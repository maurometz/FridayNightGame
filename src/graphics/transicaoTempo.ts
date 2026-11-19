// Transição da Igreja Unidos para a Arena do Tempo: o grupo é sugado por um vórtice de relógios e páginas de
// calendário, a tela vai a um branco dourado e a arena aparece do outro lado. A troca de fase acontece no
// meio (tela branca); antes e depois, o mundo gira e encolhe (e desencolhe) em torno do centro.

import { TRANSICAO_MEIO, TRANSICAO_QUADROS } from '../combat/run';

type Ctx = CanvasRenderingContext2D;

export interface FatorTransicao {
  /** Rotação do mundo, em radianos. */
  rot: number;
  /** Escala do mundo (1 = normal). */
  escala: number;
  /** 0 a 1: quanto o vórtice está forte (pico no meio). */
  k: number;
  /** 0 a 1: opacidade do branco dourado (pico no meio). */
  brancura: number;
}

/** Valores da animação no quadro `t` (0 a TRANSICAO_QUADROS). Sobe até o pico no meio e desce até zero no fim. */
export function fatorTransicao(t: number): FatorTransicao {
  const u = Math.min(1, Math.max(0, t / TRANSICAO_QUADROS)) * 2 - 1;
  const k = 1 - Math.abs(u);
  const brancura = Math.min(1, Math.max(0, (k - 0.55) / 0.45)) ** 2;
  return { rot: k * k * 2.6, escala: 1 - 0.7 * k * k, k, brancura };
}

/** Desenha o vórtice (anéis de relógio, ponteiros, páginas) e o branco dourado por cima do mundo. */
export function drawVortice(ctx: Ctx, t: number, W: number, H: number): void {
  const f = fatorTransicao(t);
  const cx = W / 2;
  const cy = H / 2;
  const R = Math.hypot(W, H) / 2;
  const entrando = t < TRANSICAO_MEIO;

  // Anéis de relógio que se fecham para o centro (na entrada) e se abrem de volta (na saída), com marcas girando.
  for (let i = 0; i < 6; i++) {
    const fase = (t * 0.018 + i / 6) % 1;
    const r = R * (entrando ? 1 - fase : fase);
    ctx.globalAlpha = f.k * 0.85 * (1 - fase * 0.5);
    ctx.strokeStyle = '#e8c35a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(1, r), 0, Math.PI * 2);
    ctx.stroke();
    const giro = t * 0.03 * (i % 2 === 0 ? 1 : -1);
    for (let m = 0; m < 12; m++) {
      const a = giro + (m / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.lineTo(cx + Math.cos(a) * (r - 6), cy + Math.sin(a) * (r - 6));
      ctx.stroke();
    }
  }

  // Ponteiros gigantes girando no centro, cada vez mais rápido.
  ctx.lineCap = 'round';
  for (const [comp, vel, grossura] of [[0.3, 0.02, 4], [0.46, 0.11, 3]] as const) {
    const a = t * vel * (1 + f.k * 2) - Math.PI / 2;
    ctx.globalAlpha = f.k * 0.9;
    ctx.strokeStyle = '#fff2c4';
    ctx.lineWidth = grossura;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * R * comp, cy + Math.sin(a) * R * comp);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';

  // Páginas de calendário e poeira dourada espiralando.
  for (let j = 0; j < 40; j++) {
    const a = j * 2.4 + t * 0.045 * (1 + (j % 3) * 0.3);
    const raio = R * (0.95 - 0.8 * f.k) * (0.45 + (j % 7) / 9);
    ctx.globalAlpha = f.k;
    ctx.fillStyle = j % 3 === 0 ? '#e8e2c8' : '#e8c35a';
    ctx.save();
    ctx.translate(cx + Math.cos(a) * raio, cy + Math.sin(a) * raio);
    ctx.rotate(a * 2);
    ctx.fillRect(-2, -3, j % 3 === 0 ? 5 : 3, j % 3 === 0 ? 6 : 3);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // Branco dourado: pico no meio, é quando a arena toma o lugar da igreja.
  if (f.brancura > 0) {
    ctx.fillStyle = `rgba(255,244,214,${f.brancura})`;
    ctx.fillRect(0, 0, W, H);
  }
  // Vinheta escura nas pontas da animação.
  const v = ctx.createRadialGradient(cx, cy, R * 0.25, cx, cy, R);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, `rgba(5,6,13,${0.55 * f.k})`);
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}
