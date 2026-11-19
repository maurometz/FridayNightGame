import type { World } from '../engine/world';

/** Mensagem na tela: aviso de chefe, fala de personagem. Mostra a primeira da fila. */
export interface Message {
  /** Quem fala. Vazio = aviso do jogo. */
  speaker: string;
  text: string;
  /** Segundos restantes. */
  left: number;
}

export function pushMessage(world: World, speaker: string, text: string, seconds = 3.5): void {
  world.messages.push({ speaker, text, left: seconds });
  if (world.messages.length > 6) world.messages.shift();
}

export function updateMessages(world: World, dt: number): void {
  const m = world.messages[0];
  if (!m) return;
  m.left -= dt;
  if (m.left <= 0) world.messages.shift();
}
