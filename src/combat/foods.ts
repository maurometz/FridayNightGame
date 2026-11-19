import { STEP_S } from '../data/balance';
import {
  FOOD_BUFFS,
  FOOD_BUFF_DAMAGE_MUL,
  FOOD_BUFF_REGEN_PER_S,
  FOOD_BUFF_SPEED_MUL,
  FOODS,
  type FoodBuffKind,
  type FoodDef,
} from '../data/foods';
import {
  BUFE_SHIELD,
  CARDAPIO_BUFF_S,
  FOOD_DROP_BASE,
  FOOD_DROP_THAISA_MUL,
  FOOD_LIFETIME_S,
  FOOD_PICKUP_RADIUS,
  SOPA_MUL,
} from '../data/thaisa';
import type { Player } from '../entities/player';
import type { World } from '../engine/world';
import { reduceCooldowns } from '../characters/kitHooks';
import { PODE_PASSAR_RADIUS } from '../data/team';
import { aliadosPerto } from './teamEffects';
import { RISADA_COOLDOWN_CUT_S } from '../data/thayssa';
import { addShield, healPlayer } from './playerStats';
import { darPico } from '../characters/thaisaState';
import { distrairMatilha } from './salsichas';

/** A Thaisa (viva) está na partida? Então as comidas aparecem com o dobro de frequência. */
function thaisaPresente(world: World): boolean {
  return world.players.some((p) => p.hp > 0 && p.kit?.type === 'thaisa');
}

export function foodDropChance(world: World): number {
  return FOOD_DROP_BASE * (thaisaPresente(world) ? FOOD_DROP_THAISA_MUL : 1);
}

function pickFood(world: World): FoodDef {
  let total = 0;
  for (const f of FOODS) total += f.weight;
  let r = world.rng.next() * total;
  for (const f of FOODS) {
    r -= f.weight;
    if (r < 0) return f;
  }
  return FOODS[0]!;
}

export function spawnFood(world: World, def: FoodDef, x: number, y: number): boolean {
  const f = world.foods.acquire();
  if (!f) return false;
  f.def = def;
  f.x = x;
  f.y = y;
  f.life = FOOD_LIFETIME_S;
  f.alive = true;
  return true;
}

/** Ao morrer, um inimigo pode soltar uma comida. */
export function maybeDropFood(world: World, x: number, y: number): void {
  if (world.rng.next() >= foodDropChance(world)) return;
  spawnFood(world, pickFood(world), x, y);
}

function aplicarBuff(p: Player, kind: FoodBuffKind): void {
  removerBuff(p);
  p.foodBuff = { kind, left: CARDAPIO_BUFF_S };
  if (kind === 'velocidade') p.speedMul *= FOOD_BUFF_SPEED_MUL;
  else if (kind === 'dano') p.baseDamageMul *= FOOD_BUFF_DAMAGE_MUL;
}

function removerBuff(p: Player): void {
  const b = p.foodBuff;
  if (!b) return;
  if (b.kind === 'velocidade') p.speedMul /= FOOD_BUFF_SPEED_MUL;
  else if (b.kind === 'dano') p.baseDamageMul /= FOOD_BUFF_DAMAGE_MUL;
  p.foodBuff = null;
}

/** Alguma Thaisa viva com Cardápio do Dia? As comidas então dão um buff extra a quem comer. */
function cardapioAtivo(world: World): boolean {
  return world.players.some((p) => p.hp > 0 && p.kit?.type === 'thaisa' && p.kit.mods.cardapio);
}

/** Um jogador come uma comida: cura, Pico de Glicose (só a Thaisa) e extras das cartas. */
export function comer(world: World, p: Player, def: FoodDef): void {
  const k = p.kit;
  const isThaisa = k?.type === 'thaisa';
  const heal = def.heal * (isThaisa && k.mods.sopa ? SOPA_MUL : 1);
  healPlayer(p, heal);
  if (isThaisa) {
    darPico(k, def.stacks + (k.mods.segunda ? 1 : 0));
    // Bufê Livre: toda comida de cura também ativa um escudo.
    if (k.mods.bufe && def.heal > 0) addShield(p, BUFE_SHIELD);
    // Pode Passar: a comida também cura o aliado mais ferido a até 4 tiles.
    if (k.mods.podePassar) {
      const ferido = aliadosPerto(world, p, PODE_PASSAR_RADIUS)
        .filter((a) => a.hp < a.maxHp)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (ferido) healPlayer(ferido, heal);
    }
  }
  // Risada em Cadeia (Thayssa): brilhos de cura reduzem a recarga de 2 aliados.
  if (def.id === 'brilho' && world.players.some((t) => t.hp > 0 && t.kit?.type === 'thayssa' && t.kit.mods.risadaCadeia)) {
    const aliados = world.players
      .filter((a) => a !== p && a.hp > 0)
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))
      .slice(0, 2);
    for (const a of aliados) reduceCooldowns(a, RISADA_COOLDOWN_CUT_S);
  }
  if (cardapioAtivo(world)) {
    const buff = FOOD_BUFFS[world.rng.int(0, FOOD_BUFFS.length - 1)]!;
    aplicarBuff(p, buff.id);
  }
}

/** Comidas no chão: expiram e são comidas por quem encostar. Também gerencia os buffs de comida. */
export function updateFoods(world: World): void {
  const list = world.foods.active;
  for (const f of list) {
    f.life -= STEP_S;
    if (f.life <= 0) {
      f.alive = false;
      continue;
    }
    for (const p of world.players) {
      if (p.hp <= 0) continue;
      const dx = p.x - f.x;
      const dy = p.y - f.y;
      if (dx * dx + dy * dy <= FOOD_PICKUP_RADIUS * FOOD_PICKUP_RADIUS) {
        comer(world, p, f.def);
        f.alive = false;
        distrairMatilha(world, f.x, f.y); // luta das Salsichas: quem come perto distrai os cachorros
        break;
      }
    }
  }
  for (let i = list.length - 1; i >= 0; i--) {
    const f = list[i]!;
    if (!f.alive) world.foods.release(f);
  }

  for (const p of world.players) {
    const b = p.foodBuff;
    if (!b) continue;
    b.left -= STEP_S;
    if (b.kind === 'regeneracao' && p.hp > 0) healPlayer(p, FOOD_BUFF_REGEN_PER_S * STEP_S);
    if (b.left <= 0) removerBuff(p);
  }
}
