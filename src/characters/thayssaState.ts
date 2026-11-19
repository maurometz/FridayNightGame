import { CIRCULO_RADIUS_BONUS } from '../data/team';
import {
  ABRACO_BUFF_MUL,
  ABRACO_RADIUS_MUL,
  AURA_RADIUS,
  METRONOMO_TRANSICAO_S,
  TRANSICAO_S,
} from '../data/thayssa';

export type AuraMode = 'euforia' | 'sobrecarga';

export interface ThayssaMods {
  /** Drop na Troca: alternar de modo libera uma explosão em área. */
  drop: boolean;
  /** Ressonância Dupla: as duas auras ativas ao mesmo tempo por 4 s. */
  ressonancia: boolean;
  /** Raio do Abraço Coletivo: raio da aura +50% e buffs +20%. */
  abraco: boolean;
  /** Risada em Cadeia: brilhos de cura reduzem a recarga de 2 aliados. */
  risadaCadeia: boolean;
  /** Metrônomo do Coração: a transição cai para 0,2 s. */
  metronomo: boolean;
  /** Aura de Pé no Chão: Euforia dá +0,5 de regeneração por segundo. */
  peNoChao: boolean;
  /** Sincronia Oceânica: trocar de aura libera um pulso que cura aliados a 5 tiles. */
  sincronia: boolean;
  /** Entrega Calorosa: aliados na aura recebem 50% do XP dos inimigos mortos na aura. */
  entrega: boolean;
  /** Último Abraço: abaixo de 10% de HP, aliados na aura ficam invulneráveis por 2 s. */
  ultimo: boolean;
  /** Dança dos Dois Modos: cinco trocas seguidas criam uma explosão. */
  danca: boolean;
  /** Gargalhada Perdida: inimigos mortos na aura têm 15% de chance de dar XP extra. */
  gargalhada: boolean;
  /** Pulso de Palmas: a cada 10 s, uma onda de empurrão ao redor da aura. */
  palmas: boolean;
  /** Coração Grande: os pulsos das duas auras causam +50% de dano. */
  coracao: boolean;
  /** Abraço Apertado: o raio da aura +20%. */
  apertado: boolean;
  /** Lágrima Doce: cada pulso da Euforia cura 1,5 HP de quem está na aura. */
  lagrima: boolean;
  /** Playlist Compartilhada: trocar de modo dá +20% de velocidade de ataque por 4 s a quem está na aura. */
  playlist: boolean;
  // ---- Cartas de equipe ----
  /** Mão Estendida: aliados que entram no anel ganham +10% de velocidade por 2 s. */
  maoEstendida: boolean;
  /** Abraço em Grupo: aliados no anel recebem +1 HP/s na Euforia. */
  abracoGrupo: boolean;
  /** Escudo de Afeto: aliados no anel dividem 20% do dano recebido pela Thayssa. */
  escudoAfeto: boolean;
  /** Espelho de Emoção: quando um aliado usa Ultimate, troca de modo sem transição. */
  espelho: boolean;
  /** Círculo Completo: com 3 ou mais aliados no anel, +1 pulso e +1 tile de raio. */
  circulo: boolean;
}

export interface ThayssaState {
  readonly type: 'thayssa';
  mode: AuraMode;
  /** Segundos restantes de transição entre modos (sem pulsos e sem buffs). */
  transitionLeft: number;
  /** Segundos até o próximo pulso de dano da Euforia. */
  pulseCd: number;
  /** Segundos até o próximo pulso de repulsão da Sobrecarga. */
  pulseS: number;
  /** Segundos restantes em que as duas auras funcionam juntas. */
  resonanceLeft: number;
  resonanceCd: number;
  /** Trocas seguidas de modo (Dança dos Dois Modos). */
  switchCount: number;
  /** Segundos desde a última troca. */
  sinceSwitch: number;
  palmasCd: number;
  /** Segundos ate o proximo grito do Megafone. */
  megaCd: number;
  ultimoCd: number;
  prevAction: boolean;
  /** Slots dos aliados que estavam no anel no passo anterior (Mão Estendida). */
  inside: number[];
  /** O Círculo Completo está ativo neste passo (3 ou mais aliados no anel). */
  circuloAtivo: boolean;
  mods: ThayssaMods;
}

export function createThayssaState(): ThayssaState {
  return {
    type: 'thayssa',
    mode: 'euforia',
    transitionLeft: 0,
    pulseCd: 0,
    pulseS: 0,
    resonanceLeft: 0,
    resonanceCd: 0,
    switchCount: 0,
    sinceSwitch: 999,
    palmasCd: 0,
    megaCd: 0,
    ultimoCd: 0,
    prevAction: false,
    inside: [],
    circuloAtivo: false,
    mods: {
      maoEstendida: false,
      abracoGrupo: false,
      escudoAfeto: false,
      espelho: false,
      circulo: false,
      drop: false,
      ressonancia: false,
      abraco: false,
      risadaCadeia: false,
      metronomo: false,
      peNoChao: false,
      sincronia: false,
      entrega: false,
      ultimo: false,
      danca: false,
      gargalhada: false,
      palmas: false,
      coracao: false,
      apertado: false,
      lagrima: false,
      playlist: false,
    },
  };
}

/** Raio atual da aura em pixels. */
export function raioDaAura(s: ThayssaState): number {
  return AURA_RADIUS * (s.mods.abraco ? ABRACO_RADIUS_MUL : 1) * (s.mods.apertado ? 1.2 : 1) + (s.circuloAtivo ? CIRCULO_RADIUS_BONUS : 0);
}

/** Multiplicador dos buffs da aura (Raio do Abraço Coletivo dá +20%). */
export function multiplicadorDeBuff(s: ThayssaState): number {
  return s.mods.abraco ? ABRACO_BUFF_MUL : 1;
}

export function duracaoDaTransicao(s: ThayssaState): number {
  return s.mods.metronomo ? METRONOMO_TRANSICAO_S : TRANSICAO_S;
}

/** O efeito do modo está ativo? Com a Ressonância Dupla, os dois ficam ativos juntos. */
export function modoAtivo(s: ThayssaState, mode: AuraMode): boolean {
  if (s.transitionLeft > 0) return false;
  return s.resonanceLeft > 0 || s.mode === mode;
}
