import { describe, expect, it } from 'vitest';
import { spawnEnemy } from '../combat/spawner';
import { spawnGem } from '../combat/gems';
import { spawnHazard } from '../combat/hostile';
import { COMUNS } from '../data/enemies';
import { NO_INPUT } from '../engine/input';
import { CONVIDADA_SLOT, createWorld, stepWorld, type World } from '../engine/world';
import { createPlayer } from '../entities/player';
import type { CharacterId } from '../data/characters';
import { ALL_CARDS } from '../combat/cardPool';
import { CompanionInput, decidir, desvioDePerigos, escolherCartasDaIA, FOLLOW_PX, novaMemoria, pontuarCarta, RUN_PX } from './companion';

function dupla(ia: CharacterId = 'mauro', initialChoice = false): World {
  const w = createWorld(['felipe', ia], { noSpawn: true, noBosses: true, initialChoice });
  const [a, b] = w.players;
  a!.x = a!.prevX = 0;
  a!.y = a!.prevY = 0;
  b!.x = b!.prevX = 30;
  b!.y = b!.prevY = 0;
  return w;
}

describe('companheiro IA', () => {
  it('perto do jogador, fica por perto (não corre para longe)', () => {
    const w = dupla();
    const i = decidir(w, w.players[1]!, w.players[0]!);
    expect(Math.hypot(i.moveX, i.moveY)).toBeLessThanOrEqual(1.001);
    // Já está a ~30 px (menos de 4 tiles): não precisa correr.
    expect(Math.hypot(w.players[1]!.x - w.players[0]!.x, 0)).toBeLessThan(FOLLOW_PX);
  });

  it('mais de 8 tiles: corre em direção ao jogador', () => {
    const w = dupla();
    w.players[1]!.x = RUN_PX + 60;
    const i = decidir(w, w.players[1]!, w.players[0]!);
    expect(i.moveX).toBeLessThan(-0.9);
  });

  it('entre 4 e 8 tiles segue o jogador', () => {
    const w = dupla();
    w.players[1]!.x = FOLLOW_PX + 30;
    const i = decidir(w, w.players[1]!, w.players[0]!);
    expect(i.moveX).toBeLessThan(0);
  });

  it('vai até uma gema a menos de 5 tiles', () => {
    const w = dupla();
    w.players[1]!.x = 40;
    w.players[1]!.y = 0;
    spawnGem(w, 40, 60, 1);
    const i = decidir(w, w.players[1]!, w.players[0]!);
    expect(i.moveY).toBeGreaterThan(0.9);
  });

  it('ignora gema distante demais (mais de 5 tiles)', () => {
    const w = dupla();
    w.players[1]!.x = 40;
    spawnGem(w, 40, 200, 1);
    const i = decidir(w, w.players[1]!, w.players[0]!);
    expect(i.moveY).toBeLessThan(0.5);
  });

  it('foge de uma área telegrafada em cima dele', () => {
    const w = dupla();
    const ia = w.players[1]!;
    spawnHazard(w, { kind: 'circle', x: ia.x - 4, y: ia.y, radius: 24, delay: 1.2, damage: 20 });
    const i = decidir(w, ia, w.players[0]!);
    expect(i.moveX).toBeGreaterThan(0.5); // para longe do centro, que está à esquerda
    expect(desvioDePerigos(w, { x: 500, y: 500 })).toEqual({ x: 0, y: 0 });
  });

  it('Thaisa avança na frente: vai na direção do inimigo, não do jogador', () => {
    const w = dupla('thaisa');
    w.players[1]!.x = 0;
    w.players[1]!.y = 0;
    spawnEnemy(w, COMUNS[0]!, 0, -150);
    const i = decidir(w, w.players[1]!, w.players[0]!);
    expect(i.moveY).toBeLessThan(-0.5);
  });

  it('Thayssa fica mais atrás: recua para o lado oposto ao inimigo', () => {
    const w = dupla('thayssa');
    w.players[1]!.x = 0;
    w.players[1]!.y = 0;
    spawnEnemy(w, COMUNS[0]!, 0, -150);
    const i = decidir(w, w.players[1]!, w.players[0]!);
    expect(i.moveY).toBeGreaterThan(0.2);
  });

  it('morto não faz nada', () => {
    const w = dupla();
    w.players[1]!.hp = 0;
    expect(decidir(w, w.players[1]!, w.players[0]!)).toEqual(NO_INPUT);
  });

  it('usa a Ultimate quando a barra da dupla está cheia e o jogador está no alcance', () => {
    const w = dupla();
    const i0 = decidir(w, w.players[1]!, w.players[0]!);
    expect(i0.ultimate).toBe(false);
    w.synergy.pairs[0]!.bar = 100;
    expect(decidir(w, w.players[1]!, w.players[0]!).ultimate).toBe(true);
    // Longe demais (fora do alcance de ativação): não usa.
    w.players[1]!.x = 2000;
    expect(decidir(w, w.players[1]!, w.players[0]!).ultimate).toBe(false);
  });

  it('a Ultimate da IA realmente dispara na simulação', () => {
    const w = dupla();
    const ia = new CompanionInput(() => w, 1);
    w.synergy.pairs[0]!.bar = 100;
    stepWorld(w, [NO_INPUT, ia.poll()]);
    expect(w.synergy.active.length).toBe(1);
  });

  it('escolhe sozinho a carta pendente da IA, mas nunca a do jogador', () => {
    const w = createWorld(['felipe', 'mauro'], { noSpawn: true, noBosses: true, initialChoice: true });
    // Primeiro na fila é o jogador (slot 0): a IA não mexe.
    escolherCartasDaIA(w, [1]);
    expect(w.choices.length).toBe(2);
    // Resolvendo a do jogador, a seguinte é da IA e é resolvida.
    w.choices.shift();
    escolherCartasDaIA(w, [1]);
    expect(w.choices.length).toBe(0);
  });

  it('companheiro acompanha o jogador andando de verdade (simulação de 6 s)', () => {
    const w = dupla('melissa');
    const ia = new CompanionInput(() => w, 1);
    for (let t = 0; t < 360; t++) stepWorld(w, [{ moveX: 1, moveY: 0, action: false, ultimate: false }, ia.poll()]);
    const d = Math.hypot(w.players[0]!.x - w.players[1]!.x, w.players[0]!.y - w.players[1]!.y);
    expect(d).toBeLessThan(FOLLOW_PX * 1.5);
  });
});

describe('companheiro IA: kits, reviver e cartas', () => {
  it('vai reviver o aliado caído mesmo bem longe, ignorando gemas', () => {
    const w = dupla('mauro');
    w.players[0]!.hp = 0;
    w.players[0]!.x = 600;
    w.players[1]!.x = 0;
    spawnGem(w, 0, 40, 1);
    const i = decidir(w, w.players[1]!, w.players[0]!);
    expect(i.moveX).toBeGreaterThan(0.9);
  });

  it('para ao lado do caído e o levanta na simulação', () => {
    const w = dupla('melissa');
    const ia = new CompanionInput(() => w, 1);
    w.players[0]!.hp = 0;
    w.players[0]!.x = w.players[0]!.prevX = 200;
    for (let t = 0; t < 600 && w.players[0]!.hp <= 0; t++) stepWorld(w, [NO_INPUT, ia.poll()]);
    expect(w.players[0]!.hp).toBeGreaterThan(0);
    expect(w.stats.revives).toBe(1);
  });

  it('atirador (Mauro) recua quando o inimigo encosta', () => {
    const w = dupla('mauro');
    w.players[1]!.x = 0;
    w.players[1]!.y = 0;
    spawnEnemy(w, COMUNS[0]!, 0, -25);
    const i = decidir(w, w.players[1]!, w.players[0]!);
    expect(i.moveY).toBeGreaterThan(0.3);
  });

  it('corpo a corpo (Melissa) avança até o inimigo para bater', () => {
    const w = dupla('melissa');
    w.players[1]!.x = 0;
    w.players[1]!.y = 0;
    spawnEnemy(w, COMUNS[0]!, 0, -90);
    const i = decidir(w, w.players[1]!, w.players[0]!);
    expect(i.moveY).toBeLessThan(-0.7);
  });

  it('Thayssa troca para Sobrecarga quando o jogador está machucado', () => {
    const w = dupla('thayssa');
    const k = w.players[1]!.kit;
    if (k?.type !== 'thayssa') throw new Error('kit');
    w.players[0]!.hp = 20;
    expect(decidir(w, w.players[1]!, w.players[0]!).action).toBe(true);
    k.mode = 'sobrecarga';
    expect(decidir(w, w.players[1]!, w.players[0]!).action).toBe(false);
  });

  it('Felipe (IA) vai de Bateria quando está cercado', () => {
    const w = dupla('felipe');
    const ia = w.players[1]!;
    ia.x = 0;
    ia.y = 0;
    for (let n = 0; n < 3; n++) spawnEnemy(w, COMUNS[0]!, 20 + n * 5, 10);
    expect(decidir(w, ia, w.players[0]!).action).toBe(true);
  });

  it('não repete o toque na tecla de ação em passos seguidos', () => {
    const w = dupla('thayssa');
    w.players[0]!.hp = 20;
    const ia = new CompanionInput(() => w, 1);
    expect(ia.poll().action).toBe(true);
    expect(ia.poll().action).toBe(false);
  });

  it('prefere a carta que destrava o kit em vez de uma de raridade parecida', () => {
    const w = createWorld(['felipe', 'melissa'], { noSpawn: true, noBosses: true });
    const mel = w.players[1]!;
    const invest = ALL_CARDS.find((c) => c.id === 'melissa-investida')!;
    const outra = ALL_CARDS.find((c) => c.id === 'melissa-fandom')!;
    expect(pontuarCarta(mel, invest)).toBeGreaterThan(pontuarCarta(mel, outra));
  });
});

describe('companheiro IA na luta do RM', () => {
  it('vai encostar na Melissa encantada para quebrar o transe', () => {
    const w = createWorld(['felipe', 'mauro'], { noSpawn: true, noBosses: true, initialChoice: false });
    w.walls = [];
    const [lider, ia] = w.players;
    lider!.x = lider!.prevX = 0;
    ia!.x = ia!.prevX = 40;
    const conv = createPlayer(CONVIDADA_SLOT, 'melissa', 100, 0);
    w.convidada = conv;
    w.trance = { slot: CONVIDADA_SLOT, meter: 100, caught: true };
    const i = decidir(w, ia!, lider!);
    expect(i.moveX).toBeGreaterThan(0.9); // para a direita, onde ela está
    // Logo depois de ela bater (golpe recarregando): encosta e gira em volta dela, sem ficar parado.
    conv.weaponCd = 1;
    ia!.x = 100 + 14;
    const girando = decidir(w, ia!, lider!);
    expect(Math.hypot(girando.moveX, girando.moveY)).toBeGreaterThan(0.5);
    expect(Math.abs(girando.moveY)).toBeGreaterThan(0.5); // gira (movimento lateral), não só empurra
  });

  it('o golpe dela quase pronto: a IA foge por um instante (kite) e depois volta a entrar', () => {
    const w = createWorld(['felipe', 'mauro'], { noSpawn: true, noBosses: true, initialChoice: false });
    w.walls = [];
    const [lider, ia] = w.players;
    lider!.x = lider!.prevX = 0;
    ia!.x = ia!.prevX = 100 + 14;
    ia!.y = ia!.prevY = 0;
    const conv = createPlayer(CONVIDADA_SLOT, 'melissa', 100, 0);
    w.convidada = conv;
    w.trance = { slot: CONVIDADA_SLOT, meter: 100, caught: true };
    const mem = novaMemoria();
    conv.weaponCd = 1;
    decidir(w, ia!, lider!, mem); // janela segura
    conv.weaponCd = 0.1; // o golpe vai ficar pronto
    const foge = decidir(w, ia!, lider!, mem);
    expect(foge.moveX).toBeGreaterThan(0.3); // para longe dela (ela está à esquerda da IA)
    w.tick += 60; // passou a fuga
    const entra = decidir(w, ia!, lider!, mem);
    expect(entra.moveX).toBeLessThan(-0.5); // volta para ela
  });

  it('antes de ela ser pega, o companheiro NÃO a segura (senão o transe nunca aconteceria) e segue o jogador normalmente', () => {
    const w = createWorld(['felipe', 'mauro'], { noSpawn: true, noBosses: true, initialChoice: false });
    w.walls = [];
    const [lider, ia] = w.players;
    lider!.x = lider!.prevX = 0;
    ia!.x = ia!.prevX = 20;
    w.convidada = createPlayer(CONVIDADA_SLOT, 'melissa', 0, 120);
    w.trance = { slot: CONVIDADA_SLOT, meter: 100, caught: false };
    expect(decidir(w, ia!, lider!).moveY).toBeLessThan(0.5); // não corre até ela, que está a 120 px abaixo
    w.trance = null;
    expect(decidir(w, ia!, lider!).moveY).toBeLessThan(0.5);
  });

  it('a Thayssa entra na área da aura (perto da encantada) e não precisa encostar', () => {
    const w = createWorld(['felipe', 'thayssa'], { noSpawn: true, noBosses: true, initialChoice: false });
    w.walls = [];
    const [lider, ia] = w.players;
    lider!.x = lider!.prevX = 0;
    ia!.x = ia!.prevX = 0;
    w.convidada = createPlayer(CONVIDADA_SLOT, 'melissa', 100, 0);
    w.trance = { slot: CONVIDADA_SLOT, meter: 100, caught: true };
    expect(decidir(w, ia!, lider!).moveX).toBeGreaterThan(0.9);
    // Dentro da faixa da aura (55 a 80 px): fica rodeando em volta dela, sem encostar e sem parar.
    ia!.x = 100 - 70;
    const rodeia = decidir(w, ia!, lider!);
    expect(Math.abs(rodeia.moveY)).toBeGreaterThan(0.9);
    // Perto demais (menos de 55 px): afasta-se dela.
    ia!.x = 100 - 30;
    expect(decidir(w, ia!, lider!).moveX).toBeLessThan(-0.3);
  });
});
