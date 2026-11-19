import { LOGICAL_HEIGHT, LOGICAL_WIDTH, TARGET_LOGICAL_HEIGHT } from '../data/balance';

/** Maior escala inteira em que a resolução lógica cabe na janela (mínimo 1). */
export function integerScale(
  windowW: number,
  windowH: number,
  logicalW: number = LOGICAL_WIDTH,
  logicalH: number = LOGICAL_HEIGHT,
): number {
  return Math.max(1, Math.floor(Math.min(windowW / logicalW, windowH / logicalH)));
}

/**
 * Tela dinâmica: o jogo ocupa a janela inteira. A escala é inteira (pixels nítidos) e escolhida
 * para a altura lógica ficar perto de 270; a largura lógica é o que couber. Mínimo de 320x180.
 */
export function fitWindow(
  windowW: number,
  windowH: number,
  targetHeight: number = TARGET_LOGICAL_HEIGHT,
): { scale: number; w: number; h: number } {
  const scale = Math.max(1, Math.round(windowH / targetHeight));
  let w = Math.floor(windowW / scale);
  let h = Math.floor(windowH / scale);
  // Janelas muito pequenas: reduz a escala até caber pelo menos 320x180.
  let s = scale;
  while (s > 1 && (w < 320 || h < 180)) {
    s--;
    w = Math.floor(windowW / s);
    h = Math.floor(windowH / s);
  }
  // Janelas ultralargas: no máximo 21:9 de campo de visão (o resto vira faixa escura, centralizada).
  w = Math.min(w, Math.round(h * (21 / 9)));
  return { scale: s, w: Math.max(1, w), h: Math.max(1, h) };
}
