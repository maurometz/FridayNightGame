// Pixel art dos personagens, em grade de caracteres (ver spriteFormat.ts).
// Cada pessoa foi desenhada a partir da foto de referência (cabelo, óculos, barba, roupa).
// Estilo: cabeças grandes, contorno colorido (nunca preto puro), 3 a 4 tons por material.

import { c, pernas, type SpriteDef, type SpriteId } from './spriteFormat';

const r = (ch: string, n: number): string => ch.repeat(n);

// Letras comuns a todas as paletas:
// o contorno · h/H cabelo e luz · s/S/L pele, sombra e luz · e olho · w branco do olho
// g óculos · m bigode e barba · b barba rala · y fio grisalho · l/r boca
// a acessório prateado · j/J jaqueta · t/T/D camiseta · u camisa · n/N calça · k/K sapato
// q/Q cajado e brilho

// ---------------------------------------------------------------- Felipe
// Cabelo escuro e cacheado curto, óculos retangulares de metal, bigode grosso e barba por fazer,
// jaqueta de couro preta sobre camiseta cinza-claro.
const FELIPE: SpriteDef = {
  id: 'felipe',
  palette: {
    o: '#241a1c', h: '#2e2422', H: '#4b3a36', s: '#c8996f', S: '#a67856', L: '#dfb48f',
    g: '#8f98a3', w: '#f2f2f2', e: '#1a1416', m: '#3a2a24', b: '#8b6a55', r: '#8c4a42',
    j: '#1c1c24', J: '#3a3a4a', t: '#aab0b8', n: '#2b2d3a', N: '#1d1f2a', k: '#14141a', K: '#33333f',
  },
  head: [
    c('...oooooooo...'),
    c('..ohhHhhHhho..'),
    c('.ohhhHhhhhHho.'),
    c('.ohhhhhhhhhho.'),
    c('.ohhsssssshho.'),
    c('.oggggssggggo.'),
    c('.ogewgssgewgo.'),
    c('.oggggssggggo.'),
    c('.ossssSSsssso.'),
    c('.osmmmmmmmmso.'),
    c('.obbbrrrrbbbo.'),
    c('..obbbbbbbbo..'),
    c('...oooooooo...'),
  ],
  torso: [
    c('.ojjjjjttjjjjjo.'),
    c('ojjjjjjttjjjjjjo'),
    c('ojJjjjjttjjjjJjo'),
    c('ojJjjjjttjjjjJjo'),
    c('osojjjjttjjjjoso'),
    c('..oojjjjjjjjoo..'),
  ],
  legs: pernas(7),
};

// ---------------------------------------------------------------- Mauro
// Cabelo escuro ondulado com franja, óculos aviador laranja-avermelhado, bigode fino e cavanhaque,
// camiseta marrom escura larga, relógio preto no pulso.
const MAURO: SpriteDef = {
  id: 'mauro',
  palette: {
    o: '#2a1f1c', h: '#2b2220', H: '#46362f', s: '#e8c3a3', S: '#c9a07f', L: '#f4d9c0',
    g: '#d9622b', G: '#f09a58', w: '#f2f2f2', e: '#1a1416', m: '#3a2a24', r: '#a35a52',
    a: '#1c1c22', t: '#5a3a2a', T: '#6e4a38', D: '#43291d',
    n: '#2d3447', N: '#1f2433', k: '#d8d8d8', K: '#9a9aa0',
  },
  head: [
    c('...oooooooo...'),
    c('..ohhHhhHhho..'),
    c('.ohhhhhhhhhho.'),
    c('.ohhHhhhhhhho.'),
    c('.ohhhsssshhho.'),
    c('.oggggssggggo.'),
    c('.ogGegssgGego.'),
    c('.oggggssggggo.'),
    c('.ossssSSsssso.'),
    c('.osssmmmmssso.'),
    c('.ossssrrsssso.'),
    c('..ossmmmmsso..'),
    c('...oooooooo...'),
  ],
  torso: [
    c('.otttttttttttto.'),
    c('otttTttttttTttto'),
    c('otttttttttttttto'),
    c('otttttttttttttto'),
    c('osottttttttttoao'),
    c('..oDDDDDDDDDDo..'),
  ],
  legs: pernas(7),
};

// ---------------------------------------------------------------- Melissa
// Cabelo liso comprido vermelho-escuro com mechas na frente, delineado gráfico, brincos prateados,
// blusa preta de gola canoa.
const MELISSA: SpriteDef = {
  id: 'melissa',
  palette: {
    o: '#2a1218', h: '#a31d2b', H: '#d03545', s: '#f0cfb8', S: '#d8aa94', L: '#fae3d2',
    e: '#1a1014', w: '#f2f2f2', l: '#b5424f', a: '#cfd5dc',
    t: '#22222b', T: '#3a3a48', n: '#2a2a38', N: '#1c1c28', k: '#17171f', K: '#3a3a48',
  },
  head: [
    c('...oooooooo...'),
    c('..ohhHhhHhho..'),
    c('.ohhhhHhhhhho.'),
    c('.ohhhhhhhhhho.'),
    c('.ohhHsssssshho.'),
    c('ohh' + r('s', 8) + 'hho'),
    c('ohh' + 'sewsswes' + 'hho'.replace('hho', 'hho')),
    c('ohh' + 'sssSSsss' + 'hho'),
    c('oah' + 'ssllllss' + 'hao'),
    c('.ohh' + 'ssssss' + 'hho.'),
    c('.ohh' + r('o', 8) + 'hho.'),
  ],
  torso: [
    c('ohho' + 'tttssttt'.slice(0, 8) + 'ohho'),
    c('ohho' + 'tttttttt' + 'ohho'),
    c('ohho' + 'ttTttTtt' + 'ohho'),
    c('osso' + 'tttttttt' + 'osso'),
    c('..o' + r('t', 10) + 'o..'),
  ],
  legs: pernas(6),
};

// ---------------------------------------------------------------- Thaisa
// Cabelo comprido, ondulado, castanho-dourado, sorriso largo, argolas prateadas, blusa preta.
// Mais baixa (cerca de 80%); o violoncelo é desenhado à parte.
const THAISA: SpriteDef = {
  id: 'thaisa',
  palette: {
    o: '#3a2410', h: '#b8843c', H: '#dcae62', s: '#f3d3bb', S: '#dcae94', L: '#fae6d4',
    e: '#1a1014', w: '#ffffff', l: '#c05a5e', a: '#cfd5dc',
    t: '#22222b', T: '#3a3a48', n: '#2f3550', N: '#1f2438', k: '#2a1c14', K: '#4a3426',
  },
  head: [
    c('....oooooooo....'),
    c('..ohhHhhhhHhho..'),
    c('.ohhhhhhhhhhhho.'),
    c('o' + 'hhHhhhhhhhhHhh' + 'o'),
    c('o' + 'hhhh' + 'ssssss' + 'hhhh' + 'o'),
    c('o' + 'hhh' + r('s', 8) + 'hhh' + 'o'),
    c('o' + 'hhh' + 'sesssses' + 'hhh' + 'o'),
    c('o' + 'hhh' + 'sssSSsss' + 'hhh' + 'o'),
    c('o' + 'hh' + 'a' + 'slwwwwls' + 'a' + 'hh' + 'o'),
    c('.o' + 'hh' + 'ssssss' + 'hh' + 'o.'),
    c('.o' + 'hhh' + r('o', 6) + 'hhh' + 'o.'),
  ],
  torso: [
    c('ohh' + 'o' + 'ttt' + 'ss' + 'ttt' + 'o' + 'hho'),
    c('ohh' + 'o' + r('t', 8) + 'o' + 'hho'),
    c('ohh' + 'o' + 'ttTttTtt' + 'o' + 'hho'),
    c('oss' + 'o' + r('t', 8) + 'o' + 'sso'),
  ],
  legs: pernas(5),
};

// ---------------------------------------------------------------- Thayssa
// Cabelo escuro, volumoso e cacheado, com um cacho solto na testa, rosto redondo, blusa escura.
// Menor ainda (cerca de 75%).
const THAYSSA: SpriteDef = {
  id: 'thayssa',
  palette: {
    o: '#1c1420', h: '#2a1e24', H: '#4a3640', s: '#e2b894', S: '#c4966f', L: '#f0cfae',
    e: '#1a1014', w: '#ffffff', l: '#a8454e',
    t: '#3a2c52', T: '#52406e', n: '#2a2a3c', N: '#1c1c2a', k: '#241c2c', K: '#4a3c58',
  },
  head: [
    c('..' + r('o', 12) + '..'),
    c('.o' + 'hhhHhhhhHhhh' + 'o.'),
    c('o' + 'hhhHhhhhhhhhHhhh' + 'o'),
    c('o' + r('h', 16) + 'o'),
    c('o' + 'hhhh' + 'ssshhsss' + 'hhhh' + 'o'),
    c('o' + 'hhhh' + r('s', 8) + 'hhhh' + 'o'),
    c('o' + 'hhhh' + 'sesssses' + 'hhhh' + 'o'),
    c('o' + 'hhhh' + 'sssSSsss' + 'hhhh' + 'o'),
    c('o' + 'hhhh' + 'ssslllss' + 'hhhh' + 'o'),
    c('.o' + 'hhhh' + 'ssss' + 'hhhh' + 'o.'),
  ],
  torso: [
    c('ohhh' + 'o' + 'tttttt' + 'o' + 'hhho'),
    c('ohhh' + 'o' + 'ttTttt' + 'o' + 'hhho'),
    c('oss' + 'o' + r('t', 8) + 'o' + 'sso'),
    c('..o' + r('t', 10) + 'o..'),
  ],
  legs: pernas(4),
};

// ---------------------------------------------------------------- Lucas
// 40 anos, alto, careca com laterais aparadas, barba castanha com fios grisalhos e bigode,
// blazer preto sobre camisa preta abotoada, cajado de madeira com brilho.
const LUCAS: SpriteDef = {
  id: 'lucas',
  palette: {
    o: '#2a1c18', h: '#4a3426', s: '#d8aa86', S: '#b88a68', L: '#ecc9a8',
    e: '#1a1416', w: '#f2f2f2', m: '#5a3a24', b: '#6a4630', y: '#a8a49e', r: '#8c4a42',
    j: '#16161c', J: '#2a2a34', u: '#22222c',
    n: '#1e1e28', N: '#14141c', k: '#101016', K: '#2c2c36', q: '#8a5a2b', Q: '#ffd36a',
  },
  head: [
    c('...oooooooo...'),
    c('..o' + 'sLLLssss' + 'o..'),
    c('.o' + 'ssLsssssss' + 'o.'),
    c('.o' + 'h' + r('s', 8) + 'h' + 'o.'),
    c('.o' + 'shhsssshhs' + 'o.'),
    c('.o' + 'sewsssswes' + 'o.'),
    c('.o' + 'ssssSSssss' + 'o.'),
    c('.o' + 'bbymmmmybb' + 'o.'),
    c('.o' + 'bbbrrrrbbb' + 'o.'),
    c('..o' + 'bbybbybb' + 'o..'),
    c('...o' + r('b', 6) + 'o...'),
    c('....' + r('o', 6) + '....'),
  ],
  torso: [
    c('.o' + 'jjjj' + 'uuuu' + 'jjjj' + 'o.'),
    c('ojJjjjuuuujjjJjo'),
    c('ojJjjjjuujjjjJjo'),
    c('ojJjjjjuujjjjJjo'),
    c('ojjjjjjuujjjjjjo'),
    c('osojjjjuujjjjoso'),
    c('osso' + r('j', 8) + 'osso'),
    c('..o' + r('j', 10) + 'o..'),
  ].map((l, i) => (i < 6 ? l.slice(0, 1) + (i === 0 ? 'Q' : 'q') + l.slice(2) : l)),
  legs: pernas(16),
};

export const SPRITE_DEFS: Readonly<Record<SpriteId, SpriteDef>> = {
  felipe: FELIPE,
  mauro: MAURO,
  melissa: MELISSA,
  thaisa: THAISA,
  thayssa: THAYSSA,
  lucas: LUCAS,
};
