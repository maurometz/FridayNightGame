// Safe Rooms (LORE seção 5): salas sem combate nem spawn. Entrar nelas dispara falas exclusivas
// que revelam camadas mais fundas da lore, piadas internas e o subtexto sutil da despedida.
//
// Regras de escrita (as mesmas de `interactions.ts`): 2 a 4 linhas, até 90 caracteres por linha.
// Regra de ouro: NINGUÉM anuncia que está indo embora nem que o grupo vai se separar.
// Piadas internas reais continuam em `interactions.private.ts`.

import type { CharacterId } from './characters';
import type { InteractionLine, InteractionTag, Who } from './interactions';

export type SafeRoomId =
  | 'f1-despensa'
  | 'f2-varanda'
  | 'f3-quiosque'
  | 'f4-saguao'
  | 'f5-galpao'
  | 'f6-varanda-marlene'
  | 'f7-sala-de-coral';

export interface SafeRoomInteraction {
  readonly id: string;
  readonly room: SafeRoomId;
  readonly tag: InteractionTag;
  readonly a: Who;
  readonly b: Who;
  readonly lines: readonly InteractionLine[];
}

export interface SafeRoomDef {
  readonly id: SafeRoomId;
  readonly fase: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  readonly name: string;
  /** Descrição curta do cenário, para quem for desenhar o mapa. */
  readonly description: string;
}

export const SAFE_ROOMS: readonly SafeRoomDef[] = [
  { id: 'f1-despensa', fase: 1, name: 'A Despensa do Felipe', description: 'Prateleiras, pacotes de bolacha e caixas de papelão no canto.' },
  { id: 'f2-varanda', fase: 2, name: 'A Varanda de Ivoti', description: 'Cadeiras de balanço, um pôr do sol de tarde e uma cuia esquecida.' },
  { id: 'f3-quiosque', fase: 3, name: 'O Quiosque do Parcão', description: 'Mesas de piquenique, patinhos no lago ao fundo, luzes de fim de tarde.' },
  { id: 'f4-saguao', fase: 4, name: 'O Saguão do Cinema', description: 'Pipoqueira desligada, pôsteres e uma fileira de poltronas vazias.' },
  { id: 'f5-galpao', fase: 5, name: 'O Galpão dos Animais', description: 'Palha, bois dormindo e uma lâmpada pendurada balançando.' },
  { id: 'f6-varanda-marlene', fase: 6, name: 'A Varanda da Dona Marlene', description: 'Mesa grande, bolo, chimarrão e um calendário velho na parede.' },
  { id: 'f7-sala-de-coral', fase: 7, name: 'A Sala do Coral', description: 'Banco de madeira, vitral, o teclado do louvor e uma luz quente.' },
];

const L = (who: 'a' | 'b', text: string): InteractionLine => ({ who, text });

export const SAFE_ROOM_INTERACTIONS: readonly SafeRoomInteraction[] = [
  // ---- Fase 1: a casa
  {
    id: 'sr1-felipe-thaisa',
    room: 'f1-despensa',
    tag: 'respiro',
    a: 'thaisa',
    b: 'felipe',
    lines: [
      L('a', 'Tem comida pra um batalhão. Você compra pensando em quem?'),
      L('b', 'Em quem vem. Sempre em quem vem.'),
      L('a', 'Então compra um pouco mais. Pra sobrar.'),
    ],
  },
  {
    id: 'sr1-mauro-melissa',
    room: 'f1-despensa',
    tag: 'respiro',
    a: 'mauro',
    b: 'melissa',
    lines: [
      L('a', 'Eu ainda tenho a ficha da primeira vez que você foi na casa do Felipe.'),
      L('b', 'Você guarda ficha de TUDO?'),
      L('a', 'Quase tudo. Essa eu guardei duas vezes.'),
      L('b', 'Esse corredor é muito estreito, hein.'),
    ],
  },
  {
    id: 'sr1-melissa-thayssa-papelao',
    room: 'f1-despensa',
    tag: 'queda',
    a: 'melissa',
    b: 'thayssa',
    lines: [L('a', 'Por que tem tanta caixa vazia aqui?'), L('b', 'Sempre tem. Alguém sempre guarda.'), L('a', 'Guarda pra quê, se não é pra usar?')],
  },
  // ---- Fase 2: Ivoti
  {
    id: 'sr2-thaisa-thayssa',
    room: 'f2-varanda',
    tag: 'queda',
    a: 'thaisa',
    b: 'thayssa',
    lines: [
      L('a', 'A varanda me lembra a da minha casa.'),
      L('b', 'Qual delas? Todas?'),
      L('a', 'A que eu ainda vou ter que aprender a chamar de nova.'),
    ],
  },
  {
    id: 'sr2-felipe-mauro',
    room: 'f2-varanda',
    tag: 'livre',
    a: 'felipe',
    b: 'mauro',
    lines: [
      L('a', 'Ivoti. Eu nunca tinha vindo. Sabia que tinha tanta cuca?'),
      L('b', 'Sabia. Vi num documentário de 2014.'),
      L('a', 'Você foi até isso estudar antes?'),
    ],
  },
  // ---- Fase 3: Parcão
  {
    id: 'sr3-melissa-felipe',
    room: 'f3-quiosque',
    tag: 'respiro',
    a: 'melissa',
    b: 'felipe',
    lines: [
      L('a', 'Quem ia imaginar que o Juninho ia usar drone no Parcão.'),
      L('b', 'Eu imaginava. Ele tem cara de quem tem drone.'),
      L('a', 'Ele tem cara de quem tem cronograma.'),
    ],
  },
  {
    id: 'sr3-mauro-thayssa',
    room: 'f3-quiosque',
    tag: 'queda',
    a: 'thayssa',
    b: 'mauro',
    lines: [
      L('a', 'Você parou de anotar.'),
      L('b', 'Eu... estou escolhendo o que anotar.'),
      L('a', 'Isso é novo. Eu gosto.'),
    ],
  },
  // ---- Fase 4: Cinema
  {
    id: 'sr4-melissa-mauro',
    room: 'f4-saguao',
    tag: 'queda',
    a: 'melissa',
    b: 'mauro',
    lines: [
      L('a', 'O RM me olhou por um segundo e eu quase fui.'),
      L('b', 'Quase?'),
      L('a', 'Quase. Foi um pouco longe demais.'),
      L('b', 'Que bom que não foi.'),
    ],
  },
  {
    id: 'sr4-thaisa-felipe',
    room: 'f4-saguao',
    tag: 'respiro',
    a: 'felipe',
    b: 'thaisa',
    lines: [
      L('a', 'Quando a gente vê um filme junto de novo?'),
      L('b', 'Quando a gente marcar. Eu confio na gente.'),
      L('a', 'Eu levo a pipoca.'),
    ],
  },
  // ---- Fase 5: Expointer
  {
    id: 'sr5-thayssa-thaisa',
    room: 'f5-galpao',
    tag: 'respiro',
    a: 'thayssa',
    b: 'thaisa',
    lines: [
      L('a', 'Esse cheiro de boi me lembra tanta coisa.'),
      L('b', 'Lembra o seu pai fingindo que sabe de gado.'),
      L('a', 'Eu AMO isso. Quero guardar esse cheiro.'),
    ],
  },
  {
    id: 'sr5-mauro-felipe-calendario',
    room: 'f5-galpao',
    tag: 'queda',
    a: 'mauro',
    b: 'felipe',
    lines: [
      L('a', 'Você lembra que a gente jogou online pela primeira vez em setembro?'),
      L('b', 'No dia 7. Eu lembro.'),
      L('a', 'Parece que foi ontem e há uma vida.'),
    ],
  },
  // ---- Fase 6: Sítio da Dona Marlene
  {
    id: 'sr6-melissa-thayssa',
    room: 'f6-varanda-marlene',
    tag: 'queda',
    a: 'melissa',
    b: 'thayssa',
    lines: [
      L('a', 'Esse calendário da Dona Marlene é igual ao da cozinha do Felipe.'),
      L('b', 'Tem dezembro circulado?'),
      L('a', 'Tem. Mas eu não vou olhar muito.'),
    ],
  },
  {
    id: 'sr6-felipe-mauro',
    room: 'f6-varanda-marlene',
    tag: 'respiro',
    a: 'felipe',
    b: 'mauro',
    lines: [
      L('a', 'O Alê dá ordens há tanto tempo que a gente já não sabe viver sem apito.'),
      L('b', 'Ele nem sabe que criou o Comitê.'),
      L('a', 'Melhor assim. Se soubesse, mandava a gente formar fila.'),
    ],
  },
  // ---- Fase 7: Igreja Unidos
  {
    id: 'sr7-thaisa-thayssa',
    room: 'f7-sala-de-coral',
    tag: 'queda',
    a: 'thaisa',
    b: 'thayssa',
    lines: [
      L('a', 'Eu guardei o programa do primeiro evento.'),
      L('b', 'Eu também. Tá amassado.'),
      L('a', 'Os dois estão. Isso quer dizer que foram usados.'),
    ],
  },
  {
    id: 'sr7-felipe-melissa',
    room: 'f7-sala-de-coral',
    tag: 'respiro',
    a: 'melissa',
    b: 'felipe',
    lines: [
      L('a', 'Toca uma pra mim antes de entrar.'),
      L('b', 'Qual?'),
      L('a', 'Qualquer uma que a gente cante junto no fim.'),
    ],
  },
  {
    id: 'sr7-mauro-melissa',
    room: 'f7-sala-de-coral',
    tag: 'queda',
    a: 'mauro',
    b: 'melissa',
    lines: [
      L('a', 'Eu tinha uma coisa pra te dizer. Mas o evento vem primeiro.'),
      L('b', 'Então diz depois do evento.'),
      L('a', '...Depois do evento.'),
      L('b', 'Anota isso.'),
    ],
  },
  // ---- Pistas do Tempo (sutis): coelho, relógios, folhas de calendário
  {
    id: 'srx-qualquer-relogio',
    room: 'f4-saguao',
    tag: 'queda',
    a: 'qualquer',
    b: 'qualquer',
    lines: [L('a', 'Esse relógio do saguão tá certo?'), L('b', 'Tá parado.'), L('a', 'Ah. Parece que só ele quer ficar.')],
  },
];

export function salasDaFase(fase: number): readonly SafeRoomDef[] {
  return SAFE_ROOMS.filter((s) => s.fase === fase);
}

export function falasDaSala(room: SafeRoomId): readonly SafeRoomInteraction[] {
  return SAFE_ROOM_INTERACTIONS.filter((i) => i.room === room);
}

/** Personagem com falas na sala (para validação). */
export type SafeRoomSpeaker = CharacterId | 'qualquer';

// ---- Posição das Safe Rooms no mapa (a zona é um círculo sem combate nem spawn) ----
export interface SafeRoomPos {
  readonly x: number;
  readonly y: number;
  /** Raio da zona segura, em pixels. */
  readonly r: number;
}

export const SAFE_ROOM_POS: Readonly<Record<SafeRoomId, SafeRoomPos>> = {
  'f1-despensa': { x: -200, y: -60, r: 44 },
  'f2-varanda': { x: 200, y: -80, r: 44 },
  'f3-quiosque': { x: -190, y: 100, r: 44 },
  'f4-saguao': { x: 210, y: 90, r: 44 },
  'f5-galpao': { x: -210, y: -110, r: 44 },
  'f6-varanda-marlene': { x: 180, y: -140, r: 44 },
  'f7-sala-de-coral': { x: -200, y: 80, r: 44 },
};

/** Regeneração dentro da Safe Room, em fração do HP máximo por segundo. */
export const SAFE_ROOM_REGEN_PER_S = 0.04;
