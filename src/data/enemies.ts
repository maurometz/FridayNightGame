// Inimigos comuns e chefes da campanha (GDD A.7, LORE seções 10 e 11).
// Os comuns vêm do bestiário (`bestiary.ts`); os chefes têm um EnemyDef cada, com os dados de `bosses.ts`.
// Valores iniciais, ajustáveis nos playtests.

import { BESTIARY, type BestiaryBehaviorId, type BestiaryDef, type BestiaryId } from './bestiary';

export type BossEnemyId = 'salsichas' | 'juninho' | 'rm' | 'christopher' | 'ale' | 'tiagow' | 'tempo';
/** Os outros três cachorros das Salsichas: corpos que dividem a vida do Geraldo (`salsichas`). */
export type SalsichaFollowerId = 'monet' | 'toddy' | 'bucky';
export type EnemyTypeId = BestiaryId | BossEnemyId | SalsichaFollowerId;

/** Comportamento do inimigo (ver combat/enemyAI.ts e combat/bosses.ts). */
export type BehaviorId = 'chase' | BestiaryBehaviorId | 'boss';

export interface EnemyDef {
  readonly id: EnemyTypeId;
  readonly name: string;
  readonly hp: number;
  /** Pixels por segundo. */
  readonly speed: number;
  /** Dano por contato. */
  readonly damage: number;
  readonly radius: number;
  /** XP da gema solta ao morrer. */
  readonly xp: number;
  readonly color: string;
  /** Peso no sorteio de spawn. */
  readonly weight: number;
  /** Quantos nascem juntos (enxame). */
  readonly groupSize: number;
  /** Chefe. */
  readonly boss?: boolean;
  /** Velocidade de giro em rad/s. Quanto menor, mais fácil de flanquear. */
  readonly turnRate: number;
  readonly behavior: BehaviorId;
  /** Nasce já dentro da tela, em volta do jogador (inimigos territoriais ou parados). */
  readonly territorial?: boolean;
}

function doBestiario(b: BestiaryDef): EnemyDef {
  return {
    id: b.id,
    name: b.name,
    hp: b.hp,
    speed: b.speed,
    damage: b.damage,
    radius: b.radius,
    xp: b.xp,
    color: b.color,
    weight: b.weight,
    groupSize: b.groupSize,
    turnRate: b.turnRate,
    behavior: b.behavior,
    territorial: b.territorial,
  };
}

/** Todos os inimigos comuns, na ordem do bestiário. */
export const COMUNS: readonly EnemyDef[] = BESTIARY.map(doBestiario);

/** Inimigos comuns de cada fase da campanha (índice 0 = fase 1 ... 6 = fase 7, 7 = Arena do Tempo). */
export const PHASE_ENEMIES: readonly (readonly EnemyDef[])[] = [1, 2, 3, 4, 5, 6, 7, 8].map((fase) => {
  const f = fase === 8 ? [1, 2, 3, 4, 5, 6, 7] : [fase];
  const lista = COMUNS.filter((d) => BESTIARY.find((b) => b.id === d.id)!.fases.some((x) => f.includes(x)));
  return lista.length > 0 ? lista : COMUNS;
});

const chefe = (id: BossEnemyId, name: string, hp: number, speed: number, radius: number, xp: number, color: string): EnemyDef => ({
  id,
  name,
  hp,
  speed,
  damage: 14,
  radius,
  xp,
  color,
  weight: 0,
  groupSize: 1,
  boss: true,
  turnRate: 1.2,
  behavior: 'boss',
});

// ---- Chefes (um por fase; ver BOSS_ROSTER em bosses.ts para a lore) ----
export const SALSICHAS = chefe('salsichas', 'As Salsichas: Geraldo, Monet, Toddy e Bucky', 1100, 30, 16, 40, '#b5651d');

const corpo = (id: SalsichaFollowerId, name: string, color: string): EnemyDef => ({ ...chefe('salsichas', name, 1, 30, 16, 0, color), id });
/** Monet, Toddy e Bucky: seguem o Geraldo e sofrem o dano pela mesma barra de vida. */
export const SALSICHAS_CORPOS: readonly EnemyDef[] = [corpo('monet', 'Monet', '#d9a15a'), corpo('toddy', 'Toddy', '#7a3f10'), corpo('bucky', 'Bucky', '#e6c9a0')];
export const JUNINHO = chefe('juninho', 'Juninho e as Azuletes', 2200, 16, 22, 60, '#3a6fb5');
export const RM = chefe('rm', 'RM (Kim Namjoon)', 2800, 20, 22, 80, '#9a7fd1');
export const CHRISTOPHER = chefe('christopher', 'Christopher', 3500, 22, 26, 90, '#cfe8ff');
export const ALE = chefe('ale', 'Alê', 4200, 18, 22, 100, '#d9a441');
export const TIAGOW = chefe('tiagow', 'Tiago W', 5200, 16, 22, 120, '#5b5b66');
export const TEMPO = chefe('tempo', 'O Próprio Tempo', 7000, 12, 36, 200, '#e8e2c8');

/** Chefes na ordem da campanha. A fase 2 não tem chefe. */
export const BOSSES: readonly EnemyDef[] = [SALSICHAS, JUNINHO, RM, CHRISTOPHER, ALE, TIAGOW, TEMPO];

export function bossDef(id: BossEnemyId): EnemyDef {
  return BOSSES.find((b) => b.id === id)!;
}
