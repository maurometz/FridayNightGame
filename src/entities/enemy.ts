import type { EnemyDef } from '../data/enemies';
import type { Poolable } from '../engine/pool';

export interface Enemy extends Poolable {
  /** Identificador único e crescente (poolIndex muda, uid não). */
  uid: number;
  def: EnemyDef;
  x: number;
  y: number;
  hp: number;
  alive: boolean;
  /** Segundos restantes do flash branco ao levar dano. */
  hitFlash: number;
  /** Segundos de atordoamento: não anda nem causa dano. */
  stun: number;
  /** Marcado (Índice Remissivo do Mauro): recebe dano extra. */
  marked: boolean;
  /** Direção da frente, em radianos. O inimigo anda para onde olha e gira com velocidade limitada. */
  facing: number;
  /** Segundos restantes do Holofote da Melissa (nas costas do inimigo). */
  spot: number;
  /** Já recebeu e teve um Holofote acertado (Show Inesperado só explode o primeiro). */
  spotUsed: boolean;
  /** Segundos de desorientação (Flash de Fancam): vaga sem rumo e não causa dano. */
  blind: number;
  /** Velocidade de empurrão (knockback), em px/s. Decai com o atrito. */
  kx: number;
  ky: number;
  /** Quem empurrou (slot do jogador), para creditar o dano de colisão. -1 = ninguém. */
  kbOwner: number;
  /** Segundos até poder sofrer outra colisão de arremesso. */
  collideCd: number;
  /** Segundos de lentidão (-50% de velocidade). Renovado pelas fontes enquanto o inimigo está nelas. */
  slow: number;
  /** Quem Canta Junto (Felipe): aliados que atacam este inimigo causam +10% de dano. */
  focusLeft: number;
  focusOwner: number;
  /** Passe de Holofote (Melissa): aliados acertam este inimigo com crítico. */
  passeLeft: number;
  passeOwner: number;

  // ---- Comportamento (ver combat/enemyAI.ts e combat/bosses.ts) ----
  /** Estado da máquina de estados do comportamento. */
  aiState: number;
  /** Segundos que faltam para a próxima mudança de estado. */
  aiT: number;
  /** Recarga do ataque especial. */
  aiCd: number;
  /** Direção e alvo guardados (investida do motoboy, salto da lixeira...). */
  aiDir: number;
  aiX: number;
  aiY: number;
  /** Ponto de origem (inimigos territoriais). */
  homeX: number;
  homeY: number;
  /** Fugindo depois de levar dano (barata). */
  flee: number;
  /** Fora de alcance: não pode ser atingido nem alvo (espectro sumido). */
  untargetable: boolean;
  /** Contador de ataques (ciclos dos chefes). */
  aiCount: number;
  /** Corpo que divide a vida de outro (uid do líder). 0 = nenhum. As Salsichas usam. */
  leader: number;
  /** Resistência a dano (0 a 1). O Tiago W aprende padrões repetidos. */
  resist: number;
  /** Cronômetro auxiliar dos chefes (birra, resistência, janelas). */
  aiT2: number;
  /** Contagem do ataque de empurrar do RM em volta da encantada (ver combat/bosses.ts). */
  aiW: number;
  /** Auxiliares dos chefes novos (Christopher: slot marcado no pique-pega, cronômetros, esconde-esconde). */
  aiU: number;
  aiV: number;
  aiS: number;
  aiR: number;
}

export function createEnemy(): Enemy {
  return {
    poolIndex: 0,
    uid: 0,
    // Substituído em spawnEnemy; o tipo exige um valor inicial.
    def: undefined as unknown as EnemyDef,
    x: 0,
    y: 0,
    hp: 0,
    alive: false,
    hitFlash: 0,
    stun: 0,
    marked: false,
    facing: 0,
    spot: 0,
    spotUsed: false,
    blind: 0,
    kx: 0,
    ky: 0,
    kbOwner: -1,
    collideCd: 0,
    slow: 0,
    focusLeft: 0,
    focusOwner: -1,
    passeLeft: 0,
    passeOwner: -1,
    aiState: 0,
    aiT: 0,
    aiCd: 0,
    aiDir: 0,
    aiX: 0,
    aiY: 0,
    homeX: 0,
    homeY: 0,
    flee: 0,
    untargetable: false,
    aiCount: 0,
    leader: 0,
    resist: 0,
    aiT2: 0,
    aiW: 0,
    aiU: -1,
    aiV: 0,
    aiS: 0,
    aiR: 0,
  };
}
