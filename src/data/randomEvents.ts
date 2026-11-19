// Eventos aleatórios (LORE seção 8): no máximo 1 por fase.
// Os de tipo "minigame" PAUSAM o combate e o spawn infinito. Os de tipo "tempo-real" rolam durante o combate.

export type EventId =
  | 'bexigas'
  | 'domingao'
  | 'fruitninja'
  | 'lanche'
  | 'thiagao'
  | 'miguel'
  | 'valdir'
  | 'oscar'
  | 'jorginho'
  | 'gabi';

export type EventKind = 'minigame' | 'tempo-real';

export interface RandomEventDef {
  readonly id: EventId;
  readonly name: string;
  readonly kind: EventKind;
  /** Quem aparece (para o Códice de Eventos). */
  readonly npc: string;
  readonly description: string;
  /** Pausa o combate e o spawn enquanto roda. */
  readonly pausesCombat: boolean;
  /** Peso no sorteio. */
  readonly weight: number;
  /** Frases de exemplo (balões). */
  readonly lines?: readonly string[];
}

export const RANDOM_EVENTS: readonly RandomEventDef[] = [
  // ---- Minigames: pausam o combate e o spawn ----
  {
    id: 'bexigas',
    name: 'Arremessar Bexigas',
    kind: 'minigame',
    npc: 'O grupo',
    pausesCombat: true,
    weight: 10,
    description: 'Os personagens se alinham e rebatem bexigas d\'água de um lado para o outro. A recompensa escala com a pontuação.',
  },
  {
    id: 'domingao',
    name: 'Domingão do Pedrão',
    kind: 'minigame',
    npc: 'Pedrão (marido da Débora)',
    pausesCombat: true,
    weight: 10,
    description: 'Pedrão surge vestido de apresentador de reality show e faz um quiz de trivia, com zonas de resposta no chão.',
    lines: ['Boa noite, Brasil! Quem quer ser aprovado?', 'Corre pra letra B! É B, né? Ou é A.'],
  },
  {
    id: 'fruitninja',
    name: 'Fruit Ninja Marciano',
    kind: 'minigame',
    npc: 'Marciano (pai da Thaisa, agricultor)',
    pausesCombat: true,
    weight: 10,
    description: 'Marciano passa dirigindo o caminhãozinho e derruba frutas. Cada fruta coletada dá um buff diferente.',
    lines: ['Pega aí, que é da roça!'],
  },
  // ---- Tempo real: acontecem durante o combate ----
  {
    id: 'lanche',
    name: 'Tiago Schneider chega com lanche',
    kind: 'tempo-real',
    npc: 'Tiago Schneider',
    pausesCombat: false,
    weight: 10,
    description: 'NPC quieto. Chega, entrega o lanche que cura o grupo e sai sem falar quase nada.',
    lines: ['...', 'Trouxe lanche.'],
  },
  {
    id: 'thiagao',
    name: 'QUE MOMENTO, THIAGÃO',
    kind: 'tempo-real',
    npc: 'Thiagão (pastor maratonista)',
    pausesCombat: false,
    weight: 10,
    description: 'Passa correndo. 50% de chance de encorajar o grupo (buff) e 50% de exortar (debuff).',
    lines: ['QUE MOMENTO!', 'Vamos lá, time! Sem moleza!'],
  },
  {
    id: 'miguel',
    name: 'Pega Miguel',
    kind: 'tempo-real',
    npc: 'Miguel',
    pausesCombat: false,
    weight: 10,
    description: 'Miguel corre pelo mapa como um treasure goblin. Acertá-lo gera XP extra.',
  },
  {
    id: 'valdir',
    name: 'Valdir aparece de fininho',
    kind: 'tempo-real',
    npc: 'Valdir',
    pausesCombat: false,
    weight: 8,
    description: 'Mais velho. Aparece no canto da tela, solta uma frase de impacto e vai embora.',
    lines: ['Tá bom assim.', 'Isso aí já deu.'],
  },
  {
    id: 'oscar',
    name: 'Oscar Mágico',
    kind: 'tempo-real',
    npc: 'Oscar (cunhado da Melissa)',
    pausesCombat: false,
    weight: 8,
    description: 'Surge do nada, faz um truque de mágica aleatório no mapa e some.',
    lines: ['Prestem atenção. Nada na manga. (tem tudo na manga)'],
  },
  {
    id: 'jorginho',
    name: 'Jorginho Pitbull',
    kind: 'tempo-real',
    npc: 'Jorginho Pitbull',
    pausesCombat: false,
    weight: 8,
    description:
      'Idoso metido a atleta que não sabe mexer em tecnologia. Exibe mensagens caóticas cheias de emojis na tela; o caos visual atordoa os inimigos.',
    lines: [
      '👨🏾‍🍳👨🏾‍🍳👨🏾‍🍳Opsssss !!! M.Showww!!! Temos Bons Especialistas no Ramo. 👨🏾‍🍳 🔪. 🔪. 🔪 🔥. 🥩. 🔥.🍴🍽️🍴🍽️',
      '🤷🏾‍♂️Deuuuuu. !!! 🤌🏾. 🤌🏾. 🤌🏾. Pra Hoje !!! ---------🙃------- ---------😁--------',
    ],
  },
  {
    id: 'gabi',
    name: 'Gabi (Médica)',
    kind: 'tempo-real',
    npc: 'Gabi (esposa do Juninho)',
    pausesCombat: false,
    weight: 8,
    description: 'Aparece como NPC de suporte e cura o grupo.',
    lines: ['Quem está com dor? Todo mundo? Certo.'],
  },
];

/** Eventos que pausam o combate e o spawn. */
export const PAUSING_EVENTS = RANDOM_EVENTS.filter((e) => e.pausesCombat);

/** Quantos eventos podem disparar por fase. */
export const MAX_EVENTS_PER_PHASE = 1;

export function eventById(id: EventId): RandomEventDef {
  return RANDOM_EVENTS.find((e) => e.id === id)!;
}
