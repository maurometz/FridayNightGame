// Relay do co-op online. O servidor NÃO roda o jogo: ele só guarda as salas (código de 4 letras), o lobby
// e repassa as mensagens entre os navegadores. Cada navegador simula a partida inteira (lockstep).
//
// Protocolo (JSON). Cliente -> servidor:
//   {t:'create', name}                 cria uma sala
//   {t:'join', code, name}             entra numa sala
//   {t:'pick', character}              escolhe o personagem (único na sala)
//   {t:'ready', ready}                 marca "pronto"
//   {t:'cfg', delay}                   (anfitrião) atraso de entrada em passos: 4, 6 ou 10
//   {t:'start'}                        (anfitrião) começa a partida
//   {t:'restart'}                      (anfitrião) nova partida com os mesmos jogadores, depois do fim
//   {t:'i', f:[[tick,x,y,bits,cmds?]]} entradas dos passos (repassadas aos outros)
//   {t:'h', k, h}                      checksum da simulação (repassado aos outros)
// Servidor -> cliente: room, start, i, h, left, host, error.

import { WebSocketServer } from 'ws';
import { randomInt } from 'node:crypto';

export const MAX_PLAYERS = 5;
export const CHARACTERS = ['felipe', 'mauro', 'melissa', 'thaisa', 'thayssa'];
export const DELAYS = [4, 6, 10];
const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';

const clean = (s) => String(s ?? '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 14) || 'Jogador';
const num = (n) => typeof n === 'number' && Number.isFinite(n);

/**
 * Liga o relay a um servidor HTTP já existente (Vite ou o servidor de produção).
 * Só trata o caminho `path`; qualquer outro upgrade (como o HMR do Vite) fica com quem o ouvia.
 */
export function attachRelay(httpServer, { path = '/coop', log = () => {} } = {}) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  /** @type {Map<string, any>} */
  const rooms = new Map();

  httpServer.on('upgrade', (req, socket, head) => {
    let pathname = '';
    try {
      pathname = new URL(req.url ?? '', 'http://localhost').pathname;
    } catch {
      return;
    }
    if (pathname !== path) return;
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  const send = (m, obj) => {
    if (m.ws.readyState === 1) m.ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj));
  };
  const everyone = (room, obj, except = null) => {
    const raw = JSON.stringify(obj);
    for (const m of room.members) if (m !== except) send(m, raw);
  };

  const roomView = (room, you) => ({
    t: 'room',
    code: room.code,
    you: you.id,
    host: room.hostId,
    phase: room.phase,
    delay: room.delay,
    members: room.members.map((m) => ({ id: m.id, name: m.name, character: m.character, ready: m.ready })),
  });
  const broadcastRoom = (room) => {
    for (const m of room.members) send(m, roomView(room, m));
  };

  const newCode = () => {
    for (let i = 0; i < 50; i++) {
      let c = '';
      for (let k = 0; k < 4; k++) c += CODE_LETTERS[randomInt(CODE_LETTERS.length)];
      if (!rooms.has(c)) return c;
    }
    return null;
  };

  const startGame = (room) => {
    room.members.sort((a, b) => (a.slot ?? 99) - (b.slot ?? 99));
    room.members.forEach((m, i) => {
      m.slot = i;
      m.lastK = room.delay - 1;
    });
    room.phase = 'playing';
    const seed = randomInt(1, 0xffffffff);
    const players = room.members.map((m) => ({ slot: m.slot, name: m.name, character: m.character }));
    for (const m of room.members) {
      send(m, { t: 'start', seed, delay: room.delay, opts: room.opts, players, you: m.slot });
    }
    log(`sala ${room.code}: partida com ${players.length} jogador(es)`);
  };

  const leave = (m) => {
    const room = m.room;
    if (!room) return;
    m.room = null;
    const i = room.members.indexOf(m);
    if (i < 0) return;
    room.members.splice(i, 1);
    if (room.members.length === 0) {
      rooms.delete(room.code);
      log(`sala ${room.code}: fechada`);
      return;
    }
    if (room.hostId === m.id) room.hostId = room.members[0].id;
    if (room.phase === 'playing') {
      everyone(room, { t: 'left', s: m.slot, last: Math.max(m.lastK ?? 0, room.delay - 1) });
      everyone(room, { t: 'host', id: room.hostId });
    }
    broadcastRoom(room);
  };

  let nextId = 1;
  wss.on('connection', (ws) => {
    const m = { ws, id: nextId++, name: 'Jogador', room: null, character: null, ready: false, slot: null, lastK: 0 };
    ws.on('close', () => leave(m));
    ws.on('error', () => {});
    ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (!msg || typeof msg.t !== 'string') return;
      const room = m.room;

      switch (msg.t) {
        case 'create':
        case 'join': {
          if (room) return;
          m.name = clean(msg.name);
          let target;
          if (msg.t === 'create') {
            const code = newCode();
            if (!code) return send(m, { t: 'error', msg: 'Não foi possível criar a sala. Tente de novo.' });
            target = { code, members: [], hostId: m.id, phase: 'lobby', delay: 6, opts: { repeatInteractions: false, autoCutscene: false } };
            rooms.set(code, target);
          } else {
            target = rooms.get(String(msg.code ?? '').toUpperCase().trim());
            if (!target) return send(m, { t: 'error', msg: 'Sala não encontrada. Confira o código.' });
            if (target.phase !== 'lobby') return send(m, { t: 'error', msg: 'Essa partida já começou.' });
            if (target.members.length >= MAX_PLAYERS) return send(m, { t: 'error', msg: 'Sala cheia (máximo de 5 jogadores).' });
          }
          m.room = target;
          m.ready = false;
          m.character = CHARACTERS.find((c) => !target.members.some((o) => o.character === c)) ?? null;
          m.slot = target.members.length;
          target.members.push(m);
          if (msg.t === 'create' && msg.opts && typeof msg.opts === 'object') {
            target.opts = { repeatInteractions: !!msg.opts.repeatInteractions, autoCutscene: !!msg.opts.autoCutscene };
          }
          broadcastRoom(target);
          log(`sala ${target.code}: ${m.name} entrou (${target.members.length})`);
          return;
        }
        case 'pick': {
          if (!room || room.phase !== 'lobby') return;
          if (!CHARACTERS.includes(msg.character)) return;
          if (room.members.some((o) => o !== m && o.character === msg.character)) return;
          m.character = msg.character;
          m.ready = false;
          return broadcastRoom(room);
        }
        case 'ready': {
          if (!room || room.phase !== 'lobby') return;
          m.ready = !!msg.ready && m.character !== null;
          return broadcastRoom(room);
        }
        case 'cfg': {
          if (!room || room.phase !== 'lobby' || room.hostId !== m.id) return;
          if (DELAYS.includes(msg.delay)) room.delay = msg.delay;
          if (msg.opts && typeof msg.opts === 'object') {
            room.opts = { repeatInteractions: !!msg.opts.repeatInteractions, autoCutscene: !!msg.opts.autoCutscene };
          }
          return broadcastRoom(room);
        }
        case 'start': {
          if (!room || room.phase !== 'lobby' || room.hostId !== m.id) return;
          if (room.members.some((o) => o.character === null || (o !== m && !o.ready))) {
            return send(m, { t: 'error', msg: 'Todos precisam escolher um personagem e marcar "Pronto".' });
          }
          return startGame(room);
        }
        case 'restart': {
          if (!room || room.phase !== 'playing' || room.hostId !== m.id) return;
          return startGame(room);
        }
        case 'i': {
          if (!room || room.phase !== 'playing' || !Array.isArray(msg.f) || msg.f.length > 64) return;
          for (const f of msg.f) {
            if (!Array.isArray(f) || !num(f[0]) || !num(f[1]) || !num(f[2]) || !num(f[3])) return;
            if (f[0] > m.lastK) m.lastK = f[0];
          }
          return everyone(room, { t: 'i', s: m.slot, f: msg.f }, m);
        }
        case 'h': {
          if (!room || room.phase !== 'playing' || !num(msg.k) || !num(msg.h)) return;
          return everyone(room, { t: 'h', s: m.slot, k: msg.k, h: msg.h }, m);
        }
      }
    });
  });

  // Derruba conexões mortas e mantém túneis (ngrok, cloudflared) acordados.
  const timer = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 20000);
  timer.unref?.();
  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => (ws.isAlive = true));
  });

  return { wss, rooms, close: () => clearInterval(timer) };
}
