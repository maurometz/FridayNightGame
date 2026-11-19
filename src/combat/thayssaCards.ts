import type { ThayssaState } from '../characters/thayssaState';
import type { Player } from '../entities/player';
import type { CardDef } from './cardTypes';

function thayssa(fn: (s: ThayssaState, p: Player) => void): (p: Player) => void {
  return (p) => {
    if (p.kit?.type === 'thayssa') fn(p.kit, p);
  };
}

/** As 12 cartas exclusivas da Thayssa (GDD A.4). */
export const THAYSSA_CARDS: readonly CardDef[] = [
  {
    id: 'thayssa-drop',
    character: 'thayssa',
    rarity: 'epica',
    name: 'Drop na Troca',
    description: 'Alternar de modo libera uma explosão em área.',
    apply: thayssa((s) => { s.mods.drop = true; }),
  },
  {
    id: 'thayssa-ressonancia',
    character: 'thayssa',
    rarity: 'lendaria',
    name: 'Ressonância Dupla',
    description: 'As duas auras ficam ativas juntas por 4 s, a cada 30 s.',
    apply: thayssa((s) => { s.mods.ressonancia = true; }),
  },
  {
    id: 'thayssa-abraco',
    character: 'thayssa',
    rarity: 'epica',
    name: 'Raio do Abraço Coletivo',
    description: 'Raio da aura +50% e buffs +20%.',
    apply: thayssa((s) => { s.mods.abraco = true; }),
  },
  {
    id: 'thayssa-cadeia',
    character: 'thayssa',
    rarity: 'rara',
    name: 'Risada em Cadeia',
    description: 'Brilhos de cura reduzem a recarga de 2 aliados.',
    apply: thayssa((s) => { s.mods.risadaCadeia = true; }),
  },
  {
    id: 'thayssa-metronomo',
    character: 'thayssa',
    rarity: 'rara',
    name: 'Metrônomo do Coração',
    description: 'A transição entre auras cai para 0,2 s.',
    apply: thayssa((s) => { s.mods.metronomo = true; }),
  },
  {
    id: 'thayssa-pe-no-chao',
    character: 'thayssa',
    rarity: 'comum',
    name: 'Aura de Pé no Chão',
    description: 'A Euforia dá +0,5 de regeneração por segundo.',
    apply: thayssa((s) => { s.mods.peNoChao = true; }),
  },
  {
    id: 'thayssa-sincronia',
    character: 'thayssa',
    rarity: 'epica',
    name: 'Sincronia Oceânica',
    description: 'Trocar de aura libera um pulso que cura aliados a 5 tiles.',
    apply: thayssa((s) => { s.mods.sincronia = true; }),
  },
  {
    id: 'thayssa-entrega',
    character: 'thayssa',
    rarity: 'rara',
    name: 'Entrega Calorosa',
    description: 'Aliados na aura recebem 50% do XP dos inimigos mortos na aura.',
    apply: thayssa((s) => { s.mods.entrega = true; }),
  },
  {
    id: 'thayssa-ultimo',
    character: 'thayssa',
    rarity: 'lendaria',
    name: 'Último Abraço',
    description: 'Com a Thayssa abaixo de 10% de HP, aliados na aura ficam invulneráveis por 2 s.',
    apply: thayssa((s) => { s.mods.ultimo = true; }),
  },
  {
    id: 'thayssa-danca',
    character: 'thayssa',
    rarity: 'epica',
    name: 'Dança dos Dois Modos',
    description: 'Cinco trocas seguidas de aura criam uma explosão.',
    apply: thayssa((s) => { s.mods.danca = true; }),
  },
  {
    id: 'thayssa-gargalhada',
    character: 'thayssa',
    rarity: 'comum',
    name: 'Gargalhada Perdida',
    description: 'Inimigos mortos na aura têm 15% de chance de dar XP extra.',
    apply: thayssa((s) => { s.mods.gargalhada = true; }),
  },
  {
    id: 'thayssa-palmas',
    character: 'thayssa',
    rarity: 'rara',
    name: 'Pulso de Palmas',
    description: 'A cada 10 s, uma onda de empurrão ao redor da aura.',
    apply: thayssa((s) => { s.mods.palmas = true; }),
  },
  {
    id: 'thayssa-coracao-grande',
    character: 'thayssa',
    rarity: 'epica',
    name: 'Coração Grande',
    description: 'Os pulsos das duas auras causam +50% de dano.',
    apply: thayssa((s) => { s.mods.coracao = true; }),
  },
  {
    id: 'thayssa-abraco-apertado',
    character: 'thayssa',
    rarity: 'rara',
    name: 'Abraço Apertado',
    description: 'O raio da aura aumenta 20%.',
    apply: thayssa((s) => { s.mods.apertado = true; }),
  },
  {
    id: 'thayssa-lagrima-doce',
    character: 'thayssa',
    rarity: 'rara',
    name: 'Lágrima Doce',
    description: 'Cada pulso da Euforia cura 1,5 HP de quem está na aura.',
    apply: thayssa((s) => { s.mods.lagrima = true; }),
  },
  {
    id: 'thayssa-playlist',
    character: 'thayssa',
    rarity: 'epica',
    name: 'Playlist Compartilhada',
    description: 'Ao trocar de modo, quem está na aura ganha +20% de velocidade de ataque por 4 s.',
    apply: thayssa((s) => { s.mods.playlist = true; }),
  },
];
