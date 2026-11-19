// SpriteManager: monta os quadros de cada personagem (a partir das grades) e tenta trocá-los por
// uma folha PNG externa em /assets/sprites/<nome>.png. Sem o PNG, vale o desenho procedural.
// Folha externa: uma linha com 8 quadros de mesmo tamanho, na ordem de FRAME_ORDER (ver ASSETS_README.md).

import { SPRITE_DEFS } from './characterSprites';
import { ENEMY_SPRITE_DEFS, type EnemySpriteDef } from './enemySprites';
import { INIMIGOS_EXTERNOS, NPCS_EXTERNOS, quadrosDe, RETRATOS_EXTERNOS, TRANSE_EXTERNOS, DESNORTEADOS_EXTERNOS, GALERIA_EXTERNOS, COMIDAS_EXTERNAS, type FolhaTipo } from './enemyFrames';
import { alturaDoQuadro, FRAME_ORDER, montarQuadro, SPRITE_W, type FrameName, type SpriteDef, type SpriteId } from './spriteFormat';

export type FrameSet = Record<FrameName, HTMLCanvasElement>;

export interface Sprite {
  readonly w: number;
  readonly h: number;
  readonly frames: FrameSet;
  /** Veio de um PNG externo? */
  readonly externo: boolean;
}

function criarCanvas(w: number, h: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return cv;
}

function desenharGrade(def: SpriteDef, frame: FrameName): HTMLCanvasElement {
  const grade = montarQuadro(def, frame);
  const cv = criarCanvas(SPRITE_W, grade.length);
  const ctx = cv.getContext('2d')!;
  grade.forEach((linha, y) => {
    for (let x = 0; x < SPRITE_W; x++) {
      const ch = linha[x] ?? '.';
      if (ch === '.') continue;
      ctx.fillStyle = def.palette[ch] ?? '#ff00ff';
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return cv;
}

/** Cópia do quadro com uma cor sobreposta só nos pixels opacos (flash de ataque e de dano). */
function tingir(src: HTMLCanvasElement, cor: string, alfa: number): HTMLCanvasElement {
  const cv = criarCanvas(src.width, src.height);
  const ctx = cv.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = alfa;
  ctx.fillStyle = cor;
  ctx.fillRect(0, 0, cv.width, cv.height);
  return cv;
}

function procedural(id: SpriteId): Sprite {
  const def = SPRITE_DEFS[id];
  const frames = {} as FrameSet;
  for (const f of FRAME_ORDER) frames[f] = desenharGrade(def, f);
  frames.attack = tingir(frames.idle0, '#ffffff', 0.65);
  frames.hurt = tingir(frames.idle0, '#ff3030', 0.6);
  return { w: SPRITE_W, h: alturaDoQuadro(def), frames, externo: false };
}

/** Fatia a folha PNG externa em 8 quadros. */
function deFolha(img: HTMLImageElement): Sprite | null {
  if (img.width % FRAME_ORDER.length !== 0 || img.height === 0) return null;
  const w = img.width / FRAME_ORDER.length;
  const h = img.height;
  const frames = {} as FrameSet;
  FRAME_ORDER.forEach((f, i) => {
    const cv = criarCanvas(w, h);
    cv.getContext('2d')!.drawImage(img, i * w, 0, w, h, 0, 0, w, h);
    frames[f] = cv;
  });
  return { w, h, frames, externo: true };
}

/** Inimigo ou chefe: um desenho, mais as versões tingidas (dano e aviso). */
export interface EnemySprite {
  readonly w: number;
  readonly h: number;
  readonly normal: HTMLCanvasElement;
  readonly white: HTMLCanvasElement;
  readonly red: HTMLCanvasElement;
}

function enemyProcedural(def: EnemySpriteDef): EnemySprite {
  const w = def.rows[0]!.length;
  const h = def.rows.length;
  const cv = criarCanvas(w, h);
  const ctx = cv.getContext('2d')!;
  def.rows.forEach((linha, y) => {
    for (let x = 0; x < w; x++) {
      const ch = linha[x] ?? '.';
      if (ch === '.') continue;
      ctx.fillStyle = def.palette[ch] ?? '#ff00ff';
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return { w, h, normal: cv, white: tingir(cv, '#ffffff', 0.85), red: tingir(cv, '#ff3030', 0.6) };
}

/** Faixa de quadros de mesmo tamanho (arma com 1 quadro, projétil animado com vários), apontando para a direita. */
export interface Faixa {
  readonly w: number;
  readonly h: number;
  readonly quadros: readonly HTMLCanvasElement[];
}

/** Armas na mão (public/assets/sprites/armas/<id>.png) e quantos quadros cada uma tem. */
export const ARMAS_EXTERNAS: Readonly<Record<string, number>> = { violao: 1, bateria: 1, flauta: 1, kazoo: 1, tomo: 1, florete: 1, cello: 1, microfone: 1, megafone: 1 };
/** Veículos (public/assets/sprites/veiculos/<id>.png): uma imagem, olhando para a direita, com os pés/rodas na base. */
export const VEICULOS_EXTERNOS: Readonly<Record<string, number>> = { cavalo: 1, carroca: 1, c3: 1, skate: 1, armadura: 1 };
/** Projéteis e efeitos (public/assets/sprites/projeteis/<nome>.png): o nome é o ProjectileKind ou o Effect.sprite. */
export const PROJETEIS_EXTERNOS: Readonly<Record<string, number>> = {
  note: 4,
  kazoo: 4,
  runa: 4,
  // Efeitos de ataque (Effect.sprite) e o marcador do Holofote.
  bateria: 4,
  melissaArco: 4,
  melissaHolofote: 4,
  thaisaArco: 4,
  thayssaEuforia: 4,
  thayssaSobrecarga: 4,
  // Efeitos dos chefes e dos inimigos.
  latido: 4,
  holofote_rm: 4,
  rm_onda: 4,
  transe: 4,
  // Projéteis hostis e ataques de chefe.
  espinho: 4,
  agua: 4,
  tinta: 4,
  apito: 4,
  ponteiro: 4,
  folha: 4,
  // Luta das Salsichas: poça de tinta da Monet, trilha do Toddy e a mordida do Bucky (perigos no chão).
  poca_tinta: 4,
  toddy_rastro: 4,
  mordida: 4,
};
/** Props de cenário (public/assets/sprites/props/<id>.png): uma imagem do objeto, vista 3/4 de cima. */
export const PROPS_EXTERNOS: readonly string[] = [
  'sofa', 'mesinha', 'bancada', 'geladeira', 'caixas', 'tigela',
  'banco', 'poste', 'padaria', 'portal',
  'quiosque', 'lago', 'arvore', 'escritorio',
  'poltronas', 'pipoqueira', 'poster', 'relogio_parado', 'tela',
  'boi', 'baia', 'feno', 'estande', 'trator',
  'casa', 'rede_volei', 'horta', 'sino', 'mesa_bolo', 'calendario_velho',
  'bancos', 'vitral', 'teclado', 'purpito', 'faixa', 'relogio',
  'ponteiros', 'folhas', 'ampulhetas',
];
/** Pisos repetíveis (public/assets/sprites/pisos/<chave>.png): fase1 a fase7 e extra (Arena do Tempo). */
export const PISOS_EXTERNOS: readonly string[] = ['fase1', 'fase2', 'fase3', 'fase4', 'fase5', 'fase6', 'fase7', 'extra'];

function deFaixa(img: HTMLImageElement, n: number): Faixa | null {
  if (n < 1 || img.width % n !== 0 || img.height === 0) return null;
  const w = img.width / n;
  const quadros: HTMLCanvasElement[] = [];
  for (let i = 0; i < n; i++) {
    const cv = criarCanvas(w, img.height);
    cv.getContext('2d')!.drawImage(img, i * w, 0, w, img.height, 0, 0, w, img.height);
    quadros.push(cv);
  }
  return { w, h: img.height, quadros };
}

/** Folha animada de inimigo ou chefe: um EnemySprite (normal, branco e vermelho) por quadro. */
export interface EnemySheet {
  readonly tipo: FolhaTipo;
  readonly frames: Readonly<Record<string, EnemySprite>>;
}

export class SpriteManager {
  private readonly folhas = new Map<string, EnemySheet>();
  private readonly retratos = new Map<string, HTMLCanvasElement>();
  private readonly npcs = new Map<string, Faixa>();
  /** Ícones dos colecionáveis da Galeria do Mauro (1 imagem cada). */
  private readonly galeria = new Map<string, Faixa>();
  /** Comidas do chão (1 imagem cada). */
  private readonly comidas = new Map<string, Faixa>();
  private readonly pisos = new Map<string, HTMLCanvasElement>();
  private readonly props = new Map<string, HTMLCanvasElement>();
  private readonly transe = new Map<string, Faixa>();
  private readonly desnorteados = new Map<string, Faixa>();
  private readonly sprites = new Map<SpriteId, Sprite>();
  private readonly inimigos = new Map<string, EnemySprite | null>();
  private readonly armas = new Map<string, Faixa>();
  private readonly projeteis = new Map<string, Faixa>();
  private readonly veiculos = new Map<string, Faixa>();

  /** Tem folha animada externa para este inimigo ou chefe? */
  temFolha(id: string): boolean {
    return this.folhas.has(id);
  }

  /** Tipo da folha (comum de 4 quadros ou chefe de 8), se houver. */
  tipoDaFolha(id: string): FolhaTipo | undefined {
    return this.folhas.get(id)?.tipo;
  }

  /** Um quadro da folha animada do inimigo (com as versões tingidas), ou null. */
  getEnemyFrame(id: string, quadro: string): EnemySprite | null {
    return this.folhas.get(id)?.frames[quadro] ?? null;
  }

  /** Imagem de um prop de cenário, ou undefined. */
  getProp(id: string): HTMLCanvasElement | undefined {
    return this.props.get(id);
  }

  /** Textura do piso da fase (chave fase1..fase7 ou extra), ou undefined. */
  getPiso(chave: string): HTMLCanvasElement | undefined {
    return this.pisos.get(chave);
  }

  /** Retrato para a cutscene, ou undefined. */
  getRetrato(id: string): HTMLCanvasElement | undefined {
    return this.retratos.get(id);
  }

  /** NPC (evento, aprendiz ou jovem): 2 quadros, ou undefined. */
  getNpc(id: string): Faixa | undefined {
    return this.npcs.get(id);
  }

  /** Imagem de uma comida do chão, ou undefined (vale o desenho por código). */
  getComida(id: string): Faixa | undefined {
    return this.comidas.get(id);
  }

  /** Ícone de um colecionável da Galeria do Mauro, ou undefined (vale o desenho por código). */
  getGaleria(id: string): Faixa | undefined {
    return this.galeria.get(id);
  }

  /** Personagem desnorteado depois do transe: 2 quadros, ou undefined. */
  getDesnorteado(id: string): Faixa | undefined {
    return this.desnorteados.get(id);
  }

  /** Personagem do Comitê em transe: 2 quadros, ou undefined. */
  getTranse(id: string): Faixa | undefined {
    return this.transe.get(id);
  }

  /** Imagem do veículo, ou undefined se não houver PNG (vale o desenho por código). */
  getVeiculo(id: string): Faixa | undefined {
    return this.veiculos.get(id);
  }

  /** Imagem da arma na mão, ou undefined se não houver PNG (vale o desenho antigo). */
  getArma(id: string): Faixa | undefined {
    return this.armas.get(id);
  }

  /** Imagem animada do projétil, ou undefined se não houver PNG. */
  getProjetil(kind: string): Faixa | undefined {
    return this.projeteis.get(kind);
  }

  /** Tenta carregar as imagens de armas e projéteis; o que faltar segue com o desenho por código. */
  carregarArmas(base = '/assets/sprites'): void {
    const pedir = (pasta: string, tabela: Readonly<Record<string, number>>, destino: Map<string, Faixa>): void => {
      for (const [id, n] of Object.entries(tabela)) {
        const img = new Image();
        img.onload = () => {
          const f = deFaixa(img, n);
          if (f) destino.set(id, f);
        };
        img.onerror = () => {
          /* sem PNG */
        };
        img.src = `${base}/${pasta}/${id}.png`;
      }
    };
    pedir('armas', ARMAS_EXTERNAS, this.armas);
    pedir('projeteis', PROJETEIS_EXTERNOS, this.projeteis);
    pedir('veiculos', VEICULOS_EXTERNOS, this.veiculos);
    pedir('npcs', Object.fromEntries(NPCS_EXTERNOS.map((id) => [id, 2])), this.npcs);
    pedir('transe', Object.fromEntries(TRANSE_EXTERNOS.map((id) => [id, 2])), this.transe);
    pedir('comidas', Object.fromEntries(COMIDAS_EXTERNAS.map((id) => [id, 1])), this.comidas);
    pedir('galeria', Object.fromEntries(GALERIA_EXTERNOS.map((id) => [id, 1])), this.galeria);
    pedir('desnorteados', Object.fromEntries(DESNORTEADOS_EXTERNOS.map((id) => [id, 2])), this.desnorteados);
    // Props de cenário: uma imagem por objeto.
    for (const id of PROPS_EXTERNOS) {
      const img = new Image();
      img.onload = () => {
        const cv = criarCanvas(img.width, img.height);
        cv.getContext('2d')!.drawImage(img, 0, 0);
        this.props.set(id, cv);
      };
      img.onerror = () => {
        /* sem prop: vale o retângulo */
      };
      img.src = `${base}/props/${id}.png`;
    }
    // Pisos: uma textura que se repete.
    for (const chave of PISOS_EXTERNOS) {
      const img = new Image();
      img.onload = () => {
        const cv = criarCanvas(img.width, img.height);
        cv.getContext('2d')!.drawImage(img, 0, 0);
        this.pisos.set(chave, cv);
      };
      img.onerror = () => {
        /* sem textura: vale o piso por código */
      };
      img.src = `${base}/pisos/${chave}.png`;
    }
    // Retratos: uma imagem inteira.
    for (const id of RETRATOS_EXTERNOS) {
      const img = new Image();
      img.onload = () => {
        const cv = criarCanvas(img.width, img.height);
        cv.getContext('2d')!.drawImage(img, 0, 0);
        this.retratos.set(id, cv);
      };
      img.onerror = () => {
        /* sem retrato */
      };
      img.src = `${base}/retratos/${id}.png`;
    }
    // Folhas animadas de inimigos e chefes.
    for (const [id, info] of Object.entries(INIMIGOS_EXTERNOS)) {
      const img = new Image();
      img.onload = () => {
        const nomes = quadrosDe(info.tipo);
        if (img.width % nomes.length !== 0 || img.height === 0) return;
        const w = img.width / nomes.length;
        const frames: Record<string, EnemySprite> = {};
        nomes.forEach((nome, i) => {
          const cv = criarCanvas(w, img.height);
          cv.getContext('2d')!.drawImage(img, i * w, 0, w, img.height, 0, 0, w, img.height);
          frames[nome] = { w, h: img.height, normal: cv, white: tingir(cv, '#ffffff', 0.85), red: tingir(cv, '#ff3030', 0.6) };
        });
        this.folhas.set(id, { tipo: info.tipo, frames });
      };
      img.onerror = () => {
        /* sem folha: vale o desenho por código */
      };
      img.src = `${base}/${info.pasta}/${id}.png`;
    }
  }

  /** Sprite do inimigo ou chefe (null se não houver desenho: o renderer usa o quadrado antigo). */
  getEnemy(id: string): EnemySprite | null {
    let s = this.inimigos.get(id);
    if (s === undefined) {
      const def = ENEMY_SPRITE_DEFS[id];
      s = def ? enemyProcedural(def) : null;
      this.inimigos.set(id, s);
    }
    return s;
  }

  /** Sprite pronto para desenhar: o externo, se já carregou, ou o procedural. */
  get(id: SpriteId): Sprite {
    let s = this.sprites.get(id);
    if (!s) {
      s = procedural(id);
      this.sprites.set(id, s);
    }
    return s;
  }

  /** Tenta carregar /assets/sprites/<nome>.png para todos; quem não existir segue procedural. */
  carregarExternos(base = '/assets/sprites'): void {
    for (const id of Object.keys(SPRITE_DEFS) as SpriteId[]) {
      const img = new Image();
      img.onload = () => {
        const s = deFolha(img);
        if (s) this.sprites.set(id, s);
      };
      img.onerror = () => {
        /* sem PNG: continua o desenho procedural */
      };
      img.src = `${base}/${id}.png`;
    }
  }

  /** Desenha com os pés em (x, y), centralizado, espelhado conforme `facing` (1 = direita). */
  desenhar(ctx: CanvasRenderingContext2D, id: SpriteId, frame: FrameName, x: number, y: number, facing: -1 | 1): void {
    const s = this.get(id);
    const cv = s.frames[frame];
    const left = Math.round(x - s.w / 2);
    const top = Math.round(y - s.h);
    if (facing === 1) {
      ctx.drawImage(cv, left, top);
      return;
    }
    ctx.save();
    ctx.translate(left + s.w, top);
    ctx.scale(-1, 1);
    ctx.drawImage(cv, 0, 0);
    ctx.restore();
  }
}
