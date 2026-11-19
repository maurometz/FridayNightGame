// Pool de comidas (GDD A.4, Thaisa). Compartilhado: qualquer jogador pode comer.

export type FoodId = 'coxinha' | 'paoDeQueijo' | 'esfiha' | 'brigadeiro' | 'brilho';

export interface FoodDef {
  readonly id: FoodId;
  readonly name: string;
  readonly heal: number;
  /** Acúmulos de Pico de Glicose (só a Thaisa ganha). */
  readonly stacks: number;
  /** Peso no sorteio. O Brigadeiro é raro. */
  readonly weight: number;
  readonly color: string;
}

export const FOODS: readonly FoodDef[] = [
  { id: 'coxinha', name: 'Coxinha', heal: 15, stacks: 0, weight: 40, color: '#e9a23b' },
  { id: 'paoDeQueijo', name: 'Pão de Queijo', heal: 10, stacks: 1, weight: 30, color: '#f6d776' },
  { id: 'esfiha', name: 'Esfiha', heal: 20, stacks: 0, weight: 25, color: '#c4472f' },
  { id: 'brigadeiro', name: 'Brigadeiro', heal: 5, stacks: 2, weight: 5, color: '#4a2c1a' },
];

/** Brilho da Risada Contagiante (Thayssa): cura pequena. Não está no sorteio normal de comidas. */
export const BRILHO: FoodDef = { id: 'brilho', name: 'Brilho', heal: 6, stacks: 0, weight: 0, color: '#ff8fd0' };

export type FoodBuffKind = 'velocidade' | 'dano' | 'regeneracao';

/** Cardápio do Dia: buff aleatório extra ao comer. */
export const FOOD_BUFFS: readonly { id: FoodBuffKind; name: string }[] = [
  { id: 'velocidade', name: '+20% de velocidade' },
  { id: 'dano', name: '+15% de dano' },
  { id: 'regeneracao', name: 'Regeneração' },
];

export const FOOD_BUFF_SPEED_MUL = 1.2;
// O buff de dano da comida mexe no multiplicador permanente (`baseDamageMul`) e é desfeito ao acabar.
export const FOOD_BUFF_DAMAGE_MUL = 1.15;
export const FOOD_BUFF_REGEN_PER_S = 3;
