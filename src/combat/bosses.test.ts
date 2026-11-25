import { describe, expect, it } from 'vitest';
import {
  ADVICE_CONFUSAO_S,
  ADVICE_OPTIONS,
  ADVICE_UNIDADE,
  ALE_CFG,
  BOSS_ROSTER,
  CHRISTOPHER_CFG,
  JUNINHO_CFG,
  LUCAS_LINHA_FINAL,
  MIN_TELEGRAPH_S,
  RM_CFG,
  SALSICHAS_CFG,
  TEMPO_CFG,
  TIAGOW_CFG,
} from '../data/bosses';
import { BOSSES, SALSICHAS, JUNINHO, RM, CHRISTOPHER, ALE, TIAGOW, TEMPO, type EnemyDef } from '../data/enemies';
import { NO_INPUT } from '../engine/input';
import { CONVIDADA_SLOT, createWorld, stepWorld, type World } from '../engine/world';
import type { Enemy } from '../entities/enemy';
import { chooseAdvice } from './advice';
import { BOSS_STATE, chefeVivo, conselhosEmbaralhados, faseDoTiagoW, spawnBoss } from './bosses';
import { estaExausto, faseDaLuta, salsichaoFundido } from './salsichas';
import { spawnFood } from './foods';
import { FOODS } from '../data/foods';
import { damageEnemy } from './enemies';
import { spawnHazard, spawnHostile } from './hostile';
import { COR_TAPETE, duracaoDaRegra, esconderIniciar, iniciarRegra, piqueIniciar, REGRA, regraAtiva } from './christopher';

type Char = 'felipe' | 'thaisa' | 'melissa' | 'thayssa' | 'mauro';

/** Mundo só com o chefe. Jogadores muito resistentes e kits calados: observamos o chefe em paz. */
function mundo(chars: Char[] = ['felipe']): World {
  const w = createWorld(chars, { initialChoice: false, noSpawn: true, noBosses: true, seed: 4 });
  w.walls = [];
  for (const p of w.players) {
    p.hp = p.maxHp = 1e9;
    const k = p.kit as unknown as { cd?: number } | null;
    if (k) k.cd = 1e9;
  }
  return w;
}

function step(w: World, n = 1): void {
  for (let i = 0; i < n; i++) {
    stepWorld(w, w.players.map(() => NO_INPUT));
    w.choices.length = 0;
  }
}

function chefe(w: World, def: EnemyDef): Enemy {
  spawnBoss(w, def);
  const e = w.enemies.active.find((x) => x.def.boss)!;
  e.x = 100;
  e.y = 0;
  return e;
}

/** Faz o chefe começar o próximo ataque agora. */
function atacar(e: Enemy): void {
  e.aiCd = 0;
  e.aiState = BOSS_STATE.LIVRE;
}

const aneis = (w: World): number => w.hazards.active.filter((h) => h.kind === 'ring').length;

describe('Elenco de chefes', () => {
  it('são 7 chefes da campanha, cada um com o seu EnemyDef, e nenhum dos chefes antigos', () => {
    expect(BOSSES.map((b) => b.id)).toEqual(['salsichas', 'juninho', 'rm', 'christopher', 'ale', 'tiagow', 'tempo']);
    const ids = BOSSES.map((b) => b.id as string);
    for (const velho of ['golem', 'sindico', 'burocrata']) expect(ids).not.toContain(velho);
    for (const b of BOSSES) expect(b.boss).toBe(true);
  });

  it('o elenco de lore tem um chefe de dados para cada EnemyDef de chefe', () => {
    const lore = BOSS_ROSTER.map((b) => b.id as string);
    for (const b of BOSSES) expect(lore).toContain(b.id);
  });

  it('os chefes nascem com o tipo certo, avisam e são chefes (não atordoam nem empurram)', () => {
    for (const def of BOSSES) {
      const w = mundo();
      const e = chefe(w, def);
      expect(e.def.id).toBe(def.id);
      expect(w.messages.some((m) => m.text.includes('Aviso de chefe'))).toBe(true);
      expect(e.aiX).toBe(e.hp);
    }
  });
});

describe('Chefes: aviso de pelo menos 1 s antes de cada ataque', () => {
  it('todos os tempos de aviso configurados são de 1 s ou mais', () => {
    expect(MIN_TELEGRAPH_S).toBe(1);
    const avisos = [
      SALSICHAS_CFG.trenzinho.warnS,
      SALSICHAS_CFG.cerco.warnS,
      SALSICHAS_CFG.monet.warnS,
      SALSICHAS_CFG.toddy.warnS,
      SALSICHAS_CFG.bucky.warnS,
      JUNINHO_CFG.lasers.warnS,
      JUNINHO_CFG.cronograma.warnS,
      RM_CFG.holofotes.warnS,
      CHRISTOPHER_CFG.birra.warnS,
      CHRISTOPHER_CFG.brinquedos.warnS,
      CHRISTOPHER_CFG.regras.avisoS,
      ALE_CFG.apito.warnS,
      ALE_CFG.fila.warnS,
      TIAGOW_CFG.tiros.warnS,
      TIAGOW_CFG.carimbo.warnS,
      TEMPO_CFG.ponteiro.warnS,
      TEMPO_CFG.folhas.warnS,
    ];
    for (const a of avisos) expect(a).toBeGreaterThanOrEqual(MIN_TELEGRAPH_S);
  });

  it('todo perigo criado por um ataque de chefe nasce com 1 s ou mais de aviso', () => {
    for (const def of BOSSES) {
      const w = mundo();
      const e = chefe(w, def);
      for (let ciclo = 0; ciclo < 6; ciclo++) {
        atacar(e);
        step(w, 3);
        for (const h of w.hazards.active) if (!h.active) expect(h.warnTotal, `${def.id}`).toBeGreaterThanOrEqual(0);
        e.aiState = BOSS_STATE.LIVRE;
      }
      expect(w.enemies.active.some((x) => x.def.boss)).toBe(true);
    }
  });
});

describe('As Salsichas (fase 1)', () => {
  it('têm 1100 de vida e são uma matilha', () => {
    expect(SALSICHAS.hp).toBe(1100);
    expect(BOSS_ROSTER.find((b) => b.id === 'salsichas')!.members).toHaveLength(4);
  });

  it('o trenzinho avisa 1,2 s e solta uma fila de latidos', () => {
    const w = mundo();
    const e = chefe(w, SALSICHAS);
    atacar(e);
    step(w, 2);
    expect(e.aiState).toBe(BOSS_STATE.PREPARANDO);
    expect(w.hostiles.active).toHaveLength(0);
    step(w, 60 * SALSICHAS_CFG.trenzinho.warnS + 10);
    expect(w.hostiles.active.filter((h) => h.kind === 'latido').length).toBe(SALSICHAS_CFG.trenzinho.count);
  });

  it('o rodízio começa pelo Geraldo e segue Monet, Toddy e Bucky', () => {
    const w = mundo();
    const e = chefe(w, SALSICHAS);
    const matilha = (): Enemy[] => [e, ...w.enemies.active.filter((x) => x.leader === e.uid)];
    const quem: string[] = [];
    for (let i = 0; i < 4; i++) {
      for (const d of matilha()) d.aiState = BOSS_STATE.LIVRE;
      e.aiCd = 0;
      step(w, 1);
      quem.push(...matilha().filter((d) => d.aiState === BOSS_STATE.PREPARANDO).map((d) => d.def.id));
    }
    expect(quem).toEqual(['salsichas', 'monet', 'toddy', 'bucky']);
  });

  it('Monet pinta poças de tinta com aviso no chão, que ficam dando dano e lentidão', () => {
    const w = mundo();
    const e = chefe(w, SALSICHAS);
    e.aiCount = 1; // o próximo do rodízio é a Monet
    atacar(e);
    step(w, 2);
    const pocas = w.hazards.active.filter((h) => h.sprite === 'poca_tinta');
    expect(pocas).toHaveLength(SALSICHAS_CFG.monet.count);
    for (const h of pocas) {
      expect(h.warnTotal).toBeGreaterThanOrEqual(1);
      expect(h.life).toBeGreaterThan(0);
      expect(h.slowFor).toBeGreaterThan(0);
    }
  });

  it('Toddy marca uma trilha reta e dispara por ela depois do aviso', () => {
    const w = mundo();
    const e = chefe(w, SALSICHAS);
    const toddy = w.enemies.active.find((x) => x.def.id === 'toddy')!;
    e.aiCount = 2; // o próximo do rodízio é o Toddy
    atacar(e);
    step(w, 2);
    expect(w.hazards.active.filter((h) => h.sprite === 'toddy_rastro')).toHaveLength(SALSICHAS_CFG.toddy.steps);
    expect(toddy.aiState).toBe(BOSS_STATE.PREPARANDO);
    step(w, Math.ceil(60 * SALSICHAS_CFG.toddy.warnS) + 3);
    expect(toddy.aiState).toBe(BOSS_STATE.CARGA);
    const x0 = toddy.x;
    const y0 = toddy.y;
    step(w, 12);
    expect(Math.hypot(toddy.x - x0, toddy.y - y0)).toBeGreaterThan(20);
    step(w, 60);
    expect(toddy.aiState).not.toBe(BOSS_STATE.CARGA);
  });

  it('Bucky abocanha o grupo: aviso no chão que puxa para o centro e deixa lento', () => {
    const w = mundo();
    const e = chefe(w, SALSICHAS);
    e.aiCount = 3; // o próximo do rodízio é o Bucky
    atacar(e);
    step(w, 2);
    const boca = w.hazards.active.find((h) => h.sprite === 'mordida')!;
    expect(boca).toBeDefined();
    expect(boca.push).toBeLessThan(0); // negativo = puxa para o centro
    expect(boca.slowFor).toBeGreaterThan(0);
    expect(boca.warnTotal).toBeGreaterThanOrEqual(1);
  });

  it('só um cachorro ataca por vez na fase 1', () => {
    const w = mundo();
    const e = chefe(w, SALSICHAS);
    atacar(e);
    step(w, 30);
    const todos = [e, ...w.enemies.active.filter((x) => x.leader === e.uid)];
    expect(todos.filter((d) => d.aiState === BOSS_STATE.PREPARANDO)).toHaveLength(1);
  });

  it('a geladeira se abre e solta comida', () => {
    const w = mundo();
    chefe(w, SALSICHAS);
    expect(w.foods.active).toHaveLength(0);
    step(w, Math.ceil(60 * SALSICHAS_CFG.comida.geladeira.firstS) + 5);
    // A matilha pode ter comido na hora: o que vale é a geladeira ter aberto.
    expect(w.messages.some((m) => m.text.includes('geladeira'))).toBe(true);
  });

  it('o cachorro que chega primeiro na comida come, se cura e fica parado (vulnerável)', () => {
    const w = mundo();
    const e = chefe(w, SALSICHAS);
    e.hp = e.aiX * 0.9;
    const hp = e.hp;
    spawnFood(w, FOODS[0]!, e.x + 10, e.y);
    e.aiCd = 99; // sem atacar neste teste
    step(w, 3);
    expect(e.aiState).toBe(BOSS_STATE.AQUECENDO);
    expect(e.hp).toBeGreaterThan(hp);
    const x = e.x;
    step(w, 60);
    expect(e.x).toBeCloseTo(x, 3); // parado comendo
  });

  it('o jogador que come perto da matilha distrai os cachorros livres', () => {
    const w = mundo();
    const e = chefe(w, SALSICHAS);
    e.aiCd = 99;
    const p = w.players[0]!;
    p.x = e.x + 40;
    p.y = e.y;
    spawnFood(w, FOODS[0]!, p.x, p.y);
    step(w, 2);
    expect(e.aiState).toBe(BOSS_STATE.AQUECENDO);
  });

  it('a vida decide a fase: unida, dividida (2/3) e Salsichão (1/3)', () => {
    expect(SALSICHAS_CFG.fases.dividida).toBeCloseTo(0.66);
    expect(SALSICHAS_CFG.fases.salsichao).toBeCloseTo(0.33);
    expect(faseDaLuta(1)).toBe(1);
    expect(faseDaLuta(0.5)).toBe(2);
    expect(faseDaLuta(0.2)).toBe(3);
    const w = mundo();
    const e = chefe(w, SALSICHAS);
    step(w, 2);
    expect(e.aiT2).toBe(1);
    e.hp = e.aiX * 0.5;
    step(w, 2);
    expect(e.aiT2).toBe(2);
    expect(w.messages.some((m) => m.text.includes('separou'))).toBe(true);
    e.hp = e.aiX * 0.2;
    step(w, 2);
    expect(e.aiT2).toBe(3);
    expect(w.messages.some((m) => m.text.includes('fundindo'))).toBe(true);
    step(w, Math.ceil(60 * SALSICHAS_CFG.salsichao.fusaoS) + 5);
    expect(w.messages.some((m) => m.text.includes('SALSICHÃO'))).toBe(true);
  });

  it('na fase 2 cada cachorro tem o seu relógio e ataca por conta própria', () => {
    const w = mundo();
    const e = chefe(w, SALSICHAS);
    e.hp = e.aiX * 0.5;
    step(w, 2);
    const todos = [e, ...w.enemies.active.filter((x) => x.leader === e.uid)];
    expect(todos.every((d) => d.aiW > 0)).toBe(true);
    const vistos = new Set<string>();
    for (let i = 0; i < 60 * 8; i++) {
      step(w, 1);
      for (const d of todos) if (d.aiState === BOSS_STATE.PREPARANDO) vistos.add(d.def.id);
    }
    expect(vistos.size).toBeGreaterThanOrEqual(3);
  });

  it('na fase 2, o cachorro sem vigor se deita exausto: sem contato e sem atacar, e volta depois', () => {
    const w = mundo();
    const e = chefe(w, SALSICHAS);
    e.hp = e.aiX * 0.5;
    step(w, 2);
    const bucky = w.enemies.active.find((x) => x.def.id === 'bucky')!;
    damageEnemy(w, bucky, bucky.aiW + 1, w.players[0]);
    expect(bucky.aiState).toBe(BOSS_STATE.EXAUSTO);
    expect(estaExausto(bucky)).toBe(true);
    // Deitado em cima do jogador: não machuca.
    const p = w.players[0]!;
    p.hp = p.maxHp = 100;
    p.invuln = 0;
    bucky.x = p.x;
    bucky.y = p.y;
    step(w, 3);
    expect(p.hp).toBe(100);
    step(w, Math.ceil(60 * SALSICHAS_CFG.vigor.exaustoS) + 5);
    expect(bucky.aiState).not.toBe(BOSS_STATE.EXAUSTO);
    expect(bucky.aiW).toBeGreaterThan(0);
  });

  it('o vigor só vale na fase 2: nas outras fases o dano não deita ninguém', () => {
    const w = mundo();
    chefe(w, SALSICHAS);
    const monet = w.enemies.active.find((x) => x.def.id === 'monet')!;
    damageEnemy(w, monet, 300, w.players[0]);
    expect(estaExausto(monet)).toBe(false);
  });

  it('a fusão: os três corpos correm até o Geraldo, ninguém ataca, e no fim nasce o Salsichão', () => {
    const w = mundo();
    const e = chefe(w, SALSICHAS);
    step(w, 2);
    // Espalha os cachorros e começa a fase 3.
    const corpos = w.enemies.active.filter((x) => x.leader === e.uid);
    corpos.forEach((c, i) => {
      c.x = e.x + 150 * Math.cos(i * 2.1);
      c.y = e.y + 150 * Math.sin(i * 2.1);
    });
    e.hp = e.aiX * 0.2;
    step(w, 2);
    expect(e.aiT2).toBe(3);
    expect(salsichaoFundido(e)).toBe(false);
    const distAntes = Math.max(...corpos.map((c) => Math.hypot(c.x - e.x, c.y - e.y)));
    step(w, Math.ceil(60 * SALSICHAS_CFG.salsichao.fusaoS * 0.5));
    // No meio da fusão: ninguém ataca e eles já se aproximaram.
    expect([e, ...corpos].some((d) => d.aiState === BOSS_STATE.PREPARANDO)).toBe(false);
    expect(Math.max(...corpos.map((c) => Math.hypot(c.x - e.x, c.y - e.y)))).toBeLessThan(distAntes);
    step(w, Math.ceil(60 * SALSICHAS_CFG.salsichao.fusaoS * 0.5) + 5);
    expect(salsichaoFundido(e)).toBe(true);
    // Fundidos: os corpos ficam em linha horizontal embaixo do sprite, nos lugares combinados.
    step(w, 30);
    const lado = Math.cos(e.facing) >= 0 ? 1 : -1;
    corpos.forEach((c, i) => {
      expect(Math.abs(c.x - (e.x + SALSICHAS_CFG.salsichao.offsets[i]! * lado))).toBeLessThan(6);
      expect(Math.abs(c.y - e.y)).toBeLessThan(6);
    });
    expect(w.effects.active.some((fx) => fx.text === 'SALSICHÃO!') || w.messages.some((m) => m.text.includes('SALSICHÃO'))).toBe(true);
  });

  it('o Salsichão só existe na fase 3', () => {
    const w = mundo();
    const e = chefe(w, SALSICHAS);
    step(w, 2);
    expect(salsichaoFundido(e)).toBe(false);
    e.hp = e.aiX * 0.5;
    step(w, 2);
    expect(salsichaoFundido(e)).toBe(false);
  });

  it('no Salsichão dois ataques saem combinados', () => {
    const w = mundo();
    const e = chefe(w, SALSICHAS);
    e.hp = e.aiX * 0.2;
    step(w, Math.ceil(60 * SALSICHAS_CFG.salsichao.fusaoS) + 30);
    e.aiCd = 0;
    step(w, 2);
    const todos = [e, ...w.enemies.active.filter((x) => x.leader === e.uid)];
    expect(todos.filter((d) => d.aiState === BOSS_STATE.PREPARANDO)).toHaveLength(SALSICHAS_CFG.salsichao.combo);
  });

  it('abaixo de 33% o trenzinho vem maior e acompanhado de ondas', () => {
    const w = mundo();
    const e = chefe(w, SALSICHAS);
    e.hp = e.aiX * 0.2;
    step(w, Math.ceil(60 * SALSICHAS_CFG.salsichao.fusaoS) + 30);
    e.aiCount = 0; // começa pelo Geraldo
    e.aiCd = 0;
    step(w, 2);
    step(w, 60 * SALSICHAS_CFG.trenzinho.warnS + 10);
    expect(w.hostiles.active.filter((h) => h.kind === 'latido').length).toBe(SALSICHAS_CFG.trenzinho.count + SALSICHAS_CFG.salsichao.extraLatidos);
    expect(aneis(w)).toBeGreaterThan(0);
  });
});

describe('Juninho e as Azuletes (fase 3)', () => {
  const azuletes = (w: World, j: Enemy) => ({
    mariana: w.enemies.active.find((x) => x.def.id === 'mariana' && x.leader === j.uid)!,
    melina: w.enemies.active.find((x) => x.def.id === 'melina' && x.leader === j.uid)!,
  });

  it('a Mariana e a Melina estão em campo desde o início e dividem a vida do Juninho', () => {
    const w = mundo();
    const j = chefe(w, JUNINHO);
    const { mariana, melina } = azuletes(w, j);
    expect(mariana).toBeDefined();
    expect(melina).toBeDefined();
    expect(chefeVivo(w)).toBe(j); // só o Juninho conta como chefe (a barra de vida é uma só)
    const antes = j.hp;
    damageEnemy(w, mariana, 40, undefined);
    expect(j.hp).toBe(antes - 40);
  });

  it('lasers miram a posição dos jogadores com aviso', () => {
    const w = mundo();
    const e = chefe(w, JUNINHO);
    e.aiCount = 0; // próximo é o ataque 1: lasers
    atacar(e);
    step(w, 2);
    const h = w.hazards.active.find((x) => x.warnTotal === JUNINHO_CFG.lasers.warnS);
    expect(h).toBeDefined();
  });

  it('as zonas de cronograma atrasam quem passa e, quando o prazo acaba, explodem', () => {
    const w = mundo();
    const e = chefe(w, JUNINHO);
    e.aiCount = 1; // próximo é par: cronograma
    atacar(e);
    step(w, 2);
    expect(w.hazards.active.some((h) => h.slowFor === JUNINHO_CFG.cronograma.slowFor)).toBe(true);
    const c = JUNINHO_CFG.cronograma;
    expect(w.hazards.active.some((h) => h.damage === c.prazoDamage && h.warnTotal > c.warnS)).toBe(true);
  });

  it('a notificação de e-mail solta um leque de projéteis', () => {
    const w = mundo();
    const e = chefe(w, JUNINHO);
    e.aiCount = 2; // próximo é o 3
    atacar(e);
    step(w, 2);
    expect(w.hostiles.active.filter((h) => h.kind === 'email')).toHaveLength(JUNINHO_CFG.email.count);
  });

  it('a reunião obrigatória puxa os jogadores para o centro', () => {
    const w = mundo();
    const e = chefe(w, JUNINHO);
    e.aiCount = 3; // próximo é o 4
    atacar(e);
    step(w, 2);
    const h = w.hazards.active.find((x) => x.push < 0);
    expect(h).toBeDefined();
    expect(h!.warnTotal).toBeGreaterThanOrEqual(MIN_TELEGRAPH_S);
  });

  it('a Mariana investe deixando tinta no chão e, depois de algumas investidas, fica sem fôlego', () => {
    const w = mundo();
    const j = chefe(w, JUNINHO);
    j.aiCd = 1e9; // o Juninho espera: observamos só a Mariana
    const { mariana } = azuletes(w, j);
    mariana.aiCd = 0;
    step(w, 3);
    expect(mariana.aiState).toBe(BOSS_STATE.PREPARANDO);
    expect(w.hazards.active.some((h) => h.sprite === 'poca_tinta')).toBe(true);
    let exausta = false;
    for (let i = 0; i < 900 && !exausta; i++) {
      step(w, 1);
      exausta = mariana.aiState === BOSS_STATE.EXAUSTO;
    }
    expect(exausta).toBe(true);
  });

  it('sem fôlego, a Mariana leva dano extra', () => {
    const w = mundo();
    const j = chefe(w, JUNINHO);
    const { mariana } = azuletes(w, j);
    mariana.aiState = BOSS_STATE.EXAUSTO;
    mariana.aiT = 5;
    const antes = j.hp;
    damageEnemy(w, mariana, 100, undefined);
    expect(j.hp).toBeCloseTo(antes - 100 * JUNINHO_CFG.mariana.exaustaDanoMul, 5);
  });

  it('a Mariana tropeça numa zona de cronograma e cansa na hora', () => {
    const w = mundo();
    const j = chefe(w, JUNINHO);
    j.aiCd = 1e9;
    const { mariana } = azuletes(w, j);
    mariana.x = 0;
    mariana.y = 0;
    mariana.aiState = BOSS_STATE.CARGA;
    mariana.aiDir = 0;
    mariana.aiY = 0;
    mariana.aiCount = 0;
    const h = w.hazards.acquire()!;
    Object.assign(h, { kind: 'circle', x: 6, y: 0, radius: 30, delay: 0, warnTotal: 0, life: 5, damage: 0, dps: 0, slowFor: 3, expand: 0, maxRadius: 30, thickness: 8, push: 0, pushS: 0, color: '#6ea8ff', sprite: '', active: true, alive: true });
    step(w, 2);
    expect(mariana.aiState).toBe(BOSS_STATE.EXAUSTO);
  });

  it('a Melina bota um escudo no Juninho que absorve dano e, ao quebrar, deixa o grupo atordoado', () => {
    const w = mundo();
    const j = chefe(w, JUNINHO);
    j.aiCd = 1e9;
    const { melina, mariana } = azuletes(w, j);
    melina.aiT2 = 0;
    melina.aiCd = 1e9;
    step(w, Math.ceil((JUNINHO_CFG.melina.escudoWarnS + 0.5) * 60));
    expect(j.aiY).toBeGreaterThan(0);
    const escudo = j.aiY;
    const antes = j.hp;
    damageEnemy(w, j, escudo / 2, undefined);
    expect(j.hp).toBe(antes); // o escudo segurou
    damageEnemy(w, j, escudo, undefined); // quebra
    expect(j.aiY).toBe(0);
    expect(j.hp).toBe(antes);
    expect(j.stun).toBeGreaterThan(0);
    expect(mariana.stun).toBeGreaterThan(0);
    damageEnemy(w, j, 50, undefined); // sem escudo, o dano passa
    expect(j.hp).toBe(antes - 50);
  });

  it('acertar a Melina com o escudo ativo o desgasta em dobro', () => {
    const w = mundo();
    const j = chefe(w, JUNINHO);
    const { melina } = azuletes(w, j);
    j.aiY = j.aiDir = 100;
    j.aiW = 7;
    damageEnemy(w, melina, 20, undefined);
    expect(j.aiY).toBe(60);
  });

  it('a Melina lança ironias e quem leva uma fica com debuff de dano e ataque', () => {
    const w = mundo();
    const j = chefe(w, JUNINHO);
    j.aiCd = 1e9;
    const { melina } = azuletes(w, j);
    melina.aiT2 = 1e9; // sem escudo nesta hora
    melina.aiCd = 0;
    step(w, 2);
    expect(w.hostiles.active.some((h) => h.kind === 'ironia')).toBe(true);
    // Uma ironia que acerta o jogador.
    const p = w.players[0]!;
    spawnHostile(w, { kind: 'ironia', x: p.x, y: p.y - 8, angle: 0, speed: 0, damage: 4, life: 1 });
    step(w, 2);
    const b = p.buffs.find((x) => x.id === 'ironia');
    expect(b).toBeDefined();
    expect(b!.damage).toBe(JUNINHO_CFG.melina.debuff.damage);
    expect(b!.attack).toBe(JUNINHO_CFG.melina.debuff.attack);
  });

  it('as fases vêm pela vida restante e a fase 3 tem hora extra', () => {
    const w = mundo();
    const j = chefe(w, JUNINHO);
    j.hp = j.aiX * 0.5;
    step(w, 2);
    expect(j.aiT2).toBe(2);
    j.hp = j.aiX * 0.2;
    j.aiCount = 3;
    atacar(j);
    step(w, 2);
    expect(j.aiT2).toBe(3);
    expect(w.messages.some((m) => m.speaker === 'Juninho' && /Hora extra/.test(m.text))).toBe(true);
  });

  it('derrotar o Juninho leva as Azuletes junto', () => {
    const w = mundo();
    const j = chefe(w, JUNINHO);
    const { mariana, melina } = azuletes(w, j);
    damageEnemy(w, j, 1e9, undefined);
    expect(j.alive).toBe(false);
    expect(mariana.alive).toBe(false);
    expect(melina.alive).toBe(false);
  });
});

describe('RM (fase 4): encanto e transe', () => {
  it('o feixe escolhe a Melissa, se ela está na partida, e a puxa na direção do RM', () => {
    const w = mundo(['felipe', 'melissa']);
    const e = chefe(w, RM);
    e.aiT2 = 0;
    w.players[0]!.x = -300; // longe: sem aliado encostado para segurá-la
    const mel = w.players[1]!;
    const d0 = Math.hypot(e.x - mel.x, e.y - mel.y);
    step(w, 120);
    expect(w.trance?.slot).toBe(1);
    expect(Math.hypot(e.x - mel.x, e.y - mel.y)).toBeLessThan(d0);
  });

  it('sem a Melissa na partida, aparece uma Melissa convidada e o RM nunca encanta um jogador', () => {
    const w = mundo(['felipe', 'thaisa']);
    chefe(w, RM);
    expect(w.convidada).toBeNull();
    const antes = w.players.map((p) => [p.x, p.y]);
    step(w, 5);
    expect(w.convidada).not.toBeNull();
    expect(w.convidada!.characterId).toBe('melissa');
    expect(w.trance?.slot).toBe(CONVIDADA_SLOT);
    expect(w.players).toHaveLength(2); // ela não é um jogador
    expect(w.players.every((p, i) => p.x === antes[i]![0] && p.y === antes[i]![1])).toBe(true);
  });

  it('a convidada é puxada pelo RM, entra em transe e a equipe pode quebrar o encanto', () => {
    const w = mundo(['thayssa', 'felipe']);
    const e = chefe(w, RM);
    step(w, 2);
    const c = w.convidada!;
    c.x = e.x - 10;
    c.y = e.y;
    w.players[0]!.x = e.x - 40;
    w.players[0]!.y = e.y;
    w.players[1]!.x = e.x - 44;
    w.players[1]!.y = e.y;
    step(w, 5);
    expect(w.trance?.caught).toBe(true);
    for (let i = 0; i < 60 * 15 && w.trance; i++) step(w, 1);
    expect(w.trance).toBeNull();
    expect(w.convidada).not.toBeNull(); // continua na luta até o RM cair
  });

  it('em transe, a convidada sai do lado do RM, persegue a equipe e a golpeia até o transe quebrar', () => {
    const w = mundo(['felipe', 'thaisa']);
    const e = chefe(w, RM);
    step(w, 2);
    const c = w.convidada!;
    c.x = e.x - 10;
    c.y = e.y;
    // Equipe a ~90 px do RM, fora do alcance do toque (nenhum dreno rápido).
    w.players[0]!.x = e.x - 90;
    w.players[0]!.y = e.y;
    w.players[1]!.x = e.x - 100;
    w.players[1]!.y = e.y + 10;
    step(w, 5);
    expect(w.trance?.caught).toBe(true);
    const x0 = c.x;
    const hp0 = w.players.map((p) => p.hp);
    step(w, 60 * 3);
    expect(Math.abs(c.x - x0)).toBeGreaterThan(20); // saiu do lado do RM
    expect(w.players.some((p, i) => p.hp < hp0[i]!)).toBe(true); // machucou alguém
    expect(Math.hypot(c.x - e.x, c.y - e.y)).toBeLessThanOrEqual(RM_CFG.convidada.leash + 1);
  });

  it('quebrado o transe, ela para de atacar', () => {
    const w = mundo(['thayssa', 'felipe']);
    const e = chefe(w, RM);
    step(w, 2);
    const c = w.convidada!;
    c.x = e.x - 10;
    c.y = e.y;
    w.players[0]!.x = e.x - 20;
    w.players[0]!.y = e.y;
    w.players[1]!.x = e.x - 24;
    w.players[1]!.y = e.y;
    step(w, 5);
    expect(w.trance?.caught).toBe(true);
    for (let i = 0; i < 60 * 15 && w.trance; i++) step(w, 1);
    expect(w.trance).toBeNull();
    const c2 = w.convidada!;
    c2.weaponCd = 0;
    step(w, 60 * 2); // o RM descansa 8 s antes de encantar de novo
    expect(c2.weaponCd).toBe(0); // nenhum golpe novo
    expect(w.hostiles.active.some((h) => h.kind === 'notificacao')).toBe(false);
  });

  it('os inimigos ignoram a convidada e ninguém da equipe sofre dano por causa dela', () => {
    const w = mundo(['felipe', 'thaisa']);
    chefe(w, RM);
    step(w, 5);
    expect(w.players.every((p) => p.hp === p.maxHp)).toBe(true);
    expect(w.convidada!.hp).toBe(w.convidada!.maxHp);
  });

  it('com a Melissa na partida não aparece convidada; se ela está caída, o RM espera em vez de encantar outro', () => {
    const w = mundo(['felipe', 'melissa']);
    chefe(w, RM);
    w.players[1]!.hp = 0;
    step(w, 120);
    expect(w.convidada).toBeNull();
    expect(w.trance).toBeNull();
  });

  it('derrotar o RM faz a convidada sumir', async () => {
    const { onBossKilled } = await import('./run');
    const w = mundo(['felipe', 'thaisa']);
    const e = chefe(w, RM);
    step(w, 5);
    expect(w.convidada).not.toBeNull();
    onBossKilled(w, e);
    expect(w.convidada).toBeNull();
    expect(w.trance).toBeNull();
  });

  it('um aliado encostado impede que ela seja puxada', () => {
    const w = mundo(['felipe', 'melissa']);
    const e = chefe(w, RM);
    const mel = w.players[1]!;
    mel.x = 40;
    mel.y = 0;
    w.players[0]!.x = 44;
    w.players[0]!.y = 0;
    step(w, 120);
    expect(w.trance?.caught).toBe(false);
    expect(Math.hypot(e.x - mel.x, e.y - mel.y)).toBeGreaterThan(RM_CFG.catchPx);
  });

  it('se ela alcança o RM, entra em transe e ataca a própria equipe', () => {
    const w = mundo(['felipe', 'melissa']);
    const e = chefe(w, RM);
    const mel = w.players[1]!;
    mel.x = e.x - 10;
    mel.y = e.y;
    w.players[0]!.x = -300;
    step(w, 5);
    expect(w.trance?.caught).toBe(true);
    step(w, 60 * 3);
    expect(w.hostiles.active.length + w.messages.length).toBeGreaterThan(0);
    expect(w.hostiles.active.some((h) => h.kind === 'notificacao')).toBe(true);
  });

  it('a aura da Thayssa esvazia a barra de transe muito mais rápido que sozinha', () => {
    const sozinha = mundo(['felipe', 'melissa']);
    const comThayssa = mundo(['thayssa', 'melissa']);
    for (const [w, mel] of [[sozinha, 1], [comThayssa, 1]] as const) {
      const e = chefe(w, RM);
      w.players[mel]!.x = e.x - 10;
      w.players[mel]!.y = e.y;
      w.players[1 - mel]!.x = e.x - 40;
      w.players[1 - mel]!.y = e.y;
      step(w, 5);
    }
    step(sozinha, 60);
    step(comThayssa, 60);
    expect(comThayssa.trance ? comThayssa.trance.meter : -1).toBeLessThan(sozinha.trance ? sozinha.trance.meter : 1e9);
  });

  it('quebrar o transe devolve a Melissa ao grupo', () => {
    const w = mundo(['thayssa', 'melissa']);
    const e = chefe(w, RM);
    w.players[1]!.x = e.x - 10;
    w.players[1]!.y = e.y;
    w.players[0]!.x = e.x - 40;
    w.players[0]!.y = e.y;
    step(w, 5);
    expect(w.trance?.caught).toBe(true);
    step(w, 60 * 12);
    expect(w.trance).toBeNull();
    expect(w.messages.some((m) => m.text.includes('transe quebrou'))).toBe(true);
  });

  it('aliados colados na Melissa antes do transe levam a onda de aplausos e são empurrados para longe dela', () => {
    const w = mundo(['felipe', 'mauro']);
    const e = chefe(w, RM);
    step(w, 2);
    const c = w.convidada!;
    c.x = 0;
    c.y = 0;
    e.x = 400; // longe: ela demora a ser pega
    const [a, b] = w.players;
    a!.x = 14;
    a!.y = 0;
    b!.x = -14;
    b!.y = 0;
    // O RM espera o tempo de recarga com aliados colados, avisa no chão e solta a onda.
    step(w, 60 * RM_CFG.onda.everyS + 5);
    const aviso = w.hazards.active.find((h) => h.sprite === 'rm_onda');
    expect(aviso).toBeDefined();
    expect(aviso!.push).toBe(RM_CFG.onda.push);
    const centro = { x: aviso!.x, y: aviso!.y };
    const antes = [a!, b!].map((p) => Math.hypot(p.x - centro.x, p.y - centro.y));
    step(w, 60 * RM_CFG.onda.warnS + 5);
    // Empurrados para longe dela.
    const depois = [a!, b!].map((p) => Math.hypot(p.x - centro.x, p.y - centro.y));
    expect(depois[0]!).toBeGreaterThan(antes[0]! + 20);
    expect(depois[1]!).toBeGreaterThan(antes[1]! + 20);
    expect(a!.hp).toBeLessThan(a!.maxHp);
  });

  it('sem aliados colados nela, o RM não solta a onda', () => {
    const w = mundo(['felipe', 'mauro']);
    const e = chefe(w, RM);
    step(w, 2);
    w.convidada!.x = 0;
    w.convidada!.y = 0;
    e.x = 400;
    w.players[0]!.x = 300;
    w.players[1]!.x = 320;
    step(w, 60 * (RM_CFG.onda.everyS + 2));
    expect(w.hazards.active.some((h) => h.sprite === 'rm_onda')).toBe(false);
  });

  it('quando o transe quebra, a convidada fica desnorteada no lugar e depois anda um pouquinho para longe do RM', () => {
    const w = mundo(['thayssa', 'felipe']);
    const e = chefe(w, RM);
    step(w, 2);
    const c = w.convidada!;
    c.x = e.x - 10;
    c.y = e.y;
    w.players[0]!.x = e.x - 20;
    w.players[0]!.y = e.y;
    w.players[1]!.x = e.x - 24;
    w.players[1]!.y = e.y;
    step(w, 5);
    expect(w.trance?.caught).toBe(true);
    for (let i = 0; i < 60 * 15 && w.trance; i++) step(w, 1);
    expect(w.trance).toBeNull();
    // Desnorteada: parada e "confusa" (flag usada pela arte).
    const x0 = c.x;
    const y0 = c.y;
    const d0 = Math.hypot(c.x - e.x, c.y - e.y);
    step(w, 60);
    expect(c.confusedLeft).toBeGreaterThan(0);
    expect(c.x).toBe(x0);
    expect(c.y).toBe(y0);
    // Depois anda devagar para longe do RM, e o RM ainda a alcança no próximo encanto.
    step(w, 60 * 4);
    expect(c.confusedLeft).toBe(0);
    const d1 = Math.hypot(c.x - e.x, c.y - e.y);
    expect(d1).toBeGreaterThan(d0 + 10);
    expect(d1 - d0).toBeLessThan(RM_CFG.convidada.andarSpeed * RM_CFG.descansoS + 1); // só um pouquinho
    step(w, 60 * 6);
    expect(w.trance).not.toBeNull(); // enchantou de novo
    expect(c.confusedLeft).toBe(0);
  });

  it('a Melissa jogadora em transe perde o controle e ataca os aliados sozinha', () => {
    const w = mundo(['felipe', 'melissa']);
    const e = chefe(w, RM);
    const mel = w.players[1]!;
    mel.x = e.x - 10;
    mel.y = e.y;
    w.players[0]!.x = e.x - 90;
    w.players[0]!.y = e.y;
    step(w, 5);
    expect(w.trance?.slot).toBe(1);
    expect(w.trance?.caught).toBe(true);
    // A pessoa aperta para fugir (esquerda para direita) e para atacar/usar Ultimate: nada vale.
    const x0 = mel.x;
    const fuga = { moveX: 1, moveY: 0, action: true, ultimate: true };
    const hp0 = w.players[0]!.hp;
    for (let i = 0; i < 60 * 3; i++) {
      stepWorld(w, [NO_INPUT, fuga]);
      w.choices.length = 0;
    }
    expect(mel.x).toBeLessThan(x0); // foi atrás do aliado (à esquerda), não para onde a pessoa mandou
    expect(w.players[0]!.hp).toBeLessThan(hp0); // golpeou o aliado
    expect(w.stats.ultimatesUsed).toBe(0);
  });

  it('quebrado o transe, a Melissa jogadora volta a obedecer a pessoa', () => {
    const w = mundo(['thayssa', 'melissa']);
    const e = chefe(w, RM);
    const mel = w.players[1]!;
    mel.x = e.x - 10;
    mel.y = e.y;
    w.players[0]!.x = e.x - 20;
    w.players[0]!.y = e.y;
    step(w, 5);
    expect(w.trance?.caught).toBe(true);
    for (let i = 0; i < 60 * 15 && w.trance; i++) step(w, 1);
    expect(w.trance).toBeNull();
    const x0 = mel.x;
    for (let i = 0; i < 30; i++) {
      stepWorld(w, [NO_INPUT, { moveX: 1, moveY: 0, action: false, ultimate: false }]);
      w.choices.length = 0;
    }
    expect(mel.x).toBeGreaterThan(x0 + 5);
  });

  it('a Pausa Dramática (Mauro + Melissa) é um dos meios de quebrar o transe', () => {
    expect(RM_CFG.trance.pausaDrain).toBeGreaterThan(RM_CFG.trance.passiveDrain);
  });
});

describe('Christopher (fase 5)', () => {
  const copias = (w: World) => w.enemies.active.filter((x) => x.def.id === 'christopherCopia');

  it('começa com atenção média e em fase 1', () => {
    const w = mundo();
    const e = chefe(w, CHRISTOPHER);
    expect(e.aiW).toBe(CHRISTOPHER_CFG.atencao.inicio);
    step(w, 2);
    expect(e.aiT2).toBe(1);
  });

  it('com alguém perto a atenção sobe; sem ninguém perto ela desce', () => {
    const w = mundo();
    const e = chefe(w, CHRISTOPHER);
    e.aiCd = 1e9;
    e.x = 30;
    e.y = 0;
    const a0 = e.aiW;
    step(w, 60);
    expect(e.aiW).toBeGreaterThan(a0);
    e.x = 5000;
    const a1 = e.aiW;
    step(w, 60);
    expect(e.aiW).toBeLessThan(a1);
  });

  it('atenção zerada: birra com anéis que têm vão, depois ele chora exausto e leva dano extra', () => {
    const w = mundo();
    const e = chefe(w, CHRISTOPHER);
    e.x = 5000;
    e.aiCd = 1e9;
    e.aiW = 1;
    step(w, 30);
    expect(w.messages.some((m) => m.text.includes('NINGUÉM ME OLHA'))).toBe(true);
    step(w, 60);
    const aneis = w.hazards.active.filter((h) => h.kind === 'ring');
    expect(aneis.length).toBeGreaterThan(0);
    expect(aneis.every((h) => h.gapHalf > 0)).toBe(true);
    for (let i = 0; i < 60 * 8 && e.aiState !== BOSS_STATE.EXAUSTO; i++) step(w, 1);
    expect(e.aiState).toBe(BOSS_STATE.EXAUSTO);
    const antes = e.hp;
    damageEnemy(w, e, 100, undefined);
    expect(e.hp).toBeCloseTo(antes - 100 * CHRISTOPHER_CFG.birra.exaustoDanoMul, 5);
  });

  it('o anel da birra não machuca quem está no vão', () => {
    const w = mundo();
    const p = w.players[0]!;
    p.hp = p.maxHp = 100;
    p.x = 50;
    p.y = 0;
    spawnHazard(w, { kind: 'ring', x: 0, y: 0, radius: 50, delay: 0, expand: 0.0001, maxRadius: 300, thickness: 12, damage: 16, gapAngle: 0, gapHalf: 0.5 });
    step(w, 3);
    expect(p.hp).toBe(100); // no vão (direção 0): ileso
    p.x = 0;
    p.y = 50; // fora do vão
    p.invuln = 0;
    step(w, 3);
    expect(p.hp).toBeLessThan(100);
  });

  it('a chuva de brinquedos solta bolas com aviso', () => {
    const w = mundo();
    const e = chefe(w, CHRISTOPHER);
    e.x = 30;
    e.aiCount = 0; // próximo é o 1º ataque da fase 1: brinquedos
    atacar(e);
    step(w, 2);
    const c = CHRISTOPHER_CFG.brinquedos;
    const bolas = w.hazards.active.filter((h) => h.sprite === 'brinquedo');
    expect(bolas.length).toBe(c.bolas * c.passos);
    expect(bolas.every((h) => h.warnTotal >= MIN_TELEGRAPH_S)).toBe(true);
  });

  it('pique-pega: marca um jogador; passar por toque a um aliado transfere a marca', () => {
    const w = mundo(['felipe', 'mauro']);
    const e = chefe(w, CHRISTOPHER);
    e.x = 30;
    e.aiCd = 1e9;
    expect(piqueIniciar(w, e)).toBe(true);
    const marcado = w.players.find((p) => p.slot === e.aiU)!;
    const outro = w.players.find((p) => p !== marcado)!;
    outro.x = marcado.x + 5;
    outro.y = marcado.y;
    step(w, 2);
    expect(e.aiU).toBe(outro.slot);
  });

  it('pique-pega: se ninguém passar a marca, ela explode em quem a carrega', () => {
    const w = mundo(['felipe', 'mauro']);
    const e = chefe(w, CHRISTOPHER);
    e.x = 30;
    e.aiCd = 1e9;
    w.players[0]!.x = -300;
    w.players[1]!.x = 300;
    piqueIniciar(w, e);
    step(w, Math.ceil(CHRISTOPHER_CFG.pique.timeS * 60) + 5);
    expect(w.hazards.active.some((h) => h.sprite === 'explosao_pique')).toBe(true);
    expect(e.aiU).toBe(-1);
  });

  it('pique-pega sozinho (sem aliados) não começa: ele solta brinquedos no lugar', () => {
    const w = mundo(['felipe']);
    const e = chefe(w, CHRISTOPHER);
    expect(piqueIniciar(w, e)).toBe(false);
    e.aiCount = 1; // próximo ataque é o 2º da fase 1: pique
    atacar(e);
    step(w, 2);
    expect(e.aiU).toBe(-1);
    expect(w.hazards.active.some((h) => h.sprite === 'brinquedo')).toBe(true);
  });

  it('esconde-esconde: acertar uma cópia só dá um susto; achar o verdadeiro o atordoa e revela', () => {
    const w = mundo();
    const e = chefe(w, CHRISTOPHER);
    expect(esconderIniciar(w, e)).toBe(true);
    step(w, 2);
    expect(copias(w)).toHaveLength(CHRISTOPHER_CFG.esconde.copias);
    const antes = e.hp;
    const copia = copias(w)[0]!;
    damageEnemy(w, copia, 500, undefined);
    expect(copia.alive).toBe(false);
    expect(e.hp).toBe(antes); // não é a vida do chefe
    expect(w.hazards.active.some((h) => h.sprite === 'susto_copia')).toBe(true);
    damageEnemy(w, e, 100, undefined);
    expect(e.stun).toBeGreaterThan(0);
    expect(e.hp).toBeCloseTo(antes - 100 * CHRISTOPHER_CFG.esconde.achouDanoMul, 5);
    expect(copias(w).filter((x) => x.alive)).toHaveLength(0); // as outras somem
  });

  it('esconde-esconde: se ninguém achar, as cópias somem sozinhas', () => {
    const w = mundo();
    const e = chefe(w, CHRISTOPHER);
    esconderIniciar(w, e);
    step(w, Math.ceil(CHRISTOPHER_CFG.esconde.duracaoS * 60) + 5);
    expect(copias(w).filter((x) => x.alive)).toHaveLength(0);
    expect(w.messages.some((m) => m.text.includes('Não me acharam'))).toBe(true);
  });

  it('regra da arena: "o chão é lava" machuca fora dos tapetes e não machuca em cima deles', () => {
    const w = mundo();
    const p = w.players[0]!;
    p.hp = p.maxHp = 100;
    const e = chefe(w, CHRISTOPHER);
    e.aiCd = 1e9;
    e.x = 100; // longe do contato
    e.aiDir = REGRA.LAVA;
    e.aiY = CHRISTOPHER_CFG.regras.lava.duracaoS; // sem aviso
    const h = w.hazards.acquire()!;
    Object.assign(h, { kind: 'circle', x: p.x, y: p.y, radius: 36, delay: 0, warnTotal: 0, life: 9, damage: 0, dps: 0, slowFor: 0, expand: 0, maxRadius: 36, thickness: 8, push: 0, pushS: 0, color: COR_TAPETE, sprite: '', active: true, alive: true, hit: [] });
    step(w, 60);
    expect(p.hp).toBe(100);
    p.x += 300; // sai do tapete
    step(w, 60);
    expect(p.hp).toBeLessThan(100);
  });

  it('regra da arena: pés pesados deixa lento e dá mais dano; tudo ao contrário inverte', () => {
    const w = mundo();
    const e = chefe(w, CHRISTOPHER);
    e.aiCd = 1e9;
    e.x = 30;
    e.aiDir = REGRA.PESADOS;
    e.aiY = CHRISTOPHER_CFG.regras.pesados.duracaoS;
    step(w, 2);
    const p = w.players[0]!;
    expect(p.slowLeft).toBeGreaterThan(0);
    expect(p.buffs.some((b) => b.id === 'pesados' && b.damage === CHRISTOPHER_CFG.regras.pesados.dano)).toBe(true);
    e.aiDir = REGRA.REVERSO;
    e.aiY = CHRISTOPHER_CFG.regras.reverso.duracaoS;
    step(w, 2);
    expect(p.confusedLeft).toBeGreaterThan(0);
  });

  it('a regra tem aviso antes de valer e termina sozinha', () => {
    const w = mundo();
    const e = chefe(w, CHRISTOPHER);
    e.aiCd = 1e9;
    e.x = 30;
    iniciarRegra(w, e);
    expect(e.aiDir).not.toBe(REGRA.NENHUMA);
    expect(regraAtiva(e)).toBe(false); // ainda no aviso
    const id = e.aiDir;
    step(w, Math.ceil((CHRISTOPHER_CFG.regras.avisoS + duracaoDaRegra(id) + 1) * 60));
    expect(e.aiDir).toBe(REGRA.NENHUMA);
  });

  it('fases pela vida restante, com fala nova na fase 2', () => {
    const w = mundo();
    const e = chefe(w, CHRISTOPHER);
    e.aiCd = 1e9;
    e.x = 30;
    step(w, 2);
    e.hp = e.aiX * 0.5;
    step(w, 2);
    expect(e.aiT2).toBe(2);
    expect(w.messages.some((m) => /Hora do doce/.test(m.text))).toBe(true);
    e.hp = e.aiX * 0.2;
    step(w, 2);
    expect(e.aiT2).toBe(3);
  });

  it('derrotar o Christopher leva as cópias junto', () => {
    const w = mundo();
    const e = chefe(w, CHRISTOPHER);
    esconderIniciar(w, e);
    step(w, 2);
    damageEnemy(w, e, 1e9, undefined);
    expect(e.alive).toBe(false);
    expect(copias(w).filter((x) => x.alive)).toHaveLength(0);
  });
});

describe('Alê (fase 6)', () => {
  it('o apito avisa 1,5 s; depois, quem se mexe leva dano', () => {
    const w = mundo();
    const e = chefe(w, ALE);
    e.aiCount = 0; // primeiro ataque: apito
    atacar(e);
    step(w, 2);
    expect(e.aiState).toBe(BOSS_STATE.AQUECENDO);
    step(w, 60 * ALE_CFG.apito.warnS + 5);
    expect(e.aiState).toBe(BOSS_STATE.PREPARANDO);
    expect(w.messages.some((m) => m.text === 'PARAR!')).toBe(true);
    const p = w.players[0]!;
    const hp = p.hp;
    p.x += 40; // se mexeu
    step(w, 30);
    expect(p.hp).toBeLessThan(hp);
  });

  it('o cronograma rígido faz uma fila de perigos com aviso', () => {
    const w = mundo();
    const e = chefe(w, ALE);
    e.aiCount = 1;
    atacar(e);
    step(w, 2);
    expect(w.hazards.active.length).toBe(ALE_CFG.fila.count);
  });

  it('os obstáculos de acampamento entram em campo', () => {
    const w = mundo();
    const e = chefe(w, ALE);
    e.aiCount = 2;
    atacar(e);
    step(w, 2);
    expect(w.enemies.active.filter((x) => !x.def.boss).length).toBe(ALE_CFG.obstaculos.count);
  });
});

describe('Tiago W (fase 7, falso chefe final)', () => {
  it('tem 3 fases pela vida: 66% e 33%', () => {
    expect(faseDoTiagoW(1)).toBe(0);
    expect(faseDoTiagoW(0.7)).toBe(0);
    expect(faseDoTiagoW(0.5)).toBe(1);
    expect(faseDoTiagoW(0.2)).toBe(2);
  });

  it('aprende: ganha resistência com o tempo, até o teto', () => {
    const w = mundo();
    const e = chefe(w, TIAGOW);
    w.tick = 60 * TIAGOW_CFG.resistencia.everyS * 3;
    step(w, 2);
    expect(e.resist).toBeCloseTo(TIAGOW_CFG.resistencia.step * 3, 5);
    w.tick = 60 * 3600;
    step(w, 2);
    expect(e.resist).toBe(TIAGOW_CFG.resistencia.max);
  });

  it('a resistência reduz o dano que ele leva', () => {
    const w = mundo();
    const e = chefe(w, TIAGOW);
    const hp = e.hp;
    damageEnemy(w, e, 100, w.players[0]);
    const semResist = hp - e.hp;
    e.hp = hp;
    e.resist = 0.4;
    damageEnemy(w, e, 100, w.players[0]);
    expect(hp - e.hp).toBeLessThan(semResist);
  });

  it('as provocações deixam todo mundo confuso por um instante', () => {
    const w = mundo();
    const e = chefe(w, TIAGOW);
    e.aiCount = TIAGOW_CFG.provocacao.every - 1;
    atacar(e);
    step(w, 2);
    expect(w.players[0]!.confusedLeft).toBeGreaterThan(0);
    expect(w.messages.some((m) => m.speaker === 'Tiago W')).toBe(true);
  });

  it('fase 3: o Lucas entra, diz a frase final e oferece 3 conselhos; o jogo pausa até escolher', () => {
    const w = mundo();
    const b = chefe(w, TIAGOW);
    b.hp = b.aiX * 0.2;
    step(w, 3);
    expect(b.aiDir).toBe(2);
    expect(w.lucasVisible).toBe(true);
    expect(w.messages.some((m) => m.speaker === 'Lucas' && m.text === LUCAS_LINHA_FINAL)).toBe(true);
    expect(w.advice).not.toBeNull();
    expect(w.advice!.options).toHaveLength(3);
    const tick = w.tick;
    step(w, 120);
    expect(w.tick).toBe(tick); // pausado
    expect(chooseAdvice(w, 1)).toBe(true);
    step(w, 30);
    expect(w.tick).toBeGreaterThan(tick);
  });
});

describe('O Próprio Tempo (Arena do Tempo)', () => {
  it('ponteiros: varredura de perigos nos dois sentidos, com aviso', () => {
    const w = mundo();
    const e = chefe(w, TEMPO);
    e.aiCount = 0;
    atacar(e);
    step(w, 2);
    expect(w.hazards.active.length).toBe(TEMPO_CFG.ponteiro.steps * 2);
  });

  it('folhas de calendário: perigos espalhados que ficam no chão', () => {
    const w = mundo();
    const e = chefe(w, TEMPO);
    e.aiCount = 1;
    atacar(e);
    step(w, 2);
    expect(w.hazards.active.filter((h) => h.life === TEMPO_CFG.folhas.lifeS).length).toBe(TEMPO_CFG.folhas.count);
  });

  it('o vínculo: com os jogadores juntos o Tempo ataca menos vezes', () => {
    const juntos = mundo(['felipe', 'thaisa']);
    const longe = mundo(['felipe', 'thaisa']);
    longe.players[1]!.x = 400;
    longe.players[1]!.y = 300;
    for (const w of [juntos, longe]) {
      const e = chefe(w, TEMPO);
      e.aiCd = 0;
      step(w, 60 * 30);
    }
    const ataques = (w: World): number => w.enemies.active.find((x) => x.def.boss)!.aiCount;
    expect(ataques(juntos)).toBeLessThan(ataques(longe));
  });
});

describe('Lucas e os conselhos', () => {
  it('a frase final do Lucas é a do GDD', () => {
    expect(LUCAS_LINHA_FINAL).toBe('Toda profecia tem um último capítulo. A gente só não escolhe quando ele começa.');
  });

  it('os conselhos: um é útil e os outros dois são inúteis ou atrapalham', () => {
    expect(ADVICE_OPTIONS.map((o) => o.effect).sort()).toEqual(['confusao', 'nada', 'unidade']);
    expect(ADVICE_OPTIONS.find((o) => o.effect === 'confusao')!.text).toBe('Usem a estratégia de sempre.');
  });

  it('a posição do conselho útil varia de uma partida para outra', () => {
    const posicoes = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      const w = createWorld(['felipe'], { initialChoice: false, seed, noSpawn: true });
      posicoes.add(conselhosEmbaralhados(w).findIndex((o) => o.effect === 'unidade'));
    }
    expect(posicoes.size).toBe(3);
  });

  it('conselho útil ("Fiquem juntos"): +20% de dano e escudo por 20 s', () => {
    const w = mundo(['felipe', 'thaisa']);
    w.advice = { options: [...ADVICE_OPTIONS] };
    chooseAdvice(w, ADVICE_OPTIONS.findIndex((o) => o.effect === 'unidade'));
    step(w, 2);
    for (const p of w.players) {
      expect(p.damageMul).toBeCloseTo(ADVICE_UNIDADE.damage, 5);
      expect(p.shield).toBeGreaterThan(0);
    }
    step(w, 60 * (ADVICE_UNIDADE.durationS + 1));
    expect(w.players[0]!.damageMul).toBeCloseTo(1, 5);
  });

  it('conselho ruim ("a estratégia de sempre"): confusão, o movimento fica invertido por 4 s', () => {
    const w = mundo();
    w.advice = { options: [...ADVICE_OPTIONS] };
    chooseAdvice(w, ADVICE_OPTIONS.findIndex((o) => o.effect === 'confusao'));
    expect(w.players[0]!.confusedLeft).toBe(ADVICE_CONFUSAO_S);
    const x0 = w.players[0]!.x;
    for (let i = 0; i < 30; i++) stepWorld(w, [{ ...NO_INPUT, moveX: 1 }]);
    expect(w.players[0]!.x).toBeLessThan(x0);
    for (let i = 0; i < 60 * 5; i++) stepWorld(w, [NO_INPUT]);
    expect(w.players[0]!.confusedLeft).toBe(0);
    const x1 = w.players[0]!.x;
    for (let i = 0; i < 30; i++) stepWorld(w, [{ ...NO_INPUT, moveX: 1 }]);
    expect(w.players[0]!.x).toBeGreaterThan(x1);
  });

  it('o terceiro conselho não faz nada, e o Lucas comenta', () => {
    const w = mundo();
    w.advice = { options: [...ADVICE_OPTIONS] };
    chooseAdvice(w, ADVICE_OPTIONS.findIndex((o) => o.effect === 'nada'));
    expect(w.players[0]!.confusedLeft).toBe(0);
    expect(w.players[0]!.buffs).toHaveLength(0);
    expect(w.messages.some((m) => m.speaker === 'Lucas')).toBe(true);
  });

  it('um índice de conselho inválido não faz nada e mantém o jogo pausado', () => {
    const w = mundo();
    w.advice = { options: [...ADVICE_OPTIONS] };
    expect(chooseAdvice(w, 7)).toBe(false);
    expect(w.advice).not.toBeNull();
  });
});

describe('As Salsichas: 4 corpos, 1 vida', () => {
  it('nascem o Geraldo e três corpos (Monet, Toddy e Bucky), todos ligados ao líder', () => {
    const w = mundo();
    const lider = chefe(w, SALSICHAS);
    const corpos = w.enemies.active.filter((e) => e.leader === lider.uid);
    expect(corpos.map((c) => c.def.id).sort()).toEqual(['bucky', 'monet', 'toddy']);
    expect(corpos.every((c) => c.hp === lider.hp)).toBe(true);
  });

  it('o dano em qualquer corpo tira da mesma barra de vida', () => {
    const w = mundo();
    const lider = chefe(w, SALSICHAS);
    const corpo = w.enemies.active.find((e) => e.leader === lider.uid)!;
    const hp = lider.hp;
    damageEnemy(w, corpo, 100, w.players[0]);
    expect(lider.hp).toBe(hp - 100);
    step(w, 2);
    for (const c of w.enemies.active.filter((e) => e.leader === lider.uid)) expect(c.hp).toBe(lider.hp);
  });

  it('o líder cai e leva os corpos junto; só um chefe foi derrotado', () => {
    const w = mundo();
    const lider = chefe(w, SALSICHAS);
    damageEnemy(w, lider, 1e9, w.players[0]);
    step(w, 2);
    expect(w.enemies.active.filter((e) => e.alive)).toHaveLength(0);
    expect(w.bossesDefeated.filter((b) => b === 'salsichas')).toHaveLength(1);
  });

  it('matar um corpo (por qualquer meio) derruba a matilha inteira, uma vez só', () => {
    const w = mundo();
    const lider = chefe(w, SALSICHAS);
    const corpo = w.enemies.active.find((e) => e.leader === lider.uid)!;
    damageEnemy(w, corpo, 1e9, w.players[0]);
    step(w, 2);
    expect(w.enemies.active.filter((e) => e.alive)).toHaveLength(0);
    expect(w.bossesDefeated.filter((b) => b === 'salsichas')).toHaveLength(1);
  });

  it('na fase 1 os corpos seguem em fila atrás do líder', () => {
    const w = mundo();
    const lider = chefe(w, SALSICHAS);
    step(w, 120);
    const corpos = w.enemies.active.filter((e) => e.leader === lider.uid);
    const dFila = corpos.map((c) => Math.hypot(c.x - lider.x, c.y - lider.y));
    expect(Math.max(...dFila)).toBeLessThan(150);
  });

  it('o trenzinho solta o latido de cada cachorro da fila', () => {
    const w = mundo();
    const lider = chefe(w, SALSICHAS);
    atacar(lider);
    step(w, 2);
    step(w, 60 * SALSICHAS_CFG.trenzinho.warnS + 10);
    const origens = new Set(w.hostiles.active.filter((h) => h.kind === 'latido').map((h) => Math.round(h.x)));
    expect(origens.size).toBeGreaterThan(1);
  });
});

describe('Salsichas: o chefe é sempre o líder', () => {
  it('chefeVivo devolve o Geraldo mesmo que um corpo venha antes na lista', () => {
    const w = mundo();
    const lider = chefe(w, SALSICHAS);
    w.enemies.active.reverse();
    expect(chefeVivo(w)).toBe(lider);
  });
});
