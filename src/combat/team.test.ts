import { danoDaFase } from '../data/acts';
import { CITACAO_LEVEL } from '../data/team';
import { describe, expect, it } from 'vitest';
import { aliadosPerto, addBuff, hitPlayer, onGroupSpotHit, onUltimateUsed } from './teamEffects';
import { TEAM_CARDS } from './teamCards';
import { getCard } from './cardPool';
import { spawnEnemy } from './spawner';
import { grantXp } from './leveling';
import { damageEnemy, killEnemy } from './enemies';
import { updateExtraWeapons } from './sharedWeapons';
import { COMUNS } from '../data/enemies';
import { NO_INPUT, type PlayerInput } from '../engine/input';
import { createWorld, stepWorld, type World } from '../engine/world';
import { xpToNext } from '../engine/xp';
import type { CharacterId } from '../data/characters';
import type { FelipeState } from '../characters/felipeState';
import type { MauroState } from '../characters/mauroState';
import type { MelissaState } from '../characters/melissaState';
import type { ThaisaState } from '../characters/thaisaState';
import type { ThayssaState } from '../characters/thayssaState';
import { switchTo } from '../characters/felipe';
import { danoDaNota } from '../characters/mauro';
import { acertarInimigo } from '../characters/melissa';
import { darPico } from '../characters/thaisaState';
import { raioDaAura } from '../characters/thayssaState';
import { BRILHO, FOODS } from '../data/foods';
import { spawnFood } from './foods';

const ROBO = COMUNS[0]!;

/** Mundo de 2 jogadores: [dono da carta, aliado]. O aliado fica a 30 px, perto de tudo. */
function dupla(dono: CharacterId, aliado: CharacterId = 'felipe', seed = 1): World {
  const w = createWorld([dono, aliado], { initialChoice: false, seed, noSpawn: true });
  w.players[1]!.x = 30;
  w.players[1]!.y = 0;
  // Os kits não atacam sozinhos, para isolar a carta de equipe.
  for (const p of w.players) {
    const k = p.kit as unknown as { cd?: number };
    if (k) k.cd = 1e9;
  }
  return w;
}

function step(w: World, n = 1, input0: PlayerInput = NO_INPUT): void {
  for (let i = 0; i < n; i++) {
    stepWorld(w, w.players.map((_, slot) => (slot === 0 ? input0 : NO_INPUT)));
    w.choices.length = 0;
  }
}

function carta(id: string, w: World, slot = 0): void {
  getCard(id)!.apply(w.players[slot]!);
}

function parado(w: World, x: number, y: number, hp = 1000): ReturnType<typeof w.enemies.active.at> & object {
  spawnEnemy(w, ROBO, x, y);
  const e = w.enemies.active[w.enemies.active.length - 1]!;
  e.stun = 9999;
  e.hp = hp;
  return e;
}

describe('Cartas de equipe: catálogo', () => {
  it('são 25, 5 por personagem, todas do tipo equipe e com id único', () => {
    expect(TEAM_CARDS).toHaveLength(25);
    expect(new Set(TEAM_CARDS.map((c) => c.id)).size).toBe(25);
    for (const ch of ['felipe', 'mauro', 'melissa', 'thaisa', 'thayssa']) {
      expect(TEAM_CARDS.filter((c) => c.character === ch)).toHaveLength(5);
    }
    for (const c of TEAM_CARDS) expect(c.kind).toBe('team');
  });

  it('buffs temporários somam multiplicadores e expiram', () => {
    const w = dupla('felipe');
    const p = w.players[1]!;
    addBuff(p, { id: 'a', left: 0.1, damage: 1.1, attack: 1.2 });
    addBuff(p, { id: 'b', left: 5, damage: 1.5, reduction: 0.2 });
    step(w, 1);
    expect(p.damageMul).toBeCloseTo(1.1 * 1.5, 10);
    expect(p.auraAttackMul).toBeCloseTo(1.2, 10);
    expect(p.damageTakenMul).toBeCloseTo(0.8, 10);
    step(w, 20);
    expect(p.buffs.some((b) => b.id === 'a')).toBe(false);
    expect(p.damageMul).toBeCloseTo(1.5, 10);
    // O mesmo id renova em vez de acumular.
    addBuff(p, { id: 'b', left: 9, damage: 1.5 });
    expect(p.buffs.filter((b) => b.id === 'b')).toHaveLength(1);
  });

  it('aliadosPerto devolve só quem está no raio, do mais perto para o mais longe', () => {
    const w = createWorld(['felipe', 'mauro', 'thaisa'], { initialChoice: false, noSpawn: true });
    w.players[1]!.x = 40;
    w.players[2]!.x = 20;
    expect(aliadosPerto(w, w.players[0]!, 100).map((a) => a.slot)).toEqual([2, 1]);
    expect(aliadosPerto(w, w.players[0]!, 30).map((a) => a.slot)).toEqual([2]);
    w.players[2]!.hp = 0;
    expect(aliadosPerto(w, w.players[0]!, 100).map((a) => a.slot)).toEqual([1]);
  });
});

describe('Equipe do Felipe', () => {
  it('Coro de Apoio: aliados próximos ganham +5% de dano enquanto o Felipe ataca', () => {
    const w = dupla('felipe', 'thaisa');
    carta('team-felipe-coro', w);
    const s = w.players[0]!.kit as FelipeState;
    s.cd = 0;
    parado(w, 100, 0);
    step(w, 4); // o buff vale a partir do passo seguinte ao ataque
    expect(w.players[1]!.damageMul).toBeCloseTo(1.05, 10);
    // Parando de atacar, o bônus some.
    s.cd = 1e9;
    step(w, 60 * 2);
    expect(w.players[1]!.damageMul).toBe(1);
  });

  it('Coro de Apoio: aliado longe não recebe', () => {
    const w = dupla('felipe', 'thaisa');
    carta('team-felipe-coro', w);
    w.players[1]!.x = 400;
    (w.players[0]!.kit as FelipeState).cd = 0;
    parado(w, 100, 0);
    step(w, 2);
    expect(w.players[1]!.damageMul).toBe(1);
  });

  it('Sinal de Passagem: ao trocar de instrumento, o aliado mais próximo recarrega 1 s', () => {
    const w = dupla('felipe', 'mauro');
    carta('team-felipe-sinal', w);
    const mauro = w.players[1]!.kit as MauroState;
    mauro.cd = 3;
    switchTo(w, w.players[0]!.kit as FelipeState, 'bateria');
    expect(mauro.cd).toBeCloseTo(2, 10);
  });

  it('Intervalo Compartilhado: ao esgotar uma munição, aliados próximos recarregam mais rápido', () => {
    const w = dupla('felipe', 'mauro');
    carta('team-felipe-intervalo', w);
    const felipe = w.players[0]!.kit as FelipeState;
    const mauro = w.players[1]!.kit as MauroState;
    mauro.cd = 5;
    felipe.cd = 0;
    felipe.ammo.violao = 1;
    parado(w, 100, 0);
    step(w, 1);
    expect(mauro.cd).toBeLessThan(5 - 1);
  });

  it('Quem Canta Junto: aliados que atacam o mesmo inimigo causam +10% de dano', () => {
    const w = dupla('felipe', 'thaisa');
    carta('team-felipe-quem-canta', w);
    const felipe = w.players[0]!.kit as FelipeState;
    felipe.cd = 0;
    const e = parado(w, 100, 0);
    step(w, 1);
    expect(e.focusLeft).toBeGreaterThan(0);
    e.hp = 1000;
    damageEnemy(w, e, 10, w.players[1]); // aliado
    expect(1000 - e.hp).toBeCloseTo(11, 10);
    e.hp = 1000;
    damageEnemy(w, e, 10, w.players[0]); // o próprio Felipe não ganha
    expect(1000 - e.hp).toBeCloseTo(10, 10);
  });

  it('Passa a Vez: empresta o Violão ao aliado mais próximo a cada 45 s, por 10 s', () => {
    const w = dupla('felipe', 'thaisa');
    carta('team-felipe-passa-a-vez', w);
    const ally = w.players[1]!;
    expect((w.players[0]!.kit as FelipeState).passaTimer).toBe(45);
    step(w, 60 * 44);
    expect(ally.extraWeapons).toHaveLength(0);
    step(w, 60 * 2);
    expect(ally.extraWeapons.map((x) => x.id)).toEqual(['emprestado']);
    step(w, 60 * 11);
    expect(ally.extraWeapons).toHaveLength(0);
  });
});

describe('Equipe do Mauro', () => {
  it('Trabalho em Grupo: o aliado ganha +10% de dano por 3 s quando o Mauro ataca', () => {
    const w = dupla('mauro', 'thaisa');
    carta('team-mauro-trabalho', w);
    (w.players[0]!.kit as MauroState).cd = 0;
    parado(w, 100, 0);
    step(w, 2);
    expect(w.players[1]!.damageMul).toBeCloseTo(1.1, 10);
  });

  it('Resumo Coletivo: aliados dividem 10% do dano com o Mauro, que ganha Foco', () => {
    const w = dupla('mauro', 'thaisa');
    carta('team-mauro-resumo', w);
    const mauro = w.players[0]!;
    const ally = w.players[1]!;
    const s = mauro.kit as MauroState;
    s.foco = 10;
    hitPlayer(w, ally, 20 / danoDaFase(w.act));
    expect(150 - ally.hp).toBeCloseTo(18, 10);
    expect(70 - mauro.hp).toBeCloseTo(2, 10);
    expect(s.foco).toBeGreaterThan(10);
  });

  it('Bibliografia Compartilhada: abates do Mauro aceleram aliados próximos, e no nível 10 vira Citação', () => {
    const w = dupla('mauro', 'melissa');
    carta('team-mauro-biblio', w);
    const melissa = w.players[1]!.kit as MelissaState;
    melissa.reacaoCd = 10;
    const e = parado(w, 60, 0, 1);
    killEnemy(w, e, w.players[0]);
    expect(melissa.reacaoCd).toBeCloseTo(9.7, 5);
    const mauro = w.players[0]!;
    const base = danoDaNota(mauro, mauro.kit as MauroState);
    mauro.level = CITACAO_LEVEL;
    expect(danoDaNota(mauro, mauro.kit as MauroState)).toBeCloseTo(base * 1.25, 5);
  });

  it('Revisão por Pares: quando um aliado sobe de nível, o Mauro ganha 50 de XP', () => {
    const w = dupla('mauro', 'thaisa');
    carta('team-mauro-pares', w);
    const mauro = w.players[0]!;
    const xp0 = mauro.xp + mauro.level * 1000;
    grantXp(w, w.players[1]!, xpToNext(1));
    // Mauro recebeu 50 de XP (x1,15 da passiva) e, com isso, subiu de nível.
    expect(mauro.xp + mauro.level * 1000).toBeGreaterThan(xp0);
    expect(mauro.level).toBeGreaterThan(1);
  });

  it('Índice Coletivo: a cada 100 abates do grupo, +5% de dano para todos', () => {
    const w = dupla('mauro', 'thaisa');
    carta('team-mauro-indice', w);
    w.players[0]!.kills = 150;
    w.players[1]!.kills = 60; // total 210: 2 degraus
    step(w, 2);
    expect(w.players[0]!.damageMul).toBeCloseTo(1.1, 10);
    expect(w.players[1]!.damageMul).toBeCloseTo(1.1, 10);
    w.players[0]!.kills = 5000;
    step(w, 2);
    expect(w.players[1]!.damageMul).toBeCloseTo(1.5, 10); // teto +50%
  });
});

describe('Equipe da Melissa', () => {
  it('Torcida Organizada: aliados perto ganham +5% de velocidade de ataque', () => {
    const w = dupla('melissa', 'thaisa');
    carta('team-melissa-torcida', w);
    step(w, 2);
    expect(w.players[1]!.auraAttackMul).toBeCloseTo(1.05, 10);
    w.players[1]!.x = 500;
    step(w, 15);
    expect(w.players[1]!.auraAttackMul).toBe(1);
  });

  it('Passe de Holofote: ao acertar um Holofote, outro inimigo fica marcado e aliados o acertam com crítico', () => {
    const w = dupla('melissa', 'thaisa');
    carta('team-melissa-passe', w);
    const melissa = w.players[0]!;
    const s = melissa.kit as MelissaState;
    const e = parado(w, 20, 0);
    const outro = parado(w, 60, 10);
    e.facing = 0; // olha para a direita: a Melissa (x=0) está nas costas
    e.spot = 3;
    acertarInimigo(w, melissa, s, e, 1);
    expect(outro.passeLeft).toBeGreaterThan(2.5);
    expect(outro.passeOwner).toBe(0);
    damageEnemy(w, outro, 10, w.players[1]);
    expect(1000 - outro.hp).toBeCloseTo(20, 10);
    outro.hp = 1000;
    damageEnemy(w, outro, 10, melissa); // a própria Melissa não ganha
    expect(1000 - outro.hp).toBeCloseTo(10, 10);
  });

  it('Entrada Sincronizada: um aliado perto avança junto e os dois causam dano em área', () => {
    const w = dupla('melissa', 'thaisa');
    carta('melissa-investida', w);
    carta('team-melissa-entrada', w);
    const ally = w.players[1]!;
    const perto = parado(w, 20, 0);
    const x0 = ally.x;
    step(w, 1, { ...NO_INPUT, moveX: 1, action: true });
    step(w, 12, { ...NO_INPUT, moveX: 1 });
    expect(ally.x - x0).toBeGreaterThan(40);
    expect(perto.hp).toBeLessThan(1000);
  });

  it('Cobertura do Encore: aliado abaixo de 30% de HP dá velocidade à Melissa (recarga de 10 s)', () => {
    const w = dupla('melissa', 'thaisa');
    carta('team-melissa-cobertura', w);
    const ally = w.players[1]!;
    ally.hp = 60;
    hitPlayer(w, ally, 30); // 30 de 150 = 20%
    step(w, 1);
    expect(w.players[0]!.auraSpeedMul).toBeCloseTo(1.3, 10);
    const s = w.players[0]!.kit as MelissaState;
    expect(s.coberturaCd).toBeGreaterThan(9);
  });

  it('Coreografia de Grupo: a cada 3 Holofotes acertados pelo grupo, Reação Exagerada no time', () => {
    const w = dupla('melissa', 'thaisa');
    carta('team-melissa-coreografia', w);
    const s = w.players[0]!.kit as MelissaState;
    onGroupSpotHit(w);
    onGroupSpotHit(w);
    expect(s.reacaoFree).toBe(false);
    onGroupSpotHit(w);
    expect(s.reacaoFree).toBe(true);
  });

  it('Coreografia de Grupo: um aliado que acerta o Holofote pelas costas também conta', () => {
    const w = dupla('melissa', 'thaisa');
    carta('team-melissa-coreografia', w);
    const e = parado(w, 100, 0);
    e.facing = 0; // olha para a direita
    e.spot = 3;
    w.players[1]!.x = 70; // nas costas do inimigo (à esquerda dele)
    w.players[1]!.y = 0;
    damageEnemy(w, e, 1, w.players[1]);
    expect((w.players[0]!.kit as MelissaState).groupHits).toBe(1);
    expect(e.spot).toBe(0);
    // De frente, não conta.
    e.spot = 3;
    w.players[1]!.x = 130;
    damageEnemy(w, e, 1, w.players[1]);
    expect((w.players[0]!.kit as MelissaState).groupHits).toBe(1);
  });
});

describe('Equipe da Thaisa', () => {
  it('Pode Passar: a comida que a Thaisa pega também cura o aliado mais ferido', () => {
    const w = dupla('thaisa', 'felipe');
    carta('team-thaisa-pode-passar', w);
    const thaisa = w.players[0]!;
    thaisa.hp = 100;
    w.players[1]!.hp = 40;
    spawnFood(w, FOODS[2]!, thaisa.x, thaisa.y); // esfiha: cura 20
    step(w, 1);
    expect(w.players[1]!.hp).toBe(60);
  });

  it('Muro Humano: aliados a até 3 tiles recebem 15% de redução de dano', () => {
    const w = dupla('thaisa', 'felipe');
    carta('team-thaisa-muro', w);
    step(w, 2);
    expect(w.players[1]!.damageTakenMul).toBeCloseTo(0.85, 10);
    w.players[1]!.x = 300;
    step(w, 20);
    expect(w.players[1]!.damageTakenMul).toBe(1);
  });

  it('Arco Coletivo: o arco empurra inimigos na direção do aliado, que ganha +15% de dano', () => {
    const w = dupla('thaisa', 'felipe');
    carta('team-thaisa-arco', w);
    (w.players[0]!.kit as ThaisaState).cd = 0;
    w.players[1]!.x = 0;
    w.players[1]!.y = 100; // aliado abaixo
    const e = parado(w, 25, 0);
    step(w, 30);
    expect(e.y).toBeGreaterThan(5); // empurrado para baixo, não para longe
    expect(w.players[1]!.damageMul).toBeCloseTo(1.15, 10);
  });

  it('Roda de Mate: com aliados por perto, ganha 1 Pico e eles ganham velocidade de ataque', () => {
    const w = dupla('thaisa', 'felipe');
    carta('team-thaisa-roda', w);
    step(w, 2);
    const s = w.players[0]!.kit as ThaisaState;
    expect(s.stacks.length).toBe(1);
    expect(w.players[1]!.auraAttackMul).toBeCloseTo(1.08, 10);
    expect(s.rodaCd).toBeGreaterThan(9);
  });

  it('Retaguarda Gaúcha: quando um aliado cai, a Thaisa ganha escudo e os aliados ganham +20% de velocidade', () => {
    const w = createWorld(['thaisa', 'felipe', 'mauro'], { initialChoice: false, noSpawn: true });
    for (const p of w.players) (p.kit as unknown as { cd: number }).cd = 1e9;
    w.players[1]!.x = 20;
    w.players[2]!.x = 40;
    carta('team-thaisa-retaguarda', w);
    w.players[1]!.hp = 5;
    hitPlayer(w, w.players[1]!, 50); // Felipe cai
    expect(w.players[1]!.hp).toBeLessThanOrEqual(0);
    expect(w.players[0]!.shield).toBeCloseTo(45, 5);
    step(w, 1);
    expect(w.players[2]!.auraSpeedMul).toBeCloseTo(1.2, 10);
  });
});

describe('Equipe da Thayssa', () => {
  it('Mão Estendida: aliados que entram no anel ganham +10% de velocidade por 2 s', () => {
    const w = dupla('thayssa', 'felipe');
    carta('team-thayssa-mao', w);
    w.players[1]!.x = 300; // fora do anel
    step(w, 2);
    expect(w.players[1]!.buffs).toHaveLength(0);
    w.players[1]!.x = 20; // entra
    step(w, 2);
    expect(w.players[1]!.buffs.some((b) => b.speed === 1.1)).toBe(true);
    // Aura da Euforia soma +20% na mesma passada.
    expect(w.players[1]!.auraSpeedMul).toBeGreaterThan(1.2);
  });

  it('Abraço em Grupo: aliados no anel recebem +1 HP/s na Euforia', () => {
    const w = dupla('thayssa', 'felipe');
    carta('team-thayssa-abraco', w);
    w.players[1]!.hp = 50;
    step(w, 60);
    expect(w.players[1]!.hp - 50).toBeCloseTo(1, 1);
  });

  it('Escudo de Afeto: aliados no anel dividem 20% do dano recebido pela Thayssa', () => {
    const w = dupla('thayssa', 'felipe');
    carta('team-thayssa-escudo', w);
    const thayssa = w.players[0]!;
    const felipe = w.players[1]!;
    hitPlayer(w, thayssa, 20 / danoDaFase(w.act));
    expect(110 - thayssa.hp).toBeCloseTo(16, 10);
    expect(felipe.maxHp - felipe.hp).toBeCloseTo(4, 10);
  });

  it('Escudo de Afeto: sem aliados no anel, a Thayssa leva o dano todo', () => {
    const w = dupla('thayssa', 'felipe');
    carta('team-thayssa-escudo', w);
    w.players[1]!.x = 500;
    hitPlayer(w, w.players[0]!, 20 / danoDaFase(w.act));
    expect(110 - w.players[0]!.hp).toBeCloseTo(20, 10);
  });

  it('Espelho de Emoção: quando um aliado usa a Ultimate, a Thayssa troca de modo sem transição', () => {
    const w = dupla('thayssa', 'felipe');
    carta('team-thayssa-espelho', w);
    const s = w.players[0]!.kit as ThayssaState;
    expect(s.mode).toBe('euforia');
    onUltimateUsed(w, w.players[1]!);
    expect(s.mode).toBe('sobrecarga');
    expect(s.transitionLeft).toBe(0);
    // Sem a carta, ou se a própria Thayssa usa, nada muda.
    onUltimateUsed(w, w.players[0]!);
    expect(s.mode).toBe('sobrecarga');
  });

  it('Círculo Completo: com 3 ou mais aliados no anel, +1 tile de raio e pulsos em dobro', () => {
    const w = createWorld(['thayssa', 'felipe', 'mauro', 'melissa'], { initialChoice: false, noSpawn: true });
    for (const p of w.players) (p.kit as unknown as { cd?: number }).cd = 1e9;
    carta('team-thayssa-circulo', w);
    const s = w.players[0]!.kit as ThayssaState;
    for (let i = 1; i < 4; i++) {
      w.players[i]!.x = 10 * i;
      w.players[i]!.y = 0;
    }
    const base = raioDaAura(s);
    step(w, 2);
    expect(s.circuloAtivo).toBe(true);
    expect(raioDaAura(s)).toBe(base + 16);
    // Com um aliado a menos, desliga.
    w.players[3]!.x = 500;
    step(w, 2);
    expect(s.circuloAtivo).toBe(false);
    expect(raioDaAura(s)).toBe(base);
  });
});

describe('Brilhos e extras que dependem de equipe', () => {
  it('Risada em Cadeia: o brilho de cura reduz a recarga de 2 aliados', () => {
    const w = createWorld(['thayssa', 'felipe', 'mauro', 'melissa'], { initialChoice: false, noSpawn: true });
    for (const p of w.players) (p.kit as unknown as { cd?: number }).cd = 1e9;
    carta('thayssa-cadeia', w);
    const eater = w.players[1]!;
    eater.hp = 50;
    (w.players[2]!.kit as MauroState).cd = 5;
    (w.players[3]!.kit as MelissaState).cd = 5;
    (w.players[0]!.kit as ThayssaState).palmasCd = 5;
    eater.x = 300;
    eater.y = 300;
    w.players[2]!.x = 310;
    w.players[2]!.y = 300;
    w.players[3]!.x = 320;
    w.players[3]!.y = 300;
    spawnFood(w, BRILHO, eater.x, eater.y);
    step(w, 1);
    expect(eater.hp).toBe(56);
    // Os dois aliados mais próximos (Mauro e Melissa) recarregam 0,5 s.
    expect((w.players[2]!.kit as MauroState).cd).toBeLessThan(5);
    expect((w.players[3]!.kit as MelissaState).cd).toBeLessThan(5);
  });

  it('as cartas de equipe não fazem nada quando o jogador é de outro personagem', () => {
    const w = dupla('felipe', 'mauro');
    carta('team-thaisa-muro', w);
    carta('team-mauro-resumo', w);
    step(w, 2);
    expect(w.players[1]!.damageTakenMul).toBe(1);
  });
});

void updateExtraWeapons;
void darPico;
