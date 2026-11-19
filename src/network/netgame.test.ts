import { describe, expect, it } from 'vitest';
import type { CharacterId } from '../data/characters';
import type { PlayerInput } from '../engine/input';
import { createWorld, type World } from '../engine/world';
import { Lockstep, PARK_TICKS, type WireFrame } from './lockstep';
import { HASH_EVERY, NetGame, hashWorld } from './netgame';

interface Peer {
  me: number;
  world: World;
  ls: Lockstep;
  game: NetGame;
  hashes: Map<number, number>;
  online: boolean;
  /** Gerador de entradas do "jogador" (independente da simulação). */
  rnd: number;
}

interface Packet {
  due: number;
  to: number;
  run: () => void;
}

/** Rede em memória: entrega com latência fixa por tentativa, na ordem (como o TCP do servidor). */
class Hub {
  now = 0;
  queue: Packet[] = [];
  peers: Peer[] = [];
  lastK: number[] = [];

  constructor(readonly latency: number) {}

  post(to: number, run: () => void): void {
    this.queue.push({ due: this.now + this.latency, to, run });
  }

  deliver(): void {
    this.now++;
    const due = this.queue.filter((p) => p.due <= this.now);
    this.queue = this.queue.filter((p) => p.due > this.now);
    for (const p of due) p.run();
  }
}

function makePeers(chars: CharacterId[], delay: number, latency: number, seed = 1234): { hub: Hub; peers: Peer[] } {
  const hub = new Hub(latency);
  const peers: Peer[] = chars.map((_, me) => {
    const world = createWorld(chars, { seed, cutscenes: false });
    const hashes = new Map<number, number>();
    const peer = { me, world, hashes, online: true, rnd: 7 + me * 101 } as Peer;
    const poll = (): PlayerInput => {
      // Entrada pseudo-aleatória que muda de vez em quando (o que importa é ser diferente em cada jogador).
      peer.rnd = (Math.imul(peer.rnd, 1103515245) + 12345) >>> 0;
      const r = peer.rnd >>> 8;
      return { moveX: ((r % 5) - 2) / 2, moveY: (((r >> 3) % 5) - 2) / 2, action: (r & 64) !== 0, ultimate: (r & 1023) === 0 };
    };
    peer.ls = new Lockstep({
      slots: chars.length,
      me,
      delay,
      poll,
      send: (frames: WireFrame[]) => {
        for (const f of frames) hub.lastK[me] = Math.max(hub.lastK[me] ?? 0, f[0]);
        for (const o of hub.peers) if (o.me !== me) hub.post(o.me, () => o.ls.receive(me, frames));
      },
    });
    peer.game = new NetGame(world, peer.ls, {
      autoCut: false,
      sendHash: (tick, h) => {
        hashes.set(tick, h);
        for (const o of hub.peers) if (o.me !== me) hub.post(o.me, () => o.game.receiveHash(me, tick, h));
      },
    });
    return peer;
  });
  hub.peers = peers;
  return { hub, peers };
}

/** Roda `frames` quadros de tela: cada um faz um passo de laço por navegador. Cada jogador escolhe as cartas dele. */
function run(hub: Hub, frames: number, onFrame?: (f: number) => void): void {
  for (let f = 0; f < frames; f++) {
    onFrame?.(f);
    for (const p of hub.peers) {
      if (!p.online) continue;
      const c = p.world.choices[0];
      if (c && c.slot === p.me) p.ls.command({ c: 'pick', i: 0 });
      p.game.update();
    }
    hub.deliver();
  }
}

describe('co-op online (lockstep)', () => {
  it('três navegadores com latência veem exatamente o mesmo jogo', () => {
    const { hub, peers } = makePeers(['felipe', 'mauro', 'thaisa'], 6, 3);
    run(hub, 2600);
    for (const p of peers) expect(p.game.desyncAt).toBe(-1);
    // Todos executaram muitos passos, e os checksums dos mesmos passos são iguais.
    for (const p of peers) expect(p.ls.tick).toBeGreaterThan(2000);
    const [a, ...resto] = peers;
    expect(a!.hashes.size).toBeGreaterThan(10);
    let comuns = 0;
    for (const p of resto) {
      for (const [tick, h] of p.hashes) {
        if (!a!.hashes.has(tick)) continue;
        expect(a!.hashes.get(tick)).toBe(h);
        comuns++;
      }
    }
    expect(comuns).toBeGreaterThan(15);
    // Cada jogador mexeu o próprio personagem, e a escolha de cartas rolou.
    a!.world.players.forEach((pl, i) => expect(Math.hypot(pl.x - i * 24, pl.y)).toBeGreaterThan(5));
    expect(a!.world.players.some((q) => q.level > 1 || q.cardsTaken.length > 0)).toBe(true);
  });

  it('o jogador de cada slot só controla o próprio personagem', () => {
    const { hub, peers } = makePeers(['felipe', 'mauro'], 4, 1);
    // Só o slot 1 se mexe (sempre para a direita); o slot 0 fica parado.
    peers[0]!.ls = new Lockstep({
      slots: 2,
      me: 0,
      delay: 4,
      poll: () => ({ moveX: 0, moveY: 0, action: false, ultimate: false }),
      send: (frames) => hub.post(1, () => peers[1]!.ls.receive(0, frames)),
    });
    peers[1]!.ls = new Lockstep({
      slots: 2,
      me: 1,
      delay: 4,
      poll: () => ({ moveX: 1, moveY: 0, action: false, ultimate: false }),
      send: (frames) => hub.post(0, () => peers[0]!.ls.receive(1, frames)),
    });
    for (const p of peers) {
      const old = p.game;
      p.game = new NetGame(p.world, p.ls, { autoCut: false, sendHash: () => {} });
      void old;
    }
    run(hub, 400);
    for (const p of peers) {
      expect(p.world.players[0]!.x).toBeCloseTo(0, 5);
      expect(p.world.players[1]!.x).toBeGreaterThan(24 + 20);
    }
    expect(peers[0]!.world.players[1]!.x).toBe(peers[1]!.world.players[1]!.x);
  });

  it('cutscene avança por comando e por passo, igual para todos', () => {
    const { hub, peers } = makePeers(['felipe', 'mauro'], 6, 2);
    for (const p of peers) p.world.cutscene = { lines: [{ who: '', text: 'oi' }, { who: '', text: 'tchau' }], index: 0 };
    run(hub, 30);
    expect(peers[0]!.world.cutscene).not.toBeNull();
    expect(peers[1]!.world.cutscene!.t).toBe(peers[0]!.world.cutscene!.t);
    peers[1]!.ls.command({ c: 'cut', k: 'skip' });
    run(hub, 30);
    for (const p of peers) expect(p.world.cutscene).toBeNull();
    expect(peers[0]!.world.tick).toBe(peers[1]!.world.tick);
  });

  it('quem sai fica parado por 15 s e depois vira IA, em todos os navegadores', () => {
    const { hub, peers } = makePeers(['felipe', 'mauro', 'thaisa'], 6, 2);
    run(hub, 300);
    // O slot 2 cai: o servidor avisa os outros com o último passo que repassou.
    const saiu = peers[2]!;
    saiu.online = false;
    const last = hub.lastK[2]!;
    // Entrega o que já estava a caminho e então avisa da saída.
    run(hub, hub.latency + 1);
    for (const o of [peers[0]!, peers[1]!]) o.ls.depart(2, last);
    run(hub, 600);
    const [a, b] = [peers[0]!, peers[1]!];
    expect(a.game.aiSlots).toEqual([]); // ainda parado
    run(hub, PARK_TICKS + 300);
    expect(a.game.aiSlots).toEqual([2]);
    expect(b.game.aiSlots).toEqual([2]);
    expect(a.game.desyncAt).toBe(-1);
    expect(b.game.desyncAt).toBe(-1);
    expect(a.world.tick).toBeGreaterThan(PARK_TICKS);
    for (const [tick, h] of b.hashes) if (a.hashes.has(tick)) expect(a.hashes.get(tick)).toBe(h);
    expect(hashWorld(a.world) === hashWorld(b.world) || a.world.tick !== b.world.tick).toBe(true);
  });

  it('sem receber as entradas de um jogador, o passo não roda (espera)', () => {
    const { peers } = makePeers(['felipe', 'mauro'], 4, 1);
    const a = peers[0]!;
    // Sem entrega nenhuma: roda só os passos neutros (0 a 3) e para.
    for (let i = 0; i < 20; i++) a.game.update();
    expect(a.ls.tick).toBe(4);
    expect(a.ls.waitingFor()).toEqual([1]);
    expect(a.game.stalled).toBeGreaterThan(0);
  });

  it('o checksum detecta quando um navegador diverge', () => {
    const { hub, peers } = makePeers(['felipe', 'mauro'], 4, 1);
    run(hub, HASH_EVERY + 20);
    expect(peers[0]!.game.desyncAt).toBe(-1);
    // Adultera o jogo de um deles.
    peers[1]!.world.players[0]!.x += 5;
    run(hub, HASH_EVERY * 3);
    expect(peers[0]!.game.desyncAt >= 0 || peers[1]!.game.desyncAt >= 0).toBe(true);
  });
});
