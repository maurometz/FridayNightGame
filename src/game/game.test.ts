import { describe, expect, it } from 'vitest';
import { defaultMeta, formatDuration, loadMeta, recordRun, saveMeta, sanitizeMeta } from './meta';
import { defaultSettings, emotionScaleOf, keyLabel, loadSettings, rebind, sanitizeSettings, saveSettings, targetHeightOf } from './settings';

class MemStorage {
  data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
}

describe('opções', () => {
  it('salva e carrega de volta', () => {
    const st = new MemStorage();
    const s = defaultSettings();
    s.musicVolume = 3;
    s.reduceFlash = true;
    s.emotion = 'reduzido';
    s.textSize = 'maior';
    saveSettings(s, st);
    expect(loadSettings(st)).toEqual(s);
  });

  it('sem armazenamento ou com lixo, volta aos padrões', () => {
    expect(loadSettings(null)).toEqual(defaultSettings());
    const st = new MemStorage();
    st.setItem('profecia.settings.v1', '{isso não é json');
    expect(loadSettings(st)).toEqual(defaultSettings());
    expect(sanitizeSettings({ musicVolume: 'alto', emotion: 'xyz', keymaps: 7 })).toEqual(defaultSettings());
  });

  it('valores fora da faixa são limitados', () => {
    const s = sanitizeSettings({ musicVolume: 99, sfxVolume: -5 });
    expect(s.musicVolume).toBe(10);
    expect(s.sfxVolume).toBe(0);
  });

  it('armazenamento que lança erro não derruba o jogo', () => {
    const ruim = {
      getItem(): string | null {
        throw new Error('bloqueado');
      },
      setItem(): void {
        throw new Error('cheio');
      },
    };
    expect(() => saveSettings(defaultSettings(), ruim)).not.toThrow();
    expect(loadSettings(ruim)).toEqual(defaultSettings());
  });

  it('ciclo emocional e tamanho do texto viram números', () => {
    expect(emotionScaleOf('normal')).toBe(1);
    expect(emotionScaleOf('reduzido')).toBe(0.5);
    expect(emotionScaleOf('desligado')).toBe(0);
    expect(targetHeightOf('maior')).toBeLessThan(targetHeightOf('grande'));
    expect(targetHeightOf('grande')).toBeLessThan(targetHeightOf('normal'));
  });

  it('remapear uma tecla troca com quem já a usava (nunca duas ações na mesma tecla)', () => {
    const s = defaultSettings();
    expect(rebind(s, 0, 'action', 'KeyG')).toBe(true); // G era a Ultimate do P1
    expect(s.keymaps[0]!.action).toBe('KeyG');
    expect(s.keymaps[0]!.ultimate).toBe('KeyF'); // trocou
    const todas = s.keymaps.flatMap((m) => Object.values(m));
    expect(new Set(todas).size).toBe(todas.length);
  });

  it('remapear para a mesma tecla não muda nada; tecla livre só substitui', () => {
    const s = defaultSettings();
    expect(rebind(s, 0, 'up', 'KeyW')).toBe(false);
    rebind(s, 0, 'up', 'KeyI');
    expect(s.keymaps[0]!.up).toBe('KeyI');
  });

  it('rótulos de teclas', () => {
    expect(keyLabel('KeyW')).toBe('W');
    expect(keyLabel('ArrowUp')).toBe('↑');
    expect(keyLabel('Numpad1')).toBe('Num 1');
    expect(keyLabel('Digit5')).toBe('5');
  });
});

describe('meta-progressão', () => {
  it('registra uma partida e guarda os recordes', () => {
    let m = defaultMeta();
    m = recordRun(m, { character: 'mauro', victory: false, kills: 120, seconds: 400.7 });
    m = recordRun(m, { character: 'mauro', victory: true, kills: 90, seconds: 900 });
    expect(m.runs).toBe(2);
    expect(m.wins).toBe(1);
    expect(m.totalKills).toBe(210);
    expect(m.bestKills).toBe(120);
    expect(m.bestTime).toBe(900);
    expect(m.perCharacter.mauro).toEqual({ runs: 2, wins: 1, bestKills: 120 });
    expect(m.perCharacter.felipe).toBeUndefined();
  });

  it('salva, carrega e ignora dados inválidos', () => {
    const st = new MemStorage();
    const m = recordRun(defaultMeta(), { character: 'thaisa', victory: true, kills: 5, seconds: 60 });
    saveMeta(m, st);
    expect(loadMeta(st)).toEqual(m);
    expect(sanitizeMeta({ runs: -4, wins: 'x', lastCharacter: 'lucas', lastCompanion: 'nobody' })).toEqual(defaultMeta());
    expect(loadMeta(null)).toEqual(defaultMeta());
  });

  it('formata a duração', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(905.4)).toBe('15:05');
  });
});

describe('teclas de escolher carta', () => {
  it('os padrões não dependem do teclado numérico', async () => {
    const { defaultSettings, keyLabel } = await import('./settings');
    const s = defaultSettings();
    expect(s.keymaps[1]!.card1).toBe('Digit4');
    expect(s.keymaps[1]!.action).toBe('Comma');
    expect(Object.values(s.keymaps[1]!).some((c) => c.startsWith('Numpad'))).toBe(false);
    expect(keyLabel('Digit4')).toBe('4');
  });

  it('configuração antiga do P2 (Numpad 1 e 2) migra para as teclas novas e guarda o resto', async () => {
    const { sanitizeSettings } = await import('./settings');
    const s = sanitizeSettings({ keymaps: [{ up: 'KeyI' }, { action: 'Numpad1', ultimate: 'Numpad2', left: 'KeyJ' }] });
    expect(s.keymaps[0]!.up).toBe('KeyI');
    expect(s.keymaps[1]!.action).toBe('Comma');
    expect(s.keymaps[1]!.ultimate).toBe('Period');
    expect(s.keymaps[1]!.left).toBe('KeyJ');
    expect(s.keymaps[1]!.card1).toBe('Digit4');
  });

  it('remapear uma carta para uma tecla já usada troca as duas', async () => {
    const { defaultSettings, rebind } = await import('./settings');
    const s = defaultSettings();
    expect(rebind(s, 1, 'card1', 'Digit9')).toBe(true);
    expect(s.keymaps[1]!.card1).toBe('Digit9');
    expect(rebind(s, 1, 'card2', 'Digit1')).toBe(true); // Digit1 era do P1
    expect(s.keymaps[0]!.card1).toBe('Digit5');
    const todas = s.keymaps.flatMap((m) => Object.values(m));
    expect(new Set(todas).size).toBe(todas.length);
  });
});
