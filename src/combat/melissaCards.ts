import type { MelissaState } from '../characters/melissaState';
import { ENSAIO_ATTACK_SPEED } from '../data/melissa';
import type { Player } from '../entities/player';
import type { CardDef } from './cardTypes';

function melissa(fn: (s: MelissaState, p: Player) => void): (p: Player) => void {
  return (p) => {
    if (p.kit?.type === 'melissa') fn(p.kit, p);
  };
}

/** As 12 cartas exclusivas da Melissa (GDD A.4). */
export const MELISSA_CARDS: readonly CardDef[] = [
  {
    id: 'melissa-investida',
    character: 'melissa',
    rarity: 'epica',
    name: 'Investida do Encore',
    description: 'Libera um avanço cortante (tecla de ação). Acertar um Holofote reseta a recarga.',
    apply: melissa((s) => { s.mods.investida = true; }),
  },
  {
    id: 'melissa-fancam',
    character: 'melissa',
    rarity: 'epica',
    name: 'Flash de Fancam',
    description: 'Cone que faz os inimigos perderem a mira por 2 s.',
    apply: melissa((s) => { s.mods.fancam = true; }),
  },
  {
    id: 'melissa-protagonista',
    character: 'melissa',
    rarity: 'lendaria',
    name: 'Síndrome de Protagonista',
    description: 'Após a Reação Exagerada: crítico x3 por 5 s e 0,5 s de invulnerabilidade.',
    apply: melissa((s) => { s.mods.protagonista = true; }),
  },
  {
    id: 'melissa-ensaio',
    character: 'melissa',
    rarity: 'comum',
    maxLevel: 3,
    name: 'Ensaio de Coreografia',
    description: '+10% de velocidade de ataque.',
    apply: (p) => { p.attackSpeedMul *= ENSAIO_ATTACK_SPEED; },
  },
  {
    id: 'melissa-extra',
    character: 'melissa',
    rarity: 'rara',
    name: 'Ponto de Holofote Extra',
    description: 'Dois Holofotes por ataque.',
    apply: melissa((s) => { s.mods.extraHolofote = true; }),
  },
  {
    id: 'melissa-passo',
    character: 'melissa',
    rarity: 'rara',
    requires: 'melissa-investida',
    name: 'Passo de Dança Vertical',
    description: 'O avanço atravessa obstáculos.',
    apply: melissa((s) => { s.mods.passoVertical = true; }),
  },
  {
    id: 'melissa-fandom',
    character: 'melissa',
    rarity: 'epica',
    name: 'Fandom Organizado',
    description: 'Aliados perto da Melissa ganham +5% de crítico.',
    apply: melissa((s) => { s.mods.fandom = true; }),
  },
  {
    id: 'melissa-lightstick',
    character: 'melissa',
    rarity: 'rara',
    name: 'Lightstick Fora de Órbita',
    description: 'Alcance do florete +30%.',
    apply: melissa((s) => { s.mods.lightstick = true; }),
  },
  {
    id: 'melissa-rotina',
    character: 'melissa',
    rarity: 'epica',
    name: 'Rotina de Fim de Semana',
    description: 'A cada 3 Holofotes acertados, uma Reação Exagerada sem recarga.',
    apply: melissa((s) => { s.mods.rotina = true; }),
  },
  {
    id: 'melissa-show',
    character: 'melissa',
    rarity: 'lendaria',
    name: 'Show Inesperado',
    description: 'O primeiro Holofote de cada inimigo explode em luz.',
    apply: melissa((s) => { s.mods.showInesperado = true; }),
  },
  {
    id: 'melissa-bis',
    character: 'melissa',
    rarity: 'rara',
    requires: 'melissa-investida',
    name: 'Bis de Coreografia',
    description: 'Depois de um avanço, um segundo avanço sem recarga em 3 s.',
    apply: melissa((s) => { s.mods.bis = true; }),
  },
  {
    id: 'melissa-camera',
    character: 'melissa',
    rarity: 'comum',
    name: 'Câmera de Celular',
    description: 'Os Holofotes duram 1 s a mais.',
    apply: melissa((s) => { s.mods.camera = true; }),
  },
  {
    id: 'melissa-bastidores',
    character: 'melissa',
    rarity: 'rara',
    name: 'Passe de Bastidores',
    description: 'Cada Holofote acertado pelas costas cura 4 HP.',
    apply: melissa((s) => { s.mods.backstage = true; }),
  },
  {
    id: 'melissa-afterparty',
    character: 'melissa',
    rarity: 'comum',
    name: 'After Party',
    description: 'A explosão de velocidade do Holofote dura 1,5 s a mais.',
    apply: melissa((s) => { s.mods.afterparty = true; }),
  },
  {
    id: 'melissa-autografo',
    character: 'melissa',
    rarity: 'epica',
    name: 'Autógrafo no Ato',
    description: 'O Holofote acertado pelas costas atordoa o inimigo por 1 s.',
    apply: melissa((s) => { s.mods.autografo = true; }),
  },
  {
    id: 'melissa-closeup',
    character: 'melissa',
    rarity: 'rara',
    name: 'Close-Up',
    description: 'O crítico do Holofote vale x2,5 em vez de x2.',
    apply: melissa((s) => { s.mods.closeUp = true; }),
  },
];
