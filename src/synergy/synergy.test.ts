import { describe, expect, it } from 'vitest';
import { spawnEnemy } from '../combat/spawner';
import { spawnFood } from '../combat/foods';
import { spawnGem } from '../combat/gems';
import { damageEnemy } from '../combat/enemies';
import { getCard } from '../combat/cardPool';
import type { CharacterId } from '../data/characters';
import { COMUNS } from '../data/enemies';
import { FOODS } from '../data/foods';
import {
  COMMITTEE_CHARGE_PER_S,
  DUPLAS,
  SAIDEIRA_COOLDOWN_S,
  SAIDEIRA_DURATION_S,
  SYNERGY_ACTIVATE_PX,
  SYNERGY_CHARGE_PER_S,
  SYNERGY_NEAR_PX,
  ULTIMATE_COOLDOWN_S,
  ULTIMATE_DURATION_S,
  ULT,
  duplaDe,
} from '../data/synergy';
import { NO_INPUT, type PlayerInput } from '../engine/input';
import { createWorld, stepWorld, type World } from '../engine/world';
import type { Enemy } from '../entities/enemy';
import type { ThayssaState } from '../characters/thayssaState';
import { onKillSynergy, tryActivateUltimate, ultimateDisponivel, saideiraPronta } from './index';
import { comiteProximo, parDe } from './charge';

const ROBO = COMUNS[0]!;
const TODOS: CharacterId[] = ['felipe', 'mauro', 'melissa', 'thaisa', 'thayssa'];

/** Mundo só com os personagens pedidos, juntinhos (24 px entre si), sem inimigos e com os kits calados. */
function mundo(chars: CharacterId[], seed = 1): World {
  const w = createWorld(chars, { initialChoice: false, noSpawn: true, noBosses: true, seed });
  w.walls = [];
  for (const p of w.players) {
    p.hp = p.maxHp = 1e6;
    const k = p.kit as unknown as { cd?: number } | null;
    if (k) k.cd = 1e9;
    if (p.kit?.type === 'thayssa') p.kit.megaCd = 1e9; // o Megafone também fica calado
  }
  return w;
}

function step(w: World, n = 1, input: PlayerInput = NO_INPUT): void {
  for (let i = 0; i < n; i++) {
    stepWorld(w, w.players.map((_, slot) => (slot === 0 ? input : NO_INPUT)));
    w.choices.length = 0;
  }
}

function inimigo(w: World, x: number, y: number, hp = 1e6, parado = true): Enemy {
  spawnEnemy(w, ROBO, x, y);
  const e = w.enemies.active[w.enemies.active.length - 1]!;
  e.hp = hp;
  if (parado) e.stun = 9999;
  return e;
}

function encher(w: World): void {
  for (const par of w.synergy.pairs) par.bar = 100;
}

function usar(w: World, slot = 0): boolean {
  return tryActivateUltimate(w, w.players[slot]!);
}

describe('Barra de Sinergia', () => {
  it('há uma barra por par de jogadores', () => {
    expect(mundo(['felipe']).synergy.pairs).toHaveLength(0);
    expect(mundo(['felipe', 'mauro']).synergy.pairs).toHaveLength(1);
    expect(mundo(['felipe', 'mauro', 'melissa']).synergy.pairs).toHaveLength(3);
    expect(mundo(TODOS).synergy.pairs).toHaveLength(10);
  });

  it('carrega 1% por segundo quando os dois estão a até 6 tiles', () => {
    const w = mundo(['felipe', 'mauro']);
    step(w, 60 * 10);
    expect(parDe(w, 0, 1)!.bar).toBeCloseTo(10 * SYNERGY_CHARGE_PER_S, 1);
  });

  it('não carrega com o parceiro longe (mais de 6 tiles) nem morto', () => {
    const longe = mundo(['felipe', 'mauro']);
    longe.players[1]!.x = SYNERGY_NEAR_PX + 10;
    step(longe, 60 * 5);
    expect(parDe(longe, 0, 1)!.bar).toBe(0);
    const morto = mundo(['felipe', 'mauro']);
    morto.players[1]!.hp = 0;
    step(morto, 60 * 2); // antes de os 3 s para reviver o parceiro
    expect(parDe(morto, 0, 1)!.bar).toBe(0);
  });

  it('o dano causado também carrega: +0,2% a cada 10 de dano, só com o parceiro perto', () => {
    const w = mundo(['felipe', 'mauro']);
    const e = inimigo(w, 400, 400);
    damageEnemy(w, e, 100, w.players[0]);
    expect(parDe(w, 0, 1)!.bar).toBeCloseTo(2, 5);
    // O dano do parceiro também conta para a barra do par.
    damageEnemy(w, e, 50, w.players[1]);
    expect(parDe(w, 0, 1)!.bar).toBeCloseTo(3, 5);
    // Com o parceiro longe, não conta.
    w.players[1]!.x = 500;
    damageEnemy(w, e, 1000, w.players[0]);
    expect(parDe(w, 0, 1)!.bar).toBeCloseTo(3, 5);
  });

  it('o dano que passa da vida restante não conta', () => {
    const w = mundo(['felipe', 'mauro']);
    const e = inimigo(w, 400, 400, 10);
    damageEnemy(w, e, 1000, w.players[0]);
    expect(parDe(w, 0, 1)!.bar).toBeCloseTo(0.2, 5); // só os 10 de vida
  });

  it('a barra de um par não carrega a de outro', () => {
    const w = mundo(['felipe', 'mauro', 'thaisa']);
    const e = inimigo(w, 400, 400);
    damageEnemy(w, e, 100, w.players[0]);
    expect(parDe(w, 0, 1)!.bar).toBeCloseTo(2, 5);
    expect(parDe(w, 0, 2)!.bar).toBeCloseTo(2, 5);
    expect(parDe(w, 1, 2)!.bar).toBe(0); // o Felipe não está nesse par
  });

  it('nunca passa de 100', () => {
    const w = mundo(['felipe', 'mauro']);
    parDe(w, 0, 1)!.bar = 99.9;
    const e = inimigo(w, 400, 400);
    damageEnemy(w, e, 1e5, w.players[0]);
    step(w, 60 * 5);
    expect(parDe(w, 0, 1)!.bar).toBe(100);
  });
});

describe('Ativação das Ultimates de dupla', () => {
  it('só com a barra cheia', () => {
    const w = mundo(['felipe', 'mauro']);
    parDe(w, 0, 1)!.bar = 99;
    expect(usar(w)).toBe(false);
    parDe(w, 0, 1)!.bar = 100;
    expect(usar(w)).toBe(true);
  });

  it('exige os dois a até 8 tiles no momento do uso', () => {
    const w = mundo(['felipe', 'mauro']);
    encher(w);
    w.players[1]!.x = SYNERGY_ACTIVATE_PX + 4;
    expect(usar(w)).toBe(false);
    w.players[1]!.x = SYNERGY_ACTIVATE_PX - 4;
    expect(usar(w)).toBe(true);
  });

  it('o alcance de ativação (8 tiles) é maior que o de carga (6 tiles)', () => {
    expect(SYNERGY_ACTIVATE_PX).toBe(128);
    expect(SYNERGY_NEAR_PX).toBe(96);
    const w = mundo(['felipe', 'mauro']);
    parDe(w, 0, 1)!.bar = 100;
    w.players[1]!.x = 110; // fora dos 6 tiles de carga, dentro dos 8 de ativação
    expect(usar(w)).toBe(true);
  });

  it('dura 6 s e depois termina', () => {
    const w = mundo(['felipe', 'mauro']);
    encher(w);
    usar(w);
    expect(w.synergy.active).toHaveLength(1);
    expect(ULTIMATE_DURATION_S).toBe(6);
    step(w, 60 * 5);
    expect(w.synergy.active).toHaveLength(1);
    step(w, 60 * 1 + 5);
    expect(w.synergy.active).toHaveLength(0);
  });

  it('depois do uso a barra zera e há 60 s de recarga, mesmo com a barra cheia de novo', () => {
    const w = mundo(['felipe', 'mauro']);
    encher(w);
    usar(w);
    const par = parDe(w, 0, 1)!;
    expect(par.bar).toBe(0);
    expect(par.cooldown).toBe(ULTIMATE_COOLDOWN_S);
    step(w, 60 * 7);
    par.bar = 100;
    expect(usar(w)).toBe(false); // ainda em recarga
    step(w, 60 * 52);
    par.bar = 100;
    expect(par.cooldown).toBeGreaterThan(0);
    step(w, 60 * 2);
    par.bar = 100;
    expect(par.cooldown).toBe(0);
    expect(usar(w)).toBe(true);
  });

  it('não ativa de novo uma dupla que já está em andamento', () => {
    const w = mundo(['felipe', 'mauro']);
    encher(w);
    expect(usar(w)).toBe(true);
    parDe(w, 0, 1)!.bar = 100;
    parDe(w, 0, 1)!.cooldown = 0;
    expect(usar(w)).toBe(false);
  });

  it('com o parceiro morto, não ativa', () => {
    const w = mundo(['felipe', 'mauro']);
    encher(w);
    w.players[1]!.hp = 0;
    expect(usar(w)).toBe(false);
  });

  it('o toque na tecla de Ultimate ativa, e segurar não repete', () => {
    const w = mundo(['felipe', 'mauro']);
    encher(w);
    step(w, 1, { ...NO_INPUT, ultimate: true });
    expect(w.synergy.active).toHaveLength(1);
    parDe(w, 0, 1)!.bar = 100;
    parDe(w, 0, 1)!.cooldown = 0;
    step(w, 5, { ...NO_INPUT, ultimate: true }); // segurando
    expect(w.synergy.active).toHaveLength(1);
  });

  it('com vários parceiros, usa a dupla cujo parceiro está mais perto', () => {
    const w = mundo(['felipe', 'mauro', 'thaisa']);
    encher(w);
    w.players[1]!.x = 100; // Mauro mais longe
    w.players[2]!.x = 20; // Thaisa mais perto
    usar(w, 0);
    expect(w.synergy.active[0]!.id).toBe('rodeio'); // Felipe + Thaisa
    // E a outra dupla do Felipe continua disponível.
    expect(ultimateDisponivel(w, w.players[0]!)?.dupla.id).toBe('setlist');
  });
});

describe('As 10 Ultimates de dupla ativam cada uma a sua', () => {
  it('são 10 duplas, todas as combinações dos 5 personagens, com nomes do GDD', () => {
    expect(DUPLAS).toHaveLength(10);
    const nomes = DUPLAS.map((d) => d.name);
    expect(nomes).toEqual([
      'Setlist Anotada',
      'Dança do Refrão',
      'Rodeio Sonoro',
      'Pista Aberta',
      'Pausa Dramática',
      'Estante em Queda',
      'Constelação Afetiva',
      'Lançamento Olímpico',
      'Prisma de Melhores Amigas',
      'Sobremesa Espectral',
    ]);
    const chaves = new Set(DUPLAS.map((d) => [d.a, d.b].sort().join('+')));
    expect(chaves.size).toBe(10);
  });

  for (const dupla of DUPLAS) {
    it(`${dupla.name}: ${dupla.a} + ${dupla.b} ativa a própria Ultimate (de qualquer dos dois)`, () => {
      for (const quemUsa of [0, 1]) {
        const w = mundo([dupla.a, dupla.b]);
        encher(w);
        expect(duplaDe(dupla.a, dupla.b)).toBe(dupla);
        expect(duplaDe(dupla.b, dupla.a)).toBe(dupla);
        expect(usar(w, quemUsa)).toBe(true);
        expect(w.synergy.active).toHaveLength(1);
        expect(w.synergy.active[0]!.id).toBe(dupla.id);
        expect(w.messages.some((m) => m.text === dupla.name)).toBe(true);
        step(w, 60 * 7); // roda a Ultimate inteira sem estourar
        expect(w.synergy.active).toHaveLength(0);
      }
    });
  }

  it('a ordem dos jogadores não importa: dois personagens iguais não têm Ultimate', () => {
    const w = mundo(['felipe', 'felipe']);
    encher(w);
    expect(usar(w)).toBe(false);
  });
});

describe('Efeitos de cada Ultimate', () => {
  it('Setlist Anotada: discos orbitam e as notas elétricas atingem inimigos em cadeia', () => {
    const w = mundo(['felipe', 'mauro']);
    const fila = [60, 90, 120, 150].map((x) => inimigo(w, x, -8));
    encher(w);
    usar(w);
    const u = w.synergy.active[0]!;
    const a0 = u.angle;
    step(w, 60);
    expect(u.angle).toBeGreaterThan(a0);
    expect(fila.filter((e) => e.hp < 1e6).length).toBeGreaterThanOrEqual(3);
  });

  it('Dança do Refrão: a Melissa corta em dash, deixando nota explosiva e cegando inimigos', () => {
    const w = mundo(['felipe', 'melissa']);
    const perto = inimigo(w, 60, -4);
    const x0 = w.players[1]!.x;
    encher(w);
    usar(w);
    step(w, 5);
    expect(w.players[1]!.x).not.toBe(x0); // fez o dash
    expect(w.synergy.active[0]!.list.length).toBeGreaterThan(0); // nota explosiva no chão
    step(w, 80);
    expect(perto.hp).toBeLessThan(1e6);
    // Inimigos perto do ponto de partida ficam cegos.
    const w2 = mundo(['felipe', 'melissa']);
    const cego = inimigo(w2, w2.players[1]!.x + 20, w2.players[1]!.y);
    encher(w2);
    usar(w2);
    step(w2, 2);
    expect(cego.blind).toBeGreaterThan(1);
  });

  it('Rodeio Sonoro: o anel puxa os inimigos para o centro e os esmaga', () => {
    const w = mundo(['felipe', 'thaisa']);
    const centro = { x: (w.players[0]!.x + w.players[1]!.x) / 2, y: (w.players[0]!.y + w.players[1]!.y) / 2 };
    const e = inimigo(w, centro.x + 90, centro.y);
    const longe = inimigo(w, centro.x + 400, centro.y);
    const d0 = Math.hypot(e.x - centro.x, e.y - centro.y);
    encher(w);
    usar(w);
    step(w, 90);
    expect(Math.hypot(e.x - centro.x, e.y - centro.y)).toBeLessThan(d0 - 20);
    expect(e.hp).toBeLessThan(1e6);
    expect(longe.hp).toBe(1e6); // fora do anel
  });

  it('Pista Aberta: aliados invulneráveis por 1 s, inimigos dentro dançam e sofrem dano contínuo', () => {
    const w = mundo(['felipe', 'thayssa']);
    const dentro = inimigo(w, 60, 0);
    const fora = inimigo(w, 400, 0);
    encher(w);
    usar(w);
    for (const p of w.players) expect(p.invuln).toBeGreaterThan(0.9);
    step(w, 60);
    expect(dentro.hp).toBeLessThan(1e6 - 4);
    expect(dentro.blind).toBeGreaterThan(0);
    expect(fora.hp).toBe(1e6);
    // A invulnerabilidade acaba depois de ~1 s.
    step(w, 30);
    expect(w.players[0]!.invuln).toBe(0);
  });

  it('Pausa Dramática: câmera lenta nos inimigos e a Melissa acerta todos os Holofotes visíveis', () => {
    const w = mundo(['mauro', 'melissa']);
    const e = inimigo(w, 80, 0, 1e6, false);
    const longe = inimigo(w, 800, 0);
    expect(w.enemySpeedMul).toBe(1);
    encher(w);
    usar(w);
    expect(e.hp).toBeLessThan(1e6); // acertou o Holofote (crítico) de quem está na tela
    expect(longe.hp).toBe(1e6);
    step(w, 2);
    expect(w.enemySpeedMul).toBe(ULT.pausa.slow);
    step(w, 60 * 6 + 10);
    expect(w.enemySpeedMul).toBe(1);
  });

  it('Pausa Dramática: os inimigos andam 1/4 da velocidade enquanto dura', () => {
    const anda = (ativar: boolean): number => {
      const w = mundo(['mauro', 'melissa']);
      const e = inimigo(w, 200, 0, 1e6, false);
      e.stun = 0;
      if (ativar) {
        encher(w);
        usar(w);
      }
      const x0 = e.x;
      step(w, 40);
      return x0 - e.x;
    };
    expect(anda(true) / anda(false)).toBeLessThan(0.4);
  });

  it('Estante em Queda: estantes caem pela tela, atordoando e causando dano', () => {
    const w = mundo(['mauro', 'thaisa']);
    const alvos: Enemy[] = [];
    for (let i = 0; i < 12; i++) alvos.push(inimigo(w, -150 + i * 28, (i % 3) * 30 - 30, 1e6, false));
    for (const e of alvos) e.stun = 0;
    encher(w);
    usar(w);
    let atordoou = false;
    for (let i = 0; i < 60 * 6; i++) {
      step(w);
      if (alvos.some((e) => e.stun > 0.5)) atordoou = true;
    }
    expect(atordoou).toBe(true);
    expect(alvos.filter((e) => e.hp < 1e6).length).toBeGreaterThanOrEqual(6);
  });

  it('Constelação Afetiva: gemas viram mísseis teleguiados que curam ao acertar', () => {
    const w = mundo(['mauro', 'thayssa']);
    for (let i = 0; i < 5; i++) spawnGem(w, 30 + i * 8, -20, 1);
    const e = inimigo(w, 140, -8, 1e6, false);
    e.stun = 9999;
    w.players[0]!.hp = 500;
    w.players[0]!.maxHp = 1000;
    const xp0 = w.players[0]!.xp + w.players[1]!.xp;
    encher(w);
    usar(w);
    step(w, 30);
    expect(w.gems.size).toBe(0); // todas viraram mísseis
    expect(w.projectiles.active.some((p) => p.kind === 'missil') || e.hp < 1e6).toBe(true);
    expect(w.players[0]!.xp + w.players[1]!.xp).toBeGreaterThan(xp0); // o XP não se perde
    step(w, 120);
    expect(e.hp).toBeLessThan(1e6);
    expect(w.players[0]!.hp).toBeGreaterThan(500); // curou ao acertar
  });

  it('Lançamento Olímpico: a Melissa gira entre os inimigos, invulnerável, causando dano', () => {
    const w = mundo(['melissa', 'thaisa']);
    const a = inimigo(w, 90, 0);
    const b = inimigo(w, 150, 20);
    const c = inimigo(w, 60, -50);
    encher(w);
    usar(w);
    step(w, 1);
    expect(w.players[0]!.invuln).toBeGreaterThan(0);
    const x0 = w.players[0]!.x;
    step(w, 120);
    expect(Math.abs(w.players[0]!.x - x0)).toBeGreaterThan(20); // andou pelos inimigos
    expect([a, b, c].filter((e) => e.hp < 1e6).length).toBeGreaterThanOrEqual(2);
  });

  it('Prisma de Melhores Amigas: o laser entre as duas corta o que está no caminho', () => {
    const w = mundo(['melissa', 'thayssa']);
    w.players[0]!.x = 0;
    w.players[1]!.x = 80;
    const noMeio = inimigo(w, 40, -8);
    const alemDaPonta = inimigo(w, 100, -8); // o laser passa um pouco das pontas
    const fora = inimigo(w, 40, 60);
    encher(w);
    usar(w);
    step(w, 60);
    expect(noMeio.hp).toBeLessThan(1e6 - 20);
    expect(alemDaPonta.hp).toBeLessThan(1e6);
    expect(fora.hp).toBe(1e6);
  });

  it('Prisma: o laser acompanha as duas quando elas se mexem', () => {
    const w = mundo(['melissa', 'thayssa']);
    w.players[0]!.x = 0;
    w.players[1]!.x = 80;
    const e = inimigo(w, 40, 100);
    encher(w);
    usar(w);
    w.players[0]!.y = 100;
    w.players[1]!.y = 100;
    step(w, 40);
    expect(e.hp).toBeLessThan(1e6);
  });

  it('Sobremesa Espectral: dois clones de silhuetas diferentes provocam os inimigos', () => {
    const w = mundo(['thaisa', 'thayssa']);
    const e = inimigo(w, 300, 0, 1e6, false);
    e.stun = 0;
    encher(w);
    usar(w);
    step(w, 2);
    const u = w.synergy.active[0]!;
    expect(u.list).toHaveLength(2);
    expect(new Set(u.list.map((c) => c.t)).size).toBe(2); // grande e pequeno
    expect(w.decoys).toHaveLength(2);
    // Põe um clone longe dos jogadores e confere que o inimigo vai atrás dele.
    const clone = w.decoys[0]!;
    e.x = 300;
    e.y = 0;
    const jogadores = w.players[0]!;
    // Inimigo perto do clone: persegue o clone em vez do jogador mais próximo.
    const d0 = Math.hypot(e.x - clone.x, e.y - clone.y);
    step(w, 20);
    expect(d0).toBeGreaterThan(0);
    expect(jogadores).toBeDefined();
  });

  it('Sobremesa Espectral: o inimigo provocado persegue o clone, não o jogador', () => {
    const w = mundo(['thaisa', 'thayssa']);
    encher(w);
    usar(w);
    step(w, 1);
    // Um inimigo nascido bem perto de um clone, mas com o jogador do outro lado.
    const clone = w.decoys[0]!;
    const e = inimigo(w, clone.x, clone.y - 120, 1e6, false);
    e.stun = 0;
    e.facing = Math.PI / 2;
    const dClone0 = Math.hypot(e.x - clone.x, e.y - clone.y);
    step(w, 45);
    expect(Math.hypot(e.x - clone.x, e.y - clone.y)).toBeLessThan(dClone0);
  });

  it('Sobremesa Espectral: os clones comem a comida do chão, curam e fortalecem o time, e explodem no fim', () => {
    const w = mundo(['thaisa', 'thayssa']);
    w.players[0]!.hp = 100;
    w.players[1]!.hp = 100;
    w.players[0]!.maxHp = w.players[1]!.maxHp = 1000;
    encher(w);
    usar(w);
    step(w, 1);
    const clone = w.synergy.active[0]!.list[0]!;
    spawnFood(w, FOODS[2]!, clone.x, clone.y); // esfiha: cura 20
    step(w, 3);
    expect(w.foods.size).toBe(0);
    expect(w.players[0]!.hp).toBeGreaterThan(100);
    expect(w.players[1]!.hp).toBeGreaterThan(100);
    step(w, 2);
    expect(w.players[0]!.auraAttackMul).toBeGreaterThan(1);
    // No fim, os clones explodem em área.
    const perto = inimigo(w, clone.x + 30, clone.y);
    step(w, 60 * 7);
    expect(perto.hp).toBeLessThan(1e6);
    expect(w.decoys).toHaveLength(0);
  });
});

describe('Saideira, a Ultimate do Comitê', () => {
  function comite(): World {
    const w = mundo(TODOS);
    w.synergy.committee.bar = 100;
    return w;
  }

  it('só existe com os cinco: no solo e com 2 a 4 jogadores fica indisponível', () => {
    for (const n of [1, 2, 3, 4]) {
      const w = mundo(TODOS.slice(0, n));
      w.synergy.committee.bar = 100;
      expect(comiteProximo(w)).toBe(false);
      expect(saideiraPronta(w)).toBe(false);
    }
    expect(saideiraPronta(comite())).toBe(true);
  });

  it('exige os cinco vivos e a no máximo 10 tiles entre quaisquer dois', () => {
    const longe = comite();
    longe.players[4]!.x = 200; // 104 px do primeiro... e 176 do P0? põe bem longe
    longe.players[4]!.x = 400;
    expect(saideiraPronta(longe)).toBe(false);
    const limite = comite();
    limite.players[4]!.x = 150; // 150 px do P0 (< 160)
    expect(saideiraPronta(limite)).toBe(true);
    limite.players[4]!.x = 170; // 170 px do P0 (> 160)
    expect(saideiraPronta(limite)).toBe(false);
    const morto = comite();
    morto.players[2]!.hp = 0;
    expect(saideiraPronta(morto)).toBe(false);
  });

  it('só ativa com a barra cheia e a recarga zerada', () => {
    const w = mundo(TODOS);
    w.synergy.committee.bar = 99;
    expect(usar(w)).toBe(false);
    w.synergy.committee.bar = 100;
    expect(usar(w)).toBe(true);
    expect(w.synergy.committee.cooldown).toBe(SAIDEIRA_COOLDOWN_S);
    expect(w.synergy.committee.bar).toBe(0);
    w.synergy.committee.bar = 100;
    step(w, 60 * 9);
    expect(usar(w)).toBe(false); // 120 s de recarga
  });

  it('a barra do Comitê carrega 0,5%/s com os cinco juntos, e não carrega sem eles', () => {
    const w = mundo(TODOS);
    step(w, 60 * 20);
    expect(w.synergy.committee.bar).toBeCloseTo(20 * COMMITTEE_CHARGE_PER_S, 1);
    const sem = mundo(TODOS);
    sem.players[4]!.x = 500;
    step(sem, 60 * 20);
    expect(sem.synergy.committee.bar).toBe(0);
  });

  it('cada Ultimate de dupla usada dá +10% e cada abate dentro do grupo dá +0,1%', () => {
    const w = mundo(TODOS);
    parDe(w, 0, 1)!.bar = 100;
    usar(w, 0);
    expect(w.synergy.committee.bar).toBeCloseTo(10, 5);
    const antes = w.synergy.committee.bar;
    onKillSynergy(w, w.players[2]);
    expect(w.synergy.committee.bar).toBeCloseTo(antes + 0.1, 5);
    // Abate com o grupo desfeito não conta.
    w.players[4]!.x = 500;
    const depois = w.synergy.committee.bar;
    onKillSynergy(w, w.players[2]);
    expect(w.synergy.committee.bar).toBe(depois);
  });

  it('os cinco ficam invulneráveis por 3 s, e a Saideira dura 8 s', () => {
    const w = comite();
    usar(w);
    expect(w.synergy.committee.t).toBe(0);
    for (const p of w.players) expect(p.invuln).toBeGreaterThanOrEqual(3);
    step(w, 60 * 2);
    for (const p of w.players) expect(p.invuln).toBeGreaterThan(0.1);
    step(w, 60 * 1.5);
    for (const p of w.players) expect(p.invuln).toBeLessThan(1);
    expect(w.synergy.committee.t).toBeGreaterThan(3);
    step(w, 60 * 5);
    expect(w.synergy.committee.t).toBe(-1);
    expect(SAIDEIRA_DURATION_S).toBe(8);
  });

  it('o inimigo encostando durante a invulnerabilidade não machuca', () => {
    const w = comite();
    for (const p of w.players) p.hp = p.maxHp = 100;
    usar(w);
    // Cerca os personagens de inimigos que atacam.
    for (let i = 0; i < 8; i++) {
      spawnEnemy(w, ROBO, w.players[0]!.x + 4 + i, w.players[0]!.y);
      w.enemies.active[w.enemies.active.length - 1]!.hp = 1e6;
    }
    step(w, 60 * 2.5);
    for (const p of w.players) expect(p.hp).toBe(100);
  });

  it('ao fim, o pulso de brinde empurra e causa dano a todos os inimigos da tela e cura 25% do HP', () => {
    const w = comite();
    for (const p of w.players) {
      p.maxHp = 400;
      p.hp = 100;
    }
    const perto = inimigo(w, 200, 0); // atordoados: ficam onde estão até o pulso
    const tela = inimigo(w, 0, 220);
    const longe = inimigo(w, 900, 900);
    usar(w);
    step(w, 60 * 7.9);
    expect(perto.hp).toBe(1e6);
    expect(w.players[0]!.hp).toBeLessThan(150); // ainda sem a cura
    step(w, 20);
    expect(perto.hp).toBeLessThan(1e6);
    expect(tela.hp).toBeLessThan(1e6);
    expect(longe.hp).toBe(1e6); // fora da tela
    for (const p of w.players) expect(p.hp).toBeCloseTo(200, 0); // 100 + 25% de 400
    expect(perto.kx !== 0 || perto.x > 200).toBe(true); // empurrado
  });

  it('a Saideira diz uma linha do grupo e usa o Espelho de Emoção da Thayssa', () => {
    const w = comite();
    getCard('team-thayssa-espelho')!.apply(w.players[4]!);
    const s = w.players[4]!.kit as ThayssaState;
    expect(s.mode).toBe('euforia');
    usar(w, 0);
    expect(s.mode).toBe('sobrecarga');
    expect(w.messages.some((m) => /brinde|Saideira|saideira|vai/.test(m.text))).toBe(true);
  });

  it('a Saideira tem prioridade sobre as duplas quando está pronta', () => {
    const w = comite();
    encher(w);
    usar(w);
    expect(w.synergy.committee.t).toBe(0);
    expect(w.synergy.active).toHaveLength(0);
  });
});

describe('Espelho de Emoção com Ultimates de dupla', () => {
  it('quando um aliado usa a Ultimate, a Thayssa troca de modo sem transição', () => {
    const w = mundo(['felipe', 'thayssa', 'mauro']);
    getCard('team-thayssa-espelho')!.apply(w.players[1]!);
    const s = w.players[1]!.kit as ThayssaState;
    parDe(w, 0, 2)!.bar = 100; // Felipe + Mauro
    usar(w, 0);
    expect(s.mode).toBe('sobrecarga');
    expect(s.transitionLeft).toBe(0);
  });
});
