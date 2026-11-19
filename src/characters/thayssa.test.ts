import { describe, expect, it } from 'vitest';
import { spawnFood } from '../combat/foods';
import { damagePlayer } from '../combat/playerStats';
import { pushChoice } from '../combat/leveling';
import { spawnEnemy } from '../combat/spawner';
import { THAYSSA_CARDS } from '../combat/thayssaCards';
import { COMUNS } from '../data/enemies';
import { BRILHO } from '../data/foods';
import {
  AURA_RADIUS,
  DANCA_DAMAGE,
  EUFORIA_PULSE_EVERY_S,
  RESSONANCIA_COOLDOWN_S,
  TRANSICAO_S,
} from '../data/thayssa';
import { NO_INPUT, type PlayerInput } from '../engine/input';
import { createWorld, stepWorld, type World } from '../engine/world';
import { reduceCooldowns } from './kitHooks';
import { onEnemyKilled } from '../combat/thayssaAura';
import { duracaoDaTransicao, modoAtivo, multiplicadorDeBuff, raioDaAura, type ThayssaState } from './thayssaState';
import type { FelipeState } from './felipeState';
import type { MelissaState } from './melissaState';

const ROBO = COMUNS[0]!;
const TROCAR: PlayerInput = { ...NO_INPUT, action: true };

function setup(seed = 1, extra: ('felipe' | 'melissa')[] = []): { w: World; s: ThayssaState } {
  const w = createWorld(['thayssa', ...extra], { initialChoice: false, seed, noSpawn: true });
  const s = w.players[0]!.kit as ThayssaState;
  s.megaCd = 1e9; // o Megafone só entra nos testes dele
  return { w, s };
}

function step(w: World, n = 1, input: PlayerInput = NO_INPUT): void {
  for (let i = 0; i < n; i++) {
    stepWorld(w, w.players.map((_, slot) => (slot === 0 ? input : NO_INPUT)));
    w.choices.length = 0;
  }
}

/** Alterna o modo: toque (segura 1 passo e solta 1 passo). */
function trocar(w: World): void {
  step(w, 1, TROCAR);
  step(w, 1, NO_INPUT);
}

function card(id: string): (typeof THAYSSA_CARDS)[number] {
  return THAYSSA_CARDS.find((c) => c.id === id)!;
}

function parado(w: World, x: number, y: number): ReturnType<typeof w.enemies.active.at> & object {
  spawnEnemy(w, ROBO, x, y);
  const e = w.enemies.active[w.enemies.active.length - 1]!;
  e.stun = 999;
  e.hp = 1000;
  return e;
}

describe('Thayssa: aura e modos', () => {
  it('começa na Euforia, com 110 de HP e raio de 3 tiles (48 px)', () => {
    const { w, s } = setup();
    expect(s.mode).toBe('euforia');
    expect(w.players[0]!.maxHp).toBe(110);
    expect(raioDaAura(s)).toBe(AURA_RADIUS);
    expect(AURA_RADIUS).toBe(48);
  });

  it('a tecla de ação alterna o modo e a transição leva 0,4 s', () => {
    const { w, s } = setup();
    step(w, 1, TROCAR);
    expect(s.mode).toBe('sobrecarga');
    expect(s.transitionLeft).toBeGreaterThan(TRANSICAO_S - 0.05);
    expect(modoAtivo(s, 'sobrecarga')).toBe(false); // em transição, sem efeitos
    step(w, 30);
    expect(s.transitionLeft).toBe(0);
    expect(modoAtivo(s, 'sobrecarga')).toBe(true);
  });

  it('durante a transição não dá para trocar de novo, nem há pulsos', () => {
    const { w, s } = setup();
    const e = parado(w, 20, 0);
    trocar(w);
    const hp = e.hp;
    expect(s.mode).toBe('sobrecarga');
    step(w, 1, TROCAR); // ainda em transição
    step(w, 1, NO_INPUT);
    expect(s.mode).toBe('sobrecarga');
    expect(e.hp).toBe(hp);
  });

  it('Euforia: +20% de velocidade de movimento e de ataque para quem está no anel', () => {
    const { w } = setup(1, ['felipe']);
    const felipe = w.players[1]!;
    felipe.x = 30;
    felipe.y = 0;
    step(w);
    expect(felipe.auraSpeedMul).toBeCloseTo(1.2, 10);
    expect(felipe.auraAttackMul).toBeCloseTo(1.2, 10);
    expect(w.players[0]!.auraSpeedMul).toBeCloseTo(1.2, 10); // a própria Thayssa também
  });

  it('quem está fora do anel não recebe o buff', () => {
    const { w } = setup(1, ['felipe']);
    w.players[1]!.x = AURA_RADIUS + 40;
    step(w);
    expect(w.players[1]!.auraSpeedMul).toBe(1);
  });

  it('o buff de movimento vira velocidade de verdade', () => {
    // Dentro do anel tem bônus; fora não tem. Compara os primeiros passos (antes de sair do anel).
    const w1 = setup(1, ['felipe']);
    const w2 = setup(1, ['felipe']);
    w2.w.players[1]!.x = 300;
    w1.w.players[1]!.x = 10;
    for (let i = 0; i < 5; i++) {
      stepWorld(w1.w, [NO_INPUT, { ...NO_INPUT, moveX: 1 }]);
      stepWorld(w2.w, [NO_INPUT, { ...NO_INPUT, moveX: 1 }]);
      w1.w.choices.length = 0;
      w2.w.choices.length = 0;
    }
    expect(w1.w.players[1]!.x - 10).toBeGreaterThan((w2.w.players[1]!.x - 300) * 1.1);
  });

  it('Euforia: pulso de dano a cada 0,5 s', () => {
    const { w } = setup();
    const e = parado(w, 20, 0);
    step(w, 1); // primeiro pulso
    const hp1 = e.hp;
    expect(hp1).toBeLessThan(1000);
    step(w, Math.round(EUFORIA_PULSE_EVERY_S * 60) - 3);
    expect(e.hp).toBe(hp1);
    step(w, 6);
    expect(e.hp).toBeLessThan(hp1);
  });

  it('Sobrecarga: -25% de dano recebido e +1 HP/s para quem está no anel', () => {
    const { w } = setup(1, ['felipe']);
    const felipe = w.players[1]!;
    felipe.x = 20;
    trocar(w);
    step(w, 30);
    expect(felipe.damageTakenMul).toBeCloseTo(0.75, 10);
    felipe.hp = 50;
    damagePlayer(felipe, 20);
    expect(felipe.hp).toBeCloseTo(35, 5);
    const hp0 = felipe.hp;
    step(w, 60);
    expect(felipe.hp - hp0).toBeCloseTo(1, 1);
  });

  it('Sobrecarga: pulso de repulsão empurra os inimigos para longe', () => {
    const { w } = setup();
    const e = parado(w, 30, 0);
    trocar(w);
    step(w, 60);
    expect(e.x).toBeGreaterThan(40);
  });

  it('fora do anel os inimigos não são empurrados', () => {
    const { w } = setup();
    const e = parado(w, AURA_RADIUS + 60, 0);
    trocar(w);
    step(w, 90);
    expect(e.x).toBeCloseTo(AURA_RADIUS + 60, 5);
  });
});

describe('Thayssa: Risada Contagiante', () => {
  it('abates dentro da aura reduzem em 0,5 s a recarga dos aliados na aura', () => {
    const { w } = setup(1, ['melissa']);
    const melissa = w.players[1]!;
    melissa.x = 20;
    const s = melissa.kit as MelissaState;
    s.reacaoCd = 10;
    const e = parado(w, 25, 0);
    onEnemyKilled(w, e);
    expect(s.reacaoCd).toBeCloseTo(9.5, 5);
  });

  it('abates fora da aura não reduzem recargas', () => {
    const { w } = setup(1, ['melissa']);
    const s = w.players[1]!.kit as MelissaState;
    s.reacaoCd = 10;
    const e = parado(w, 400, 400);
    onEnemyKilled(w, e);
    expect(s.reacaoCd).toBe(10);
  });

  it('cerca de 10% dos abates na aura soltam um brilho (cura ou gema)', () => {
    let drops = 0;
    const total = 2000;
    const { w } = setup(7);
    for (let i = 0; i < total; i++) {
      const e = parado(w, 20, 0);
      const before = w.foods.size + w.gems.size;
      onEnemyKilled(w, e);
      drops += w.foods.size + w.gems.size - before;
      w.foods.clear();
      w.gems.clear();
      w.enemies.release(e);
    }
    expect(drops / total).toBeGreaterThan(0.07);
    expect(drops / total).toBeLessThan(0.13);
  });

  it('o brilho de cura recupera HP de quem o come', () => {
    const { w } = setup(1, ['felipe']);
    const f = w.players[1]!;
    f.x = 200;
    f.y = 0;
    f.hp = 50;
    spawnFood(w, BRILHO, f.x, f.y);
    step(w);
    expect(f.hp).toBe(56);
  });

  it('reduceCooldowns funciona nos kits dos outros personagens', () => {
    const w = createWorld(['felipe'], { initialChoice: false, noSpawn: true });
    const s = w.players[0]!.kit as FelipeState;
    s.cd = 1;
    reduceCooldowns(w.players[0]!, 0.5);
    expect(s.cd).toBeCloseTo(0.5, 10);
    reduceCooldowns(w.players[0]!, 5);
    expect(s.cd).toBe(0);
  });
});

describe('Thayssa: cartas exclusivas', () => {
  it('são 16 com ids únicos', () => {
    expect(THAYSSA_CARDS).toHaveLength(16);
    expect(new Set(THAYSSA_CARDS.map((c) => c.id)).size).toBe(16);
  });

  it('Drop na Troca: alternar de modo libera uma explosão em área', () => {
    const { w } = setup();
    card('thayssa-drop').apply(w.players[0]!);
    const e = parado(w, 55, 0); // dentro do raio de 64 do drop, fora do anel
    const hp = e.hp;
    step(w, 1, TROCAR);
    expect(e.hp).toBeLessThan(hp);
  });

  it('Raio do Abraço Coletivo: raio +50% e buffs +20%', () => {
    const { w, s } = setup(1, ['felipe']);
    card('thayssa-abraco').apply(w.players[0]!);
    expect(raioDaAura(s)).toBe(AURA_RADIUS * 1.5);
    expect(multiplicadorDeBuff(s)).toBe(1.2);
    const f = w.players[1]!;
    f.x = 60; // fora do raio base, dentro do ampliado (72)
    step(w);
    expect(f.auraSpeedMul).toBeCloseTo(1 + 0.2 * 1.2, 10);
  });

  it('Metrônomo do Coração: a transição cai para 0,2 s', () => {
    const { w, s } = setup();
    card('thayssa-metronomo').apply(w.players[0]!);
    expect(duracaoDaTransicao(s)).toBe(0.2);
    step(w, 1, TROCAR);
    expect(s.transitionLeft).toBeLessThanOrEqual(0.2);
  });

  it('Aura de Pé no Chão: a Euforia dá +0,5 de regeneração por segundo', () => {
    const { w } = setup();
    card('thayssa-pe-no-chao').apply(w.players[0]!);
    const p = w.players[0]!;
    p.hp = 50;
    step(w, 60);
    expect(p.hp - 50).toBeCloseTo(0.5, 1);
  });

  it('Sincronia Oceânica: trocar de aura cura aliados a 5 tiles', () => {
    const { w } = setup(1, ['felipe']);
    card('thayssa-sincronia').apply(w.players[0]!);
    const f = w.players[1]!;
    f.x = 70; // fora do anel (48), dentro de 5 tiles (80)
    f.hp = 40;
    step(w, 1, TROCAR);
    expect(f.hp).toBe(50);
  });

  it('Entrega Calorosa: aliados na aura recebem 50% do XP dos inimigos mortos na aura', () => {
    const { w } = setup(1, ['felipe']);
    card('thayssa-entrega').apply(w.players[0]!);
    const f = w.players[1]!;
    f.x = 20;
    const e = parado(w, 25, 0);
    const xp0 = f.xp;
    onEnemyKilled(w, e);
    expect(f.xp - xp0).toBeCloseTo(e.def.xp * 0.5, 5);
  });

  it('Gargalhada Perdida: abates na aura às vezes dão XP extra', () => {
    const { w } = setup(3);
    card('thayssa-gargalhada').apply(w.players[0]!);
    let extra = 0;
    for (let i = 0; i < 400; i++) {
      const e = parado(w, 20, 0);
      onEnemyKilled(w, e);
      extra += w.gems.active.filter((g) => g.xp === 2).length;
      w.gems.clear();
      w.foods.clear();
      w.enemies.release(e);
    }
    expect(extra / 400).toBeGreaterThan(0.08);
    expect(extra / 400).toBeLessThan(0.23);
  });

  it('Último Abraço: abaixo de 10% de HP, aliados na aura ficam invulneráveis por 2 s', () => {
    const { w } = setup(1, ['felipe']);
    card('thayssa-ultimo').apply(w.players[0]!);
    const f = w.players[1]!;
    f.x = 20;
    w.players[0]!.hp = 5;
    step(w);
    expect(f.invuln).toBeGreaterThan(1.8);
    expect(w.players[0]!.invuln).toBeGreaterThan(1.8);
  });

  it('Último Abraço: não dispara com HP acima de 10%', () => {
    const { w } = setup();
    card('thayssa-ultimo').apply(w.players[0]!);
    w.players[0]!.hp = 60;
    step(w);
    expect(w.players[0]!.invuln).toBe(0);
  });

  it('Dança dos Dois Modos: cinco trocas seguidas criam uma explosão', () => {
    const { w } = setup();
    card('thayssa-danca').apply(w.players[0]!);
    const e = parado(w, 60, 0);
    const hp = e.hp;
    for (let i = 0; i < 4; i++) {
      trocar(w);
      step(w, 30);
    }
    expect(e.hp).toBeGreaterThanOrEqual(hp - 40); // sem explosão ainda (só pulsos leves dentro do anel)
    const before = e.hp;
    trocar(w);
    expect(before - e.hp).toBeGreaterThanOrEqual(DANCA_DAMAGE - 0.01);
  });

  it('Dança dos Dois Modos: uma pausa longa zera a contagem', () => {
    const { w, s } = setup();
    card('thayssa-danca').apply(w.players[0]!);
    for (let i = 0; i < 3; i++) {
      trocar(w);
      step(w, 30);
    }
    expect(s.switchCount).toBe(3);
    step(w, 60 * 8);
    trocar(w);
    expect(s.switchCount).toBe(1);
  });

  it('Pulso de Palmas: a cada 10 s, onda de empurrão ao redor da aura', () => {
    const { w } = setup();
    card('thayssa-palmas').apply(w.players[0]!);
    const e = parado(w, 60, 0); // entre o anel (48) e 1,5x (72)
    step(w, 3);
    expect(e.x).toBeGreaterThan(61);
    const { w: w2 } = setup();
    const e2 = parado(w2, 60, 0);
    step(w2, 3);
    expect(e2.x).toBe(60); // sem a carta, nada
  });

  it('Ressonância Dupla: as duas auras juntas por 4 s e recarrega depois', () => {
    const { w, s } = setup(1, ['felipe']);
    card('thayssa-ressonancia').apply(w.players[0]!);
    const f = w.players[1]!;
    f.x = 20;
    step(w);
    expect(s.resonanceLeft).toBeGreaterThan(3.8);
    expect(f.auraSpeedMul).toBeGreaterThan(1.19);
    expect(f.damageTakenMul).toBeLessThan(0.76);
    step(w, 60 * 4 + 10);
    expect(s.resonanceLeft).toBe(0);
    expect(modoAtivo(s, 'sobrecarga')).toBe(false);
    expect(s.resonanceCd).toBeGreaterThan(RESSONANCIA_COOLDOWN_S - 6);
    step(w, 60 * 26);
    expect(s.resonanceLeft).toBeGreaterThan(0); // ativou de novo
  });

  it('toda escolha tem pelo menos 1 exclusiva da Thayssa', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const { w } = setup(seed);
      pushChoice(w, w.players[0]!);
      expect(w.choices[0]!.cards.some((c) => c.character === 'thayssa')).toBe(true);
    }
  });
});
