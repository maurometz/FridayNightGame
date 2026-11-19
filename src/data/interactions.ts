// NOTA: as Safe Rooms da campanha nova vivem em `safeRooms.ts`. Os POIs abaixo continuam valendo (ver LORE seção 16).
// Interações locais (GDD A.10): conversas curtas quando duas pessoas do grupo ficam perto de um ponto de interesse.
// As piadas internas reais ficam em `interactions.private.ts` (fora do controle de versão).
//
// Regras de escrita (A.10): 2 a 4 linhas, até 90 caracteres por linha. Ninguém anuncia que vai embora.
// A palavra "mudar" só aparece em falas de queda, nunca como anúncio.

import type { CharacterId } from './characters';
import { SAFE_ROOMS, SAFE_ROOM_INTERACTIONS, SAFE_ROOM_POS, type SafeRoomId } from './safeRooms';

export type InteractionTag = 'queda' | 'respiro' | 'livre';
export type PoiId = 'sofa' | 'cozinha' | 'quintal' | 'rua' | 'calendario' | 'patio' | 'banco' | 'lucas' | SafeRoomId;
/** Quem participa: um personagem específico ou "qualquer" (quem estiver perto). */
export type Who = CharacterId | 'qualquer' | 'lucas';

export interface InteractionLine {
  /** Papel de quem fala: "a" ou "b" (ver campos `a` e `b`). */
  who: 'a' | 'b';
  text: string;
}

export interface Interaction {
  id: string;
  poi: PoiId;
  tag: InteractionTag;
  a: Who;
  b: Who;
  lines: readonly InteractionLine[];
}

/** Pontos de interesse: onde ficam no mundo e em quais atos existem. */
export interface PoiDef {
  readonly id: PoiId;
  readonly x: number;
  readonly y: number;
  /** Fases (0 = fase 1 ... 6 = fase 7) em que o ponto existe. */
  readonly acts: readonly number[];
}

export const POIS: readonly PoiDef[] = [
  { id: 'sofa', x: -82, y: -59, acts: [0] },
  { id: 'cozinha', x: 65, y: -113, acts: [0] },
  { id: 'quintal', x: 0, y: 110, acts: [0, 1] },
  { id: 'rua', x: -108, y: 60, acts: [1, 2, 3] },
  { id: 'calendario', x: 110, y: -128, acts: [4, 5] },
  { id: 'patio', x: 0, y: 110, acts: [6] },
  { id: 'banco', x: -68, y: -33, acts: [6] },
  // Safe Rooms: uma por mapa (ver data/safeRooms.ts).
  ...SAFE_ROOMS.map((s): PoiDef => ({ id: s.id, x: SAFE_ROOM_POS[s.id].x, y: SAFE_ROOM_POS[s.id].y, acts: [s.fase - 1] })),
];

export const INTERACTION_TRIGGER_PX = 64; // 4 tiles
export const INTERACTION_ENEMY_BLOCK_PX = 48; // 3 tiles
export const INTERACTION_PAIR_COOLDOWN_S = 90;
export const INTERACTION_LINE_SECONDS = 2.8;

const L = (who: 'a' | 'b', text: string): InteractionLine => ({ who, text });

export const INTERACTIONS: readonly Interaction[] = [
  // ---- Sofá (sala, Ato 1)
  {
    id: 'sofa-felipe-mauro',
    poi: 'sofa',
    tag: 'respiro',
    a: 'felipe',
    b: 'mauro',
    lines: [L('a', 'Você ainda tá pensando?'), L('b', 'Só mais um pouco.'), L('a', 'Já foi bastante na verdade.')],
  },
  {
    id: 'sofa-melissa-thayssa',
    poi: 'sofa',
    tag: 'queda',
    a: 'melissa',
    b: 'thayssa',
    lines: [
      L('a', 'Você tá com cara de quem já tá sentindo falta.'),
      L('b', 'Ainda nem fui, Melissa.'),
      L('a', 'Eu sei. Por isso que tá doendo antes.'),
    ],
  },
  {
    id: 'sofa-felipe-thaisa',
    poi: 'sofa',
    tag: 'livre',
    a: 'thaisa',
    b: 'felipe',
    lines: [
      L('a', 'Tá vendo essa caixa? Tô usando de banquinho.'),
      L('b', 'Pra que banquinho se você tem o violoncelo?'),
      L('a', 'Pra não estragar o violoncelo, Felipe.'),
    ],
  },
  // ---- Cozinha
  {
    id: 'cozinha-thaisa-thayssa',
    poi: 'cozinha',
    tag: 'respiro',
    a: 'thayssa',
    b: 'thaisa',
    lines: [
      L('a', 'Você guardou um pão de queijo pra mim?'),
      L('b', 'Guardei. Mas tinha dois.'),
      L('a', 'Então a gente divide. Sempre divide.'),
    ],
  },
  {
    id: 'cozinha-melissa-thaisa',
    poi: 'cozinha',
    tag: 'livre',
    a: 'melissa',
    b: 'thaisa',
    lines: [
      L('a', 'Você comeu a última coxinha?'),
      L('b', 'Foi ciência. Eu precisava de energia pra tocar.'),
      L('a', 'Você toca violoncelo, não tá carregando piano.'),
    ],
  },
  {
    id: 'calendario-qualquer',
    poi: 'calendario',
    tag: 'queda',
    a: 'qualquer',
    b: 'qualquer',
    lines: [L('a', 'Pera, o que é esse círculo?'), L('b', 'Lembrete. Só isso.'), L('a', 'Certo. Só isso.')],
  },
  {
    id: 'cozinha-felipe-mauro',
    poi: 'cozinha',
    tag: 'queda',
    a: 'felipe',
    b: 'mauro',
    lines: [
      L('a', 'Se alguém gravar uma música sobre isso, eu escrevo a letra.'),
      L('b', 'Eu não sei se vou lembrar da letra daqui a cinco anos.'),
      L('a', 'Então canta comigo agora pra ficar na memória.'),
    ],
  },
  // ---- Quintal (Atos 1 e 2)
  {
    id: 'quintal-mauro-thayssa',
    poi: 'quintal',
    tag: 'respiro',
    a: 'thayssa',
    b: 'mauro',
    lines: [
      L('a', 'Quantas estrelas você consegue ver daqui?'),
      L('b', 'Eu sei o nome de quatro.'),
      L('a', 'Me ensina uma?'),
      L('b', 'Essa é a Comitê. Ela sempre aparece nas sextas.'),
    ],
  },
  {
    id: 'quintal-felipe-melissa',
    poi: 'quintal',
    tag: 'livre',
    a: 'melissa',
    b: 'felipe',
    lines: [L('a', 'Grava isso pra mim.'), L('b', 'Já gravaram ontem.'), L('a', 'Então grava de novo, com mais dignidade.')],
  },
  {
    id: 'quintal-thaisa-felipe',
    poi: 'quintal',
    tag: 'respiro',
    a: 'thaisa',
    b: 'felipe',
    lines: [L('a', 'Me ajuda com o violoncelo?'), L('b', 'Você carrega o violoncelo, eu carrego o resto.')],
  },
  // ---- Rua (Ato 2)
  {
    id: 'rua-melissa-qualquer',
    poi: 'rua',
    tag: 'livre',
    a: 'melissa',
    b: 'qualquer',
    lines: [L('a', 'A gente tá atrasado, né?'), L('b', 'Você sempre fala isso.'), L('a', 'E sempre tô certa.')],
  },
  {
    id: 'rua-mauro-melissa',
    poi: 'rua',
    tag: 'queda',
    a: 'mauro',
    b: 'melissa',
    lines: [
      L('a', 'Você acha que a gente vai conseguir ser o que era no ano que vem?'),
      L('b', 'Não sei. Mas sei que a gente nunca foi igual dois dias seguidos.'),
    ],
  },
  // ---- Pátio e igreja (Ato 3)
  {
    id: 'patio-thayssa-thaisa',
    poi: 'patio',
    tag: 'queda',
    a: 'thayssa',
    b: 'thaisa',
    lines: [
      L('a', 'Você lembra de tudo que a gente fez esse ano?'),
      L('b', 'Eu lembro de tudo que você comeu.'),
      L('a', '(ri) E de nós?'),
      L('b', 'Sempre.'),
    ],
  },
  {
    id: 'banco-qualquer',
    poi: 'banco',
    tag: 'queda',
    a: 'qualquer',
    b: 'qualquer',
    lines: [L('a', 'Vou sentir falta disso.'), L('b', 'Isso o quê?'), L('a', 'Disso. De sexta.')],
  },
  {
    id: 'patio-melissa-felipe',
    poi: 'patio',
    tag: 'respiro',
    a: 'melissa',
    b: 'felipe',
    lines: [
      L('a', 'Então a gente combina uma sexta por mês. Por chamada.'),
      L('b', 'Mas e se a chamada cair?'),
      L('a', 'Aí a gente grita mais alto.'),
    ],
  },
  // ---- Subtexto do grupo (A.9.1)
  {
    id: 'sofa-felipe-thaisa-quieta',
    poi: 'sofa',
    tag: 'queda',
    a: 'thaisa',
    b: 'felipe',
    lines: [
      L('a', 'Nenhum dos dois é daqui, né?'),
      L('b', 'Nenhum. Mas essa sala virou casa.'),
      L('a', 'Então já é de nós dois.'),
    ],
  },
  {
    id: 'cozinha-mauro-melissa',
    poi: 'cozinha',
    tag: 'respiro',
    a: 'mauro',
    b: 'melissa',
    lines: [
      L('a', 'Na real, a primeira versão dessa música é de 97, e depois...'),
      L('b', 'Isso é uma aula ou um aviso de incêndio?'),
      L('a', 'Eu... esqueci o que eu ia dizer.'),
      L('b', 'Aham. Passa o salgadinho.'),
    ],
  },
  {
    id: 'quintal-thayssa-qualquer',
    poi: 'quintal',
    tag: 'respiro',
    a: 'thayssa',
    b: 'qualquer',
    lines: [
      L('a', 'No ano que vem eu vou começar, aí eu vou conseguir, aí...'),
      L('a', '...Ai. Eu tô falando como se vocês fossem estar aqui.'),
      L('b', 'A gente tá aqui. Continua, vai ser incrível.'),
    ],
  },
  // ---- Lucas (só vai ao ar com o epílogo, na Fase 11: o ponto "lucas" nunca é disparado em combate)
  {
    id: 'lucas-qualquer',
    poi: 'lucas',
    tag: 'livre',
    a: 'lucas',
    b: 'qualquer',
    lines: [
      L('a', 'Os Escolhidos do Comitê devem manter a compostura.'),
      L('b', 'A gente tá chorando, Lucas.'),
      L('a', 'Então mantenham o choro com compostura.'),
    ],
  },
];

/**
 * Piadas internas do grupo, escritas em `interactions.private.ts` (não vai para o controle de versão).
 * Se o arquivo não existir, o jogo roda só com a biblioteca pública.
 */
const privados = import.meta.glob<{ PRIVATE_INTERACTIONS?: readonly Interaction[] }>('./interactions.private.ts', { eager: true });

export function todasAsInteracoes(): readonly Interaction[] {
  const extras = Object.values(privados).flatMap((m) => m.PRIVATE_INTERACTIONS ?? []);
  return [...INTERACTIONS, ...SAFE_ROOM_INTERACTIONS.map((s): Interaction => ({ id: s.id, poi: s.room, tag: s.tag, a: s.a, b: s.b, lines: s.lines })), ...extras];
}
