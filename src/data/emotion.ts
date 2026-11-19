// Ciclo emocional (GDD A.8): quedas (melancólicas) e respiros (esperançosos), por fase (PHASE_MOOD_BEATS).

export type Mood = 'respiro' | 'queda';

/** Duração do fade entre uma paleta e outra (sem corte seco). */
export const MOOD_FADE_S = 3;


export interface PhaseMoodBeat {
  /** Fase (1 a 7) ou 'extra' (Arena do Tempo). */
  readonly fase: number | 'extra';
  /** Posição dentro da fase: 0 = início, 1 = fim. */
  readonly at: number;
  readonly mood: Mood;
  readonly nota: string;
}

export const PHASE_MOOD_BEATS: readonly PhaseMoodBeat[] = [
  { fase: 1, at: 0, mood: 'respiro', nota: 'Sexta começando. Lucas some e a jornada começa pela geladeira.' },
  { fase: 1, at: 0.5, mood: 'queda', nota: 'Caixas de papelão na despensa. Sem comentário.' },
  { fase: 2, at: 0, mood: 'respiro', nota: 'Interior calmo. Cuca e bobeira.' },
  { fase: 2, at: 0.8, mood: 'respiro', nota: 'Portal com o Lucas e os aprendizes.' },
  { fase: 3, at: 0, mood: 'respiro', nota: 'Parcão de tarde. Lago e luz dourada.' },
  { fase: 3, at: 0.6, mood: 'queda', nota: 'Quiosque do Parcão: Mauro para de anotar tudo.' },
  { fase: 4, at: 0, mood: 'queda', nota: 'Cinema escuro. O relógio do saguão está parado.' },
  { fase: 4, at: 0.7, mood: 'respiro', nota: 'RM derrotado. A Melissa volta ao grupo.' },
  { fase: 5, at: 0, mood: 'respiro', nota: 'Expointer: gente, boi, feira.' },
  { fase: 5, at: 0.6, mood: 'queda', nota: 'Galpão: calendário de setembro.' },
  { fase: 6, at: 0, mood: 'respiro', nota: 'Sítio da Dona Marlene, cuia rodando.' },
  { fase: 6, at: 0.6, mood: 'queda', nota: 'Varanda da Dona Marlene: calendário velho na parede.' },
  { fase: 7, at: 0, mood: 'queda', nota: 'Igreja Unidos. O último evento começa.' },
  { fase: 7, at: 0.5, mood: 'respiro', nota: 'Salão cheio, jovens aplaudindo.' },
  { fase: 7, at: 0.9, mood: 'queda', nota: 'Tiago W derrotado. O relógio da parede para.' },
  { fase: 'extra', at: 0, mood: 'queda', nota: 'Arena do Tempo. Ponteiros, folhas de calendário, silêncio.' },
  { fase: 'extra', at: 0.8, mood: 'respiro', nota: 'O grupo sobrevive ao Tempo. Fecha no epílogo.' },
];

/** Duração da queda forte quando o relógio para, antes da Arena do Tempo (segundos). */
export const RELOGIO_PARA_QUEDA_S = 7;
