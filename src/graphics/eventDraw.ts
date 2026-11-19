// Desenho provisório (por código) dos eventos aleatórios, minigames, colecionáveis e do feixe do RM.
// Vale até existirem as imagens (ver docs/ASSET_PROMPTS.md, seções 5.4 e 7).

import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../data/balance';
import { eventById } from '../data/randomEvents';
import { CONVIDADA_SLOT, type World } from '../engine/world';
import type { SpriteManager } from './spriteManager';

type Ctx = CanvasRenderingContext2D;

const COR_NPC: Record<string, string> = {
  lanche: '#8ab6d6',
  thiagao: '#ff9f43',
  miguel: '#ffd23f',
  valdir: '#a89a82',
  oscar: '#6a4fa0',
  jorginho: '#e05a5a',
  gabi: '#f5f5f5',
};
const COR_FRUTA: Record<string, string> = { maca: '#e0453a', laranja: '#ff9f1c', melancia: '#4caf50', uva: '#8e44ad', banana: '#ffe066' };

function nome(ctx: Ctx, t: string, x: number, y: number): void {
  ctx.font = '8px Silkscreen, monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#05060d';
  ctx.fillText(t, x + 1, y + 1);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(t, x, y);
  ctx.textAlign = 'left';
}

function boneco(ctx: Ctx, x: number, y: number, cor: string, tick: number): void {
  const bob = Math.floor(tick / 10) % 2;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x - 6, y - 1, 12, 3);
  ctx.fillStyle = cor;
  ctx.fillRect(x - 5, y - 14 + bob, 10, 11);
  ctx.fillStyle = '#e0b090';
  ctx.fillRect(x - 4, y - 22 + bob, 8, 8);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(x - 2, y - 19 + bob, 1, 2);
  ctx.fillRect(x + 1, y - 19 + bob, 1, 2);
}

/** Desenha eventos em tempo real, minigames, colecionáveis e o feixe do RM. */
/** Id do NPC (imagem em npcs/) de cada evento. */
const NPC_DO_EVENTO: Record<string, string> = { lanche: 'tiagoschneider', domingao: 'pedrao', fruitninja: 'marciano' };

/** Desenha o NPC pela imagem (2 quadros) ou, se faltar, pelo boneco provisório. */
function npc(ctx: Ctx, sprites: SpriteManager, id: string, cor: string, x: number, y: number, tick: number): void {
  const img = sprites.getNpc(NPC_DO_EVENTO[id] ?? id);
  if (!img) {
    boneco(ctx, x, y, cor, tick);
    return;
  }
  ctx.drawImage(img.quadros[Math.floor(tick / 20) % img.quadros.length]!, Math.round(x - img.w / 2), Math.round(y - img.h));
}

export function drawEventos(ctx: Ctx, world: World, camX: number, camY: number, sprites: SpriteManager): void {
  const tick = world.tick;

  for (const c of world.floorCollectibles) {
    const x = Math.round(c.x) - camX;
    const y = Math.round(c.y) - camY;
    if (x < -20 || x > LOGICAL_WIDTH + 20 || y < -20 || y > LOGICAL_HEIGHT + 20) continue;
    const b = Math.round(Math.sin(tick / 12) * 2);
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(tick / 9);
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(x, y - (sprites.getGaleria(c.id) ? 8 : 4) + b, sprites.getGaleria(c.id) ? 13 : 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    const icone = sprites.getGaleria(c.id)?.quadros[0];
    if (icone) {
      // Ícone do colecionável flutuando sobre o brilho (pés do ícone perto do ponto no chão).
      ctx.drawImage(icone, Math.round(x - icone.width / 2), Math.round(y - icone.height + 2 + b));
      continue;
    }
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(x - 3, y - 7 + b, 6, 6);
    ctx.fillStyle = '#fff3c4';
    ctx.fillRect(x - 2, y - 6 + b, 2, 2);
  }

  // Jovens resgatados: ficam por perto na fase seguinte (só aparecem se existir a imagem em npcs/).
  for (const j of world.youthNaFase) {
    const img = sprites.getNpc(j.id);
    if (!img) continue;
    const x = Math.round(j.x) - camX;
    const y = Math.round(j.y) - camY;
    if (x < -40 || x > LOGICAL_WIDTH + 40 || y < -60 || y > LOGICAL_HEIGHT + 60) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x - 7, y - 1, 14, 3);
    // Quadro A parado; o B (a ação) aparece de vez em quando.
    const quadro = img.quadros[tick % 300 > 240 ? 1 : 0] ?? img.quadros[0]!;
    ctx.drawImage(quadro, Math.round(x - quadro.width / 2), Math.round(y - quadro.height));
  }

  const ev = world.realtimeEvent;
  if (ev) {
    const x = Math.round(ev.x) - camX;
    const y = Math.round(ev.y) - camY;
    npc(ctx, sprites, ev.id, COR_NPC[ev.id] ?? '#888', x, y, tick);
    nome(ctx, eventById(ev.id).npc.split(' (')[0]!, x, y - 26);
  }

  const mg = world.minigame;
  if (mg) {
    const cx = Math.round(mg.cx) - camX;
    const cy = Math.round(mg.cy) - camY;
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#7ad7ff';
    ctx.beginPath();
    ctx.arc(cx, cy, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    for (const it of mg.items) {
      const x = Math.round(it.x) - camX;
      const y = Math.round(it.y) - camY;
      if (it.kind === 'zona') {
        const certa = false;
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = certa ? '#4caf50' : ['#ff5a5a', '#5ab0ff', '#ffd23f'][it.tag % 3]!;
        ctx.fillRect(x - 32, y - 20, 64, 40);
        ctx.globalAlpha = 1;
        nome(ctx, `${'ABC'[it.tag]}: ${mg.question!.options[it.tag]}`, x, y + 3);
      } else if (it.kind === 'bexiga') {
        ctx.fillStyle = '#7ad7ff';
        ctx.beginPath();
        ctx.ellipse(x, y - 6, 7, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 3, y - 11, 2, 3);
      } else {
        ctx.fillStyle = COR_FRUTA[it.kind] ?? '#fff';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // O apresentador do minigame fica no alto da arena (Pedrão e Marciano).
    if (mg.id !== 'bexigas') npc(ctx, sprites, mg.id, mg.id === 'domingao' ? '#d9a441' : '#6a8f3a', cx, cy - 70, tick);
    // Faixa de título e tempo no alto da tela.
    const titulo = eventById(mg.id).name.toUpperCase();
    ctx.fillStyle = 'rgba(5,6,13,0.8)';
    ctx.fillRect(LOGICAL_WIDTH / 2 - 110, 46, 220, 24);
    nome(ctx, titulo, LOGICAL_WIDTH / 2, 56);
    nome(ctx, `${Math.max(0, Math.ceil(mg.duration - mg.t))} s · pontos: ${mg.score}${mg.question ? ' · ' + mg.question.text : ''}`, LOGICAL_WIDTH / 2, 67);
  }

  // Feixe do RM: liga o chefe ao personagem encantado.
  const t = world.trance;
  const rm = world.enemies.active.find((e) => e.alive && e.def.id === 'rm');
  const alvo = t ? (t.slot === CONVIDADA_SLOT ? (world.convidada ?? undefined) : world.players[t.slot]) : undefined;
  if (t && rm && alvo) {
    ctx.strokeStyle = t.caught ? 'rgba(200,120,255,0.8)' : 'rgba(255,160,255,0.5)';
    ctx.lineWidth = t.caught ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(Math.round(rm.x) - camX, Math.round(rm.y) - camY - 6);
    ctx.lineTo(Math.round(alvo.x) - camX, Math.round(alvo.y) - camY - 10);
    ctx.stroke();
    if (t.caught) {
      const w = 40;
      const x = Math.round(alvo.x) - camX - w / 2;
      const y = Math.round(alvo.y) - camY - 32;
      ctx.fillStyle = 'rgba(5,6,13,0.8)';
      ctx.fillRect(x - 1, y - 1, w + 2, 6);
      ctx.fillStyle = '#c78bff';
      ctx.fillRect(x, y, Math.round((w * t.meter) / 100), 4);
    }
  }
}
