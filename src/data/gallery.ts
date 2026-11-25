// A Galeria do Mauro: colecionáveis (LORE seção 9).
// Não têm impacto mecânico. São difíceis de achar, não aparecem em todos os mapas e
// NÃO dá para coletar todos em uma única run (incentiva explorar e jogar de novo).

export type CollectibleId =
  | 'arminha'
  | 'papelao'
  | 'postes'
  | 'guitarra'
  | 'cruzes'
  | 'bola'
  | 'terere'
  | 'oculos'
  | 'chave'
  | 'mascara'
  | 'headset'
  | 'bomba'
  | 'calendario'
  | 'bexiga';

export interface CollectibleDef {
  readonly id: CollectibleId;
  readonly name: string;
  /** Texto in-character da Galeria do Mauro. */
  readonly description: string;
  /** Mapas (fases 1 a 7) onde pode aparecer. Nunca todos os itens em todos os mapas. */
  readonly fases: readonly number[];
  /** Chance de spawn quando o mapa permite (0 a 1). Valores baixos de propósito. */
  readonly spawnChance: number;
}

export const COLLECTIBLES: readonly CollectibleDef[] = [
  { id: 'arminha', name: 'Arminha de água', description: 'Catalogada: a arma mais temida do grupo. Nunca matou ninguém. Já molhou todo mundo.', fases: [1, 3], spawnChance: 0.12 },
  { id: 'papelao', name: 'Papelão', description: 'Item 002. Aparentemente é só papelão. Fui avisado de que tem mais coisa por baixo.', fases: [1, 2], spawnChance: 0.12 },
  { id: 'postes', name: 'Postes de Lúmen', description: 'Usados quando criamos Lúmen. Anotei onde ficam. Eram mais altos do que lembro.', fases: [2, 3], spawnChance: 0.1 },
  { id: 'guitarra', name: 'Guitarra do Nero', description: 'A lendária guitarra do guitarrista Nero, da banda The High Spirits. Ninguém tocou. Todo mundo quis.', fases: [4, 7], spawnChance: 0.08 },
  { id: 'cruzes', name: 'Cruzes do Djanho', description: 'Achamos que o Alê ia surtar. Está nas notas: ele não surtou. Pelo menos não onde a gente viu.', fases: [6], spawnChance: 0.1 },
  { id: 'bola', name: 'Bola de vôlei', description: 'Comprada de última hora. Ninguém sabe quem pagou. Eu sei, mas está anotado só pra mim.', fases: [3, 6], spawnChance: 0.12 },
  { id: 'terere', name: 'Tereré', description: 'Para os dias quentes. A Fabi discorda: para todos os dias.', fases: [5, 6], spawnChance: 0.1 },
  { id: 'oculos', name: 'Óculos de amigurumi', description: 'Um presente especial de alguém especial. Não vou escrever quem. Está no meu fichário.', fases: [4, 7], spawnChance: 0.07 },
  { id: 'chave', name: 'Chave do C3', description: 'A Melissa não deixa ninguém tocar. Eu toquei uma vez. Tecnicamente, foi um esbarrão.', fases: [3, 5], spawnChance: 0.08 },
  { id: 'mascara', name: 'Máscara de macaco com uma fita na boca', description: 'Referência ao Bombanana. Não perguntem. Eu mesmo já parei de perguntar.', fases: [2, 4], spawnChance: 0.1 },
  { id: 'headset', name: 'Headset', description: 'Pelas noites de Discord. O microfone ainda está ligado. Sempre está.', fases: [1, 4, 7], spawnChance: 0.1 },
  { id: 'bomba', name: 'Bomba', description: 'Referência ao Bomb Party. A sílaba era "ÇÃO". Foi um massacre.', fases: [3, 5], spawnChance: 0.1 },
  {
    id: 'calendario',
    name: 'Calendário marcado no dia 7 de setembro',
    description: 'A primeira vez que jogamos online. Eu guardei. Não me peçam para guardar os de dezembro.',
    fases: [5, 7],
    spawnChance: 0.06,
  },
  { id: 'bexiga', name: 'Bexiga d\'água', description: 'Obrigatória em todos os retiros. Sempre estoura antes da hora, sempre na pessoa errada.', fases: [2, 6], spawnChance: 0.12 },
];

/**
 * Máximo de colecionáveis que podem aparecer em uma única run.
 * Menor que o total de propósito: nunca dá para coletar os 14 de uma vez.
 */
export const MAX_COLLECTIBLES_PER_RUN = 3;

/** Máximo por mapa. */
export const MAX_COLLECTIBLES_PER_PHASE = 2;

export const GALLERY_TITLE = 'Galeria do Mauro';

export function collectiblesDaFase(fase: number): readonly CollectibleDef[] {
  return COLLECTIBLES.filter((c) => c.fases.includes(fase));
}
