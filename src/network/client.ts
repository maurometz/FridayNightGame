// Cliente do relay: conexão WebSocket, sala e lobby. Não conhece o jogo; quem usa liga os eventos.

import type { CharacterId } from '../data/characters';
import type { WireFrame } from './lockstep';

export interface Member {
  id: number;
  name: string;
  character: CharacterId | null;
  ready: boolean;
  /** Ping até o servidor, em ms (0 = ainda não medido). */
  rtt: number;
}

export interface RoomState {
  code: string;
  /** Id deste navegador na sala. */
  you: number;
  host: number;
  phase: 'lobby' | 'playing';
  delay: number;
  /** Atraso que o modo automático usaria agora. */
  autoDelay: number;
  members: Member[];
}

export interface StartInfo {
  seed: number;
  delay: number;
  opts: { repeatInteractions: boolean; autoCutscene: boolean };
  players: { slot: number; name: string; character: CharacterId }[];
  /** Slot deste navegador. */
  you: number;
}

export interface NetClientEvents {
  room(room: RoomState): void;
  start(info: StartInfo): void;
  frames(slot: number, frames: WireFrame[]): void;
  hash(slot: number, tick: number, hash: number): void;
  left(slot: number, last: number): void;
  error(msg: string): void;
  /** A conexão caiu (ou não abriu). */
  closed(): void;
}

/** Endereço do relay: o mesmo servidor que entregou a página (`/coop`), ou `?server=ws://host:porta/coop`. */
export function relayUrl(): string {
  const custom = new URLSearchParams(window.location.search).get('server');
  if (custom) return custom;
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/coop`;
}

export class NetClient {
  room: RoomState | null = null;
  private ws: WebSocket | null = null;
  private open = false;

  constructor(private readonly ev: NetClientEvents) {}

  get connected(): boolean {
    return this.open;
  }

  /** Conecta e, quando abrir, manda a primeira mensagem (criar ou entrar na sala). */
  connect(first: object): void {
    this.close();
    let ws: WebSocket;
    try {
      ws = new WebSocket(relayUrl());
    } catch {
      this.ev.error('Não foi possível conectar ao servidor.');
      this.ev.closed();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.open = true;
      this.send(first);
    };
    ws.onmessage = (e) => {
      let m: any;
      try {
        m = JSON.parse(String(e.data));
      } catch {
        return;
      }
      switch (m.t) {
        case 'room':
          this.room = m as RoomState;
          this.ev.room(this.room);
          break;
        case 'start':
          this.ev.start(m as StartInfo);
          break;
        case 'i':
          this.ev.frames(m.s, m.f);
          break;
        case 'h':
          this.ev.hash(m.s, m.k, m.h);
          break;
        case 'left':
          this.ev.left(m.s, m.last);
          break;
        case 'host':
          if (this.room) this.room.host = m.id;
          break;
        case 'error':
          this.ev.error(String(m.msg ?? 'Erro.'));
          break;
      }
    };
    ws.onclose = () => {
      const eraNossa = this.ws === ws;
      this.open = false;
      if (eraNossa) {
        this.ws = null;
        this.room = null;
        this.ev.closed();
      }
    };
    ws.onerror = () => {};
  }

  send(msg: object): void {
    if (this.ws && this.open) this.ws.send(JSON.stringify(msg));
  }

  sendFrames(frames: WireFrame[]): void {
    this.send({ t: 'i', f: frames });
  }

  sendHash(tick: number, hash: number): void {
    this.send({ t: 'h', k: tick, h: hash });
  }

  /** Sai da sala (os outros jogadores veem a saída). */
  close(): void {
    const ws = this.ws;
    this.ws = null;
    this.open = false;
    this.room = null;
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
  }
}
