// Atributos base dos personagens (GDD A.3). Valores iniciais, ajustáveis nos playtests.

export type CharacterId = 'felipe' | 'mauro' | 'melissa' | 'thaisa' | 'thayssa';

export interface CharacterStats {
  readonly id: CharacterId;
  readonly name: string;
  readonly title: string;
  readonly maxHp: number;
  /** Multiplicador sobre a velocidade base (1 = 100%). */
  readonly speed: number;
}

export const CHARACTERS: Readonly<Record<CharacterId, CharacterStats>> = {
  felipe: { id: 'felipe', name: 'Felipe', title: 'O Bardo da Madrugada', maxHp: 100, speed: 1.0 },
  mauro: { id: 'mauro', name: 'Mauro', title: 'O Guardião do Conhecimento Inútil', maxHp: 70, speed: 0.95 },
  melissa: { id: 'melissa', name: 'Melissa', title: 'A Lâmina do Holofote', maxHp: 90, speed: 1.15 },
  thaisa: { id: 'thaisa', name: 'Thaisa', title: 'A Valquíria do Rodízio', maxHp: 150, speed: 0.85 },
  thayssa: { id: 'thayssa', name: 'Thayssa', title: 'A Dínamo Emocional', maxHp: 110, speed: 1.0 },
};
