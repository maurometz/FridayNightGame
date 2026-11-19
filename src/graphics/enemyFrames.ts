// Quadros de animação dos inimigos e chefes (folhas PNG externas; ver public/assets/sprites/ASSETS_README.md).
// Sem a folha, o jogo continua com o desenho por código (um quadro só, com balanço de 1 pixel).
//
//   Inimigo comum, 8 direções (vista de cima): south, south-east, east, north-east, north, north-west, west, south-west
//   Chefe, 8 quadros:          idle0, idle1, walk0, walk1, attack, special, hurt, stun

import type { World } from '../engine/world';
import type { Enemy } from '../entities/enemy';
import { BOSS_STATE } from '../combat/bossState';
import { estaExausto } from '../combat/salsichas';
import { CHRISTOPHER_CFG } from '../data/bosses';

/** As 8 direções do inimigo comum, na ordem da folha (sentido horário a partir do sul). */
export const DIRECOES = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'] as const;
export const CHEFE_FRAMES = ['idle0', 'idle1', 'walk0', 'walk1', 'attack', 'special', 'hurt', 'stun'] as const;
export type EnemyFrame = (typeof CHEFE_FRAMES)[number] | (typeof DIRECOES)[number];
export type FolhaTipo = 'direcional' | 'chefe';

/** Quais imagens de inimigo existem e onde ficam (public/assets/sprites/<pasta>/<id>.png). */
export const INIMIGOS_EXTERNOS: Readonly<Record<string, { pasta: 'inimigos' | 'chefes'; tipo: FolhaTipo }>> = {
  abacaxi: { pasta: 'inimigos', tipo: 'direcional' },
  azeitona: { pasta: 'inimigos', tipo: 'direcional' },
  cafe: { pasta: 'inimigos', tipo: 'direcional' },
  chimarrao: { pasta: 'inimigos', tipo: 'direcional' },
  cachorroquente: { pasta: 'inimigos', tipo: 'direcional' },
  veioloco: { pasta: 'inimigos', tipo: 'direcional' },
  kpopers: { pasta: 'inimigos', tipo: 'direcional' },
  coelho: { pasta: 'inimigos', tipo: 'direcional' },
  canhoto: { pasta: 'inimigos', tipo: 'direcional' },
  // Chefes. As Salsichas são 4 corpos: salsichas (Geraldo, o líder), monet, toddy e bucky. O Salsichão é a fusão dos quatro (fase 3 da luta).
  salsichas: { pasta: 'chefes', tipo: 'chefe' },
  salsichao: { pasta: 'chefes', tipo: 'chefe' },
  monet: { pasta: 'chefes', tipo: 'chefe' },
  toddy: { pasta: 'chefes', tipo: 'chefe' },
  bucky: { pasta: 'chefes', tipo: 'chefe' },
  juninho: { pasta: 'chefes', tipo: 'chefe' },
  rm: { pasta: 'chefes', tipo: 'chefe' },
  christopher: { pasta: 'chefes', tipo: 'chefe' },
  ale: { pasta: 'chefes', tipo: 'chefe' },
  tiagow: { pasta: 'chefes', tipo: 'chefe' },
  tempo: { pasta: 'chefes', tipo: 'chefe' },
};

export function quadrosDe(tipo: FolhaTipo): readonly EnemyFrame[] {
  return tipo === 'chefe' ? CHEFE_FRAMES : DIRECOES;
}

/** Direção (uma das 8 da folha) para onde o inimigo olha. O ângulo 0 é leste e cresce para o sul (eixo y para baixo). */
export function direcaoDe(facing: number): (typeof DIRECOES)[number] {
  const oitavo = ((Math.round(facing / (Math.PI / 4)) % 8) + 8) % 8; // 0 leste, 1 sudeste, 2 sul, 3 sudoeste...
  const NA_FOLHA = [2, 1, 0, 7, 6, 5, 4, 3]; // índice da folha: sul 0, sudeste 1, leste 2...
  return DIRECOES[NA_FOLHA[oitavo]!]!;
}

/** O chefe está num estado "especial" próprio (comendo, em transe, em birra, apitando, com o Lucas...)? */
function chefeEspecial(world: World, e: Enemy): boolean {
  switch (e.def.id) {
    case 'salsichas':
    case 'monet':
    case 'toddy':
    case 'bucky':
      return e.aiState === BOSS_STATE.AQUECENDO;
    case 'rm':
      return !!world.trance?.caught;
    case 'christopher':
      return e.aiT2 > CHRISTOPHER_CFG.birraAfterS * 0.6;
    case 'ale':
      return e.aiState === BOSS_STATE.PREPARANDO;
    case 'tiagow':
      return world.lucasVisible;
    case 'tempo':
      return e.aiY === 1;
    default:
      return false;
  }
}

/** Qual quadro desenhar agora. `reduzirFlash` troca o quadro de dano pelo normal (acessibilidade). */
export function quadroDoInimigo(world: World, e: Enemy, tipo: FolhaTipo, reduzirFlash = false): EnemyFrame {
  // Inimigo comum: só a direção; o dano é o flash branco (feito pelo renderer).
  if (tipo === 'direcional') return direcaoDe(e.facing);
  if (e.hitFlash > 0 && !reduzirFlash) return 'hurt';
  const passo = Math.floor(world.tick / 9 + e.uid) % 2 === 0 ? 0 : 1;
  if (e.stun > 0 || estaExausto(e)) return 'stun';
  if (chefeEspecial(world, e)) return 'special';
  if (e.aiState === BOSS_STATE.AQUECENDO || e.aiState === BOSS_STATE.PREPARANDO || e.aiState === BOSS_STATE.CARGA) return 'attack';
  if (e.aiState === BOSS_STATE.LIVRE) return passo === 0 ? 'walk0' : 'walk1';
  return Math.floor(world.tick / 20 + e.uid) % 2 === 0 ? 'idle0' : 'idle1';
}

/** Retratos (public/assets/sprites/retratos/<id>.png): imagem única que aparece nas cutscenes. */
export const RETRATOS_EXTERNOS: readonly string[] = [
  'felipe', 'mauro', 'melissa', 'thaisa', 'thayssa', 'lucas',
  'marina', 'matias', 'gideao',
  'tamires', 'rebeca', 'crazy', 'debora', 'francis', 'fabi', 'robson', 'gabriel', 'estevao', 'bigjohn',
  'salsichas', 'monet', 'toddy', 'bucky', 'juninho', 'mariana', 'melina', 'rm', 'christopher', 'ale', 'tiagow', 'tempo',
];

/** NPCs de evento, aprendizes e jovens (public/assets/sprites/npcs/<id>.png): 2 quadros (parado A e B). */
export const NPCS_EXTERNOS: readonly string[] = [
  'pedrao', 'marciano', 'tiagoschneider', 'thiagao', 'miguel', 'valdir', 'oscar', 'jorginho', 'gabi',
  'marina', 'matias', 'gideao',
  'tamires', 'rebeca', 'crazy', 'debora', 'francis', 'fabi', 'robson', 'gabriel', 'estevao', 'bigjohn',
];

/** Ícones dos colecionáveis da Galeria do Mauro (public/assets/sprites/galeria/<id>.png): 1 imagem cada. */
export const GALERIA_EXTERNOS: readonly string[] = [
  'arminha', 'papelao', 'postes', 'guitarra', 'cruzes', 'bola', 'terere', 'oculos', 'chave', 'mascara', 'headset', 'bomba', 'calendario', 'bexiga',
];

/** Comidas do chão (public/assets/sprites/comidas/<id>.png): 1 imagem cada. Ids de FoodId em data/foods.ts. */
export const COMIDAS_EXTERNAS: readonly string[] = ['coxinha', 'paoDeQueijo', 'esfiha', 'brigadeiro', 'brilho'];

/** Personagem do Comitê em transe (public/assets/sprites/transe/<id>.png): 2 quadros (parado A e B). */
export const TRANSE_EXTERNOS: readonly string[] = ['felipe', 'mauro', 'melissa', 'thaisa', 'thayssa'];

/** Personagem desnorteado depois de um transe (public/assets/sprites/desnorteados/<id>.png): 2 quadros (tontinho A e B). */
export const DESNORTEADOS_EXTERNOS: readonly string[] = ['melissa'];

/** Nome de quem fala numa cutscene (texto por extenso) para o id do retrato. */
export const RETRATO_POR_NOME: Readonly<Record<string, string>> = {
  Geraldo: 'salsichas',
  Monet: 'monet',
  Toddy: 'toddy',
  Bucky: 'bucky',
  Juninho: 'juninho',
  Mariana: 'mariana',
  Melina: 'melina',
  RM: 'rm',
  Christopher: 'christopher',
  Alê: 'ale',
  'Tiago W': 'tiagow',
  'O Tempo': 'tempo',
  Marina: 'marina',
  Matias: 'matias',
  Gideão: 'gideao',
};
