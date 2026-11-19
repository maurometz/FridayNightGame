import { describe, expect, it } from 'vitest';
import { DEV_DANOS, DEV_DURACOES, defaultDev, defaultSettings, loadSettings, sanitizeSettings, saveSettings } from './settings';

describe('Modo dev nas opções', () => {
  it('o padrão começa na fase 1, sem invulnerabilidade e com dano normal', () => {
    expect(defaultSettings().dev).toEqual({ fase: 1, duracaoS: 0, invulneravel: false, danoMul: 1, cutscenes: true });
    expect(defaultDev().fase).toBe(1);
  });

  it('valores inválidos ou adulterados voltam ao padrão', () => {
    const s = sanitizeSettings({ dev: { fase: 99, duracaoS: 7, invulneravel: 'sim', danoMul: 3 } });
    expect(s.dev.fase).toBe(8);
    expect(s.dev.duracaoS).toBe(0);
    expect(s.dev.invulneravel).toBe(false);
    expect(s.dev.danoMul).toBe(1);
    expect(sanitizeSettings({ dev: 5 }).dev).toEqual(defaultDev());
    expect(sanitizeSettings(null).dev).toEqual(defaultDev());
  });

  it('valores válidos são mantidos, salvos e lidos de volta', () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    const s = defaultSettings();
    s.dev = { fase: 5, duracaoS: DEV_DURACOES[2]!, invulneravel: true, danoMul: DEV_DANOS[3]!, cutscenes: false };
    saveSettings(s, storage);
    expect(loadSettings(storage).dev).toEqual(s.dev);
  });
});
