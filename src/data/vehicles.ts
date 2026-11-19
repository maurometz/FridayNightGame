// Veículos temporários (um por personagem). Aparecem no chão perto do dono de tempos em tempos;
// quem encosta monta, ganha velocidade, um buff rápido e atropela os inimigos. Valores iniciais, ajustáveis nos playtests.

import type { CharacterId } from './characters';

export type VehicleId = 'cavalo' | 'carroca' | 'c3' | 'skate' | 'armadura';

export interface VehicleBuff {
  /** Multiplicador de dano. */
  damage?: number;
  /** Multiplicador de velocidade de ataque. */
  attack?: number;
  /** Soma à chance de crítico. */
  crit?: number;
  /** Redução de dano recebido (0,3 = -30%). */
  reduction?: number;
}

export interface VehicleDef {
  readonly id: VehicleId;
  readonly name: string;
  readonly character: CharacterId;
  /** Quanto tempo dura a montaria. */
  readonly durationS: number;
  /** Multiplicador de velocidade enquanto monta. */
  readonly speedMul: number;
  /** Dano e empurrão do atropelamento (o dano ainda é multiplicado pelo dano do jogador). */
  readonly hit: number;
  readonly knock: number;
  readonly hitRadius: number;
  readonly buff: VehicleBuff;
  /** Texto curto do que o veículo faz. */
  readonly blurb: string;
}

export const VEHICLES: Readonly<Record<VehicleId, VehicleDef>> = {
  cavalo: {
    id: 'cavalo',
    name: 'Cavalo Crioulo',
    character: 'thayssa',
    durationS: 12,
    speedMul: 1.8,
    hit: 14,
    knock: 240,
    hitRadius: 14,
    buff: { damage: 1.25 },
    blurb: 'Galopa por cima de todo mundo e dá +25% de dano.',
  },
  carroca: {
    id: 'carroca',
    name: 'Carroça da Madrugada',
    character: 'thaisa',
    durationS: 14,
    speedMul: 1.45,
    hit: 8,
    knock: 160,
    hitRadius: 16,
    buff: { reduction: 0.3 },
    blurb: 'Leva -30% de dano e cura quem estiver perto (2 HP/s).',
  },
  c3: {
    id: 'c3',
    name: 'Citroën C3 Vermelho',
    character: 'melissa',
    durationS: 10,
    speedMul: 2.1,
    hit: 18,
    knock: 260,
    hitRadius: 15,
    buff: { crit: 0.3 },
    blurb: 'O mais rápido de todos e +30% de chance de crítico.',
  },
  skate: {
    id: 'skate',
    name: 'Skate',
    character: 'felipe',
    durationS: 12,
    speedMul: 1.7,
    hit: 6,
    knock: 120,
    hitRadius: 12,
    buff: { attack: 1.35 },
    blurb: 'Deslizando, ataca 35% mais rápido.',
  },
  armadura: {
    id: 'armadura',
    name: 'Armadura Mark III',
    character: 'mauro',
    durationS: 14,
    speedMul: 1.35,
    hit: 12,
    knock: 200,
    hitRadius: 13,
    buff: { damage: 1.3, reduction: 0.4 },
    blurb: '+30% de dano, -40% de dano recebido e Foco sempre cheio.',
  },
};

/** Qual veículo é de quem. */
export const VEHICLE_OF: Readonly<Record<CharacterId, VehicleId>> = {
  thayssa: 'cavalo',
  thaisa: 'carroca',
  melissa: 'c3',
  felipe: 'skate',
  mauro: 'armadura',
};

/** Primeiro veículo de cada jogador (segundos de partida) e intervalo entre os seguintes. */
export const VEHICLE_FIRST_S = 40;
export const VEHICLE_EVERY_S = 75;
/** Quanto tempo o veículo espera no chão e a que distância o dono precisa chegar para montar. */
export const VEHICLE_PICKUP_LIFE_S = 25;
export const VEHICLE_PICKUP_RADIUS = 14;
/** Atropela a cada 0,25 s enquanto se move. */
export const VEHICLE_HIT_EVERY_S = 0.25;
/** A carroça cura aliados a até este raio. */
export const CARROCA_HEAL_RADIUS = 70;
export const CARROCA_HEAL_PER_S = 2;

/** Veículo no chão esperando o dono (só ele monta). */
export interface VehiclePickup {
  slot: number;
  id: VehicleId;
  x: number;
  y: number;
  /** Segundos restantes no chão. */
  left: number;
}

/** Veículo que o jogador está montando agora. */
export interface MountedVehicle {
  id: VehicleId;
  left: number;
  hitCd: number;
}
