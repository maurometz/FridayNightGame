import { FOCO_MAX } from '../data/mauro';

export interface MauroMods {
  /** Nota de Pé de Página: Notas custam 6 de Foco. */
  peDePagina: boolean;
  /** Referência Cruzada: a runa se divide em duas ao atingir um alvo (uma vez por runa). */
  referencia: boolean;
  /** Sobrecarga Enciclopédica: +5% de dano a cada 100 abates, com teto. */
  sobrecarga: boolean;
  /** Índice Remissivo: runas marcam inimigos, que recebem +10% de dano. */
  indice: boolean;
  /** Bibliografia Comentada: a cada 10 abates, +1 carga de salto. */
  biblio: boolean;
  /** Edição Revisada: Foco máximo +30 e regeneração +2/s. */
  edicao: boolean;
  /** Sala de Leitura Silenciosa: parado por 3 s, +20% de XP e de regeneração de Foco. */
  sala: boolean;
  /** Rodapé do Rodapé: cada runa deixa um eco que repete o dano após 1 s. */
  rodape: boolean;
  /** Mestre da Nota Longa: a cada 5 saltos a runa explode em área. */
  mestre: boolean;
  /** Enciclopédia Viva: +1 de dano por nível. */
  enciclopedia: boolean;
  /** Revisão de Prova: recupera Foco ao acertar um chefe. */
  revisao: boolean;
  /** Órbita de Clássicos: livros orbitam e empurram inimigos. */
  orbita: boolean;
  /** Post-it Colado: as runas deixam o inimigo lento por 1,5 s. */
  postit: boolean;
  /** Fichamento: Foco máximo +25 e regeneração +1,5 por segundo. */
  fichamento: boolean;
  /** Nota Dupla: a cada 5 ataques, uma segunda runa sai junto. */
  notaDupla: boolean;
  // ---- Cartas de equipe ----
  /** Trabalho em Grupo: uma runa por ataque pula para um aliado (+10% de dano por 3 s). */
  trabalho: boolean;
  /** Resumo Coletivo: aliados que sofrem dano dividem 10% com o Mauro, que ganha Foco. */
  resumo: boolean;
  /** Bibliografia Compartilhada: abates do Mauro aceleram as recargas de aliados próximos. */
  biblioColetiva: boolean;
  /** Revisão por Pares: quando um aliado sobe de nível, o Mauro ganha 50 de XP. */
  pares: boolean;
  /** Índice Coletivo: a cada 100 abates do grupo, +5% de dano para todos. */
  indiceColetivo: boolean;
}

export interface Echo {
  x: number;
  y: number;
  /** Segundos até o eco bater. */
  t: number;
  damage: number;
}

export interface MauroState {
  readonly type: 'mauro';
  foco: number;
  cd: number;
  /** Segundos parado (Sala de Leitura Silenciosa). */
  stillTime: number;
  /** Segundos sem levar dano (Recordação Perfeita). */
  safeTime: number;
  orbitAngle: number;
  /** Recarga de dano de cada livro orbitante. */
  bookCd: number[];
  echoes: Echo[];
  /** Cargas de salto da Bibliografia Comentada. */
  jumpCharges: number;
  killsSinceCharge: number;
  /** Rerolls grátis da Memória Fotográfica (o sistema de reroll chega na Fase 3). */
  freeRerolls: number;
  /** Ataques feitos (Nota Dupla). */
  attackCount: number;
  mods: MauroMods;
}

export function createMauroState(): MauroState {
  return {
    type: 'mauro',
    foco: FOCO_MAX,
    cd: 0,
    stillTime: 0,
    safeTime: 0,
    orbitAngle: 0,
    bookCd: [0, 0, 0],
    echoes: [],
    jumpCharges: 0,
    killsSinceCharge: 0,
    freeRerolls: 0,
    attackCount: 0,
    mods: {
      peDePagina: false,
      referencia: false,
      sobrecarga: false,
      indice: false,
      biblio: false,
      edicao: false,
      sala: false,
      rodape: false,
      mestre: false,
      enciclopedia: false,
      revisao: false,
      orbita: false,
      postit: false,
      fichamento: false,
      notaDupla: false,
      trabalho: false,
      resumo: false,
      biblioColetiva: false,
      pares: false,
      indiceColetivo: false,
    },
  };
}
