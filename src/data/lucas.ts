// O Sábio Lucas e os três aprendizes, os Wagners (LORE seção 3).
// Lucas aparece "volta e meia" durante as fases com conselhos (bom, confuso, inútil) ou abrindo caminhos.

export type AdviceKind = 'bom' | 'confuso' | 'inutil';

export interface LucasAdvice {
  readonly kind: AdviceKind;
  readonly text: string;
  /** O que o Lucas diz depois que o efeito acontece. */
  readonly reply: string;
}

/** Os três conselhos clássicos (mantêm os efeitos de `data/bosses.ts`: ADVICE_*). */
export const LUCAS_ADVICE: readonly LucasAdvice[] = [
  { kind: 'bom', text: 'Fiquem juntos. Sempre funciona melhor.', reply: 'Viu? Às vezes o óbvio funciona.' },
  { kind: 'confuso', text: 'Usem a estratégia de sempre.', reply: 'Hm. Esse não era o melhor conselho.' },
  { kind: 'inutil', text: 'Respirem fundo e esperem o chefe cansar.', reply: 'Também não ajuda, eu sei.' },
];

export type ApprenticeId = 'marina' | 'matias' | 'gideao';

export type ApprenticePowerId = 'dica-tatica' | 'bonus-xp' | 'bonus-critico' | 'encantar' | 'drop-extra' | 'nenhum';

export interface ApprenticeDef {
  readonly id: ApprenticeId;
  readonly name: string;
  /** Posição na fila de idade (1 = mais velha). */
  readonly ordem: 1 | 2 | 3;
  readonly bio: string;
  readonly powers: readonly ApprenticePowerId[];
  readonly powerNote: string;
  /** Falas de exemplo, usadas quando o aprendiz aparece em uma fase. */
  readonly lines: readonly string[];
}

export const APPRENTICES: readonly ApprenticeDef[] = [
  {
    id: 'marina',
    name: 'Marina',
    ordem: 1,
    bio: 'A mais velha. Calada e observadora, sabe muito mais do que fala.',
    powers: ['dica-tatica', 'bonus-xp', 'bonus-critico'],
    powerNote: 'Dá dicas reais sobre os chefes. Bônus de XP ou de crítico por um tempo.',
    lines: [
      'Ele pisa sempre no mesmo lugar antes de atacar.',
      'Olha o chão. O aviso está no chão.',
      '(aponta em silêncio para a esquerda)',
    ],
  },
  {
    id: 'matias',
    name: 'Matias',
    ordem: 2,
    bio: 'O do meio. Agitado, fala como gente grande, com palavras difíceis e postura de veterano.',
    powers: ['nenhum'],
    powerNote: 'Só comenta. Os "conselhos" dele são palavras difíceis que quase sempre fazem sentido.',
    lines: [
      'Convenhamos, a conjuntura é desfavorável. Proponho avançar com cautela.',
      'Em minha vasta experiência de oito anos, isso é um mau presságio.',
      'Eu já enfrentei situações análogas. Na terça.',
    ],
  },
  {
    id: 'gideao',
    name: 'Gideão',
    ordem: 3,
    bio: 'O menor. Usa a aura de fofura como estratégia para conseguir o que quer.',
    powers: ['encantar', 'drop-extra'],
    powerNote: 'Encanta e paralisa inimigos por alguns segundos, ou gera drops extras.',
    lines: ['(olha com olhos enormes para o inimigo)', 'Posso ficar com isso? Por favor?', '(abraça a perna do chefe)'],
  },
];

export interface LucasMoment {
  readonly id: string;
  /** Fase (1 a 7). */
  readonly fase: number;
  readonly kind: 'conselho' | 'abrir-caminho' | 'aprendizes' | 'abertura' | 'portal';
  readonly lines: readonly { readonly who: 'lucas' | ApprenticeId | 'comite'; readonly text: string }[];
}

const L = (who: 'lucas' | ApprenticeId | 'comite', text: string) => ({ who, text });

/** Cutscene inicial: sexta à noite na casa do Felipe. */
export const INTRO_CUTSCENE: readonly { readonly who: 'lucas' | 'felipe' | 'mauro' | 'melissa' | 'thaisa' | 'thayssa'; readonly text: string }[] = [
  { who: 'lucas', text: '(surge do nada, de blazer preto, com o cajado brilhando) Os Escolhidos do Comitê!' },
  { who: 'felipe', text: 'Lucas, a porta tem campainha.' },
  { who: 'lucas', text: 'Venho pedir ajuda para organizar o último evento de jovens do ano.' },
  { who: 'melissa', text: 'O último? Por que "último"?' },
  { who: 'lucas', text: 'Foi só o jeito de falar. O fim de ano. Continuemos.' },
  { who: 'lucas', text: 'O problema é grave: o Big John sumiu. E vários jovens estão em apuros.' },
  { who: 'mauro', text: 'Eu preciso de uma lista. Quem, onde, desde quando.' },
  { who: 'lucas', text: 'Eu despacho vocês. A jornada começa na cozinha. Mais precisamente, na geladeira.' },
  { who: 'thaisa', text: 'Eu estava mesmo com fome.' },
];

export const LUCAS_MOMENTS: readonly LucasMoment[] = [
  {
    id: 'lucas-f1-aviso',
    fase: 1,
    kind: 'abrir-caminho',
    lines: [L('lucas', 'Atrás da geladeira há uma passagem. Eu a abri. Não me agradeçam.')],
  },
  {
    id: 'lucas-f3-conselho',
    fase: 3,
    kind: 'conselho',
    lines: [L('lucas', 'Um conselho, Escolhidos: evitem os lasers.'), L('comite', 'Esse é bom, Lucas.')],
  },
  {
    id: 'lucas-f2-portal',
    fase: 2,
    kind: 'portal',
    lines: [
      L('lucas', 'Chegaram! Estes são meus aprendizes: Marina, Matias e Gideão.'),
      L('matias', 'Prazer. Sou o mais experiente da turma, sem dúvida alguma.'),
      L('marina', '(acena)'),
      L('gideao', '(sorri para todo mundo ao mesmo tempo)'),
      L('lucas', 'Abriremos o portal para o Parcão. Tragam o que for preciso.'),
    ],
  },
  {
    id: 'lucas-f5-conselho',
    fase: 5,
    kind: 'conselho',
    lines: [L('lucas', 'Não discutam com o Christopher. Ele é um conceito.'), L('comite', 'E o que a gente faz?'), L('lucas', 'Dêem atenção a ele. Ou não. Está nos livros.')],
  },
  {
    id: 'lucas-f6-conselho',
    fase: 6,
    kind: 'conselho',
    lines: [L('lucas', 'O Alê comanda o retiro. Obedeçam ao apito.')],
  },
];

/** Linha final do Lucas antes do falso chefe final (reaproveita a lore antiga). */
export const LUCAS_LINHA_FINAL = 'Toda profecia tem um último capítulo. A gente só não escolhe quando ele começa.';
