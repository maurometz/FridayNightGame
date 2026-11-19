import type { FelipeState } from '../characters/felipeState';
import { TURNE_INTERVAL_S } from '../data/felipe';
import type { Player } from '../entities/player';
import type { CardDef } from './cardTypes';

/** Aplica um efeito só se o jogador for mesmo o Felipe. */
function felipe(fn: (s: FelipeState, p: Player) => void): (p: Player) => void {
  return (p) => {
    if (p.kit?.type === 'felipe') fn(p.kit, p);
  };
}

/** As 12 cartas exclusivas do Felipe (GDD A.4). */
export const FELIPE_CARDS: readonly CardDef[] = [
  {
    id: 'felipe-viola',
    character: 'felipe',
    rarity: 'epica',
    name: 'Viola',
    description: 'Libera o 5º instrumento. Trocar de ou para a Viola não tem afinação.',
    apply: felipe((s) => {
      if (!s.owned.includes('viola')) s.owned.push('viola');
      s.ammo.viola = s.maxAmmo.viola;
    }),
  },
  {
    id: 'felipe-bis',
    character: 'felipe',
    rarity: 'rara',
    name: 'Bis no Show',
    description: 'Ao esgotar um instrumento, o próximo dispara uma rajada extra.',
    apply: felipe((s) => { s.mods.bis = true; }),
  },
  {
    id: 'felipe-afinacao',
    character: 'felipe',
    rarity: 'rara',
    name: 'Afinação de Ouvido',
    description: 'A afinação cai pela metade e o Violão erra menos.',
    apply: felipe((s) => { s.mods.afinacaoOuvido = true; }),
  },
  {
    id: 'felipe-roadie',
    character: 'felipe',
    rarity: 'rara',
    name: 'Roadie de Madrugada',
    description: 'Cada abate devolve 1 de munição ao instrumento ativo.',
    apply: felipe((s) => { s.mods.roadie = true; }),
  },
  {
    id: 'felipe-passagem',
    character: 'felipe',
    rarity: 'comum',
    name: 'Passagem de Som',
    description: 'A primeira troca de cada ato não tem afinação.',
    apply: felipe((s) => { s.mods.passagemSom = true; }),
  },
  {
    id: 'felipe-ensaio',
    character: 'felipe',
    rarity: 'epica',
    name: 'Ensaio Geral',
    description: 'Com 3 ou mais inimigos por perto, a Bateria dispara sozinha com dano extra.',
    apply: felipe((s) => { s.mods.ensaioGeral = true; }),
  },
  {
    id: 'felipe-setlist',
    character: 'felipe',
    rarity: 'rara',
    name: 'Setlist Surpresa',
    description: 'A Espiral sorteia duas anomalias e fica com a mais rara.',
    apply: felipe((s) => { s.mods.setlist = true; }),
  },
  {
    id: 'felipe-corda',
    character: 'felipe',
    rarity: 'comum',
    maxLevel: 3,
    name: 'Corda Extra',
    description: '+10 de munição no Violão.',
    apply: felipe((s) => {
      s.maxAmmo.violao += 10;
      s.ammo.violao += 10;
    }),
  },
  {
    id: 'felipe-microfone',
    character: 'felipe',
    rarity: 'epica',
    name: 'Microfone de Feedback',
    description: 'O Kazoo atordoa os inimigos em que ricocheteia.',
    apply: felipe((s) => { s.mods.microfone = true; }),
  },
  {
    id: 'felipe-turne',
    character: 'felipe',
    rarity: 'lendaria',
    name: 'Turnê de Bolso',
    description: 'A cada 60 s, todos os instrumentos disparam em sequência.',
    apply: felipe((s) => {
      s.mods.turne = true;
      s.turneTimer = TURNE_INTERVAL_S;
    }),
  },
  {
    id: 'felipe-encore',
    character: 'felipe',
    rarity: 'lendaria',
    name: 'Encore do Felipe',
    description: 'Ao esgotar qualquer munição, ela recarrega 30%.',
    apply: felipe((s) => { s.mods.encore = true; }),
  },
  {
    id: 'felipe-abertura',
    character: 'felipe',
    rarity: 'comum',
    onlyAtLevel: 2,
    name: 'Show de Abertura',
    description: '+10% de velocidade de ataque até o fim da partida.',
    apply: (p) => { p.attackSpeedMul *= 1.1; },
  },
  {
    id: 'felipe-pedal',
    character: 'felipe',
    rarity: 'rara',
    name: 'Pedal de Distorção',
    description: 'O Violão e o Kazoo causam +30% de dano.',
    apply: felipe((s) => { s.mods.pedal = true; }),
  },
  {
    id: 'felipe-solo',
    character: 'felipe',
    rarity: 'epica',
    name: 'Solo de Improviso',
    description: 'Depois de trocar de instrumento, o primeiro ataque causa o dobro de dano.',
    apply: felipe((s) => { s.mods.solo = true; }),
  },
  {
    id: 'felipe-camarim',
    character: 'felipe',
    rarity: 'comum',
    maxLevel: 3,
    name: 'Camarim Reservado',
    description: 'Os instrumentos guardados recarregam 30% mais rápido.',
    apply: felipe((s) => { s.rechargeMul += 0.3; }),
  },
  {
    id: 'felipe-requiem',
    character: 'felipe',
    rarity: 'lendaria',
    name: 'Réquiem da Morte',
    description: 'Quando você ou um aliado perto cai, a Flauta toca o Réquiem: ele se levanta com metade da vida e uma onda empurra os inimigos. Recarrega em 90 s.',
    apply: felipe((s) => { s.mods.requiem = true; }),
  },
  {
    id: 'felipe-fa-clube',
    character: 'felipe',
    rarity: 'rara',
    name: 'Fã-Clube da Madrugada',
    description: 'A cada 20 abates, +3% de dano permanente (até +30%).',
    apply: felipe((s) => { s.mods.fa = true; }),
  },
];
