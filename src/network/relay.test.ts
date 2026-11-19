// Teste de ponta a ponta: servidor relay de verdade + dois clientes de verdade (WebSocket), cada um com o seu mundo.
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { attachRelay } from '../../server/relay.mjs';
import type { CharacterId } from '../data/characters';
import { createWorld } from '../engine/world';
import { NetClient, type RoomState, type StartInfo } from './client';
import { Lockstep } from './lockstep';
import { NetGame } from './netgame';

let http: Server;
let port = 0;

beforeAll(async () => {
  http = createServer();
  attachRelay(http);
  await new Promise<void>((ok) => http.listen(0, '127.0.0.1', ok));
  port = (http.address() as AddressInfo).port;
  (globalThis as any).window = { location: { search: `?server=ws://127.0.0.1:${port}/coop`, protocol: 'http:', host: `127.0.0.1:${port}` } };
});
afterAll(() => {
  delete (globalThis as any).window;
  http.closeAllConnections();
  http.close();
});

const wait = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));
async function until(cond: () => boolean, ms = 5000): Promise<void> {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('timeout esperando a condição');
    await wait(5);
  }
}

interface Cli {
  client: NetClient;
  room: RoomState | null;
  start: StartInfo | null;
  errors: string[];
  game: NetGame | null;
  hashes: Map<number, number>;
  left: number[];
  closed: boolean;
}

function novoCliente(): Cli {
  const c: Cli = { client: null as unknown as NetClient, room: null, start: null, errors: [], game: null, hashes: new Map(), left: [], closed: false };
  c.client = new NetClient({
    room: (r) => (c.room = r),
    start: (info) => {
      c.start = info;
      const chars = info.players.map((p) => p.character as CharacterId);
      const world = createWorld(chars, { seed: info.seed, cutscenes: false });
      let rnd = 99 + info.you * 7;
      const ls = new Lockstep({
        slots: chars.length,
        me: info.you,
        delay: info.delay,
        poll: () => {
          rnd = (Math.imul(rnd, 1103515245) + 12345) >>> 0;
          const r = rnd >>> 8;
          return { moveX: ((r % 5) - 2) / 2, moveY: (((r >> 3) % 5) - 2) / 2, action: (r & 64) !== 0, ultimate: false };
        },
        send: (f) => c.client.sendFrames(f),
      });
      c.game = new NetGame(world, ls, {
        autoCut: false,
        sendHash: (tick, h) => {
          c.hashes.set(tick, h);
          c.client.sendHash(tick, h);
        },
      });
    },
    frames: (s, f) => c.game?.ls.receive(s, f),
    hash: (s, k, h) => c.game?.receiveHash(s, k, h),
    left: (s, last) => {
      c.left.push(s);
      c.game?.ls.depart(s, last);
    },
    error: (m) => c.errors.push(m),
    closed: () => (c.closed = true),
  });
  return c;
}

/** Faz o laço do cliente (sem esperar o relógio de 60 Hz) até a simulação chegar ao passo `ate`, com as cartas escolhidas. */
async function jogar(c: Cli, ate: number): Promise<void> {
  const t0 = Date.now();
  while (c.game!.ls.tick < ate) {
    if (Date.now() - t0 > 20000) throw new Error('timeout jogando');
    const g = c.game!;
    const ch = g.world.choices[0];
    if (ch && ch.slot === c.start!.you) g.ls.command({ c: 'pick', i: 0 });
    g.update();
    await new Promise<void>((ok) => setImmediate(ok));
  }
}

describe('relay + clientes reais', () => {
  it('sala, lobby, partida em lockstep sem dessincronia e saída de jogador', async () => {
    const a = novoCliente();
    const b = novoCliente();

    a.client.connect({ t: 'create', name: 'Ana' });
    await until(() => a.room !== null);
    const code = a.room!.code;
    expect(code).toMatch(/^[A-Z]{4}$/);
    expect(a.room!.host).toBe(a.room!.you);

    b.client.connect({ t: 'join', name: 'Beto', code: code.toLowerCase() });
    await until(() => b.room !== null && a.room!.members.length === 2);
    expect(b.room!.members.map((m) => m.name)).toEqual(['Ana', 'Beto']);
    // O servidor dá a cada um um personagem diferente.
    const [c1, c2] = a.room!.members.map((m) => m.character);
    expect(c1).not.toBe(c2);

    // Não dá para pegar o personagem de outro.
    b.client.send({ t: 'pick', character: c1 });
    await wait(60);
    expect(b.room!.members[1]!.character).toBe(c2);

    // Começar sem todos prontos é recusado.
    a.client.send({ t: 'start' });
    await until(() => a.errors.length > 0);
    expect(a.start).toBeNull();

    // Só o anfitrião inicia.
    b.client.send({ t: 'ready', ready: true });
    await until(() => a.room!.members[1]!.ready);
    b.client.send({ t: 'start' });
    await wait(60);
    expect(b.start).toBeNull();

    a.client.send({ t: 'cfg', delay: 4 });
    await until(() => a.room!.delay === 4);
    a.client.send({ t: 'start' });
    await until(() => a.start !== null && b.start !== null);
    expect(a.start!.seed).toBe(b.start!.seed);
    expect(a.start!.delay).toBe(4);
    expect([a.start!.you, b.start!.you].sort()).toEqual([0, 1]);

    // Os dois jogam juntos.
    await Promise.all([jogar(a, 1200), jogar(b, 1200)]);
    for (const g of [a.game!, b.game!]) expect(g.desyncAt).toBe(-1);
    let comuns = 0;
    for (const [tick, h] of a.hashes) {
      if (b.hashes.has(tick)) {
        expect(b.hashes.get(tick)).toBe(h);
        comuns++;
      }
    }
    expect(comuns).toBeGreaterThan(5);

    // B sai: A é avisado, e o jogo de A segue sozinho (o personagem de B fica parado).
    b.client.close();
    await until(() => a.left.length === 1);
    expect(a.left).toEqual([b.start!.you]);
    const antes = a.game!.ls.tick;
    await jogar(a, antes + 400);
    expect(a.game!.ls.tick).toBeGreaterThan(antes + 300);
    expect(a.game!.ls.isGone(b.start!.you)).toBe(true);
    a.client.close();
  }, 30000);

  it('sala inexistente, sala cheia e partida em andamento dão erro claro', async () => {
    const x = novoCliente();
    x.client.connect({ t: 'join', name: 'X', code: 'ZZZZ' });
    await until(() => x.errors.length > 0);
    expect(x.errors[0]).toMatch(/não encontrada/i);
    x.client.close();

    const host = novoCliente();
    host.client.connect({ t: 'create', name: 'H' });
    await until(() => host.room !== null);
    const code = host.room!.code;
    const outros: Cli[] = [];
    for (let i = 0; i < 4; i++) {
      const o = novoCliente();
      o.client.connect({ t: 'join', name: `J${i}`, code });
      await until(() => o.room !== null);
      outros.push(o);
    }
    const extra = novoCliente();
    extra.client.connect({ t: 'join', name: 'sobra', code });
    await until(() => extra.errors.length > 0);
    expect(extra.errors[0]).toMatch(/cheia/i);
    // Os 5 personagens são todos diferentes.
    expect(new Set(host.room!.members.map((m) => m.character)).size).toBe(5);

    for (const o of outros) o.client.send({ t: 'ready', ready: true });
    await until(() => host.room!.members.every((m) => m.ready || m.id === host.room!.host));
    host.client.send({ t: 'start' });
    await until(() => host.start !== null);
    const tarde = novoCliente();
    tarde.client.connect({ t: 'join', name: 'tarde', code });
    await until(() => tarde.errors.length > 0);
    expect(tarde.errors[0]).toMatch(/começou/i);
    for (const c of [host, ...outros, extra, tarde]) c.client.close();
  }, 20000);
});
