// Os jovens a serem resgatados (LORE seção 4). Um ou dois por fase; cada encontro tem uma cutscene curta.
// Regras de escrita: linhas de até 90 caracteres. Ninguém anuncia que está indo embora.

import type { CharacterId } from './characters';

export type YouthId =
  | 'tamires'
  | 'rebeca'
  | 'crazy'
  | 'debora'
  | 'francis'
  | 'fabi'
  | 'robson'
  | 'gabriel'
  | 'estevao'
  | 'bigjohn';

/** Efeito (leve) ao resgatar. Os jovens ajudam, mas a graça é o encontro. */
export type RescueEffectId =
  | 'cura'
  | 'xp'
  | 'escudo'
  | 'velocidade'
  | 'dano'
  | 'aleatorio'
  | 'nenhum';

export interface YouthLine {
  /** Id do falante: um jovem, um personagem do Comitê, ou o Lucas. */
  readonly who: YouthId | CharacterId | 'lucas';
  readonly text: string;
}

export interface YouthDef {
  readonly id: YouthId;
  readonly name: string;
  /** Uma frase sobre quem é (vai para o Códice dos Jovens). */
  readonly bio: string;
  /** Fase (1 a 7) em que é resgatado. */
  readonly fase: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  /** Quem é resgatado junto (Francis e Fabi). */
  readonly pairedWith?: YouthId;
  /** É do Comitê ou só do grupo maior de jovens. */
  readonly doComite: boolean;
  /** Relações citadas no texto (parentesco, amizade). */
  readonly relations: readonly string[];
  readonly effect: RescueEffectId;
  readonly effectNote: string;
  /** Cutscene curta de encontro. */
  readonly encounter: readonly YouthLine[];
}

const Y = (who: YouthLine['who'], text: string): YouthLine => ({ who, text });

export const YOUTH: readonly YouthDef[] = [
  {
    id: 'tamires',
    name: 'Tamires',
    bio: 'Atleta de alta performance com baixa energia para todo o resto.',
    fase: 1,
    doComite: true,
    relations: ['Irmã da Thaisa', 'BFF da Melissa'],
    effect: 'cura',
    effectNote: 'Cura o grupo e depois deita no chão para recarregar.',
    encounter: [
      Y('tamires', '(deitada ao lado da geladeira) Eu só vim pegar água. Faz duas horas.'),
      Y('thaisa', 'Tami! Você tá bem?'),
      Y('tamires', 'Tô ótima. Corri dez quilômetros hoje. Agora eu não corro mais nada.'),
      Y('melissa', 'Amiga, levanta que a gente tem um evento pra salvar.'),
    ],
  },
  {
    id: 'rebeca',
    name: 'Rebeca',
    bio: 'Baixa estatura, muito inteligente, pouca energia e muita vontade de participar.',
    fase: 2,
    doComite: true,
    relations: [],
    effect: 'xp',
    effectNote: 'Explica algo esperto: bônus de XP por um tempo.',
    encounter: [
      Y('rebeca', 'Eu sabia que vocês vinham. Calculei. Só não calculei a minha energia.'),
      Y('mauro', 'Você calculou o tempo de chegada?'),
      Y('rebeca', 'Calculei. Eu estava sentada esperando pra economizar bateria.'),
      Y('thayssa', 'Vem com a gente. A gente te carrega nos momentos difíceis.'),
    ],
  },
  {
    id: 'crazy',
    name: 'Crazy',
    bio: 'Meio baixinho, mais velho que os outros e fascinado por armas de fogo.',
    fase: 3,
    doComite: true,
    relations: [],
    effect: 'dano',
    effectNote: 'Dá cobertura com barulho e entusiasmo: bônus de dano curto.',
    encounter: [
      Y('crazy', 'Vocês trouxeram o quê de equipamento? Eu trouxe uma lista.'),
      Y('felipe', 'A gente trouxe um violão.'),
      Y('crazy', '...É calibre grande?'),
      Y('thaisa', 'É de nylon, Crazy. Vem com a gente.'),
    ],
  },
  {
    id: 'debora',
    name: 'Débora',
    bio: 'Professora e artista. É casada com o Pedrão.',
    fase: 4,
    doComite: true,
    relations: ['Esposa do Pedrão'],
    effect: 'escudo',
    effectNote: 'Desenha um escudo colorido sobre o grupo.',
    encounter: [
      Y('debora', 'Gente, tem um cinema inteiro aqui e ninguém pagou ingresso. Que maravilha.'),
      Y('melissa', 'Você tá desenhando no meio de uma emergência?'),
      Y('debora', 'Sempre. A emergência fica mais bonita assim.'),
      Y('mauro', 'O Pedrão sabe onde você está?'),
      Y('debora', 'O Pedrão sempre acha que sabe.'),
    ],
  },
  {
    id: 'francis',
    name: 'Francis',
    bio: 'Muito, muito alto. O tipo de alto que muda a iluminação do ambiente.',
    fase: 5,
    pairedWith: 'fabi',
    doComite: true,
    relations: ['Amigo da Fabi'],
    effect: 'velocidade',
    effectNote: 'Carrega o grupo nas costas: velocidade extra (em dupla com a Fabi).',
    encounter: [
      Y('francis', '(lá de cima) Oi. Vocês estão aí embaixo?'),
      Y('thayssa', 'Estamos! Como o tempo está aí em cima?'),
      Y('francis', 'Limpo. Dá pra ver a Expointer inteira. E um boi correndo.'),
      Y('felipe', 'Um boi correndo?'),
    ],
  },
  {
    id: 'fabi',
    name: 'Fabi',
    bio: 'Viciada em chimarrão. A cuia nunca esfria.',
    fase: 5,
    pairedWith: 'francis',
    doComite: true,
    relations: ['Amiga do Francis'],
    effect: 'cura',
    effectNote: 'Serve chimarrão: cura leve (em dupla com o Francis).',
    encounter: [
      Y('fabi', 'Calma, só mais uma roda. A água tá no ponto.'),
      Y('thaisa', 'Fabi, a gente precisa ir!'),
      Y('fabi', 'Toma. Quem toma, resolve. Quem resolve, anda.'),
      Y('mauro', 'Isso tem fundamento científico?'),
      Y('fabi', 'Tem fundamento cuia.'),
    ],
  },
  {
    id: 'robson',
    name: 'Robson',
    bio: 'Bem mais velho que a turma, muito forte e muito empático.',
    fase: 6,
    doComite: false,
    relations: [],
    effect: 'escudo',
    effectNote: 'Segura a porta com as costas: escudo grande, uma vez.',
    encounter: [
      Y('robson', 'Vocês parecem cansados. Sentem aqui, eu seguro o portão.'),
      Y('felipe', 'O portão é de ferro e está pegando fogo.'),
      Y('robson', 'Tá tranquilo. Eu já segurei pior. Como vocês estão por dentro?'),
      Y('thayssa', '...Eu acho que eu vou chorar.'),
    ],
  },
  {
    id: 'gabriel',
    name: 'Gabriel',
    bio: '??????????',
    fase: 6,
    doComite: false,
    relations: ['Ninguém sabe'],
    effect: 'aleatorio',
    effectNote: 'Efeito aleatório. Ninguém sabe como ele chegou aqui nem o que fazia.',
    encounter: [
      Y('gabriel', '...'),
      Y('melissa', 'Quem é esse?'),
      Y('mauro', 'Eu não tenho ficha dele. Eu tenho ficha de todo mundo.'),
      Y('felipe', 'Ele estava aqui antes da gente?'),
      Y('gabriel', '(acena e começa a andar junto)'),
    ],
  },
  {
    id: 'estevao',
    name: 'Estevão',
    bio: 'Não era do Comitê, só do grupo maior de jovens. Foi obrigado a ir para o quartel.',
    fase: 7,
    doComite: false,
    relations: ['Irmão do Big John'],
    effect: 'xp',
    effectNote: 'Marca o passo e organiza a fila: bônus de XP e de dano em marcha.',
    encounter: [
      Y('estevao', 'Soldado Estevão, apresentando. Autorizado a faltar só hoje.'),
      Y('thaisa', 'Você fugiu do quartel?'),
      Y('estevao', 'Foi uma dispensa de última hora. Tecnicamente.'),
      Y('felipe', 'E o seu irmão? O Big John?'),
      Y('estevao', 'Meu irmão nunca some. Ele só está ocupado ajudando alguém.'),
    ],
  },
  {
    id: 'bigjohn',
    name: 'Big John',
    bio: 'Ex-militar, extremamente forte e prestativo. Não tem nada de místico: só ajuda antes de pedirem.',
    fase: 7,
    doComite: false,
    relations: ['Irmão do Estevão'],
    effect: 'nenhum',
    effectNote: 'Sem efeito mágico. Está sempre carregando alguma coisa para alguém.',
    encounter: [
      Y('bigjohn', 'Opa, não precisa pedir. Posso levar isso? Já peguei.'),
      Y('lucas', 'O GRANDE JOHN! Finalmente encontrado!'),
      Y('bigjohn', 'Eu não estava perdido, Lucas. Estava carregando cadeiras.'),
      Y('lucas', '...Ele nunca esteve em perigo?'),
      Y('mauro', 'Aparentemente você só cismou com ele, Lucas.'),
    ],
  },
];

export function youthById(id: YouthId): YouthDef {
  return YOUTH.find((y) => y.id === id)!;
}

/** Jovens resgatados em uma fase (1 a 7). */
export function youthDaFase(fase: number): readonly YouthDef[] {
  return YOUTH.filter((y) => y.fase === fase);
}
