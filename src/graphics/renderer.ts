import { posicaoDoLivro } from '../characters/mauro';
import { posicaoDaFatia } from '../combat/sharedWeapons';
import { PIZZA } from '../data/sharedWeapons';
import { posicaoDoVioloncelo } from '../characters/thaisa';
import { COR_EUFORIA, COR_SOBRECARGA } from '../characters/thayssa';
import { raioDaAura } from '../characters/thayssaState';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH, PLAYER_INVULN_S, setLogicalSize, TILE } from '../data/balance';
import { fitWindow } from '../engine/scale';
import { drawMenu } from '../ui/menuView';
import type { Menu } from '../ui/menu';
import { CHARACTERS } from '../data/characters';
import type { DeviceId, KeyMap } from '../data/controls';
import { CONVIDADA_SLOT } from '../engine/world';
import type { Player } from '../entities/player';
import { SPRITE_DEFS } from './characterSprites';
import { ENEMY_SPRITE_DEFS } from './enemySprites';
import type { Effect } from '../entities/effect';
import { SpriteManager, type Faixa } from './spriteManager';
import { desenharFlauta, desenharMegafone, desenharVeiculo, VEHICLE_POSE } from './vehicleSprites';
import { VEHICLES } from '../data/vehicles';
import { COLOR, FONT_CRIT, FONT_UI, medidor, PAL, textoContornado } from '../ui/theme';
import { REVIVE_TIME_S } from '../data/revive';
import { FRAME_ORDER, type FrameName, type SpriteId } from './spriteFormat';
import { ORBITA_BOOKS } from '../data/mauro';
import type { Camera } from '../engine/camera';
import type { World } from '../engine/world';
import { PHASES, tuningDaFase } from '../data/acts';
import { SALSICHAS_CFG } from '../data/bosses';
import { salsichaoFundido } from '../combat/salsichas';
import { SAIDEIRA_DURATION_S, ULT } from '../data/synergy';
import { posicaoDoDisco } from '../synergy/ultimates';
import { drawAdvice, drawChoice, drawHud, wrapText, type DebugInfo } from '../ui/hud';
import { drawEnding, endPages } from '../ui/endScreen';
import { drawCutscene } from '../ui/cutsceneView';
import { drawVortice, fatorTransicao } from './transicaoTempo';
import { zonaSegura } from '../combat/safeRoom';
import { drawEventos } from './eventDraw';
import { quadroDoInimigo } from './enemyFrames';

/** Cores do piso por ato: [ladrilho A, ladrilho B, linha de emenda]. */
const FLOOR_COLORS: Record<string, [string, string, string]> = {
  madeira: ['#6a4a2f', '#654629', '#4a3220'],
  asfalto: ['#2b2d33', '#2f3238', '#25272c'],
  pedra: ['#4a4756', '#524f60', '#3d3a48'],
};
const WALL_COLORS: readonly string[] = ['#8a4b4b', '#4b6a8a', '#8b6b4a'];

/** Margem fora da tela dentro da qual ainda desenhamos (evita pop-in nas bordas). */
const CULL_MARGIN = 16;

/** Pose da arma na mão: deslocamento a partir dos pés (x para a frente), inclinação em rad (parado e atacando). */
interface HeldPose {
  arma: string;
  x: number;
  y: number;
  parado: number;
  ataque: number;
  /** Avanço extra, para a frente, ao atacar. */
  ataqueX: number;
  /** Desenho por código usado quando ainda não há imagem da arma. */
  provisoria?: 'flauta' | 'megafone';
}

const HELD_FELIPE: Partial<Record<string, HeldPose>> = {
  violao: { arma: 'violao', x: 8, y: -12, parado: -0.3, ataque: -0.6, ataqueX: 3 },
  bateria: { arma: 'bateria', x: 9, y: -9, parado: 0, ataque: 0, ataqueX: 2 },
  flauta: { arma: 'flauta', x: 9, y: -14, parado: -0.2, ataque: -0.5, ataqueX: 3, provisoria: 'flauta' },
  kazoo: { arma: 'kazoo', x: 9, y: -14, parado: -0.2, ataque: -0.5, ataqueX: 3 },
};

const HELD: Partial<Record<string, HeldPose>> = {
  mauro: { arma: 'tomo', x: -10, y: -22, parado: 0, ataque: 0.15, ataqueX: 0 },
  melissa: { arma: 'florete', x: 14, y: -13, parado: 0.1, ataque: -0.05, ataqueX: 8 },
  thayssa: { arma: 'megafone', x: 9, y: -13, parado: -0.5, ataque: -0.9, ataqueX: 2, provisoria: 'megafone' },
};

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  readonly sprites = new SpriteManager();
  private readonly anim = new Map<Player, { lastCd: number; attackUntil: number }>();

  constructor(private readonly canvas: HTMLCanvasElement) {
    canvas.width = LOGICAL_WIDTH;
    canvas.height = LOGICAL_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponível neste navegador.');
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
  }

  /** Ajusta o jogo ao tamanho da janela: resolução lógica dinâmica e escala inteira via CSS. */
  fitToWindow(windowW: number, windowH: number, targetHeight?: number): void {
    if (targetHeight !== undefined) this.targetHeight = targetHeight;
    const { scale, w, h } = fitWindow(windowW, windowH, this.targetHeight);
    setLogicalSize(w, h);
    // O canvas tem a resolução REAL da tela (lógica x escala); o jogo continua desenhando em coordenadas
    // lógicas por causa do setTransform. Assim o texto e as formas saem nítidos, em vez de ampliados e borrados.
    const dpr = Math.max(1, window.devicePixelRatio || 1); // zoom do Windows (125%, 150%...)
    this.scale = scale * dpr;
    this.canvas.width = Math.round(w * this.scale);
    this.canvas.height = Math.round(h * this.scale);
    this.canvas.style.width = `${w * scale}px`;
    this.canvas.style.height = `${h * scale}px`;
    this.canvas.dataset.escala = String(this.scale);
    this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    this.ctx.imageSmoothingEnabled = false; // redimensionar o canvas zera essa configuração
  }

  /** Escala inteira entre pixel lógico e pixel da tela. */
  private scale = 1;

  render(world: World, cam: Camera, alpha: number, debug: DebugInfo | null): void {
    const ctx = this.ctx;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const camX = Math.round(cam.x);
    const camY = Math.round(cam.y);

    this.tranceSlot = world.trance?.caught ? world.trance.slot : -1;
    // Transição para a Arena do Tempo: o mundo gira e encolhe em torno do centro (e volta do outro lado).
    const ftr = world.transicao ? fatorTransicao(world.transicao.t) : null;
    if (ftr) {
      ctx.fillStyle = '#05060d';
      ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      ctx.save();
      ctx.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
      ctx.rotate(ftr.rot);
      ctx.scale(ftr.escala, ftr.escala);
      ctx.translate(-LOGICAL_WIDTH / 2, -LOGICAL_HEIGHT / 2);
    }
    this.drawFloor(world, camX, camY);
    this.drawScenery(world, camX, camY);
    this.drawAuras(world, camX, camY);
    this.drawHazards(world, camX, camY);
    this.drawGems(world, camX, camY);
    this.drawEnemies(world, camX, camY);
    this.drawFusao(world, camX, camY);
    this.drawLucas(world, camX, camY);

    for (const p of world.players) {
      const x = Math.round(p.prevX + (p.x - p.prevX) * alpha) - camX;
      const y = Math.round(p.prevY + (p.y - p.prevY) * alpha) - camY;
      const dead = p.hp <= 0;
      ctx.globalAlpha = dead ? 0.3 : p.invuln > 0 ? (this.reduceFlash ? 0.65 : Math.floor(world.tick / 3) % 2 === 0 ? 0.45 : 1) : 1;
      this.drawPlayer(p, x, y, world.tick);
      ctx.globalAlpha = 1;
      if ((p.slot > 0 || this.coop) && !dead) this.drawAllyName(p, x, y);
      if (dead) this.drawFallen(world, p, x, y);
    }
    // Melissa convidada da luta do RM (não é jogadora): desenhada como as outras, com o nome acima.
    const conv = world.convidada;
    if (conv) {
      const x = Math.round(conv.prevX + (conv.x - conv.prevX) * alpha) - camX;
      const y = Math.round(conv.prevY + (conv.y - conv.prevY) * alpha) - camY;
      this.drawPlayer(conv, x, y, world.tick);
      this.drawAllyName(conv, x, y, ' (CONVIDADA)');
    }

    this.drawFoods(world, camX, camY);
    this.drawVehiclePickups(world, camX, camY);
    this.drawExtraWeapons(world, camX, camY);
    this.drawProjectiles(world, camX, camY);
    this.drawBooks(world, camX, camY);
    this.drawCellos(world, camX, camY);
    this.drawHostiles(world, camX, camY);
    drawEventos(ctx, world, camX, camY, this.sprites);
    this.drawEffects(world, camX, camY);
    this.drawDamageNumbers(world, camX, camY);
    this.drawSynergy(world, camX, camY);
    this.drawDialogue(world, camX, camY);
    this.drawMood(world);
    this.drawSaideira(world, camX, camY);
    if (ftr && world.transicao) {
      ctx.restore();
      drawVortice(ctx, world.transicao.t, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    }

    // Na cutscene e na transição o HUD some; na cutscene o jogo fica parado e escurecido atrás.
    if (!world.cutscene && !world.transicao) drawHud(ctx, world, debug, this.coop, this.viewSlot);
    const choice = world.choices[0];
    if (world.cutscene) drawCutscene(ctx, world.cutscene, (id) => (CHARACTERS as Record<string, { name: string } | undefined>)[id]?.name ?? (id === 'lucas' ? 'Lucas' : id), (id) => this.sprites.getRetrato(id), this.autoCutscene);
    else if (world.advice) drawAdvice(ctx, world.advice.options);
    else if (choice) drawChoice(ctx, choice, world.players[choice.slot], this.coop, this.coop ? (this.devices[choice.slot] ?? 'teclado1') : 'teclado1', this.keymaps, this.online && choice.slot !== this.viewSlot);
    else if (world.status !== 'playing') {
      const paginas = endPages(world);
      drawEnding(ctx, world, paginas[Math.min(this.endPage, paginas.length - 1)]!, this.endFrames++);
    }
  }

  /**
   * Paleta do ciclo emocional. Queda: mais fria, menos saturada e com sombra nas bordas.
   * Respiro: mais quente, com luz de fim de tarde. A mistura muda em 3 s, sem corte seco.
   * `emotionScale` (0 a 1) reduz ou desliga o efeito (acessibilidade).
   */
  emotionScale = 1;
  /** Cutscenes passam sozinhas (opção do jogador). */
  autoCutscene = false;
  /** Padrões de piso já criados (um por fase). */
  private readonly padroesDePiso = new Map<string, CanvasPattern>();
  /** Slot do personagem em transe (RM) neste quadro, ou -1. */
  private tranceSlot = -1;
  /** Página do fim da partida (epílogo e resumo) e quadros desde que ela abriu. Controladas pelo main. */
  endPage = 0;
  endFrames = 0;
  /** Acessibilidade: sem piscadas de dano e sem clarões (Saideira). */
  reduceFlash = false;
  /** Altura lógica alvo (o tamanho do texto nas opções muda isto). */
  targetHeight = 270;

  private drawMood(world: World): void {
    const ctx = this.ctx;
    const b = world.moodBlend * this.emotionScale; // 0 respiro .. 1 queda
    const calor = (1 - world.moodBlend) * this.emotionScale;
    if (b > 0.01) {
      // Menos saturação.
      ctx.globalCompositeOperation = 'saturation';
      ctx.fillStyle = `rgba(128,128,128,${0.22 * b})`;
      ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      ctx.globalCompositeOperation = 'source-over';
      // Tom frio.
      ctx.fillStyle = `rgba(40,70,140,${0.08 * b})`;
      ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      // Sombra longa nas bordas.
      const g = ctx.createRadialGradient(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, 60, LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, 300);
      g.addColorStop(0, 'rgba(0,0,20,0)');
      g.addColorStop(1, `rgba(0,0,20,${0.16 * b})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    }
    if (calor > 0.01) {
      ctx.fillStyle = `rgba(255,170,90,${0.04 * calor})`;
      ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    }
  }

  /** Visuais das Ultimates de dupla em andamento (discos, pista de dança, clones, câmera lenta). */
  private drawSynergy(world: World, camX: number, camY: number): void {
    const ctx = this.ctx;
    for (const u of world.synergy.active) {
      const a = world.players[u.a];
      const b = world.players[u.b];
      if (!a || !b) continue;
      const mx = (a.x + b.x) / 2 - camX;
      const my = (a.y + b.y) / 2 - camY;
      if (u.id === 'setlist') {
        const centro = a.characterId === 'felipe' ? a : b;
        for (let i = 0; i < ULT.setlist.discs; i++) {
          const p = posicaoDoDisco(centro, u, i);
          const x = Math.round(p.x) - camX;
          const y = Math.round(p.y) - camY;
          // Disco de vinil: preto com sulcos e miolo colorido.
          ctx.fillStyle = '#15151b';
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#4a4a58';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#d9a441';
          ctx.fillRect(x - 1, y - 1, 2, 2);
        }
      } else if (u.id === 'pista') {
        // Pista de dança: ladrilhos que piscam em cores.
        const r = ULT.pista.radius;
        ctx.globalAlpha = 0.28;
        const cores = ['#ff6fb5', '#ffd166', '#7ad7ff', '#b36bff'];
        const n = Math.floor(world.tick / 12);
        for (let gx = -r; gx < r; gx += 16) {
          for (let gy = -r; gy < r; gy += 16) {
            if ((gx + 8) ** 2 + (gy + 8) ** 2 > r * r) continue;
            ctx.fillStyle = cores[(Math.floor(gx / 16) + Math.floor(gy / 16) + n + 100) % 4]!;
            ctx.fillRect(Math.round(mx + gx), Math.round(my + gy), 15, 15);
          }
        }
        ctx.globalAlpha = 1;
      } else if (u.id === 'pausa') {
        ctx.fillStyle = 'rgba(60,140,220,0.10)';
        ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      } else if (u.id === 'sobremesa') {
        // Clones espectrais com silhuetas diferentes: um grande (rosa) e um pequeno (ciano).
        for (const c of u.list) {
          const x = Math.round(c.x) - camX;
          const y = Math.round(c.y) - camY;
          const grande = c.t === 0;
          ctx.globalAlpha = 0.6;
          ctx.fillStyle = grande ? '#ff8fd0' : '#8fe8ff';
          const w = grande ? 16 : 10;
          const h = grande ? 24 : 15;
          ctx.fillRect(x - w / 2, y - h, w, h);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x - 3, y - h + 4, 2, 2);
          ctx.fillRect(x + 1, y - h + 4, 2, 2);
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  /** Saideira: a tela escurece, as luzes dos Holofotes sobem e, no fim, o pulso de brinde. */
  private drawSaideira(world: World, camX: number, camY: number): void {
    const t = world.synergy.committee.t;
    if (t < 0) return;
    const ctx = this.ctx;
    // Escurece rápido, segura e volta a clarear nos últimos instantes.
    const sobe = Math.min(1, t / 1.5);
    const desce = Math.min(1, (SAIDEIRA_DURATION_S - t) / 1);
    const k = Math.max(0, Math.min(sobe, desce)) * (this.reduceFlash ? 0.6 : 1);
    ctx.fillStyle = `rgba(5,3,15,${0.45 * k})`;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    // Luzes dos Holofotes em cada personagem.
    ctx.globalCompositeOperation = 'lighter';
    for (const p of world.players) {
      if (p.hp <= 0) continue;
      const x = Math.round(p.x) - camX;
      const y = Math.round(p.y) - camY;
      const g = ctx.createRadialGradient(x, y - 8, 4, x, y - 8, 60 * (0.4 + 0.6 * k));
      g.addColorStop(0, `rgba(255,236,170,${0.55 * k})`);
      g.addColorStop(1, 'rgba(255,236,170,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 70, y - 78, 140, 140);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Piso por ato: madeira (casa), asfalto (rua) e pedra (pátio da igreja). */
  private drawFloor(world: World, camX: number, camY: number): void {
    const ctx = this.ctx;
    const piso = PHASES[world.act]?.floor;
    const tema = !piso ? 'madeira' : piso === 'arena' ? 'pedra' : piso;
    const cores = FLOOR_COLORS[tema] ?? FLOOR_COLORS.madeira!;
    // Textura externa da fase (se existir): repete e anda junto com a câmera.
    const chave = world.act >= 7 ? 'extra' : `fase${world.act + 1}`;
    const textura = this.sprites.getPiso(chave);
    if (textura) {
      let padrao = this.padroesDePiso.get(chave);
      if (!padrao) {
        padrao = ctx.createPattern(textura, 'repeat') ?? undefined;
        if (padrao) this.padroesDePiso.set(chave, padrao);
      }
      if (padrao) {
        const ox = ((camX % textura.width) + textura.width) % textura.width;
        const oy = ((camY % textura.height) + textura.height) % textura.height;
        ctx.save();
        ctx.translate(-ox, -oy);
        ctx.fillStyle = padrao;
        ctx.fillRect(0, 0, LOGICAL_WIDTH + textura.width, LOGICAL_HEIGHT + textura.height);
        ctx.restore();
        return;
      }
    }
    const startCol = Math.floor(camX / TILE);
    const startRow = Math.floor(camY / TILE);
    const cols = Math.ceil(LOGICAL_WIDTH / TILE) + 1;
    const rows = Math.ceil(LOGICAL_HEIGHT / TILE) + 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const col = startCol + c;
        const row = startRow + r;
        const x = col * TILE - camX;
        const y = row * TILE - camY;
        ctx.fillStyle = (col + row) % 2 === 0 ? cores[0] : cores[1];
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = cores[2];
        if (tema === 'madeira') {
          ctx.fillRect(x, y + TILE - 1, TILE, 1); // emenda das tábuas
        } else if (tema === 'pedra') {
          ctx.fillRect(x, y, TILE, 1);
          ctx.fillRect(x, y, 1, TILE); // rejunte
        } else if (row % 8 === 0 && col % 2 === 0) {
          ctx.fillStyle = '#d9b93f';
          ctx.fillRect(x + 3, y + 7, 10, 2); // faixa amarela da rua
        }
      }
    }
  }

  /** Safe Room: círculo de luz suave no chão, com o nome da sala. */
  private drawSafeRoom(world: World, camX: number, camY: number): void {
    const z = zonaSegura(world);
    if (!z) return;
    const ctx = this.ctx;
    const x = Math.round(z.x) - camX;
    const y = Math.round(z.y) - camY;
    if (x < -z.r - 40 || x > LOGICAL_WIDTH + z.r + 40 || y < -z.r - 40 || y > LOGICAL_HEIGHT + z.r + 40) return;
    const pulso = 0.5 + 0.15 * Math.sin(world.tick / 20);
    ctx.globalAlpha = 0.22 + 0.08 * Math.sin(world.tick / 20);
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(x, y, z.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = pulso;
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(x, y, z.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffe9a8';
    ctx.font = '8px Silkscreen, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SAFE ROOM', x, y - z.r - 4);
    ctx.textAlign = 'left';
  }

  /** Paredes do cenário e os objetos de pista (caixas de papelão, calendário). */
  private drawScenery(world: World, camX: number, camY: number): void {
    const ctx = this.ctx;
    const ato = tuningDaFase(world.act);
    const cor = WALL_COLORS[world.act % WALL_COLORS.length] ?? '#777';
    for (const w of world.walls) {
      const x = w.x - camX;
      const y = w.y - camY;
      if (x > LOGICAL_WIDTH + 40 || y > LOGICAL_HEIGHT + 40 || x + w.w < -40 || y + w.h < -60) continue;
      // Parede com prop (ex.: o sofá da casa): a imagem substitui o retângulo, com a base alinhada à parede.
      const prop = w.prop ? this.sprites.getProp(w.prop) : undefined;
      if (prop) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x + 2, y + w.h - 2, w.w, 4);
        ctx.drawImage(prop, Math.round(x + (w.w - prop.width) / 2), Math.round(y + w.h + 2 - prop.height));
        continue;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x + 2, y + 3, w.w, w.h);
      ctx.fillStyle = cor;
      ctx.fillRect(x, y, w.w, w.h);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x, y, w.w, 2);
    }
    this.drawSafeRoom(world, camX, camY);
    this.drawGeladeira(world, camX, camY);
    const t = (world.tick - world.phaseStartTick) / 60;
    for (const p of ato.props) {
      if (t < p.appearAt) continue;
      const a = Math.min(1, (t - p.appearAt) / 2);
      const x = p.x - camX;
      const y = p.y - camY;
      ctx.globalAlpha = a;
      if (p.id === 'tigela') {
        // Tigela de ração (só imagem; sem o PNG não aparece nada).
        const img = this.sprites.getProp('tigela');
        if (img) ctx.drawImage(img, Math.round(x), Math.round(y));
      } else if (p.id === 'caixas' && this.sprites.getProp('caixas')) {
        const img = this.sprites.getProp('caixas')!;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x + 2, y + img.height - 3, img.width - 2, 4);
        ctx.drawImage(img, Math.round(x), Math.round(y));
      } else if (p.id === 'caixas') {
        // Caixas de papelão empilhadas no canto. Uma tem "Frágil" em letra pequena.
        ctx.fillStyle = '#b8894f';
        ctx.fillRect(x, y + 10, 18, 14);
        ctx.fillRect(x + 20, y + 14, 16, 10);
        ctx.fillRect(x + 4, y - 2, 14, 12);
        ctx.fillStyle = '#d9b77a';
        ctx.fillRect(x + 8, y + 10, 2, 14);
        ctx.fillRect(x + 8, y - 2, 2, 12);
        ctx.fillStyle = '#7a3a22';
        ctx.font = '4px monospace';
        ctx.textBaseline = 'top';
        ctx.fillText('Frágil', x + 20, y + 16);
      } else {
        // Calendário de dezembro com o dia 31 circulado.
        ctx.fillStyle = '#f2efe6';
        ctx.fillRect(x, y, 20, 24);
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(x, y, 20, 6);
        ctx.fillStyle = '#ffffff';
        ctx.font = '5px monospace';
        ctx.textBaseline = 'top';
        ctx.fillText('DEZ', x + 4, y + 1);
        ctx.fillStyle = '#555';
        for (let i = 0; i < 5; i++) ctx.fillRect(x + 2 + i * 3.4, y + 10, 2, 1);
        for (let i = 0; i < 5; i++) ctx.fillRect(x + 2 + i * 3.4, y + 14, 2, 1);
        ctx.strokeStyle = '#d62828';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x + 14, y + 18, 3.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#222';
        ctx.fillText('31', x + 12, y + 16);
      }
      ctx.globalAlpha = 1;
    }
  }

  /** Perigos no chão: aviso (que enche), impacto, poças e ondas. */
  private drawHazards(world: World, camX: number, camY: number): void {
    const ctx = this.ctx;
    for (const h of world.hazards.active) {
      const x = Math.round(h.x) - camX;
      const y = Math.round(h.y) - camY;
      if (h.kind === 'ring') {
        if (!h.active) continue;
        ctx.strokeStyle = h.color;
        ctx.lineWidth = h.thickness;
        ctx.globalAlpha = 0.65;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1, h.radius), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        continue;
      }
      // Perigo com imagem animada (holofote do RM): quadros do aviso até o ápice, e o último some.
      const imgHazard = h.sprite ? this.sprites.getProjetil(h.sprite) : undefined;
      if (imgHazard) {
        const f = h.active ? 1 : h.warnTotal > 0 ? 1 - h.delay / h.warnTotal : 1;
        const q = imgHazard.quadros[h.active ? 3 : Math.min(2, Math.floor(f * 3))] ?? imgHazard.quadros[0]!;
        const largura = h.radius * 2.6;
        const altura = largura * (q.height / q.width);
        ctx.drawImage(q, Math.round(x - largura / 2), Math.round(y - altura / 2), Math.round(largura), Math.round(altura));
        continue;
      }
      if (!h.active) {
        // Aviso: contorno fixo e preenchimento que cresce até o impacto.
        const f = h.warnTotal > 0 ? 1 - h.delay / h.warnTotal : 1;
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = h.color;
        ctx.beginPath();
        ctx.arc(x, y, h.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.arc(x, y, h.radius * Math.max(0.05, f), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = h.color;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.arc(x, y, h.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = 0.32;
        ctx.fillStyle = h.color;
        ctx.beginPath();
        ctx.arc(x, y, h.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  /** Geladeira da luta das Salsichas: fica no canto e solta comida de tempos em tempos (a posição vem de SALSICHAS_CFG). */
  private drawGeladeira(world: World, camX: number, camY: number): void {
    if (!world.enemies.active.some((e) => e.alive && e.def.id === 'salsichas' && e.leader === 0)) return;
    const ctx = this.ctx;
    const g = SALSICHAS_CFG.comida.geladeira;
    const x = Math.round(g.x - camX);
    const y = Math.round(g.y - camY);
    if (!this.onScreen(x, y)) return;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x - 12, y + 18, 26, 4);
    const img = this.sprites.getProp('geladeira');
    if (img) {
      ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y + 20 - img.height));
      return;
    }
    // Sem imagem: geladeira por código (corpo claro, divisória e puxador).
    ctx.fillStyle = '#dfe8ee';
    ctx.fillRect(x - 10, y - 14, 20, 34);
    ctx.fillStyle = '#9fb4c2';
    ctx.fillRect(x - 10, y + 2, 20, 1);
    ctx.fillRect(x - 10, y - 14, 20, 1);
    ctx.fillRect(x + 6, y - 8, 2, 8);
    ctx.fillRect(x + 6, y + 6, 2, 8);
  }

  private drawHostiles(world: World, camX: number, camY: number): void {
    const ctx = this.ctx;
    for (const h of world.hostiles.active) {
      const x = Math.round(h.x) - camX;
      const y = Math.round(h.y) - camY;
      if (!this.onScreen(x, y)) continue;
      switch (h.kind) {
        case 'notificacao': // balãozinho azul de notificação
          ctx.fillStyle = '#3a86ff';
          ctx.fillRect(x - 4, y - 3, 8, 6);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x - 2, y - 1, 4, 1);
          break;
        case 'pedra':
          ctx.fillStyle = '#8e8a99';
          ctx.fillRect(x - 3, y - 3, 6, 6);
          break;
        case 'espinho': // espinho de abacaxi
          if (this.desenharProjetilHostil('espinho', h, x, y, world.tick)) break;
          ctx.fillStyle = '#e0b43a';
          ctx.fillRect(x - 1, y - 3, 2, 6);
          ctx.fillRect(x - 3, y - 1, 6, 2);
          break;
        case 'agua': // água fervente do chimarrão
          if (this.desenharProjetilHostil('agua', h, x, y, world.tick)) break;
          ctx.fillStyle = '#9fe0ff';
          ctx.fillRect(x - 3, y - 3, 6, 6);
          ctx.fillStyle = '#4e8a3c';
          ctx.fillRect(x - 1, y - 1, 3, 3);
          break;
        case 'latido': {
          // Onda de latido: imagem animada virada para onde o projétil vai, se existir.
          const fx = this.sprites.getProjetil('latido');
          if (fx) {
            const q = fx.quadros[Math.floor(world.tick / 6) % fx.quadros.length]!;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(Math.atan2(h.vy, h.vx));
            ctx.drawImage(q, -Math.round(q.width / 2), -Math.round(q.height / 2));
            ctx.restore();
            break;
          }
          ctx.strokeStyle = '#ffd27a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case 'tinta': // tinta azul das Azuletes
          if (this.desenharProjetilHostil('tinta', h, x, y, world.tick)) break;
          ctx.fillStyle = '#2f7bff';
          ctx.fillRect(x - 3, y - 3, 6, 6);
          break;
        case 'pipoca':
          ctx.fillStyle = '#fff3c4';
          ctx.fillRect(x - 3, y - 3, 6, 6);
          ctx.fillStyle = '#f2c14e';
          ctx.fillRect(x - 1, y - 1, 3, 3);
          break;
        default: // formulário: folha de papel
          ctx.fillStyle = '#f5f1e3';
          ctx.fillRect(x - 4, y - 5, 8, 10);
          ctx.fillStyle = '#999';
          ctx.fillRect(x - 3, y - 3, 6, 1);
          ctx.fillRect(x - 3, y, 6, 1);
      }
    }
  }

  /** Projétil hostil pela imagem animada, virada para onde ele vai. Devolve false se não houver PNG. */
  private desenharProjetilHostil(id: string, h: { vx: number; vy: number }, x: number, y: number, tick: number): boolean {
    const fx = this.sprites.getProjetil(id);
    if (!fx) return false;
    const ctx = this.ctx;
    const q = fx.quadros[Math.floor(tick / 6) % fx.quadros.length]!;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(h.vy, h.vx));
    ctx.drawImage(q, -Math.round(q.width / 2), -Math.round(q.height / 2));
    ctx.restore();
    return true;
  }

  /** O Lucas entra em cena na fase 3 do Tiago W: blazer preto, careca, cajado que brilha. */
  private drawLucas(world: World, camX: number, camY: number): void {
    if (!world.lucasVisible) return;
    const chefe = world.enemies.active.find((e) => e.def.boss && e.leader === 0);
    if (!chefe) return;
    const ctx = this.ctx;
    const x = Math.round(chefe.x) + 34 - camX;
    const y = Math.round(chefe.y) - camY;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x - 7, y - 2, 14, 4);
    this.sprites.desenhar(ctx, 'lucas', Math.floor(world.tick / 30) % 2 === 0 ? 'idle0' : 'idle1', x, y, -1);
  }

  private onScreen(x: number, y: number): boolean {
    return x > -CULL_MARGIN && x < LOGICAL_WIDTH + CULL_MARGIN && y > -CULL_MARGIN && y < LOGICAL_HEIGHT + CULL_MARGIN;
  }

  private drawEnemies(world: World, camX: number, camY: number): void {
    const ctx = this.ctx;
    const lider = world.enemies.active.find((e) => e.alive && e.def.id === 'salsichas' && e.leader === 0);
    const salsichao = lider && salsichaoFundido(lider) ? lider : undefined;
    for (const e of world.enemies.active) {
      const x = Math.round(e.x) - camX;
      const y = Math.round(e.y) - camY;
      if (!this.onScreen(x, y)) continue;
      const r = e.def.radius;
      const comp = e.def.behavior;
      // Salsichão: depois da fusão os três corpos só servem de colisão (o sprite do líder é o monstro inteiro).
      if (salsichao && e.leader !== 0 && e.leader === salsichao.uid) continue;
      const ehSalsichao = salsichao !== undefined && e === salsichao;
      // Espectro sumido: só um vulto bem fraco.
      if (e.untargetable) {
        ctx.globalAlpha = 0.12;
        const vulto = this.sprites.getEnemy(e.def.id);
        if (vulto) ctx.drawImage(vulto.normal, Math.round(x - vulto.w / 2), Math.round(y + r - vulto.h));
        else {
          ctx.fillStyle = e.def.color;
          ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }
        ctx.globalAlpha = 1;
        continue;
      }
      // Motoboy preparando a investida: linha de aviso na direção em que vai.
      if (comp === 'investida-molho' && e.aiState === 1) {
        ctx.strokeStyle = 'rgba(255,80,80,0.55)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(e.aiDir) * 140, y + Math.sin(e.aiDir) * 140);
        ctx.stroke();
      }
      const tremor = 0;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      if (ehSalsichao) ctx.fillRect(x - 36, y + r - 2, 72, 3);
      else ctx.fillRect(x - r, y + r - 2, r * 2, 3);
      // Chefe aquecendo ou preparando um ataque: pisca em vermelho (aviso).
      const avisando = e.def.boss && (e.aiState === 1 || e.aiState === 2) && Math.floor(e.aiT * 6) % 2 === 0;
      // Folha animada externa (se existir) ou o desenho por código.
      const idSprite = ehSalsichao && this.sprites.tipoDaFolha('salsichao') ? 'salsichao' : e.def.id;
      const tipoFolha = this.sprites.tipoDaFolha(idSprite);
      const quadro = tipoFolha ? quadroDoInimigo(world, e, tipoFolha, this.reduceFlash) : null;
      const spr = (quadro ? this.sprites.getEnemyFrame(idSprite, quadro) : null) ?? this.sprites.getEnemy(idSprite);
      if (spr) {
        // Balanço de 1 pixel para animar (desenho por código e inimigos de 8 direções); a folha de chefe já traz os quadros.
        const bob = tipoFolha === 'chefe' ? 0 : Math.floor(world.tick / 14 + e.uid) % 2 === 0 ? 0 : 1;
        const img = tipoFolha === 'chefe' ? (avisando && quadro !== 'hurt' ? spr.red : spr.normal) : e.hitFlash > 0 && !this.reduceFlash ? spr.white : avisando ? spr.red : spr.normal;
        const left = Math.round(x - spr.w / 2) + tremor;
        const top = Math.round(y + r - spr.h) + bob;
        // Os de 8 direções já têm o desenho para cada lado; os demais são espelhados.
        const olhaEsquerda = tipoFolha !== 'direcional' && Math.cos(e.facing) < 0;
        if (!olhaEsquerda) ctx.drawImage(img, left, top);
        else {
          ctx.save();
          ctx.translate(left + spr.w, top);
          ctx.scale(-1, 1);
          ctx.drawImage(img, 0, 0);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      } else {
        const cor = e.hitFlash > 0 ? '#ffffff' : avisando ? '#ff5a3d' : e.def.color;
        ctx.fillStyle = cor;
        ctx.fillRect(x - r + tremor, y - r, r * 2, r * 2);
      }
      if (e.stun > 0) {
        // Atordoado: faixa azul por cima.
        ctx.fillStyle = '#7ad7ff';
        ctx.fillRect(x - r, y - r, r * 2, 2);
      }
      if (e.blind > 0) {
        // Desorientado: ponto amarelo em cima.
        ctx.fillStyle = '#ffe066';
        ctx.fillRect(x - 1, y - r - 4, 3, 2);
      }
      // Direção da frente: ponto discreto na borda. Importante para achar as costas (Holofote da Melissa).
      const fx = Math.cos(e.facing);
      const fy = Math.sin(e.facing);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(Math.round(x + fx * (r - 1)) - 1, Math.round(y + fy * (r - 1)) - 1, 2, 2);
      // Holofote da Melissa: marcador ciano brilhante nas costas do inimigo.
      if (e.spot > 0) {
        const hx = Math.round(x - fx * (r + 4));
        const hy = Math.round(y - fy * (r + 4));
        const pulse = e.spot < 1 && Math.floor(e.spot * 8) % 2 === 0; // pisca quando está acabando
        const marcador = this.sprites.getProjetil('melissaHolofote');
        if (marcador) {
          const q = marcador.quadros[Math.floor(world.tick / 6) % marcador.quadros.length]!;
          ctx.globalAlpha = pulse ? 0.45 : 1;
          ctx.drawImage(q, hx - 8, hy - 8, 16, 16);
          ctx.globalAlpha = 1;
          continue;
        }
        ctx.fillStyle = pulse ? '#1b6f8a' : '#27e1ff';
        ctx.fillRect(hx - 3, hy - 3, 6, 6);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(hx - 1, hy - 1, 2, 2);
      }
    }
  }

  /**
   * Animação em que os quatro cachorros se fundem no Salsichão: um brilho dourado que cresce em volta do Geraldo enquanto
   * os outros correm até ele, e um clarão branco no instante em que o Salsichão nasce. `reduceFlash` suaviza o clarão.
   */
  private drawFusao(world: World, camX: number, camY: number): void {
    const lider = world.enemies.active.find((e) => e.alive && e.def.id === 'salsichas' && e.leader === 0);
    const F = SALSICHAS_CFG.salsichao.fusaoS;
    const clarao = SALSICHAS_CFG.salsichao.clarao;
    if (!lider || lider.aiT2 !== 3 || lider.aiW > F || lider.aiW <= -clarao) return;
    const ctx = this.ctx;
    const x = Math.round(lider.x) - camX;
    const y = Math.round(lider.y) - camY - 8;
    if (lider.aiW > 0) {
      const t = 1 - lider.aiW / F;
      const pulso = 0.5 + 0.5 * Math.sin(world.tick / 3);
      ctx.fillStyle = '#ffd27a';
      ctx.globalAlpha = (0.12 + 0.3 * t) * (this.reduceFlash ? 0.5 : 1);
      ctx.beginPath();
      ctx.arc(x, y, 14 + 44 * t, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = (0.25 + 0.4 * t) * (0.6 + 0.4 * pulso);
      ctx.strokeStyle = '#fff3c4';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, 8 + 34 * t, 0, Math.PI * 2);
      ctx.stroke();
      // Faíscas em volta, girando mais rápido perto do fim.
      ctx.fillStyle = '#fff3c4';
      ctx.globalAlpha = 0.9;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + world.tick * (0.05 + 0.12 * t);
        const rr = 10 + 46 * (1 - t) + 6 * Math.sin(world.tick / 5 + i);
        ctx.fillRect(Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr * 0.6), 2, 2);
      }
    } else {
      // Clarão final: some em 0,4 s.
      const k = 1 + lider.aiW / clarao;
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.85 * k * (this.reduceFlash ? 0.35 : 1);
      ctx.beginPath();
      ctx.arc(x, y, 30 + 60 * (1 - k), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawProjectiles(world: World, camX: number, camY: number): void {
    const ctx = this.ctx;
    for (const pr of world.projectiles.active) {
      const x = Math.round(pr.x) - camX;
      const y = Math.round(pr.y) - camY;
      if (!this.onScreen(x, y)) continue;
      // Projétil com imagem externa: animado, espelhado conforme a direção (a trilha fica atrás).
      const faixa = this.sprites.getProjetil(pr.kind);
      if (faixa) {
        const q = faixa.quadros[(Math.floor(world.tick / 5) + pr.poolIndex) % faixa.quadros.length]!;
        const left = x - Math.round(faixa.w / 2);
        const top = y - Math.round(faixa.h / 2);
        if (pr.vx >= 0) {
          ctx.drawImage(q, left, top);
        } else {
          ctx.save();
          ctx.translate(left + faixa.w, top);
          ctx.scale(-1, 1);
          ctx.drawImage(q, 0, 0);
          ctx.restore();
        }
        continue;
      }
      switch (pr.kind) {
        case 'duck': {
          // Pato de borracha gigante (provisório).
          const r = Math.round(pr.radius);
          ctx.fillStyle = '#ffd23f';
          ctx.fillRect(x - r, y - r, r * 2, r * 2);
          ctx.fillStyle = '#ff9f1c';
          ctx.fillRect(x + (pr.vx >= 0 ? 4 : -r), y - 2, r - 4 + 2, 4);
          break;
        }
        case 'kazoo':
          ctx.fillStyle = '#c77dff';
          ctx.fillRect(x - 1, y - 1, 3, 3);
          break;
        case 'viola':
          ctx.fillStyle = '#81b29a';
          ctx.fillRect(x - 1, y - 1, 3, 3);
          break;
        case 'chinelo':
          // Chinelo: sola marrom com tira.
          ctx.fillStyle = '#b5651d';
          ctx.fillRect(x - 4, y - 2, 8, 4);
          ctx.fillStyle = '#f4d35e';
          ctx.fillRect(x - 1, y - 3, 2, 6);
          break;
        case 'controle':
          ctx.fillStyle = '#2d2d34';
          ctx.fillRect(x - 3, y - 5, 6, 10);
          ctx.fillStyle = '#e63946';
          ctx.fillRect(x - 1, y - 3, 2, 2);
          break;
        case 'missil':
          // Míssil da Constelação Afetiva: estrelinha rosa.
          ctx.fillStyle = '#ff9ec4';
          ctx.fillRect(x - 1, y - 3, 3, 7);
          ctx.fillRect(x - 3, y - 1, 7, 3);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x, y, 1, 1);
          break;
        case 'onda':
          // Onda grave: faixa larga no chão.
          ctx.fillStyle = 'rgba(230,194,74,0.7)';
          ctx.fillRect(x - 6, y - 10, 4, 20);
          ctx.fillStyle = 'rgba(255,243,196,0.5)';
          ctx.fillRect(x - 2, y - 8, 3, 16);
          break;
        case 'runa':
          // Runa de Rodapé: losango ciano.
          ctx.fillStyle = '#7ad7ff';
          ctx.fillRect(x - 1, y - 3, 3, 7);
          ctx.fillRect(x - 3, y - 1, 7, 3);
          break;
        default:
          ctx.fillStyle = '#ffe066';
          ctx.fillRect(x - 1, y - 1, 3, 3);
      }
    }
  }

  /**
   * Anel da aura da Thayssa. Euforia: dourado/rosa, anel contínuo. Sobrecarga: violeta/azul, anel tracejado
   * (a forma também muda, não só a cor). Com a Ressonância Dupla, os dois anéis aparecem.
   */
  private drawAuras(world: World, camX: number, camY: number): void {
    const ctx = this.ctx;
    for (const p of world.players) {
      const k = p.kit;
      if (k?.type !== 'thayssa' || p.hp <= 0) continue;
      const x = Math.round(p.x) - camX;
      const y = Math.round(p.y - 4) - camY;
      const r = raioDaAura(k);
      const trans = k.transitionLeft > 0;
      const pulse = 0.5 + 0.5 * Math.sin(world.tick / 8);
      const modos: ('euforia' | 'sobrecarga')[] = k.resonanceLeft > 0 ? ['euforia', 'sobrecarga'] : [k.mode];
      modos.forEach((m, i) => {
        const radius = r - i * 3;
        const cor = m === 'euforia' ? COR_EUFORIA : COR_SOBRECARGA;
        ctx.globalAlpha = trans ? 0.12 : 0.14 + 0.06 * pulse;
        ctx.fillStyle = cor;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = trans ? 0.35 : 0.8;
        ctx.strokeStyle = cor;
        ctx.lineWidth = 1;
        ctx.setLineDash(m === 'sobrecarga' ? [4, 3] : []);
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      });
      ctx.globalAlpha = 1;
    }
  }

  /** Armas do pool compartilhado: fatias de pizza orbitando, roteadores e poças no chão. */
  private drawExtraWeapons(world: World, camX: number, camY: number): void {
    const ctx = this.ctx;
    for (const p of world.players) {
      if (p.hp <= 0) continue;
      for (const w of p.extraWeapons) {
        for (const z of w.zones) {
          const x = Math.round(z.x) - camX;
          const y = Math.round(z.y) - camY;
          const roteador = z.pulseCd !== Infinity;
          ctx.globalAlpha = Math.min(0.35, z.t * 0.2);
          ctx.fillStyle = roteador ? '#7ad7ff' : '#3a8fd9';
          ctx.beginPath();
          ctx.arc(x, y, z.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          if (roteador) {
            // Roteador: caixinha com antenas.
            ctx.fillStyle = '#222';
            ctx.fillRect(x - 5, y - 2, 10, 5);
            ctx.fillStyle = '#7ad7ff';
            ctx.fillRect(x - 4, y - 6, 1, 4);
            ctx.fillRect(x + 3, y - 6, 1, 4);
          }
        }
        if (w.id === 'pizza') {
          const n = PIZZA.slices(w.level);
          for (let i = 0; i < n; i++) {
            const pos = posicaoDaFatia(p, w, i);
            const x = Math.round(pos.x) - camX;
            const y = Math.round(pos.y) - camY;
            ctx.fillStyle = '#f4c542';
            ctx.beginPath();
            ctx.moveTo(x - 5, y - 4);
            ctx.lineTo(x + 5, y - 4);
            ctx.lineTo(x, y + 6);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#d64545';
            ctx.fillRect(x - 1, y - 2, 2, 2);
          }
        }
      }
    }
  }

  /** Comidas no chão. Formas diferentes por comida, e pisca quando está para sumir. */
  private drawFoods(world: World, camX: number, camY: number): void {
    const ctx = this.ctx;
    for (const f of world.foods.active) {
      if (f.life < 5 && Math.floor(f.life * 6) % 2 === 0) continue;
      const x = Math.round(f.x) - camX;
      const y = Math.round(f.y) - camY;
      if (!this.onScreen(x, y)) continue;
      const img = this.sprites.getComida(f.def.id)?.quadros[0];
      if (img) {
        // Sombrinha no chão e a comida balançando de leve.
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x - Math.floor(img.width / 3), y + 2, Math.floor((img.width * 2) / 3), 2);
        ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y + 3 - img.height + Math.sin(world.tick / 14 + f.x) * 1));
        continue;
      }
      ctx.fillStyle = f.def.color;
      switch (f.def.id) {
        case 'coxinha': // gota
          ctx.fillRect(x - 3, y - 2, 6, 6);
          ctx.fillRect(x - 1, y - 5, 2, 3);
          break;
        case 'paoDeQueijo': // bolinha
          ctx.fillRect(x - 3, y - 3, 6, 6);
          ctx.fillStyle = '#fff0b3';
          ctx.fillRect(x - 1, y - 1, 2, 2);
          break;
        case 'esfiha': // triângulo
          ctx.fillRect(x - 1, y - 4, 2, 2);
          ctx.fillRect(x - 3, y - 2, 6, 2);
          ctx.fillRect(x - 5, y, 10, 3);
          break;
        case 'brilho': // estrelinha rosa (Risada Contagiante)
          ctx.fillRect(x - 1, y - 4, 2, 8);
          ctx.fillRect(x - 4, y - 1, 8, 2);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x - 1, y - 1, 2, 2);
          break;
        default: // brigadeiro: bolinha escura com granulado
          ctx.fillRect(x - 3, y - 3, 6, 6);
          ctx.fillStyle = '#f5f0e6';
          ctx.fillRect(x - 2, y - 2, 1, 1);
          ctx.fillRect(x + 1, y, 1, 1);
          ctx.fillRect(x - 1, y + 2, 1, 1);
      }
    }
  }

  /** Violoncelo da Thaisa: separado do corpo, na direção do último golpe. */
  private drawCellos(world: World, camX: number, camY: number): void {
    const ctx = this.ctx;
    for (const p of world.players) {
      const k = p.kit;
      if (k?.type !== 'thaisa' || p.hp <= 0) continue;
      const pos = posicaoDoVioloncelo(p, k);
      const x = Math.round(pos.x) - camX;
      const y = Math.round(pos.y) - camY;
      const cello = this.sprites.getArma('cello');
      if (cello) {
        // Violoncelo da imagem: aponta na direção da mira (de cabeça para cima quando mira para a esquerda) e avança no golpe.
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(k.aim);
        if (Math.cos(k.aim) < 0) ctx.scale(1, -1);
        ctx.drawImage(cello.quadros[0]!, Math.round(-cello.w / 2 + (k.swingLeft > 0 ? 6 : 2)), Math.round(-cello.h / 2));
        ctx.restore();
        continue;
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(k.aim + Math.PI / 2);
      ctx.fillStyle = k.swingLeft > 0 ? '#ffd27a' : '#9c5f2e';
      ctx.fillRect(-4, -9, 8, 18);
      ctx.fillStyle = '#5a3418';
      ctx.fillRect(-1, -12, 2, 6);
      ctx.restore();
    }
  }

  /** Livros da Órbita de Clássicos do Mauro (provisório: retângulos). */
  private drawBooks(world: World, camX: number, camY: number): void {
    const ctx = this.ctx;
    for (const p of world.players) {
      const k = p.kit;
      if (k?.type !== 'mauro' || !k.mods.orbita || p.hp <= 0) continue;
      for (let i = 0; i < ORBITA_BOOKS; i++) {
        const pos = posicaoDoLivro(p, k, i);
        const x = Math.round(pos.x) - camX;
        const y = Math.round(pos.y) - camY;
        ctx.fillStyle = '#8b5a2b';
        ctx.fillRect(x - 4, y - 5, 8, 10);
        ctx.fillStyle = '#f4e3b2';
        ctx.fillRect(x - 3, y - 4, 2, 8);
      }
    }
  }

  private drawEffects(world: World, camX: number, camY: number): void {
    const ctx = this.ctx;
    for (const e of world.effects.active) {
      const t = 1 - e.life / e.maxLife; // 0 → 1
      const x = Math.round(e.x) - camX;
      const y = Math.round(e.y) - camY;
      ctx.globalAlpha = 1 - t;
      const faixa = e.sprite ? this.sprites.getProjetil(e.sprite) : undefined;
      if (faixa && this.drawEffectSprite(faixa, e, t, x, y, camX, camY)) {
        ctx.globalAlpha = 1;
        continue;
      }
      if (e.kind === 'ring') {
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, e.radius * (0.3 + 0.7 * t), 0, Math.PI * 2);
        ctx.stroke();
      } else if (e.kind === 'arc') {
        // Hitbox do violoncelo: fatia do arco, visível enquanto o golpe está ativo.
        ctx.globalAlpha = 0.55 * (1 - t * 0.6);
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, e.radius, e.angle - e.halfArc, e.angle + e.halfArc);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = '#fff3c4';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, e.radius, e.angle - e.halfArc, e.angle + e.halfArc);
        ctx.stroke();
      } else if (e.kind === 'beam') {
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(Math.round(e.x2) - camX, Math.round(e.y2) - camY);
        ctx.stroke();
      } else {
        ctx.font = FONT_UI;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        textoContornado(ctx, e.text, x, y - t * 10, e.color);
        ctx.textAlign = 'left';
      }
      ctx.globalAlpha = 1;
    }
  }

  /** Números de dano: brancos nos inimigos, amarelos e maiores nos críticos, vermelhos nos jogadores. */
  private drawDamageNumbers(world: World, camX: number, camY: number): void {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const n of world.damageNumbers.active) {
      const x = Math.round(n.x) - camX;
      const y = Math.round(n.y) - camY;
      if (!this.onScreen(x, y)) continue;
      const t = n.life / n.maxLife;
      const valor = String(Math.max(1, Math.round(n.value)));
      ctx.globalAlpha = Math.min(1, t * 3);
      // Dano normal em branco, crítico em amarelo (Silkscreen, com "!"), dano recebido em vermelho (com "-"). Contorno preto de 1 px.
      if (n.kind === 'critico') {
        ctx.font = FONT_CRIT;
        textoContornado(ctx, `${valor}!`, x, y, COLOR.crit, '#000000');
      } else if (n.kind === 'jogador') {
        ctx.font = FONT_UI;
        textoContornado(ctx, `-${valor}`, x, y, COLOR.hurt, '#000000');
      } else {
        ctx.font = FONT_UI;
        textoContornado(ctx, valor, x, y, COLOR.dmg, '#000000');
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  /** Efeito com imagem externa: anel que cresce, arco girado, ou feixe esticado. Devolve false se não souber desenhar. */
  private drawEffectSprite(faixa: Faixa, e: Effect, t: number, x: number, y: number, camX: number, camY: number): boolean {
    const ctx = this.ctx;
    const n = faixa.quadros.length;
    const q = faixa.quadros[Math.min(n - 1, Math.floor(t * n))]!;
    ctx.globalAlpha = 1;
    if (e.kind === 'ring') {
      const d = e.radius * 2 * (0.45 + 0.55 * t);
      ctx.drawImage(q, Math.round(x - d / 2), Math.round(y - d / 2), Math.round(d), Math.round(d));
      return true;
    }
    if (e.kind === 'arc') {
      // Fatia (hitbox) bem fraca por baixo, e a imagem do golpe girada na direção do ataque.
      ctx.globalAlpha = 0.18 * (1 - t);
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, e.radius, e.angle - e.halfArc, e.angle + e.halfArc);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      const h = Math.max(8, 2 * e.radius * Math.sin(Math.min(e.halfArc, Math.PI / 2)));
      const k = h / faixa.h;
      const w = faixa.w * k;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(e.angle);
      ctx.drawImage(q, Math.round(e.radius - w), Math.round(-h / 2), Math.round(w), Math.round(h));
      ctx.restore();
      return true;
    }
    if (e.kind === 'beam') {
      const x2 = Math.round(e.x2) - camX;
      const y2 = Math.round(e.y2) - camY;
      const len = Math.hypot(x2 - x, y2 - y);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(y2 - y, x2 - x));
      ctx.drawImage(q, 0, -Math.round(faixa.h / 2), Math.round(len), faixa.h);
      ctx.restore();
      return true;
    }
    return false;
  }

  private drawGems(world: World, camX: number, camY: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#5ee0ff';
    for (const g of world.gems.active) {
      const x = Math.round(g.x) - camX;
      const y = Math.round(g.y) - camY;
      if (!this.onScreen(x, y)) continue;
      ctx.fillRect(x - 1, y - 2, 3, 5);
      ctx.fillRect(x - 2, y - 1, 5, 3);
    }
  }

  /** Balão de fala em pixel art acima de quem está falando (interações, A.10). */
  private drawDialogue(world: World, camX: number, camY: number): void {
    const d = world.interactions.dialogue;
    const line = d?.lines[d.index];
    const p = line ? world.players[line.slot] : undefined;
    if (!d || !line || !p) return;
    const ctx = this.ctx;
    ctx.font = FONT_UI;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    const linhas = wrapText(ctx, line.text, 128);
    const nome = CHARACTERS[p.characterId].name.toUpperCase();
    const largura = Math.ceil(Math.max(ctx.measureText(nome).width, ...linhas.map((l) => ctx.measureText(l).width))) + 10;
    const altura = linhas.length * 10 + 16;
    const sx = Math.round(p.x) - camX;
    const sy = Math.round(p.y) - camY - this.sprites.get(p.characterId).h - 4;
    const x = Math.max(3, Math.min(LOGICAL_WIDTH - largura - 3, Math.round(sx - largura / 2)));
    const y = Math.max(3, sy - altura);
    // Balão claro com contorno ciano (cantos cortados, pixel art) e rabinho para quem fala.
    ctx.fillStyle = PAL.neon2;
    ctx.fillRect(x + 1, y, largura - 2, altura);
    ctx.fillRect(x, y + 1, largura, altura - 2);
    ctx.fillStyle = PAL.text;
    ctx.fillRect(x + 2, y + 1, largura - 4, altura - 2);
    ctx.fillRect(x + 1, y + 2, largura - 2, altura - 4);
    const tx = Math.max(x + 4, Math.min(x + largura - 8, sx - 2));
    ctx.fillStyle = PAL.neon2;
    ctx.fillRect(tx, y + altura, 5, 1);
    ctx.fillRect(tx + 1, y + altura + 1, 3, 1);
    ctx.fillRect(tx + 2, y + altura + 2, 1, 1);
    ctx.fillStyle = PAL.text;
    ctx.fillRect(tx + 1, y + altura - 1, 3, 1);
    ctx.fillRect(tx + 2, y + altura, 1, 1);
    ctx.fillStyle = COLOR.logoTube;
    ctx.fillText(nome, x + 5, y + 4);
    ctx.fillStyle = PAL.plate;
    linhas.forEach((l, i) => ctx.fillText(l, x + 5, y + 14 + i * 10));
  }

  /** Slots controlados pela IA (o nome deles aparece com "(IA)"). */
  aiSlots: readonly number[] = [];
  /** Co-op local: HUD dos dois jogadores e dicas de tecla por jogador. */
  coop = false;
  /** Co-op online: cada navegador vê a tela de um jogador (`viewSlot`) e só ele escolhe as próprias cartas. */
  online = false;
  viewSlot = 0;
  /** Dispositivo de cada jogador no co-op local (para as dicas de tecla). */
  devices: readonly DeviceId[] = [];
  /** Teclas dos jogadores (para as dicas de escolher carta). */
  keymaps: readonly KeyMap[] = [];

  /** Caído: uma cruz que pisca acima dele e a barra de reviver (só se ainda há alguém vivo para levantá-lo). */
  private drawFallen(world: World, p: Player, x: number, y: number): void {
    if (!world.players.some((q) => q !== p && q.hp > 0)) return;
    const ctx = this.ctx;
    const topo = y - 16;
    if (Math.floor(world.tick / 20) % 2 === 0 || p.reviveProgress > 0) {
      ctx.fillStyle = PAL.xp;
      ctx.fillRect(x - 1, topo - 4, 3, 9);
      ctx.fillRect(x - 4, topo - 1, 9, 3);
    }
    if (p.reviveProgress > 0) medidor(ctx, x - 12, topo + 8, 24, 5, p.reviveProgress / REVIVE_TIME_S, PAL.xp, COLOR.xpTrack);
  }

  /** Nome do aliado acima da cabeça, em Tiny5 com contorno. */
  private drawAllyName(p: Player, x: number, y: number, sufixo?: string): void {
    const ctx = this.ctx;
    const nome = CHARACTERS[p.characterId].name.toUpperCase() + (sufixo ?? (this.aiSlots.includes(p.slot) ? ' (IA)' : this.coop ? ` (P${p.slot + 1})` : ''));
    ctx.font = FONT_UI;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    textoContornado(ctx, nome, x, y - this.sprites.get(p.characterId).h - 12, PAL.text);
    ctx.textAlign = 'left';
  }

  /** Escolhe o quadro (parado, andando, ataque, dano) e desenha o sprite do jogador. */
  private drawPlayer(p: Player, x: number, y: number, tick: number): void {
    const ctx = this.ctx;
    // Em transe (RM): a aura de coração em espiral aparece em volta do encantado (se existir a imagem).
    if (p.slot === this.tranceSlot) {
      const aura = this.sprites.getProjetil('transe');
      if (aura) {
        const q = aura.quadros[1 + (Math.floor(tick / 8) % 3)] ?? aura.quadros[1]!;
        ctx.globalAlpha = 0.85;
        ctx.drawImage(q, Math.round(x - q.width / 2), Math.round(y - 14 - q.height / 2));
        ctx.globalAlpha = 1;
      }
    }
    // Em transe (RM): quadro próprio do personagem encantado, se existir a imagem.
    const transe = p.slot === this.tranceSlot ? this.sprites.getTranse(p.characterId) : undefined;
    if (transe) {
      const q = transe.quadros[Math.floor(tick / 20) % transe.quadros.length]!;
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      ctx.scale(p.facing, 1);
      ctx.drawImage(q, -Math.round(transe.w / 2), -transe.h);
      ctx.restore();
      return;
    }
    // Melissa convidada desnorteada (depois do transe): quadros próprios, ou estrelinhas desenhadas por código.
    if (p.slot === CONVIDADA_SLOT && p.confusedLeft > 0) {
      const tonta = this.sprites.getDesnorteado(p.characterId);
      if (tonta) {
        const q = tonta.quadros[Math.floor(tick / 18) % tonta.quadros.length]!;
        ctx.save();
        ctx.translate(Math.round(x), Math.round(y));
        ctx.scale(p.facing, 1);
        ctx.drawImage(q, -Math.round(tonta.w / 2), -tonta.h);
        ctx.restore();
        return;
      }
      const topo = this.sprites.get(p.characterId).h;
      ctx.fillStyle = '#ffe14d';
      for (let i = 0; i < 3; i++) {
        const a = tick / 10 + (i * Math.PI * 2) / 3;
        ctx.fillRect(Math.round(x + Math.cos(a) * 9) - 1, Math.round(y - topo - 3 + Math.sin(a) * 3) - 1, 3, 3);
      }
    }
    let st = this.anim.get(p);
    if (!st) {
      st = { lastCd: p.weaponCd, attackUntil: -1 };
      this.anim.set(p, st);
    }
    // Disparo novo: a recarga da arma subiu desde o último quadro desenhado.
    if (p.weaponCd > st.lastCd + 0.001) st.attackUntil = tick + 7;
    st.lastCd = p.weaponCd;

    let frame: FrameName;
    if (!this.reduceFlash && p.invuln > PLAYER_INVULN_S - 0.18 && p.invuln <= PLAYER_INVULN_S) frame = 'hurt';
    else if (!this.reduceFlash && tick < st.attackUntil) frame = 'attack';
    else if (p.moving) frame = (['walk0', 'walk1', 'walk2', 'walk3'] as const)[Math.floor(tick / 7) % 4]!;
    else frame = Math.floor(tick / 30) % 2 === 0 ? 'idle0' : 'idle1';

    const mont = p.vehicle;
    const pose = mont ? VEHICLE_POSE[mont.id] : undefined;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    if (mont) ctx.fillRect(x - 14, y - 2, 28, 4);
    else ctx.fillRect(x - 7, y - 2, 14, 4);
    if (mont && pose) {
      const assento = pose.assento;
      if (!pose.frente) this.drawVehicle(mont.id, p, x, y, tick);
      if (!pose.cobre) this.sprites.desenhar(ctx, p.characterId, frame, x, y - assento, p.facing);
      if (pose.frente) this.drawVehicle(mont.id, p, x, y, tick);
      if (!pose.cobre) this.drawHeldWeapon(p, x, y - assento, tick, frame === 'attack');
    } else {
      this.sprites.desenhar(ctx, p.characterId, frame, x, y, p.facing);
      this.drawHeldWeapon(p, x, y, tick, frame === 'attack');
    }
  }

  /** Veículo: imagem externa (se existir) ou desenho por código, com os pés/rodas em (x, y). */
  private drawVehicle(id: keyof typeof VEHICLES, p: Player, x: number, y: number, tick: number, escala = 1): void {
    const ctx = this.ctx;
    const img = this.sprites.getVeiculo(id);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(p.facing * escala, escala);
    if (img) ctx.drawImage(img.quadros[0]!, -Math.round(img.w / 2), -img.h);
    else desenharVeiculo(ctx, id, tick, p.moving);
    ctx.restore();
  }

  /** Veículos esperando no chão: uma miniatura que balança, com um anel; pisca nos últimos segundos. */
  private drawVehiclePickups(world: World, camX: number, camY: number): void {
    const ctx = this.ctx;
    for (const v of world.vehiclePickups) {
      const dono = world.players[v.slot];
      if (!dono) continue;
      const x = Math.round(v.x) - camX;
      const y = Math.round(v.y) - camY;
      if (!this.onScreen(x, y)) continue;
      if (v.left < 6 && Math.floor(world.tick / 6) % 2 === 0) continue;
      const bob = Math.round(Math.sin(world.tick / 10) * 2);
      ctx.globalAlpha = 0.5 + 0.2 * Math.sin(world.tick / 8);
      ctx.strokeStyle = '#ffe066';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y - 4, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      this.drawVehicle(v.id, { facing: 1, moving: false } as Player, x, y + bob, world.tick, 0.8);
    }
  }

  /**
   * Arma na mão (imagem externa). Cada personagem (e cada instrumento do Felipe) tem uma pose:
   * posição em relação aos pés, inclinação parado e ao atacar. Sem PNG, não desenha nada.
   */
  private drawHeldWeapon(p: Player, x: number, y: number, tick: number, atacando: boolean): void {
    if (p.hp <= 0) return;
    const k = p.kit;
    let pose: HeldPose | undefined;
    if (k?.type === 'felipe') pose = HELD_FELIPE[k.active];
    else pose = HELD[p.characterId];
    if (!pose) return;
    const arma = this.sprites.getArma(pose.arma);
    if (!arma && !pose.provisoria) return;
    const ctx = this.ctx;
    const f = p.facing;
    const balanco = p.moving ? Math.round(Math.sin(tick / 4)) : Math.floor(tick / 30) % 2 === 0 ? 0 : 1;
    const frente = atacando ? pose.ataqueX : 0;
    ctx.save();
    ctx.translate(x + f * (pose.x + frente), y + pose.y + balanco);
    ctx.scale(f, 1);
    ctx.rotate(atacando ? pose.ataque : pose.parado);
    if (arma) ctx.drawImage(arma.quadros[0]!, -Math.round(arma.w / 2), -Math.round(arma.h / 2));
    else if (pose.provisoria === 'flauta') desenharFlauta(ctx);
    else desenharMegafone(ctx);
    ctx.restore();
  }

  /** Desenha uma tela de menu (título, seleção, opções...). */
  renderMenu(menu: Menu, tick: number): void {
    drawMenu(this.ctx, menu, this.sprites, tick);
  }

  /** Mostra todos os quadros de todos os personagens em 3x (visualizador de arte: ?sprites=1). */
  drawSpriteSheet(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#3a3340';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    const ids = Object.keys(SPRITE_DEFS) as SpriteId[];
    ids.forEach((id, row) => {
      const s = this.sprites.get(id);
      FRAME_ORDER.forEach((f, col) => {
        ctx.drawImage(s.frames[f], 8 + col * 32, 4 + row * 44);
      });
    });
    // Inimigos e chefes, em colunas à direita dos personagens.
    Object.keys(ENEMY_SPRITE_DEFS).forEach((id, i) => {
      const s = this.sprites.getEnemy(id);
      if (!s) return;
      const col = Math.floor(i / 5);
      ctx.drawImage(s.normal, 280 + col * 40, 8 + (i % 5) * 36);
    });
    // Veículos (com o desenho por código ou a imagem externa), parados e andando.
    (Object.keys(VEHICLES) as (keyof typeof VEHICLES)[]).forEach((id, i) => {
      this.drawVehicle(id, { facing: 1, moving: false } as Player, 290 + i * 40, 245, 0);
    });
  }
}
