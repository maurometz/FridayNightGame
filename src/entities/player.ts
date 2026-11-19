import { createFelipeState, type FelipeState } from '../characters/felipeState';
import { createMauroState, type MauroState } from '../characters/mauroState';
import { createMelissaState, type MelissaState } from '../characters/melissaState';
import { createThaisaState, type ThaisaState } from '../characters/thaisaState';
import { createThayssaState, type ThayssaState } from '../characters/thayssaState';
import type { FoodBuffKind } from '../data/foods';
import { BASE_PICKUP_RADIUS } from '../data/balance';
import { XP_BONUS_BASE } from '../data/mauro';
import { CHARACTERS, type CharacterId } from '../data/characters';
import type { WeaponId } from '../data/weapons';
import type { ExtraWeapon } from '../combat/sharedWeaponTypes';
import { VEHICLE_FIRST_S, type MountedVehicle } from '../data/vehicles';
import { createPerks, type Perks } from './perks';

/** Buff temporário de um aliado. Todos os campos são multiplicadores (ou soma, no crítico). */
export interface Buff {
  /** Mesmo id renova em vez de acumular. */
  id: string;
  left: number;
  damage?: number;
  attack?: number;
  speed?: number;
  /** Soma à chance de crítico (0,05 = +5%). */
  crit?: number;
  /** Redução de dano recebido (0,15 = -15%). */
  reduction?: number;
}

export interface Player {
  readonly slot: number;
  readonly characterId: CharacterId;
  x: number;
  y: number;
  /** Posição no passo anterior, para interpolar na renderização. */
  prevX: number;
  prevY: number;
  /** Direção da frente: -1 esquerda, 1 direita. */
  facing: -1 | 1;
  moving: boolean;
  hp: number;
  maxHp: number;
  /** Multiplicador de velocidade (cartas e buffs alteram este valor). */
  speedMul: number;

  // ---- Progressão ----
  xp: number;
  level: number;
  /** Moeda de meta-progressão: XP que sobra depois do nível máximo. */
  salgadinhos: number;
  kills: number;

  // ---- Combate ----
  weaponId: WeaponId;
  weaponCd: number;
  /** Dano efetivo neste passo: `baseDamageMul` vezes os buffs de aliados. Recalculado a cada passo. */
  damageMul: number;
  /** Multiplicador de dano permanente (cartas e passivas). */
  baseDamageMul: number;
  /** Redução permanente de dano recebido, de 0 a 0,8 (Almofada do Sofá). */
  damageReduction: number;
  /** Regeneração permanente de HP por segundo. */
  regenPerS: number;
  /** Buffs temporários de aliados (cartas de equipe). */
  buffs: Buff[];
  /** Armas do pool compartilhado (e emprestadas por aliados). */
  extraWeapons: ExtraWeapon[];
  /** Movimento imposto (avanço conjunto da Entrada Sincronizada). */
  forcedMove: { vx: number; vy: number; left: number } | null;
  attackSpeedMul: number;
  extraProjectiles: number;
  /** Multiplicador do raio de coleta de gemas. */
  pickupMul: number;
  /** Segundos de invulnerabilidade restantes após um dano. */
  invuln: number;
  /** Multiplicador temporário de velocidade (anomalias, buffs). Volta a 1 quando acaba. */
  buffSpeedMul: number;
  /** Multiplicador de velocidade definido pelo kit a cada passo (explosão da Melissa etc.). */
  kitSpeedMul: number;
  /** Chance de crítico (x2) permanente, de 0 a 1. */
  critChance: number;
  /** Multiplicadores aplicados por auras de aliados neste passo (Thayssa). Recalculados a cada passo. */
  auraSpeedMul: number;
  auraAttackMul: number;
  /** Multiplicador do dano recebido (1 = normal, 0,75 = -25%). Recalculado a cada passo. */
  damageTakenMul: number;
  /** Chance de crítico concedida por auras de aliados neste passo. Zerada a cada passo. */
  auraCrit: number;

  // ---- Cartas e kit ----
  /** ids das cartas já escolhidas. */
  cardsTaken: string[];
  /** Nível de cada carta escolhida (1 a 3). Cartas repetidas sobem de nível. */
  cardLevels: Record<string, number>;
  /** Rerolls e banimentos que ainda restam (2 de cada por partida). */
  rerolls: number;
  bans: number;
  /** Cartas banidas: não aparecem mais nesta partida. */
  banned: string[];
  /** Estado do kit próprio do personagem. null se o kit ainda não foi implementado. */
  kit: FelipeState | MauroState | MelissaState | ThaisaState | ThayssaState | null;
  /** Escudo: absorve dano antes do HP. */
  shield: number;
  /** Buff temporário de comida (Cardápio do Dia). */
  foodBuff: { kind: FoodBuffKind; left: number } | null;
  /** Multiplicador de XP ganho (Memória Fotográfica do Mauro etc.). */
  xpMul: number;
  /** Segundos de lentidão (-50% de velocidade): multas do Síndico, poças do Golem. */
  slowLeft: number;
  /** Segundos de confusão: o movimento fica invertido (conselho ruim do Lucas). */
  confusedLeft: number;
  /** A tecla de Ultimate estava apertada no passo anterior (para detectar o toque). */
  ultPrev: boolean;
  /** Poderes gerais das cartas (roubo de vida, desvio, espinhos...). */
  perks: Perks;
  /** Segundos de TDAH que restam (debuff: distrações curtas, mas ataca mais rápido quando focado). */
  tdahLeft: number;
  /** Segundos que faltam para a distração acabar, e para a próxima. */
  distractedLeft: number;
  tdahNext: number;
  /** Direção em que o jogador anda durante a distração. */
  tdahDx: number;
  tdahDy: number;
  /** Veículo que está montando (temporário) e quanto falta para o próximo aparecer no chão. */
  vehicle: MountedVehicle | null;
  vehicleNextIn: number;
  /** Segundos de reviver acumulados enquanto está caído (ver combat/revive.ts). */
  reviveProgress: number;
}

/**
 * Arma inicial de cada personagem. Provisório: só o Violão existe na Fase 1,
 * então os demais usam o mesmo até os kits da Fase 2.
 */
const STARTING_WEAPON: Record<CharacterId, WeaponId> = {
  felipe: 'violao',
  mauro: 'violao',
  melissa: 'violao',
  thaisa: 'violao',
  thayssa: 'violao',
};

function createKit(id: CharacterId): FelipeState | MauroState | MelissaState | ThaisaState | ThayssaState | null {
  if (id === 'thayssa') return createThayssaState();
  if (id === 'felipe') return createFelipeState();
  if (id === 'mauro') return createMauroState();
  if (id === 'melissa') return createMelissaState();
  if (id === 'thaisa') return createThaisaState();
  return null;
}

export function createPlayer(slot: number, characterId: CharacterId, x: number, y: number): Player {
  const stats = CHARACTERS[characterId];
  return {
    slot,
    characterId,
    x,
    y,
    prevX: x,
    prevY: y,
    facing: 1,
    moving: false,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    speedMul: stats.speed,
    xp: 0,
    level: 1,
    salgadinhos: 0,
    kills: 0,
    weaponId: STARTING_WEAPON[characterId],
    weaponCd: 0,
    damageMul: 1,
    baseDamageMul: 1,
    damageReduction: 0,
    regenPerS: 0,
    buffs: [],
    extraWeapons: [],
    forcedMove: null,
    attackSpeedMul: 1,
    extraProjectiles: 0,
    pickupMul: 1,
    invuln: 0,
    buffSpeedMul: 1,
    kitSpeedMul: 1,
    critChance: 0,
    auraSpeedMul: 1,
    auraAttackMul: 1,
    damageTakenMul: 1,
    auraCrit: 0,
    cardsTaken: [],
    cardLevels: {},
    rerolls: 2,
    bans: 2,
    banned: [],
    kit: createKit(characterId),
    shield: 0,
    foodBuff: null,
    // Mauro, Memória Fotográfica: +15% de XP.
    xpMul: characterId === 'mauro' ? 1 + XP_BONUS_BASE : 1,
    slowLeft: 0,
    confusedLeft: 0,
    ultPrev: false,
    perks: createPerks(),
    tdahLeft: 0,
    distractedLeft: 0,
    tdahNext: 0,
    tdahDx: 0,
    tdahDy: 0,
    vehicle: null,
    vehicleNextIn: VEHICLE_FIRST_S + slot * 6,
    reviveProgress: 0,
  };
}

/** Velocidade de ataque efetiva: permanente (cartas) vezes o bônus de aura (Thayssa). */
export function attackSpeed(p: Player): number {
  return p.attackSpeedMul * p.auraAttackMul;
}

export function pickupRadius(p: Player): number {
  return BASE_PICKUP_RADIUS * p.pickupMul;
}
