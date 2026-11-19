import type { FelipeState } from '../characters/felipeState';
import type { MauroState } from '../characters/mauroState';
import type { MelissaState } from '../characters/melissaState';
import type { ThaisaState } from '../characters/thaisaState';
import type { ThayssaState } from '../characters/thayssaState';
import { PASSA_EVERY_S } from '../data/team';
import type { Player } from '../entities/player';
import type { CardDef } from './cardTypes';

/** Aplica um efeito só se o jogador for do kit certo. */
function para<K extends NonNullable<Player['kit']>>(type: K['type'], fn: (s: K, p: Player) => void): (p: Player) => void {
  return (p) => {
    if (p.kit?.type === type) fn(p.kit as K, p);
  };
}

const felipe = (fn: (s: FelipeState) => void): ((p: Player) => void) => para<FelipeState>('felipe', fn);
const mauro = (fn: (s: MauroState) => void): ((p: Player) => void) => para<MauroState>('mauro', fn);
const melissa = (fn: (s: MelissaState) => void): ((p: Player) => void) => para<MelissaState>('melissa', fn);
const thaisa = (fn: (s: ThaisaState) => void): ((p: Player) => void) => para<ThaisaState>('thaisa', fn);
const thayssa = (fn: (s: ThayssaState) => void): ((p: Player) => void) => para<ThayssaState>('thayssa', fn);

/**
 * As 25 cartas de equipe (GDD A.4.1): 5 por personagem. Todas dependem de aliados por perto,
 * então rendem mais no co-op e com o companheiro IA.
 */
export const TEAM_CARDS: readonly CardDef[] = [
  // ---- Felipe ----
  {
    id: 'team-felipe-coro',
    kind: 'team',
    character: 'felipe',
    rarity: 'rara',
    name: 'Coro de Apoio',
    description: 'Aliados a até 6 tiles recebem +5% de dano enquanto o Felipe ataca.',
    apply: felipe((s) => { s.mods.coro = true; }),
  },
  {
    id: 'team-felipe-sinal',
    kind: 'team',
    character: 'felipe',
    rarity: 'comum',
    name: 'Sinal de Passagem',
    description: 'Ao trocar de instrumento, o aliado mais próximo (até 4 tiles) recarrega mais rápido.',
    apply: felipe((s) => { s.mods.sinal = true; }),
  },
  {
    id: 'team-felipe-intervalo',
    kind: 'team',
    character: 'felipe',
    rarity: 'epica',
    name: 'Intervalo Compartilhado',
    description: 'Quando o Felipe esgota uma munição, aliados próximos recarregam mais rápido.',
    apply: felipe((s) => { s.mods.intervalo = true; }),
  },
  {
    id: 'team-felipe-quem-canta',
    kind: 'team',
    character: 'felipe',
    rarity: 'rara',
    name: 'Quem Canta Junto',
    description: 'Aliados que atacam o mesmo inimigo que o Felipe causam +10% de dano.',
    apply: felipe((s) => { s.mods.quemCanta = true; }),
  },
  {
    id: 'team-felipe-passa-a-vez',
    kind: 'team',
    character: 'felipe',
    rarity: 'lendaria',
    name: 'Passa a Vez',
    description: 'A cada 45 s, o Felipe empresta o Violão ao aliado mais próximo por 10 s.',
    apply: felipe((s) => {
      s.mods.passaAVez = true;
      s.passaTimer = PASSA_EVERY_S;
    }),
  },

  // ---- Mauro ----
  {
    id: 'team-mauro-trabalho',
    kind: 'team',
    character: 'mauro',
    rarity: 'comum',
    name: 'Trabalho em Grupo',
    description: 'Uma runa por ataque pula para um aliado, que ganha +10% de dano por 3 s.',
    apply: mauro((s) => { s.mods.trabalho = true; }),
  },
  {
    id: 'team-mauro-resumo',
    kind: 'team',
    character: 'mauro',
    rarity: 'rara',
    name: 'Resumo Coletivo',
    description: 'Aliados que sofrem dano dividem 10% com o Mauro, que regenera Foco com isso.',
    apply: mauro((s) => { s.mods.resumo = true; }),
  },
  {
    id: 'team-mauro-biblio',
    kind: 'team',
    character: 'mauro',
    rarity: 'epica',
    name: 'Bibliografia Compartilhada',
    description: 'Cada abate do Mauro acelera as recargas dos aliados próximos. No nível 10, as Notas viram Citação.',
    apply: mauro((s) => { s.mods.biblioColetiva = true; }),
  },
  {
    id: 'team-mauro-pares',
    kind: 'team',
    character: 'mauro',
    rarity: 'rara',
    name: 'Revisão por Pares',
    description: 'Quando um aliado sobe de nível, o Mauro ganha 50 de XP.',
    apply: mauro((s) => { s.mods.pares = true; }),
  },
  {
    id: 'team-mauro-indice',
    kind: 'team',
    character: 'mauro',
    rarity: 'lendaria',
    name: 'Índice Coletivo',
    description: 'A cada 100 abates do grupo, +5% de dano para todos (até +50%).',
    apply: mauro((s) => { s.mods.indiceColetivo = true; }),
  },

  // ---- Melissa ----
  {
    id: 'team-melissa-torcida',
    kind: 'team',
    character: 'melissa',
    rarity: 'comum',
    name: 'Torcida Organizada',
    description: 'Aliados perto da Melissa ganham +5% de velocidade de ataque.',
    apply: melissa((s) => { s.mods.torcida = true; }),
  },
  {
    id: 'team-melissa-passe',
    kind: 'team',
    character: 'melissa',
    rarity: 'rara',
    name: 'Passe de Holofote',
    description: 'Ao acertar um Holofote, a Melissa marca outro inimigo, e aliados o acertam com crítico por 3 s.',
    apply: melissa((s) => { s.mods.passe = true; }),
  },
  {
    id: 'team-melissa-entrada',
    kind: 'team',
    character: 'melissa',
    rarity: 'epica',
    requires: 'melissa-investida',
    name: 'Entrada Sincronizada',
    description: 'A Melissa e um aliado a até 4 tiles avançam juntos e causam dano em área.',
    apply: melissa((s) => { s.mods.entrada = true; }),
  },
  {
    id: 'team-melissa-cobertura',
    kind: 'team',
    character: 'melissa',
    rarity: 'rara',
    name: 'Cobertura do Encore',
    description: 'Quando um aliado cai abaixo de 30% de HP, a Melissa ganha velocidade.',
    apply: melissa((s) => { s.mods.cobertura = true; }),
  },
  {
    id: 'team-melissa-coreografia',
    kind: 'team',
    character: 'melissa',
    rarity: 'lendaria',
    name: 'Coreografia de Grupo',
    description: 'A cada 3 Holofotes acertados pelo grupo, a Melissa ativa a Reação Exagerada no time.',
    apply: melissa((s) => { s.mods.coreografia = true; }),
  },

  // ---- Thaisa ----
  {
    id: 'team-thaisa-pode-passar',
    kind: 'team',
    character: 'thaisa',
    rarity: 'comum',
    name: 'Pode Passar',
    description: 'A comida que a Thaisa pega também cura o aliado mais ferido a até 4 tiles.',
    apply: thaisa((s) => { s.mods.podePassar = true; }),
  },
  {
    id: 'team-thaisa-muro',
    kind: 'team',
    character: 'thaisa',
    rarity: 'rara',
    name: 'Muro Humano',
    description: 'Aliados a até 3 tiles da Thaisa recebem 15% de redução de dano.',
    apply: thaisa((s) => { s.mods.muro = true; }),
  },
  {
    id: 'team-thaisa-arco',
    kind: 'team',
    character: 'thaisa',
    rarity: 'epica',
    name: 'Arco Coletivo',
    description: 'O arco empurra inimigos na direção de aliados, que ganham +15% de dano.',
    apply: thaisa((s) => { s.mods.arcoColetivo = true; }),
  },
  {
    id: 'team-thaisa-roda',
    kind: 'team',
    character: 'thaisa',
    rarity: 'rara',
    name: 'Roda de Mate',
    description: 'A cada 10 s com aliados por perto, a Thaisa ganha 1 Pico e eles ganham velocidade de ataque.',
    apply: thaisa((s) => { s.mods.roda = true; }),
  },
  {
    id: 'team-thaisa-retaguarda',
    kind: 'team',
    character: 'thaisa',
    rarity: 'lendaria',
    name: 'Retaguarda Gaúcha',
    description: 'Quando um aliado cai, a Thaisa ganha escudo e os aliados próximos ganham +20% de velocidade por 5 s.',
    apply: thaisa((s) => { s.mods.retaguarda = true; }),
  },

  // ---- Thayssa ----
  {
    id: 'team-thayssa-mao',
    kind: 'team',
    character: 'thayssa',
    rarity: 'comum',
    name: 'Mão Estendida',
    description: 'Aliados que entram no anel ganham +10% de velocidade de movimento por 2 s.',
    apply: thayssa((s) => { s.mods.maoEstendida = true; }),
  },
  {
    id: 'team-thayssa-abraco',
    kind: 'team',
    character: 'thayssa',
    rarity: 'rara',
    name: 'Abraço em Grupo',
    description: 'Aliados no anel recebem +1 HP/s de regeneração no modo Euforia.',
    apply: thayssa((s) => { s.mods.abracoGrupo = true; }),
  },
  {
    id: 'team-thayssa-escudo',
    kind: 'team',
    character: 'thayssa',
    rarity: 'epica',
    name: 'Escudo de Afeto',
    description: 'Aliados no anel dividem 20% do dano recebido pela Thayssa.',
    apply: thayssa((s) => { s.mods.escudoAfeto = true; }),
  },
  {
    id: 'team-thayssa-espelho',
    kind: 'team',
    character: 'thayssa',
    rarity: 'rara',
    name: 'Espelho de Emoção',
    description: 'Quando um aliado usa a Ultimate, a Thayssa troca de modo sem custo de transição.',
    apply: thayssa((s) => { s.mods.espelho = true; }),
  },
  {
    id: 'team-thayssa-circulo',
    kind: 'team',
    character: 'thayssa',
    rarity: 'lendaria',
    name: 'Círculo Completo',
    description: 'Com 3 ou mais aliados no anel, a aura ganha +1 pulso e +1 tile de raio.',
    apply: thayssa((s) => { s.mods.circulo = true; }),
  },
];
