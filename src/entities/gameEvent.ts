import type { EventId } from '../data/randomEvents';

/** Um item que anda na tela durante um minigame (bexiga, fruta, zona de resposta). */
export interface MiniItem {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: string;
  alive: boolean;
  /** Livre para cada minigame (índice da resposta, lado da bexiga...). */
  tag: number;
}

/** Minigame em andamento: o combate e o spawn ficam pausados enquanto ele roda. */
export interface Minigame {
  id: 'bexigas' | 'domingao' | 'fruitninja';
  /** Segundos desde o início e duração total. */
  t: number;
  duration: number;
  score: number;
  /** Acumulador para criar novos itens. */
  acc: number;
  items: MiniItem[];
  /** Domingão do Pedrão: pergunta, opções e a certa. */
  question?: { text: string; options: string[]; correct: number };
  /** Centro da arena do minigame (em volta do primeiro jogador no início). */
  cx: number;
  cy: number;
  /** Já pagou a recompensa. */
  done: boolean;
}

/** Evento em tempo real: um NPC que cruza o mapa ou aparece e some. */
export interface RealtimeEvent {
  id: EventId;
  /** Segundos desde que apareceu e quanto fica em cena. */
  t: number;
  duration: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Já aplicou o efeito. */
  applied: boolean;
  /** Livre (Miguel: vida restante do goblin, Thiagão: se foi buff). */
  tag: number;
}

/** Colecionável no chão (Galeria do Mauro). */
export interface FloorCollectible {
  id: string;
  x: number;
  y: number;
}
