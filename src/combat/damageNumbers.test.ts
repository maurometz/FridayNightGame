import { describe, expect, it } from 'vitest';
import { COMUNS } from '../data/enemies';
import { createWorld, type World } from '../engine/world';
import { updateDamageNumbers } from './damageNumbers';
import { damageEnemy } from './enemies';
import { spawnEnemy } from './spawner';
import { hitPlayer } from './teamEffects';

function cena(): World {
  return createWorld(['felipe'], { seed: 3, noSpawn: true, noBosses: true, initialChoice: false });
}

describe('números de dano', () => {
  it('cada dano em inimigo mostra um número com o valor aplicado', () => {
    const w = cena();
    spawnEnemy(w, COMUNS[0]!, 100, 0);
    const e = w.enemies.active[0]!;
    e.hp = 1000;
    damageEnemy(w, e, 7, w.players[0]);
    expect(w.damageNumbers.size).toBe(1);
    expect(w.damageNumbers.active[0]!.value).toBeCloseTo(7);
    expect(w.damageNumbers.active[0]!.kind).toBe('inimigo');
  });

  it('golpes seguidos no mesmo alvo somam num número só; alvos diferentes têm números separados', () => {
    const w = cena();
    spawnEnemy(w, COMUNS[0]!, 100, 0);
    spawnEnemy(w, COMUNS[0]!, 140, 0);
    const [a, b] = w.enemies.active as [(typeof w.enemies.active)[0], (typeof w.enemies.active)[0]];
    a.hp = b.hp = 1000;
    damageEnemy(w, a, 3, w.players[0]);
    damageEnemy(w, a, 4, w.players[0]);
    damageEnemy(w, b, 5, w.players[0]);
    expect(w.damageNumbers.size).toBe(2);
    expect(w.damageNumbers.active[0]!.value).toBeCloseTo(7);
  });

  it('o número sobe e some depois de menos de 1 segundo', () => {
    const w = cena();
    spawnEnemy(w, COMUNS[0]!, 100, 0);
    const e = w.enemies.active[0]!;
    e.hp = 1000;
    damageEnemy(w, e, 5, w.players[0]);
    const y0 = w.damageNumbers.active[0]!.y;
    updateDamageNumbers(w);
    expect(w.damageNumbers.active[0]!.y).toBeLessThan(y0);
    for (let i = 0; i < 80; i++) updateDamageNumbers(w);
    expect(w.damageNumbers.size).toBe(0);
  });

  it('dano no jogador aparece como número do tipo jogador', () => {
    const w = cena();
    hitPlayer(w, w.players[0]!, 6);
    const n = w.damageNumbers.active.find((x) => x.kind === 'jogador');
    expect(n).toBeDefined();
    expect(n!.value).toBeGreaterThan(0);
  });
});
