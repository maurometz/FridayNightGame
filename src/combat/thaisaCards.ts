import type { ThaisaState } from '../characters/thaisaState';
import type { Player } from '../entities/player';
import type { CardDef } from './cardTypes';

function thaisa(fn: (s: ThaisaState, p: Player) => void): (p: Player) => void {
  return (p) => {
    if (p.kit?.type === 'thaisa') fn(p.kit, p);
  };
}

/** As 12 cartas exclusivas da Thaisa (GDD A.4). */
export const THAISA_CARDS: readonly CardDef[] = [
  {
    id: 'thaisa-sismica',
    character: 'thaisa',
    rarity: 'epica',
    name: 'Pancada Sísmica Fortissimo',
    description: 'A cada 3 golpes, uma onda grave percorre o chão.',
    apply: thaisa((s) => { s.mods.sismica = true; }),
  },
  {
    id: 'thaisa-rodizio',
    character: 'thaisa',
    rarity: 'epica',
    name: 'Rodízio Livre',
    description: 'Cura excedente vira escudo (até 30% do HP) e cria uma aura de choque.',
    apply: thaisa((s) => { s.mods.rodizio = true; }),
  },
  {
    id: 'thaisa-fortaleza',
    character: 'thaisa',
    rarity: 'lendaria',
    name: 'Fortaleza Acústica',
    description: 'O arco bloqueia projéteis inimigos.',
    apply: thaisa((s) => { s.mods.fortaleza = true; }),
  },
  {
    id: 'thaisa-segunda',
    character: 'thaisa',
    rarity: 'comum',
    name: 'Segunda Porção',
    description: 'As comidas dão +1 acúmulo de Pico de Glicose.',
    apply: thaisa((s) => { s.mods.segunda = true; }),
  },
  {
    id: 'thaisa-arco',
    character: 'thaisa',
    rarity: 'rara',
    name: 'Arco Largo de Família',
    description: 'Alcance do arco +25%.',
    apply: thaisa((s) => { s.mods.arcoLargo = true; }),
  },
  {
    id: 'thaisa-pe-firme',
    character: 'thaisa',
    rarity: 'rara',
    name: 'Pé Firme',
    description: 'Imune a empurrões por 1 s depois de cada golpe.',
    apply: thaisa((s) => { s.mods.peFirme = true; }),
  },
  {
    id: 'thaisa-cardapio',
    character: 'thaisa',
    rarity: 'epica',
    name: 'Cardápio do Dia',
    description: 'Comer dá um buff aleatório extra: velocidade, dano ou regeneração.',
    apply: thaisa((s) => { s.mods.cardapio = true; }),
  },
  {
    id: 'thaisa-bufe',
    character: 'thaisa',
    rarity: 'lendaria',
    name: 'Bufê Livre',
    description: 'Toda comida de cura também ativa um escudo.',
    apply: thaisa((s) => { s.mods.bufe = true; }),
  },
  {
    id: 'thaisa-maestro',
    character: 'thaisa',
    rarity: 'rara',
    name: 'Maestro do Cansaço',
    description: 'O Pico de Glicose máximo sobe para 7.',
    apply: thaisa((s) => { s.mods.maestro = true; }),
  },
  {
    id: 'thaisa-grave',
    character: 'thaisa',
    rarity: 'epica',
    requires: 'thaisa-sismica',
    name: 'Grave que Não Para',
    description: 'A onda grave empurra e marca os inimigos.',
    apply: thaisa((s) => { s.mods.grave = true; }),
  },
  {
    id: 'thaisa-sopa',
    character: 'thaisa',
    rarity: 'comum',
    name: 'Sopa de Família',
    description: 'A cura das comidas +20%.',
    apply: thaisa((s) => { s.mods.sopa = true; }),
  },
  {
    id: 'thaisa-afinacao',
    character: 'thaisa',
    rarity: 'rara',
    name: 'Afinação Pesada',
    description: 'Dano de colisão contra paredes +50%.',
    apply: thaisa((s) => { s.mods.afinacaoPesada = true; }),
  },
  {
    id: 'thaisa-repeteco',
    character: 'thaisa',
    rarity: 'rara',
    name: 'Repeteco',
    description: 'A cada 4 golpes, o golpe seguinte causa +80% de dano.',
    apply: thaisa((s) => { s.mods.repeteco = true; }),
  },
  {
    id: 'thaisa-colher',
    character: 'thaisa',
    rarity: 'comum',
    name: 'Colher de Pau',
    description: 'O arco do violoncelo deixa os atingidos lentos por 2 s.',
    apply: thaisa((s) => { s.mods.colher = true; }),
  },
  {
    id: 'thaisa-costela',
    character: 'thaisa',
    rarity: 'epica',
    name: 'Costela no Bafo',
    description: 'Com 3 ou mais acúmulos de Pico de Glicose, recebe 20% menos dano.',
    apply: thaisa((s) => { s.mods.costela = true; }),
  },
  {
    id: 'thaisa-marmita',
    character: 'thaisa',
    rarity: 'comum',
    maxLevel: 3,
    name: 'Estoque de Marmitas',
    description: '+25 de HP máximo e cura 25.',
    apply: (p) => {
      p.maxHp += 25;
      p.hp = Math.min(p.maxHp, p.hp + 25);
    },
  },
];
