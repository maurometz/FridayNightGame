// Desenhos provisórios (por código) dos veículos e de duas armas na mão. Valem até existir uma imagem PNG
// em public/assets/sprites/veiculos/<id>.png (veículos) ou armas/<id>.png (armas), que passa a ter prioridade.
// Todos os desenhos olham para a direita; a origem (0, 0) fica no chão, no centro. Y negativo é para cima.

import type { VehicleId } from '../data/vehicles';

/** Como o jogador aparece em cada veículo. */
export interface VehiclePose {
  /** Quantos pixels o personagem sobe (altura do assento). */
  assento: number;
  /** O veículo é desenhado por cima do personagem (carro: cobre as pernas). */
  frente: boolean;
  /** O veículo substitui o personagem (armadura). */
  cobre: boolean;
}

export const VEHICLE_POSE: Readonly<Record<VehicleId, VehiclePose>> = {
  cavalo: { assento: 18, frente: false, cobre: false },
  carroca: { assento: 13, frente: false, cobre: false },
  c3: { assento: 8, frente: true, cobre: false },
  skate: { assento: 3, frente: false, cobre: false },
  armadura: { assento: 0, frente: false, cobre: true },
};

type Ctx = CanvasRenderingContext2D;

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, cor: string): void {
  ctx.fillStyle = cor;
  ctx.fillRect(x, y, w, h);
}

function roda(ctx: Ctx, cx: number, cy: number, r: number, giro: number, cor: string, aro: string): void {
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = aro;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  // Raio que gira, para a roda parecer andar.
  ctx.strokeStyle = cor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(giro) * r * 0.55, cy - Math.sin(giro) * r * 0.55);
  ctx.lineTo(cx + Math.cos(giro) * r * 0.55, cy + Math.sin(giro) * r * 0.55);
  ctx.stroke();
}

/** Desenha o veículo (olhando para a direita) com os pés no (0, 0). `andando` anima pernas e rodas. */
export function desenharVeiculo(ctx: Ctx, id: VehicleId, tick: number, andando: boolean): void {
  const giro = andando ? tick / 2 : 0;
  switch (id) {
    case 'cavalo': {
      const a = andando ? Math.round(Math.sin(tick / 3) * 2) : 0;
      const perna = '#5a3a1e';
      for (const [x, d] of [[-11, a], [-7, -a], [4, -a], [8, a]] as const) {
        rect(ctx, x + d, -8, 3, 8, perna);
        rect(ctx, x + d, -1, 3, 1, '#1f1209');
      }
      rect(ctx, -13, -17, 23, 9, '#8b5a2b');
      rect(ctx, -13, -10, 23, 2, '#6e4521');
      rect(ctx, -11, -17, 17, 2, '#a87440');
      rect(ctx, 7, -23, 5, 9, '#8b5a2b'); // pescoço
      rect(ctx, 10, -24, 7, 5, '#8b5a2b'); // cabeça
      rect(ctx, 15, -22, 3, 3, '#6e4521'); // focinho
      rect(ctx, 13, -23, 1, 1, '#ffffff'); // olho
      rect(ctx, 10, -26, 2, 2, perna); // orelha
      rect(ctx, 6, -24, 2, 10, '#2b1a10'); // crina
      rect(ctx, -16, -16, 3, 9, '#2b1a10'); // rabo
      rect(ctx, -5, -19, 8, 3, '#c0392b'); // sela
      rect(ctx, -5, -17, 8, 1, '#e6c24a');
      break;
    }
    case 'carroca': {
      rect(ctx, 9, -9, 9, 2, '#6b4423'); // varal
      rect(ctx, -13, -14, 22, 7, '#a0662f');
      rect(ctx, -13, -11, 22, 1, '#7d4d20');
      rect(ctx, -14, -15, 24, 2, '#6b4423');
      rect(ctx, -10, -18, 14, 3, '#e6c24a'); // feno
      rect(ctx, 9, -12, 2, 3, '#ffd166'); // lanterna
      roda(ctx, -8, -4, 5, giro, '#3b2412', '#c9a063');
      roda(ctx, 4, -4, 5, giro, '#3b2412', '#c9a063');
      break;
    }
    case 'c3': {
      rect(ctx, -15, -10, 30, 6, '#d62828'); // carroceria
      rect(ctx, 10, -12, 5, 3, '#d62828'); // capô
      rect(ctx, -8, -17, 17, 7, '#d62828'); // cabine
      rect(ctx, -8, -17, 17, 1, '#a11d1d');
      ctx.fillStyle = 'rgba(168,218,220,0.55)'; // vidros (dá para ver o motorista)
      ctx.fillRect(-6, -16, 6, 4);
      ctx.fillRect(1, -16, 6, 4);
      rect(ctx, -15, -6, 2, 2, '#bbbbbb');
      rect(ctx, 14, -6, 2, 2, '#bbbbbb');
      rect(ctx, 14, -9, 2, 2, '#ffe066'); // farol
      rect(ctx, -16, -9, 1, 2, '#ff4d4d'); // lanterna
      rect(ctx, 11, -8, 3, 1, '#ffffff'); // chevron
      rect(ctx, -12, -5, 24, 1, '#111111');
      roda(ctx, -8, -3, 4, giro, '#1d1d1d', '#cccccc');
      roda(ctx, 8, -3, 4, giro, '#1d1d1d', '#cccccc');
      break;
    }
    case 'skate': {
      rect(ctx, -9, -3, 18, 2, '#ffb703');
      rect(ctx, -10, -4, 2, 2, '#ffb703');
      rect(ctx, 8, -4, 2, 2, '#ffb703');
      rect(ctx, -7, -3, 14, 1, '#2b2b2b');
      rect(ctx, -6, -1, 3, 2, '#222222');
      rect(ctx, 3, -1, 3, 2, '#222222');
      break;
    }
    case 'armadura': {
      const jato = andando && tick % 4 < 2 ? 3 : 2;
      rect(ctx, -5, -12, 4, 12, '#c1121f');
      rect(ctx, 1, -12, 4, 12, '#c1121f');
      rect(ctx, -5, -3, 4, 3, '#e6c24a');
      rect(ctx, 1, -3, 4, 3, '#e6c24a');
      rect(ctx, -7, -26, 14, 14, '#c1121f');
      rect(ctx, -5, -24, 10, 5, '#e6c24a');
      rect(ctx, -1, -23, 3, 3, '#7ad7ff'); // reator
      rect(ctx, -10, -26, 3, 12, '#c1121f');
      rect(ctx, 7, -26, 3, 12, '#c1121f');
      rect(ctx, -10, -15, 3, 3, '#e6c24a');
      rect(ctx, 7, -15, 3, 3, '#e6c24a');
      rect(ctx, 8, -14, 1, 1, '#7ad7ff');
      rect(ctx, -4, -34, 8, 8, '#c1121f');
      rect(ctx, -3, -32, 6, 5, '#e6c24a');
      rect(ctx, -2, -31, 2, 1, '#ffffff');
      rect(ctx, 1, -31, 2, 1, '#ffffff');
      if (andando) {
        rect(ctx, -4, 0, 3, jato, '#7ad7ff');
        rect(ctx, 1, 0, 3, jato, '#7ad7ff');
      }
      break;
    }
  }
}

/** Flauta provisória: tubo prateado com furinhos, apontando para a direita, centrado em (0, 0). */
export function desenharFlauta(ctx: Ctx): void {
  rect(ctx, -9, -1, 18, 2, '#c9d6df');
  rect(ctx, -9, -1, 18, 1, '#eef4f8');
  rect(ctx, -9, -2, 3, 4, '#8fa3b0');
  for (const x of [-2, 1, 4, 7]) rect(ctx, x, -1, 1, 1, '#4a5a66');
}

/** Megafone provisório: cone branco e vermelho com o cabo, boca para a direita, centrado em (0, 0). */
export function desenharMegafone(ctx: Ctx): void {
  rect(ctx, -6, -2, 5, 4, '#2b2b34'); // bocal
  rect(ctx, -1, -3, 4, 6, '#e63946');
  rect(ctx, 3, -4, 4, 8, '#f1f1f1');
  rect(ctx, 7, -5, 3, 10, '#e63946');
  rect(ctx, 9, -4, 1, 8, '#ffd9dc');
  rect(ctx, -3, 2, 2, 4, '#2b2b34'); // cabo
}
