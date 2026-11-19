// Novo bestiário (LORE seção 7). Substitui os inimigos comuns antigos (robô, barata, pombo, gárgula...).
// Valores iniciais, ajustáveis nos playtests. O motor ainda usa `data/enemies.ts` até a migração.

export type BestiaryId =
  | 'abacaxi'
  | 'azeitona'
  | 'cafe'
  | 'chimarrao'
  | 'cachorroquente'
  | 'veioloco'
  | 'kpopers'
  | 'coelho'
  | 'canhoto';

export type BestiaryBehaviorId =
  | 'tanque-espinhos'
  | 'enxame-poca'
  | 'velocista-explosivo'
  | 'atirador-fervente'
  | 'investida-molho'
  | 'erratico-grito'
  | 'grupo-lightstick'
  | 'teleporte-acelera'
  | 'flanqueador-curvo';

export interface BestiaryDef {
  readonly id: BestiaryId;
  readonly name: string;
  readonly hp: number;
  /** Pixels por segundo. */
  readonly speed: number;
  /** Dano por contato. */
  readonly damage: number;
  readonly radius: number;
  readonly xp: number;
  readonly color: string;
  readonly weight: number;
  readonly groupSize: number;
  readonly turnRate: number;
  readonly behavior: BestiaryBehaviorId;
  /** Descrição do comportamento, em português, para o Bestiário e para a implementação. */
  readonly description: string;
  /** Fases (1 a 7) em que pode aparecer. */
  readonly fases: readonly number[];
  readonly territorial?: boolean;
}

export const BESTIARY: readonly BestiaryDef[] = [
  {
    id: 'abacaxi',
    name: 'Abacaxi Espinhudo',
    hp: 34, speed: 14, damage: 10, radius: 8, xp: 3, color: '#e0b43a', weight: 20, groupSize: 1, turnRate: 2,
    behavior: 'tanque-espinhos',
    description: 'Lento e resistente. Tem espinhos e, ao morrer, dispara espinhos em todas as direções.',
    fases: [1, 2, 5, 6],
  },
  {
    id: 'azeitona',
    name: 'Azeitona Traiçoeira',
    hp: 3, speed: 52, damage: 3, radius: 4, xp: 1, color: '#556b2f', weight: 26, groupSize: 5, turnRate: 6,
    behavior: 'enxame-poca',
    description: 'Pequena, em enxame rápido. Deixa poças escorregadias por onde passa.',
    fases: [1, 2, 3, 6],
  },
  {
    id: 'cafe',
    name: 'Café Hiperativo',
    hp: 8, speed: 66, damage: 4, radius: 5, xp: 2, color: '#6b3e26', weight: 24, groupSize: 1, turnRate: 7,
    behavior: 'velocista-explosivo',
    description: 'Velocista trêmulo. Ao encostar, explode em calor e cafeína.',
    fases: [2, 3, 4, 7],
  },
  {
    id: 'chimarrao',
    name: 'Chimarrão Possesso',
    hp: 16, speed: 18, damage: 5, radius: 7, xp: 2, color: '#4e8a3c', weight: 18, groupSize: 1, turnRate: 3,
    behavior: 'atirador-fervente',
    description: 'Atirador de média distância: água fervente e erva-mate em arco.',
    fases: [3, 5, 6],
  },
  {
    id: 'cachorroquente',
    name: 'Cachorro-Quente Completo',
    hp: 22, speed: 30, damage: 12, radius: 8, xp: 3, color: '#c9803b', weight: 16, groupSize: 1, turnRate: 3,
    behavior: 'investida-molho',
    description: 'Investida pesada em linha reta. Deixa um rastro de molhos que reduz a velocidade.',
    fases: [1, 3, 4, 5],
  },
  {
    id: 'veioloco',
    name: 'Véio Loco',
    hp: 14, speed: 36, damage: 6, radius: 6, xp: 2, color: '#a89a82', weight: 14, groupSize: 1, turnRate: 8,
    behavior: 'erratico-grito',
    description: 'Movimento errático. Seus gritos atordoam e empurram; arremessa coisas aleatórias.',
    fases: [2, 4, 6, 7],
  },
  {
    id: 'kpopers',
    name: 'Idosos Kpopers',
    hp: 10, speed: 24, damage: 4, radius: 6, xp: 3, color: '#d96fa8', weight: 10, groupSize: 4, turnRate: 3,
    behavior: 'grupo-lightstick',
    description: 'Grupo sincronizado de lightsticks na mão. A coreografia dá buff nos inimigos próximos.',
    fases: [4, 7],
  },
  {
    id: 'coelho',
    name: 'Coelho do Relógio',
    hp: 12, speed: 30, damage: 6, radius: 5, xp: 3, color: '#f2efe6', weight: 8, groupSize: 1, turnRate: 6,
    behavior: 'teleporte-acelera',
    description: 'Teleporte curto. Acelera o ritmo ao redor. Pista sutil para o chefe final secreto, o Tempo.',
    fases: [1, 2, 3, 4, 5, 6, 7],
  },
  {
    id: 'canhoto',
    name: 'Canhotos',
    hp: 12, speed: 34, damage: 5, radius: 6, xp: 2, color: '#3f6fb0', weight: 16, groupSize: 2, turnRate: 4,
    behavior: 'flanqueador-curvo',
    description: 'Flanqueadores invertidos. Atacam pelo lado cego com projéteis que curvam.',
    fases: [3, 5, 6, 7],
  },
];

export function bestiaryDaFase(fase: number): readonly BestiaryDef[] {
  return BESTIARY.filter((b) => b.fases.includes(fase));
}
