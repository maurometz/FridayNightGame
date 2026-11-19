/**
 * Poderes gerais do jogador, dados pelas cartas do pool compartilhado e por algumas exclusivas.
 * Todos começam em zero (sem efeito). A lógica fica em combat/perks.ts.
 */
export interface Perks {
  /** Fração do dano causado que vira cura (0,02 = 2%). */
  lifesteal: number;
  /** HP recuperado a cada abate. */
  killHeal: number;
  /** Dano devolvido em volta de quem leva um golpe. */
  thorns: number;
  /** Chance de desviar de um golpe (0 a 0,5). */
  dodge: number;
  /** Dano extra dos críticos (0,5 faz o crítico valer x2,5). */
  critDamage: number;
  /** Dano extra contra chefes. */
  bossDamage: number;
  /** Dano extra com menos de 50% de HP. */
  lowHpDamage: number;
  /** Dano extra com 90% de HP ou mais. */
  fullHpDamage: number;
  /** Dano extra em inimigos a menos de 3,5 tiles. */
  closeDamage: number;
  /** Dano da explosão que um abate pode causar (0 = sem explosão). */
  killBlast: number;
  /** Escudo recuperado por segundo (até 25% do HP máximo). */
  shieldRegen: number;
  /** Quantas vezes o jogador pode se levantar depois de cair. */
  secondWind: number;
}

export function createPerks(): Perks {
  return {
    lifesteal: 0,
    killHeal: 0,
    thorns: 0,
    dodge: 0,
    critDamage: 0,
    bossDamage: 0,
    lowHpDamage: 0,
    fullHpDamage: 0,
    closeDamage: 0,
    killBlast: 0,
    shieldRegen: 0,
    secondWind: 0,
  };
}
