// Pixel art dos inimigos e chefes, em grade de caracteres (um caractere por pixel, "." é transparente).
// Cada inimigo tem um único desenho, virado para a direita; o renderer espelha, balança um pixel para
// animar e pinta de branco (dano) ou vermelho (aviso de chefe).

export interface EnemySpriteDef {
  readonly id: string;
  readonly palette: Readonly<Record<string, string>>;
  readonly rows: readonly string[];
}

/** Dobra o tamanho do desenho (cada pixel vira 2x2). Usado nos chefes. */
const dobrar = (rows: readonly string[]): string[] =>
  rows.flatMap((linha) => {
    const larga = [...linha].map((c) => c + c).join('');
    return [larga, larga];
  });

// ------------------------------------------------------------------ Inimigos comuns (bestiário)
const ABACAXI: EnemySpriteDef = {
  id: 'abacaxi',
  palette: { o: '#5a3d0a', Y: '#e0b43a', y: '#b88a1c', g: '#4e9a3c', e: '#2a1a0a' },
  rows: [
    '....g..g....',
    '...gg.ggg...',
    '....gggg....',
    '..oooooooo..',
    '.oYyYYyYYyo.',
    'oYyYYeYYeYyo',
    'oyYYyYYyYYyo',
    'oYyYYyYYyYYo',
    '.oYyYYyYYyo.',
    '..oooooooo..',
  ],
};

const AZEITONA: EnemySpriteDef = {
  id: 'azeitona',
  palette: { o: '#2a3414', G: '#556b2f', g: '#7a8f3a', r: '#c0392b', e: '#ffffff' },
  rows: ['..oooooo..', '.oGGGGGGo.', 'oGGeGGeGGo', 'oGGGGGGGGo', 'oGGGrrGGGo', '.oGGGGGGo.', '..oooooo..'],
};

const CAFE: EnemySpriteDef = {
  id: 'cafe',
  palette: { o: '#2a1408', B: '#6b3e26', W: '#f2efe6', e: '#ffe066', s: '#8fd0ff' },
  rows: ['..s....s..', '.oooooooo.', 'oWWWWWWWWo', 'oWBBBBBBWo', 'oBBeBBeBBo', 'oBBBBBBBBo', '.oBBBBBBo.', '..oooooo..'],
};

const CHIMARRAO: EnemySpriteDef = {
  id: 'chimarrao',
  palette: { o: '#1d2a14', G: '#4e8a3c', b: '#caa86a', w: '#9fe0ff', e: '#ffe066', k: '#222222' },
  rows: [
    '....wwww....',
    '....bbbb....',
    '..oooooooo..',
    '.oGGGGGGGGo.',
    'oGGeGGGGeGGo',
    'oGGGGkkGGGGo',
    '.oGGGGGGGGo.',
    '..oobbbboo..',
    '....bbbb....',
    '...oooooo...',
  ],
};

const CACHORROQUENTE: EnemySpriteDef = {
  id: 'cachorroquente',
  palette: { o: '#3a1c0a', P: '#d9a15a', S: '#c0392b', M: '#ffd23f', e: '#2a1a0a' },
  rows: [
    '..oooooooooooo..',
    '.oPPPPPPPPPPPPo.',
    'oPPSMSMSMSMSMPPo',
    'oPSSSSSSSSSSSSPo',
    'oPPPeePPPPeePPPo',
    '.oPPPPPPPPPPPPo.',
    '..oooooooooooo..',
  ],
};

const VEIOLOCO: EnemySpriteDef = {
  id: 'veioloco',
  palette: { o: '#2b2b2b', s: '#e0b090', h: '#e8e8e8', e: '#1a1a1a', b: '#8a5a3a', r: '#d94f4f', c: '#5a7a9a' },
  rows: ['..hhhhhh..', '.hhhhhhhh.', '.osssssso.', 'ossessesso', 'ossrrrrsso', '.osssssso.', '..cccccc..', '.occccccco', '..bb..bb..', '..oo..oo..'],
};

const KPOPERS: EnemySpriteDef = {
  id: 'kpopers',
  palette: { o: '#3a1a30', P: '#d96fa8', s: '#f0c8a8', h: '#cfcfcf', l: '#fff27a', e: '#1a1a1a' },
  rows: ['.l..hhhh..l.', '.l.hhhhhh.l.', '.l.osssso.l.', '..osesseso..', '..osssssso..', '..oPPPPPPo..', '.oPPPPPPPPo.', '..oo....oo..'],
};

const COELHO: EnemySpriteDef = {
  id: 'coelho',
  palette: { o: '#3a3a4a', W: '#f2efe6', p: '#ffb5c8', e: '#d62828', c: '#e8c35a' },
  rows: ['.oo....oo.', '.oWo..oWo.', '.oWo..oWo.', '..oWWWWo..', '.oWWWWWWo.', 'oWWeWWeWWo', 'oWWWppWWWo', '.oWWWWWWo.', '..occcco..', '..oooooo..'],
};

const CANHOTO: EnemySpriteDef = {
  id: 'canhoto',
  palette: { o: '#1a2a4a', B: '#3f6fb0', s: '#e0b090', e: '#1a1a1a', k: '#ffe066', h: '#3a2a1a' },
  rows: ['..hhhhhh..', '.hhhhhhhh.', '.osssssso.', '.osesseso.', '.osssssso.', '.oBBBBBBo.', 'kBBBBBBBBo', '.oBBBBBBo.', '..oo..oo..'],
};

// ------------------------------------------------------------------ Chefes
/** As Salsichas: quatro cachorros, cada um com o seu corpo (Geraldo é o líder; Monet, Toddy e Bucky o seguem). */
const CAO = ['.oo......', 'oBBooooo.', 'oeBBBBBBn', 'oBBBBBBBo', '.oBBBBBo.', '.o.o..o.o'];
const cao = (id: string, cor: string): EnemySpriteDef => ({
  id,
  palette: { o: '#3a1c0a', B: cor, e: '#ffffff', n: '#222222' },
  rows: dobrar(CAO.map((l) => l.replace(/B/g, 'B'))),
});
const SALSICHAS = cao('salsichas', '#b5651d');
const MONET = cao('monet', '#d9a15a');
const TODDY = cao('toddy', '#7a3f10');
const BUCKY = cao('bucky', '#e6c9a0');

const JUNINHO: EnemySpriteDef = {
  id: 'juninho',
  palette: { o: '#1a2a4a', s: '#e0b090', b: '#3a6fb5', B: '#2a4f8a', t: '#c0392b', e: '#1a1a1a', m: '#7a3a2a' },
  rows: dobrar([
    '..oooooooo..',
    '.osssssssso.',
    'osseesseesso',
    'osssmmmmssso',
    '.osssssssso.',
    'obbbbttbbbbo',
    'obbbbBtBbbbo',
    'obbbbbtbbbbo',
    '.obbbbbbbbo.',
    '..oo....oo..',
  ]),
};

const RM: EnemySpriteDef = {
  id: 'rm',
  palette: { o: '#2a1a3a', s: '#f0c8a8', h: '#2a2a3a', c: '#9a7fd1', g: '#ffd23f', e: '#1a1a1a', m: '#a04040' },
  rows: dobrar([
    '..hhhhhhhh..',
    '.hhhhhhhhhh.',
    '.hssssssssh.',
    '.hsessssesh.',
    '.hssssssssh.',
    '..sssmmsss..',
    '.occcccccco.',
    'occcgccgccco',
    '.occcccccco.',
    '..oo....oo..',
  ]),
};

const CHRISTOPHER: EnemySpriteDef = {
  id: 'christopher',
  palette: { o: '#6a8fb5', W: '#e8f4ff', w: '#cfe8ff', e: '#1a1a2a', m: '#ff8fb0' },
  rows: dobrar([
    '...oooooo...',
    '..oWWWWWWo..',
    '.oWWWWWWWWo.',
    'oWWeWWWWeWWo',
    'oWWWWWWWWWWo',
    'oWWWmmmmWWWo',
    'oWWWWmmWWWWo',
    'oWWWWWWWWWWo',
    'owWowWowWowo',
    '.o.o.o.o.o.o',
  ]),
};

const ALE: EnemySpriteDef = {
  id: 'ale',
  palette: { o: '#3a2a10', s: '#e0b090', c: '#d9a441', w: '#c0c0c0', e: '#1a1a1a', r: '#c0392b' },
  rows: dobrar([
    '..cccccccc..',
    'occcccccccco',
    '.osssssssso.',
    '.osesssseso.',
    '.osssssssso.',
    '.osssswwsso.',
    '..occcccco..',
    '.occcrrccco.',
    '.occcccccco.',
    '..oo....oo..',
  ]),
};

const TIAGOW: EnemySpriteDef = {
  id: 'tiagow',
  palette: { o: '#1a1a22', s: '#e0b090', h: '#3a2a1a', g: '#9fd0ff', m: '#7a3a2a', k: '#3a3a46', w: '#ffffff', t: '#5a8a5a' },
  rows: dobrar([
    '..hhhhhhhh..',
    '.hhhhhhhhhh.',
    '.osssssssso.',
    '.ogggssgggo.',
    '.osssssssso.',
    '.ossmmmmsso.',
    '..okkkkkko..',
    '.okkkwwkkko.',
    '.okkkttkkko.',
    '.okkkkkkkko.',
    '..oo....oo..',
  ]),
};

/** O Tempo: um relógio gigante com ponteiros, desenhado por fórmula. */
function relogio(n: number): string[] {
  const c = (n - 1) / 2;
  const linhas: string[] = [];
  for (let y = 0; y < n; y++) {
    let l = '';
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x - c, y - c);
      let ch = '.';
      if (d <= c + 0.4) ch = d >= c - 1 ? 'o' : 'F';
      if (ch === 'F') {
        const marca = (x === c && (y === 2 || y === n - 3)) || (y === c && (x === 2 || x === n - 3));
        if (marca) ch = 'g';
        else if (x === c && y < c && y > 3) ch = 'k'; // ponteiro dos minutos
        else if (y === c && x > c && x < c + 4) ch = 'k'; // ponteiro das horas
        if (x === c && y === c) ch = 'r';
      }
      l += ch;
    }
    linhas.push(l);
  }
  return linhas;
}
const TEMPO: EnemySpriteDef = {
  id: 'tempo',
  palette: { o: '#3a3224', F: '#e8e2c8', g: '#d6b04a', k: '#222222', r: '#c0392b' },
  rows: dobrar(relogio(15)),
};

export const ENEMY_SPRITE_DEFS: Readonly<Record<string, EnemySpriteDef>> = Object.fromEntries(
  [ABACAXI, AZEITONA, CAFE, CHIMARRAO, CACHORROQUENTE, VEIOLOCO, KPOPERS, COELHO, CANHOTO, SALSICHAS, MONET, TODDY, BUCKY, JUNINHO, RM, CHRISTOPHER, ALE, TIAGOW, TEMPO].map((d) => [d.id, d]),
);

/** Problemas da grade (vazio = ok): linhas de larguras diferentes ou caracteres fora da paleta. */
export function validarEnemySprite(def: EnemySpriteDef): string[] {
  const erros: string[] = [];
  const w = def.rows[0]?.length ?? 0;
  def.rows.forEach((l, i) => {
    if (l.length !== w) erros.push(`${def.id}[${i}] tem ${l.length} colunas (esperado ${w}): "${l}"`);
    for (const ch of l) if (ch !== '.' && !(ch in def.palette)) erros.push(`${def.id}[${i}] usa "${ch}" fora da paleta`);
  });
  return erros;
}
