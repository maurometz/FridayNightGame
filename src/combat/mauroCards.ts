import type { MauroState } from '../characters/mauroState';
import { EDICAO_FOCO_BONUS } from '../data/mauro';
import type { Player } from '../entities/player';
import type { CardDef } from './cardTypes';

function mauro(fn: (s: MauroState, p: Player) => void): (p: Player) => void {
  return (p) => {
    if (p.kit?.type === 'mauro') fn(p.kit, p);
  };
}

/** As 12 cartas exclusivas do Mauro (GDD A.4). */
export const MAURO_CARDS: readonly CardDef[] = [
  {
    id: 'mauro-orbita',
    character: 'mauro',
    rarity: 'epica',
    name: 'Órbita de Clássicos',
    description: 'Livros orbitam o Mauro, causam dano e empurram os inimigos.',
    apply: mauro((s) => { s.mods.orbita = true; }),
  },
  {
    id: 'mauro-referencia',
    character: 'mauro',
    rarity: 'epica',
    name: 'Referência Cruzada',
    description: 'A runa se divide em duas ao atingir um alvo (uma vez por runa).',
    apply: mauro((s) => { s.mods.referencia = true; }),
  },
  {
    id: 'mauro-sobrecarga',
    character: 'mauro',
    rarity: 'lendaria',
    name: 'Sobrecarga Enciclopédica',
    description: 'A cada 100 abates, +5% de dano permanente (até +25%).',
    apply: mauro((s) => { s.mods.sobrecarga = true; }),
  },
  {
    id: 'mauro-pe-de-pagina',
    character: 'mauro',
    rarity: 'comum',
    name: 'Nota de Pé de Página',
    description: 'As Notas de Rodapé custam 6 de Foco.',
    apply: mauro((s) => { s.mods.peDePagina = true; }),
  },
  {
    id: 'mauro-indice',
    character: 'mauro',
    rarity: 'rara',
    name: 'Índice Remissivo',
    description: 'As runas marcam inimigos. Marcados recebem +10% de dano.',
    apply: mauro((s) => { s.mods.indice = true; }),
  },
  {
    id: 'mauro-biblio',
    character: 'mauro',
    rarity: 'rara',
    name: 'Bibliografia Comentada',
    description: 'A cada 10 abates, a próxima Nota ganha +1 salto.',
    apply: mauro((s) => { s.mods.biblio = true; }),
  },
  {
    id: 'mauro-edicao',
    character: 'mauro',
    rarity: 'epica',
    name: 'Edição Revisada',
    description: 'Foco máximo +30 e regeneração +2/s.',
    apply: mauro((s) => {
      s.mods.edicao = true;
      s.foco += EDICAO_FOCO_BONUS;
    }),
  },
  {
    id: 'mauro-sala',
    character: 'mauro',
    rarity: 'epica',
    name: 'Sala de Leitura Silenciosa',
    description: 'Parado por 3 s, ganha +20% de XP e de regeneração de Foco.',
    apply: mauro((s) => { s.mods.sala = true; }),
  },
  {
    id: 'mauro-rodape',
    character: 'mauro',
    rarity: 'rara',
    name: 'Rodapé do Rodapé',
    description: 'Cada runa deixa um eco que repete o dano após 1 s.',
    apply: mauro((s) => { s.mods.rodape = true; }),
  },
  {
    id: 'mauro-mestre',
    character: 'mauro',
    rarity: 'lendaria',
    name: 'Mestre da Nota Longa',
    description: 'A cada 5 saltos, a runa vira um Apêndice e explode em área.',
    apply: mauro((s) => { s.mods.mestre = true; }),
  },
  {
    id: 'mauro-enciclopedia',
    character: 'mauro',
    rarity: 'lendaria',
    name: 'Enciclopédia Viva',
    description: '+1 de dano por nível do Mauro.',
    apply: mauro((s) => { s.mods.enciclopedia = true; }),
  },
  {
    id: 'mauro-revisao',
    character: 'mauro',
    rarity: 'comum',
    name: 'Revisão de Prova',
    description: 'Recupera Foco ao acertar um chefe.',
    apply: mauro((s) => { s.mods.revisao = true; }),
  },
  {
    id: 'mauro-postit',
    character: 'mauro',
    rarity: 'comum',
    name: 'Post-it Colado',
    description: 'As runas deixam o inimigo lento por 1,5 s.',
    apply: mauro((s) => { s.mods.postit = true; }),
  },
  {
    id: 'mauro-fichamento',
    character: 'mauro',
    rarity: 'rara',
    name: 'Fichamento',
    description: 'Foco máximo +25 e regeneração de Foco +1,5 por segundo.',
    apply: mauro((s) => { s.mods.fichamento = true; }),
  },
  {
    id: 'mauro-nota-dupla',
    character: 'mauro',
    rarity: 'epica',
    name: 'Nota Dupla',
    description: 'A cada 5 ataques, uma segunda runa sai junto, sem custo de Foco.',
    apply: mauro((s) => { s.mods.notaDupla = true; }),
  },
  {
    id: 'mauro-leitura-dinamica',
    character: 'mauro',
    rarity: 'comum',
    maxLevel: 3,
    name: 'Leitura Dinâmica',
    description: '+12% de XP e +8% de velocidade de ataque.',
    apply: (p) => {
      p.xpMul *= 1.12;
      p.attackSpeedMul *= 1.08;
    },
  },
];
