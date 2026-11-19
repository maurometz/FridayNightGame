import { describe, expect, it } from 'vitest';
import { MELISSA_CARDS } from '../combat/melissaCards';
import { pushChoice } from '../combat/leveling';
import { spawnEnemy } from '../combat/spawner';
import { STEP_S } from '../data/balance';
import { COMUNS } from '../data/enemies';
import {
  BURST_SPEED_MUL,
  FLORETE_DAMAGE,
  FLORETE_REACH,
  HOLOFOTE_DURATION_S,
  INVESTIDA_COOLDOWN_S,
  REACAO_COOLDOWN_S,
} from '../data/melissa';
import { NO_INPUT, type PlayerInput } from '../engine/input';
import { wrapAngle } from '../engine/math';
import { createWorld, stepWorld, type World } from '../engine/world';
import { onPlayerHit } from './kitHooks';
import { acertarInimigo, alcanceDoFlorete, inBackArc } from './melissa';
import type { MelissaState } from './melissaState';

const ROBO = COMUNS[0]!;
const PI = Math.PI;

function setup(seed = 1, characters: ('melissa' | 'felipe')[] = ['melissa']): { w: World; s: MelissaState } {
  const w = createWorld(characters, { initialChoice: false, seed });
  return { w, s: w.players[0]!.kit as MelissaState };
}

function step(w: World, n = 1, input: PlayerInput = NO_INPUT): void {
  for (let i = 0; i < n; i++) stepWorld(w, [input]);
}

function card(id: string): (typeof MELISSA_CARDS)[number] {
  return MELISSA_CARDS.find((c) => c.id === id)!;
}

/** Inimigo parado (atordoado por muito tempo) para testar posição relativa sem ele girar. */
function parado(w: World, x: number, y: number, facing: number): ReturnType<typeof firstEnemy> {
  spawnEnemy(w, ROBO, x, y);
  const e = w.enemies.active[w.enemies.active.length - 1]!;
  e.facing = facing;
  e.stun = 999;
  e.hp = 1000;
  return e;
}

function firstEnemy(w: World): NonNullable<World['enemies']['active'][number]> {
  return w.enemies.active[0]!;
}

describe('Melissa: arco de costas (90° opostos à frente)', () => {
  // Inimigo em (0,0) olhando para a direita (facing = 0). As costas ficam à esquerda.
  it('atacante diretamente atrás está nas costas', () => {
    expect(inBackArc(0, 0, 0, -20, 0)).toBe(true);
  });

  it('atacante na frente não está nas costas', () => {
    expect(inBackArc(0, 0, 0, 20, 0)).toBe(false);
  });

  it('atacante de lado (90°) não está nas costas', () => {
    expect(inBackArc(0, 0, 0, 0, 20)).toBe(false);
    expect(inBackArc(0, 0, 0, 0, -20)).toBe(false);
  });

  it('o arco tem 90° no total: ±45° em torno de trás', () => {
    const at = (deg: number): boolean => {
      // Ângulo medido a partir de "diretamente atrás" (π).
      const a = PI + (deg * PI) / 180;
      return inBackArc(0, 0, 0, Math.cos(a) * 20, Math.sin(a) * 20);
    };
    expect(at(0)).toBe(true);
    expect(at(44)).toBe(true);
    expect(at(-44)).toBe(true);
    expect(at(46)).toBe(false);
    expect(at(-46)).toBe(false);
    expect(at(90)).toBe(false);
    expect(at(180)).toBe(false);
  });

  it('funciona para qualquer direção de frente, inclusive perto da emenda em ±π', () => {
    for (const facing of [0, PI / 2, PI, -PI / 2, 3, -3, 6.1]) {
      const behind = facing + PI;
      expect(inBackArc(facing, 5, 5, 5 + Math.cos(behind) * 20, 5 + Math.sin(behind) * 20)).toBe(true);
      expect(inBackArc(facing, 5, 5, 5 + Math.cos(facing) * 20, 5 + Math.sin(facing) * 20)).toBe(false);
    }
  });

  it('a distância não importa, só o ângulo', () => {
    expect(inBackArc(0, 0, 0, -1, 0)).toBe(true);
    expect(inBackArc(0, 0, 0, -500, 0)).toBe(true);
  });

  it('wrapAngle normaliza para (-π, π]', () => {
    expect(wrapAngle(3 * PI)).toBeCloseTo(PI, 10);
    expect(wrapAngle(-3 * PI)).toBeCloseTo(PI, 10);
    expect(wrapAngle(0.5)).toBe(0.5);
    expect(wrapAngle(PI * 2 + 0.25)).toBeCloseTo(0.25, 10);
  });
});

describe('Melissa: Holofotes e crítico', () => {
  it('atacar coloca um Holofote em um inimigo próximo, por 3 s', () => {
    const { w } = setup();
    const e = parado(w, 20, 0, PI); // olhando para a Melissa
    step(w);
    expect(e.spot).toBeGreaterThan(HOLOFOTE_DURATION_S - 0.2);
  });

  it('o Holofote expira depois de 3 s', () => {
    const { w } = setup();
    const e = parado(w, 100, 0, PI); // fora do alcance do golpe, mas perto o bastante
    e.spot = 3;
    step(w, 60 * 3 + 5);
    expect(e.spot).toBe(0);
  });

  it('acertar pelas costas um inimigo com Holofote é crítico (x2), consome o Holofote e acelera', () => {
    const { w, s } = setup();
    const p = w.players[0]!;
    const e = parado(w, 20, 0, 0); // olha para a direita; Melissa (x=0) está atrás dele
    e.spot = 3;
    const base = FLORETE_DAMAGE;
    const hp0 = e.hp;
    expect(acertarInimigo(w, p, s, e, base)).toBe(true);
    expect(hp0 - e.hp).toBeCloseTo(base * 2, 5);
    expect(e.spot).toBe(0);
    expect(s.burstLeft).toBeGreaterThan(0);
    expect(s.spotHits).toBe(1);
  });

  it('acertar de frente um inimigo com Holofote não é crítico e mantém o Holofote', () => {
    const { w, s } = setup();
    const p = w.players[0]!;
    const e = parado(w, 20, 0, PI); // olha para a Melissa
    e.spot = 3;
    const hp0 = e.hp;
    expect(acertarInimigo(w, p, s, e, FLORETE_DAMAGE)).toBe(false);
    expect(hp0 - e.hp).toBeCloseTo(FLORETE_DAMAGE, 5);
    expect(e.spot).toBe(3);
    expect(s.burstLeft).toBe(0);
  });

  it('pelas costas sem Holofote não é crítico', () => {
    const { w, s } = setup();
    const e = parado(w, 20, 0, 0);
    const hp0 = e.hp;
    expect(acertarInimigo(w, w.players[0]!, s, e, FLORETE_DAMAGE)).toBe(false);
    expect(hp0 - e.hp).toBeCloseTo(FLORETE_DAMAGE, 5);
  });

  it('a explosão de velocidade dá +30% por 2 s', () => {
    const { w, s } = setup();
    s.burstLeft = 2;
    step(w);
    expect(w.players[0]!.kitSpeedMul).toBeCloseTo(BURST_SPEED_MUL, 10);
    step(w, 130);
    expect(w.players[0]!.kitSpeedMul).toBe(1);
  });

  it('o golpe só alcança inimigos dentro do alcance', () => {
    const { w } = setup();
    const near = parado(w, 20, 0, PI);
    const far = parado(w, FLORETE_REACH + 60, 0, PI);
    const farHp = far.hp;
    step(w);
    expect(near.hp).toBeLessThan(1000);
    expect(far.hp).toBe(farHp);
  });

  it('inimigos giram devagar: quem circula rápido pelo inimigo fica nas costas dele', () => {
    const { w } = setup();
    const p = w.players[0]!;
    p.x = 0;
    p.y = 0;
    spawnEnemy(w, ROBO, 30, 0);
    const e = w.enemies.active[0]!;
    e.hp = 1e6;
    e.facing = PI; // olhando para a Melissa
    // A Melissa dá a volta no inimigo: de x=0 para y=+... e depois para o outro lado.
    p.x = 30;
    p.y = 24; // abaixo do inimigo
    step(w, 8, NO_INPUT);
    // Em pouco tempo, a frente ainda não alcançou a nova posição: ainda não olha totalmente para ela.
    const toP = Math.atan2(p.y - e.y, p.x - e.x);
    expect(Math.abs(wrapAngle(toP - e.facing))).toBeGreaterThan(0.1);
  });
});

describe('Melissa: viabilidade de jogo', () => {
  it('circulando os inimigos, um jogador consegue acertar Holofotes pelas costas', () => {
    const w = createWorld(['melissa'], { initialChoice: false, seed: 5 });
    const p = w.players[0]!;
    p.hp = p.maxHp = 1e6; // só medimos a mecânica
    const s = p.kit as MelissaState;
    for (let i = 0; i < 60 * 90; i++) {
      // Estratégia simples: gira em volta do inimigo mais próximo (movimento perpendicular).
      let best = null as (typeof w.enemies.active)[number] | null;
      let bd = Infinity;
      for (const e of w.enemies.active) {
        const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
      const input: PlayerInput = best
        ? { ...NO_INPUT, moveX: -(best.y - p.y), moveY: best.x - p.x }
        : NO_INPUT;
      stepWorld(w, [input]);
      if (w.choices.length > 0) w.choices.length = 0; // ignora as escolhas de carta
    }
    expect(s.spotHits).toBeGreaterThanOrEqual(3);
  });
});

describe('Melissa: Reação Exagerada', () => {
  it('ao sofrer dano, atordoa inimigos próximos e entra em recarga de 12 s', () => {
    const { w, s } = setup();
    const e = parado(w, 40, 0, PI);
    e.stun = 0;
    e.hp = 1000;
    onPlayerHit(w.players[0]!);
    step(w);
    expect(e.stun).toBeGreaterThan(0);
    expect(s.reacaoCd).toBeGreaterThan(REACAO_COOLDOWN_S - 0.5);
  });

  it('em recarga, não dispara de novo', () => {
    const { w, s } = setup();
    s.reacaoCd = 5;
    const e = parado(w, 40, 0, PI);
    e.stun = 0;
    onPlayerHit(w.players[0]!);
    step(w);
    expect(e.stun).toBe(0);
  });
});

describe('Melissa: cartas exclusivas', () => {
  it('são 16 com ids únicos', () => {
    expect(MELISSA_CARDS).toHaveLength(16);
    expect(new Set(MELISSA_CARDS.map((c) => c.id)).size).toBe(16);
  });

  it('Ensaio de Coreografia: +10% de velocidade de ataque', () => {
    const { w } = setup();
    card('melissa-ensaio').apply(w.players[0]!);
    expect(w.players[0]!.attackSpeedMul).toBeCloseTo(1.1, 10);
  });

  it('Ponto de Holofote Extra: dois Holofotes por ataque', () => {
    const { w } = setup();
    card('melissa-extra').apply(w.players[0]!);
    const a = parado(w, 20, 0, PI);
    const b = parado(w, 60, 20, PI);
    step(w);
    expect(a.spot).toBeGreaterThan(0);
    expect(b.spot).toBeGreaterThan(0);
  });

  it('Câmera de Celular: Holofotes duram 1 s a mais', () => {
    const { w } = setup();
    card('melissa-camera').apply(w.players[0]!);
    const e = parado(w, 20, 0, PI);
    step(w);
    expect(e.spot).toBeGreaterThan(HOLOFOTE_DURATION_S + 1 - 0.2);
  });

  it('Lightstick Fora de Órbita: alcance +30%', () => {
    const { w, s } = setup();
    const base = alcanceDoFlorete(s);
    card('melissa-lightstick').apply(w.players[0]!);
    expect(alcanceDoFlorete(s)).toBeCloseTo(base * 1.3, 10);
  });

  it('Síndrome de Protagonista: crítico x3 por 5 s e 0,5 s de invulnerabilidade após a Reação', () => {
    const { w, s } = setup();
    const p = w.players[0]!;
    card('melissa-protagonista').apply(p);
    p.invuln = 0;
    onPlayerHit(p);
    step(w);
    expect(s.protagonistaLeft).toBeGreaterThan(4.5);
    expect(p.invuln).toBeGreaterThan(0.3);
    const e = parado(w, 20, 0, 0);
    e.spot = 3;
    const hp0 = e.hp;
    acertarInimigo(w, p, s, e, FLORETE_DAMAGE);
    expect(hp0 - e.hp).toBeCloseTo(FLORETE_DAMAGE * 3, 5);
  });

  it('Rotina de Fim de Semana: a cada 3 Holofotes acertados, uma Reação sem recarga', () => {
    const { w, s } = setup();
    const p = w.players[0]!;
    card('melissa-rotina').apply(p);
    s.reacaoCd = 10; // em recarga, para provar que é "sem recarga"
    for (let i = 0; i < 3; i++) {
      const e = parado(w, 20, 0, 0);
      e.spot = 3;
      acertarInimigo(w, p, s, e, 1);
    }
    expect(s.reacaoFree).toBe(true);
    const victim = parado(w, 40, 0, PI);
    victim.stun = 0;
    step(w);
    expect(victim.stun).toBeGreaterThan(0);
    expect(s.reacaoFree).toBe(false);
    expect(s.reacaoCd).toBeGreaterThan(8); // a recarga normal não foi consumida nem zerada
  });

  it('Show Inesperado: só o primeiro Holofote de cada inimigo explode em luz', () => {
    const { w, s } = setup();
    const p = w.players[0]!;
    card('melissa-show').apply(p);
    const e = parado(w, 20, 0, 0);
    const bystander = parado(w, 30, 10, PI);
    e.spot = 3;
    const bystanderHp = bystander.hp;
    acertarInimigo(w, p, s, e, 1);
    expect(bystander.hp).toBeLessThan(bystanderHp); // levou a explosão
    expect(e.spotUsed).toBe(true);
    // Segundo Holofote no mesmo inimigo: sem explosão.
    e.spot = 3;
    const hp1 = bystander.hp;
    acertarInimigo(w, p, s, e, 1);
    expect(bystander.hp).toBe(hp1);
  });

  it('Investida do Encore: o avanço corta inimigos, tem recarga e acertar um Holofote a reseta', () => {
    const { w, s } = setup();
    const p = w.players[0]!;
    card('melissa-investida').apply(p);
    const e = parado(w, 40, 0, 0); // costas viradas para a Melissa
    e.spot = 3;
    const x0 = p.x;
    step(w, 1, { ...NO_INPUT, moveX: 1, action: true });
    step(w, 12, { ...NO_INPUT, moveX: 1 });
    expect(p.x - x0).toBeGreaterThan(40); // avançou
    expect(e.hp).toBeLessThan(1000);
    expect(s.spotHits).toBeGreaterThanOrEqual(1);
    expect(s.dashCd).toBeLessThanOrEqual(0.001); // reset ao acertar o Holofote

    // Sem Holofote, a recarga vale.
    const { w: w2, s: s2 } = setup();
    card('melissa-investida').apply(w2.players[0]!);
    step(w2, 1, { ...NO_INPUT, moveX: 1, action: true });
    expect(s2.dashCd).toBeGreaterThan(INVESTIDA_COOLDOWN_S - 0.2);
  });

  it('Bis de Coreografia: depois do avanço, um segundo sem recarga em 3 s', () => {
    const { w, s } = setup();
    const p = w.players[0]!;
    card('melissa-investida').apply(p);
    card('melissa-bis').apply(p);
    step(w, 1, { ...NO_INPUT, moveX: 1, action: true });
    step(w, 12, { ...NO_INPUT, moveX: 1 });
    expect(s.dashLeft).toBe(0);
    expect(s.bisReady).toBe(true);
    const x1 = p.x;
    step(w, 1, { ...NO_INPUT, moveX: 1, action: false });
    step(w, 1, { ...NO_INPUT, moveX: 1, action: true }); // segundo avanço, ainda em recarga normal
    step(w, 12, { ...NO_INPUT, moveX: 1 });
    expect(p.x - x1).toBeGreaterThan(40);
    expect(s.bisReady).toBe(false);
    // A janela expira.
    const { w: w3, s: s3 } = setup();
    card('melissa-investida').apply(w3.players[0]!);
    card('melissa-bis').apply(w3.players[0]!);
    step(w3, 1, { ...NO_INPUT, moveX: 1, action: true });
    step(w3, 12, { ...NO_INPUT, moveX: 1 });
    expect(s3.bisReady).toBe(true);
    step(w3, Math.ceil(3.2 / STEP_S));
    expect(s3.bisReady).toBe(false);
  });

  it('Flash de Fancam: o cone desorienta inimigos à frente por 2 s', () => {
    const { w } = setup();
    card('melissa-fancam').apply(w.players[0]!);
    const e = parado(w, 60, 0, PI);
    e.stun = 0;
    step(w);
    expect(e.blind).toBeGreaterThan(1.5);
  });

  it('Fandom Organizado: aliados perto ganham +5% de crítico', () => {
    const w = createWorld(['melissa', 'felipe'], { initialChoice: false });
    card('melissa-fandom').apply(w.players[0]!);
    stepWorld(w, [NO_INPUT, NO_INPUT]);
    expect(w.players[1]!.auraCrit).toBeCloseTo(0.05, 10);
    w.players[1]!.x = 500;
    stepWorld(w, [NO_INPUT, NO_INPUT]);
    expect(w.players[1]!.auraCrit).toBe(0);
  });

  it('Passo de Dança Vertical e Bis de Coreografia só aparecem depois da Investida', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const { w } = setup(seed);
      const p = w.players[0]!;
      p.level = 4;
      pushChoice(w, p);
      for (const c of w.choices[0]!.cards) expect(['melissa-passo', 'melissa-bis']).not.toContain(c.id);
    }
    let seen = false;
    for (let seed = 1; seed <= 200; seed++) {
      const { w } = setup(seed);
      const p = w.players[0]!;
      p.level = 4;
      p.cardsTaken = ['melissa-investida'];
      pushChoice(w, p);
      if (w.choices[0]!.cards.some((c) => c.id === 'melissa-passo' || c.id === 'melissa-bis')) seen = true;
    }
    expect(seen).toBe(true);
  });

  it('toda escolha da Melissa tem pelo menos 1 exclusiva', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const { w } = setup(seed);
      pushChoice(w, w.players[0]!);
      expect(w.choices[0]!.cards.some((c) => c.character === 'melissa')).toBe(true);
    }
  });
});

describe('Melissa: Atrasada com Estilo', () => {
  it('+25% de velocidade enquanto se aproxima de um aliado', () => {
    const w = createWorld(['melissa', 'felipe'], { initialChoice: false });
    w.players[1]!.x = 200;
    const s = w.players[0]!.kit as MelissaState;
    stepWorld(w, [{ ...NO_INPUT, moveX: 1 }, NO_INPUT]);
    stepWorld(w, [{ ...NO_INPUT, moveX: 1 }, NO_INPUT]);
    stepWorld(w, [{ ...NO_INPUT, moveX: 1 }, NO_INPUT]);
    expect(s.approachLeft).toBeGreaterThan(0);
    expect(w.players[0]!.kitSpeedMul).toBeCloseTo(1.25, 10);
  });

  it('sem se aproximar de um aliado, não tem bônus', () => {
    const w = createWorld(['melissa', 'felipe'], { initialChoice: false });
    w.players[1]!.x = 200;
    for (let i = 0; i < 20; i++) stepWorld(w, [{ ...NO_INPUT, moveX: -1 }, NO_INPUT]);
    expect(w.players[0]!.kitSpeedMul).toBe(1);
  });
});
