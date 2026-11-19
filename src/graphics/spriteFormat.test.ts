import { describe, expect, it } from 'vitest';
import { BOSSES, COMUNS } from '../data/enemies';
import { SPRITE_DEFS } from './characterSprites';
import { ENEMY_SPRITE_DEFS, validarEnemySprite } from './enemySprites';
import { alturaDoQuadro, FRAME_ORDER, montarQuadro, SPRITE_W, validarSprite } from './spriteFormat';

describe('sprites de inimigos e chefes', () => {
  it('todo inimigo e chefe do jogo tem desenho', () => {
    for (const d of [...COMUNS, ...BOSSES]) expect(ENEMY_SPRITE_DEFS[d.id], d.id).toBeDefined();
  });
  for (const def of Object.values(ENEMY_SPRITE_DEFS)) {
    it(`${def.id}: linhas do mesmo tamanho e cores da paleta`, () => {
      expect(validarEnemySprite(def)).toEqual([]);
    });
  }
  it('chefes são maiores que inimigos comuns', () => {
    const w = (id: string): number => ENEMY_SPRITE_DEFS[id]!.rows[0]!.length;
    for (const b of BOSSES) for (const c of COMUNS) expect(w(b.id), `${b.id} x ${c.id}`).toBeGreaterThan(w(c.id));
  });
});

describe('sprites em grade de caracteres', () => {
  for (const def of Object.values(SPRITE_DEFS)) {
    it(`${def.id}: grades com largura certa e só cores da paleta`, () => {
      expect(validarSprite(def)).toEqual([]);
    });

    it(`${def.id}: todos os quadros têm o mesmo tamanho e têm pixels`, () => {
      const h = alturaDoQuadro(def);
      for (const f of FRAME_ORDER) {
        const g = montarQuadro(def, f);
        expect(g).toHaveLength(h);
        for (const linha of g) expect(linha).toHaveLength(SPRITE_W);
        expect(g.join('').replace(/\./g, '').length).toBeGreaterThan(100);
      }
    });

    it(`${def.id}: caminhada tem quadros diferentes entre si`, () => {
      const w = FRAME_ORDER.filter((f) => f.startsWith('walk')).map((f) => montarQuadro(def, f).join('|'));
      expect(new Set(w).size).toBeGreaterThanOrEqual(3);
    });
  }

  it('Thaisa e Thayssa são menores que Felipe (80% e 75%)', () => {
    const h = (id: keyof typeof SPRITE_DEFS): number => alturaDoQuadro(SPRITE_DEFS[id]);
    expect(h('thaisa') / h('felipe')).toBeGreaterThan(0.72);
    expect(h('thaisa') / h('felipe')).toBeLessThan(0.88);
    expect(h('thayssa') / h('felipe')).toBeGreaterThan(0.68);
    expect(h('thayssa') / h('felipe')).toBeLessThan(0.8);
    expect(h('lucas')).toBeGreaterThan(h('felipe'));
  });
});
