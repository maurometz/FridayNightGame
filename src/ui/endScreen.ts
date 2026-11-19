// Telas do fim da partida: epílogo (só na vitória) e resumo da run (A.11 e LORE seção 14).

import { EPILOGUE_FINAL, EPILOGUE_INTRO, EPILOGUE_LINES } from '../data/acts';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../data/balance';
import { CHARACTERS, type CharacterId } from '../data/characters';
import { COLLECTIBLES } from '../data/gallery';
import { finalizarStats, STATS_LABELS } from '../data/stats';
import { YOUTH } from '../data/youth';
import type { World } from '../engine/world';
import { BOSSES } from '../data/enemies';
import { cardapio, COLOR, FONT_LABEL, FONT_UI, PAL, rect, setPalette, texto, usarFonte } from './theme';

type Ctx = CanvasRenderingContext2D;

export type EndPage = 'ep1' | 'ep2' | 'ep3' | 'stats';

/** Páginas do fim, na ordem: a vitória tem epílogo antes do resumo. */
export function endPages(world: World): EndPage[] {
  return world.status === 'victory' ? ['ep1', 'ep2', 'ep3', 'stats'] : ['stats'];
}

export function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

/** Resumo final (RunStats) a partir do mundo. */
export function resumoDaPartida(world: World): ReturnType<typeof finalizarStats> {
  return finalizarStats(world.stats, {
    durationS: world.tick / 60,
    bossesDefeated: world.bossesDefeated,
    youthRescued: world.rescued,
    collectiblesFound: world.collected,
  });
}

function nomeDoChefe(id: string): string {
  return BOSSES.find((b) => b.id === id)?.name ?? id;
}

/** `frames` = quadros desde que a página abriu (para os fades). */
export function drawEnding(ctx: Ctx, world: World, page: EndPage, frames: number): void {
  const W = LOGICAL_WIDTH;
  const H = LOGICAL_HEIGHT;
  if (page === 'stats') {
    drawStats(ctx, world);
    return;
  }
  setPalette('queda');
  rect(ctx, 0, 0, W, H, '#05060d');
  usarFonte(ctx, FONT_UI, 'center');
  if (page === 'ep1') {
    EPILOGUE_INTRO.forEach((l, i) => {
      ctx.globalAlpha = Math.min(1, Math.max(0, (frames - i * 70) / 40));
      texto(ctx, l, W / 2, H / 2 - 36 + i * 16, PAL.text);
    });
  } else if (page === 'ep2') {
    (Object.keys(EPILOGUE_LINES) as (keyof typeof EPILOGUE_LINES)[]).forEach((id, i) => {
      ctx.globalAlpha = Math.min(1, Math.max(0, (frames - i * 60) / 40));
      usarFonte(ctx, FONT_LABEL, 'center');
      texto(ctx, CHARACTERS[id as CharacterId].name.toUpperCase(), W / 2, H / 2 - 54 + i * 24, PAL.accent);
      usarFonte(ctx, FONT_UI, 'center');
      texto(ctx, EPILOGUE_LINES[id], W / 2, H / 2 - 44 + i * 24, PAL.text);
    });
  } else {
    ctx.globalAlpha = Math.min(1, frames / 90);
    usarFonte(ctx, FONT_LABEL, 'center');
    texto(ctx, EPILOGUE_FINAL.toUpperCase(), W / 2, H / 2 - 4, PAL.accent);
  }
  ctx.globalAlpha = 1;
  usarFonte(ctx, FONT_UI, 'center');
  texto(ctx, 'Enter continua', W / 2, H - 14, COLOR.hint);
  ctx.textAlign = 'left';
}

function drawStats(ctx: Ctx, world: World): void {
  const W = LOGICAL_WIDTH;
  const H = LOGICAL_HEIGHT;
  const s = resumoDaPartida(world);
  const vitoria = world.status === 'victory';
  setPalette(vitoria ? 'respiro' : 'queda');
  rect(ctx, 0, 0, W, H, 'rgba(5,6,13,0.94)');
  const w = Math.min(380, W - 12);
  const h = H - 16;
  const x = Math.round((W - w) / 2);
  const y = 8;
  cardapio(ctx, x, y, w, h);
  usarFonte(ctx, FONT_LABEL, 'center');
  texto(ctx, `— ${vitoria ? STATS_LABELS.title.toUpperCase() : 'FIM DE JOGO'} —`, x + w / 2, y + 6, vitoria ? PAL.accent : PAL.neon1);

  const linhas: [string, string][] = [
    [STATS_LABELS.durationS, formatDuration(s.durationS)],
    [STATS_LABELS.totalDamageDealt, String(s.totalDamageDealt)],
    [STATS_LABELS.totalDamageTaken, String(s.totalDamageTaken)],
    [STATS_LABELS.enemiesDefeated, String(s.enemiesDefeated)],
    [STATS_LABELS.bossesDefeated, `${s.bossesDefeated.length}`],
    [STATS_LABELS.youthRescued, `${s.youthRescued.length}/${YOUTH.length}`],
    [STATS_LABELS.eventsCompleted, String(s.eventsCompleted.length)],
    [STATS_LABELS.collectiblesFound, `${s.collectiblesFound.length}/${COLLECTIBLES.length}`],
    [STATS_LABELS.ultimatesUsed, `${s.ultimatesUsed} (+${s.saideirasUsed} Saideira)`],
  ];
  usarFonte(ctx, FONT_UI);
  let yy = y + 20;
  for (const [k, v] of linhas) {
    ctx.textAlign = 'left';
    texto(ctx, k, x + 10, yy, COLOR.hint);
    ctx.textAlign = 'right';
    texto(ctx, v, x + w - 10, yy, PAL.text);
    yy += 11;
  }
  ctx.textAlign = 'left';
  yy += 4;
  texto(ctx, STATS_LABELS.damageBySource.toUpperCase(), x + 10, yy, PAL.accent);
  yy += 12;
  const topo = s.damageBySource.slice(0, Math.max(3, Math.floor((y + h - 30 - yy) / 11)));
  const maximo = Math.max(1, ...topo.map((d) => d.damage));
  for (const d of topo) {
    texto(ctx, d.label, x + 10, yy, PAL.text);
    const bw = Math.round(((w - 160) * d.damage) / maximo);
    rect(ctx, x + 150, yy + 2, Math.max(1, bw), 5, PAL.neon2);
    ctx.textAlign = 'right';
    texto(ctx, String(d.damage), x + w - 10, yy, COLOR.hint);
    ctx.textAlign = 'left';
    yy += 11;
  }
  usarFonte(ctx, FONT_UI, 'center');
  texto(ctx, 'R recomeçar · Esc menu', x + w / 2, y + h - 12, COLOR.hint);
  ctx.textAlign = 'left';
  void nomeDoChefe;
}
