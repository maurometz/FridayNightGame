// Menus do jogo (GDD A.12): lógica das telas, sem desenho. A parte visual está em menuView.ts.
// Navegação por teclado (setas ou WASD, Enter, Esc) e por mouse. As teclas do menu são fixas:
// só as teclas de jogo são remapeáveis.

import { CHARACTERS, type CharacterId } from '../data/characters';
import { DEVICES, DEVICE_LABEL, MAX_LOCAL_PLAYERS, dispositivosPadrao, type DeviceId } from '../data/controls';
import { PHASES } from '../data/acts';
import { CODEX_ORDER } from '../data/codex';
import { COLLECTIBLES } from '../data/gallery';
import type { MetaProgress } from '../game/meta';
import type { PlayerCards } from './cardsInfo';
import { DEV_DANOS, DEV_DURACOES, KEY_ACTIONS, defaultSettings, keyLabel, rebind, type EmotionLevel, type KeyAction, type Settings, type TextSize, type DevSettings } from '../game/settings';

export type Screen = 'title' | 'select' | 'controls' | 'options' | 'upgrades' | 'about' | 'soon' | 'pause' | 'cards' | 'dev' | 'gallery' | 'codex' | 'lobby';

/** Jogador do co-op local: personagem e dispositivo de entrada. */
export interface LobbyPlayer {
  character: CharacterId;
  device: DeviceId;
}

export type MenuAction =
  | { type: 'start'; character: CharacterId; companion: CharacterId | null; dev?: DevSettings }
  /** Co-op local: de 2 a 5 pessoas, cada uma com personagem e dispositivo. */
  | { type: 'startLocal'; players: LobbyPlayer[] }
  /** Abre o co-op online (sala e lobby, em HTML). */
  | { type: 'online' }
  | { type: 'resume' }
  | { type: 'quit' }
  /** As opções mudaram: salvar e aplicar. */
  | { type: 'settings' };

export interface MenuItem {
  id: string;
  label: string;
  value?: string;
  disabled?: boolean;
}

export const CHARACTER_ORDER: readonly CharacterId[] = ['felipe', 'mauro', 'melissa', 'thaisa', 'thayssa'];

const EMOTION_ORDER: readonly EmotionLevel[] = ['normal', 'reduzido', 'desligado'];
const EMOTION_LABEL: Record<EmotionLevel, string> = { normal: 'Normal', reduzido: 'Reduzido', desligado: 'Desligado' };
const TEXT_ORDER: readonly TextSize[] = ['normal', 'grande', 'maior'];
const TEXT_LABEL: Record<TextSize, string> = { normal: 'Normal', grande: 'Grande', maior: 'Maior' };

export const ACTION_LABEL: Record<KeyAction, string> = {
  up: 'Cima',
  down: 'Baixo',
  left: 'Esquerda',
  right: 'Direita',
  action: 'Ação',
  ultimate: 'Ultimate',
  card1: 'Carta 1',
  card2: 'Carta 2',
  card3: 'Carta 3',
  reroll: 'Rerolar',
};

const SOON_TEXT: Record<string, string[]> = {
  local: ['Co-op Local', 'Dois a cinco jogadores no mesmo computador,', 'com teclado e controles. Chega na Fase 9.'],
  online: ['Co-op Online', 'Jogue com os amigos pela internet,', 'com um código de 4 letras. Chega na Fase 10.'],
};

export function slider(n: number): string {
  return `[${'#'.repeat(n)}${'-'.repeat(10 - n)}]`;
}

export class Menu {
  screen: Screen = 'title';
  cursor = 0;
  character: CharacterId;
  companion: CharacterId | null;
  /** Em captura de tecla (tela de controles): qual ação está esperando uma tecla. */
  capturing: { player: number; action: KeyAction } | null = null;
  /** Qual aviso "em breve" está aberto. */
  soon: 'local' | 'online' = 'local';
  /** Co-op local: quantos jogadores (2 a 5) e a escolha de cada um. */
  lobbyCount = 2;
  lobby: LobbyPlayer[] = [];
  /** De onde viemos (para o Esc voltar certo). */
  private stack: { screen: Screen; cursor: number }[] = [];
  /** Cartas de cada jogador (tela de cartas da pausa) e qual aba está aberta. */
  cards: PlayerCards[] = [];
  cardsTab = 0;
  /** Retângulos clicáveis da última vez que a tela foi desenhada (preenchido pelo menuView). */
  hits: { x: number; y: number; w: number; h: number; index: number }[] = [];

  constructor(
    public settings: Settings,
    public meta: MetaProgress,
  ) {
    this.character = meta.lastCharacter;
    this.companion = meta.lastCompanion && meta.lastCompanion !== meta.lastCharacter ? meta.lastCompanion : null;
  }

  // ------------------------------------------------------------------ itens de cada tela
  items(): MenuItem[] {
    const s = this.settings;
    switch (this.screen) {
      case 'title':
        return [
          { id: 'solo', label: 'Solo' },
          { id: 'local', label: 'Co-op Local', value: '2 a 5 jogadores' },
          { id: 'online', label: 'Co-op Online', value: 'com amigos' },
          { id: 'upgrades', label: 'Melhorias' },
          { id: 'controls', label: 'Controles' },
          { id: 'options', label: 'Opções' },
          { id: 'about', label: 'Sobre' },
          { id: 'gallery', label: 'Galeria do Mauro' },
          { id: 'codex', label: 'Códice' },
          { id: 'dev', label: 'Modo Dev' },
        ];
      case 'pause':
        return [
          { id: 'resume', label: 'Continuar' },
          { id: 'cards', label: 'Cartas' },
          { id: 'controls', label: 'Controles' },
          { id: 'options', label: 'Opções' },
          { id: 'quit', label: 'Voltar ao menu' },
        ];
      case 'options':
        return [
          { id: 'music', label: 'Volume da música', value: slider(s.musicVolume) },
          { id: 'sfx', label: 'Volume dos efeitos', value: slider(s.sfxVolume) },
          { id: 'mute', label: 'Mudo', value: s.muted ? 'sim' : 'não' },
          { id: 'shake', label: 'Reduzir tremor de tela', value: s.reduceShake ? 'sim' : 'não' },
          { id: 'flash', label: 'Reduzir flashes', value: s.reduceFlash ? 'sim' : 'não' },
          { id: 'emotion', label: 'Ciclo emocional (paletas)', value: EMOTION_LABEL[s.emotion] },
          { id: 'text', label: 'Tamanho do texto', value: TEXT_LABEL[s.textSize] },
          { id: 'repeat', label: 'Repetir interações vistas', value: s.repeatInteractions ? 'sim' : 'não' },
          { id: 'autocut', label: 'Cutscenes passam sozinhas', value: s.autoCutscene ? 'sim' : 'não' },
          { id: 'back', label: 'Voltar' },
        ];
      case 'dev': {
        const d = s.dev;
        return [
          { id: 'dev:char', label: 'Personagem', value: CHARACTERS[this.character].name },
          { id: 'dev:comp', label: 'Companheiro', value: this.companion ? CHARACTERS[this.companion].name : 'nenhum' },
          { id: 'dev:fase', label: 'Fase inicial', value: `${d.fase}: ${PHASES[d.fase - 1]?.name ?? ''}` },
          { id: 'dev:dur', label: 'Duração da fase', value: d.duracaoS === 0 ? 'padrão' : `${d.duracaoS} s` },
          { id: 'dev:inv', label: 'Invulnerável', value: d.invulneravel ? 'sim' : 'não' },
          { id: 'dev:dano', label: 'Dano causado', value: `x${d.danoMul}` },
          { id: 'dev:cut', label: 'Cutscenes', value: d.cutscenes ? 'sim' : 'não' },
          { id: 'dev:go', label: 'Começar' },
          { id: 'back', label: 'Voltar' },
        ];
      }
      case 'lobby': {
        const out: MenuItem[] = [{ id: 'lobby:count', label: 'Jogadores', value: String(this.lobbyCount) }];
        for (let i = 0; i < this.lobbyCount; i++) {
          const j = this.lobby[i]!;
          out.push({ id: `lobby:char:${i}`, label: `Jogador ${i + 1}`, value: CHARACTERS[j.character].name });
          out.push({ id: `lobby:dev:${i}`, label: '   Controle', value: DEVICE_LABEL[j.device] });
        }
        out.push({ id: 'lobby:go', label: 'Começar' });
        out.push({ id: 'back', label: 'Voltar' });
        return out;
      }
      case 'controls': {
        const out: MenuItem[] = [];
        for (let p = 0; p < 2; p++) {
          for (const a of KEY_ACTIONS) {
            const cap = this.capturing?.player === p && this.capturing.action === a;
            out.push({ id: `key:${p}:${a}`, label: ACTION_LABEL[a], value: cap ? 'pressione uma tecla...' : keyLabel(s.keymaps[p]![a]) });
          }
        }
        out.push({ id: 'reset', label: 'Restaurar padrões' });
        out.push({ id: 'back', label: 'Voltar' });
        return out;
      }
      default:
        return [];
    }
  }

  // ------------------------------------------------------------------ navegação
  open(screen: Screen): void {
    this.stack.push({ screen: this.screen, cursor: this.cursor });
    this.screen = screen;
    this.cursor = screen === 'select' ? 2 : 0;
  }

  /** Volta uma tela. Na pausa, o Esc continua a partida. */
  back(): MenuAction | null {
    this.capturing = null;
    const prev = this.stack.pop();
    if (!prev) return this.screen === 'pause' ? { type: 'resume' } : null;
    this.screen = prev.screen;
    this.cursor = prev.cursor;
    return null;
  }

  /** Abre o menu de pausa (a partir do jogo). Com `cards`, já abre a tela das cartas (atalho Tab). */
  openPause(cards: PlayerCards[] = this.cards, aberto: 'pause' | 'cards' = 'pause'): void {
    this.cards = cards;
    this.cardsTab = Math.min(this.cardsTab, Math.max(0, cards.length - 1));
    this.stack = [];
    this.screen = 'pause';
    this.cursor = 0;
    this.capturing = null;
    if (aberto === 'cards') this.open('cards');
  }

  /** Cartas da aba aberta. */
  currentCards(): PlayerCards | undefined {
    return this.cards[this.cardsTab];
  }

  /** Volta ao título (depois de sair de uma partida). */
  openTitle(): void {
    this.stack = [];
    this.screen = 'title';
    this.cursor = 0;
    this.capturing = null;
  }

  private move(delta: number): void {
    const n = this.screen === 'select' ? 3 : this.items().length;
    if (n === 0) return;
    this.cursor = (this.cursor + delta + n) % n;
  }

  /** Companheiros possíveis: ninguém ou qualquer personagem diferente do escolhido. */
  companionChoices(): (CharacterId | null)[] {
    return [null, ...CHARACTER_ORDER.filter((c) => c !== this.character)];
  }

  private cycleCompanion(dir: number): void {
    const list = this.companionChoices();
    const i = list.indexOf(this.companion);
    this.companion = list[(i + dir + list.length) % list.length] ?? null;
  }

  private cycleCharacter(dir: number): void {
    const i = CHARACTER_ORDER.indexOf(this.character);
    this.character = CHARACTER_ORDER[(i + dir + CHARACTER_ORDER.length) % CHARACTER_ORDER.length]!;
    if (this.companion === this.character) this.companion = null;
  }

  private startAction(): MenuAction {
    return { type: 'start', character: this.character, companion: this.companion };
  }

  // ------------------------------------------------------------------ opções
  /** Muda o valor da opção sob o cursor: dir = +1/-1 (setas) ou 0 (Enter alterna). */
  private changeOption(id: string, dir: number): MenuAction | null {
    const s = this.settings;
    const cycle = <T>(list: readonly T[], cur: T): T => list[(list.indexOf(cur) + (dir === 0 ? 1 : dir) + list.length) % list.length]!;
    switch (id) {
      case 'music':
        s.musicVolume = dir === 0 ? (s.musicVolume + 1) % 11 : Math.min(10, Math.max(0, s.musicVolume + dir));
        break;
      case 'sfx':
        s.sfxVolume = dir === 0 ? (s.sfxVolume + 1) % 11 : Math.min(10, Math.max(0, s.sfxVolume + dir));
        break;
      case 'mute':
        s.muted = !s.muted;
        break;
      case 'shake':
        s.reduceShake = !s.reduceShake;
        break;
      case 'flash':
        s.reduceFlash = !s.reduceFlash;
        break;
      case 'emotion':
        s.emotion = cycle(EMOTION_ORDER, s.emotion);
        break;
      case 'text':
        s.textSize = cycle(TEXT_ORDER, s.textSize);
        break;
      case 'repeat':
        s.repeatInteractions = !s.repeatInteractions;
        break;
      case 'autocut':
        s.autoCutscene = !s.autoCutscene;
        break;
      default:
        return null;
    }
    return { type: 'settings' };
  }

  /** Muda um valor do modo dev: dir = +1/-1 (setas) ou 0 (Enter avança). */
  private changeDev(id: string, dir: number): MenuAction | null {
    const d = this.settings.dev;
    const passo = dir === 0 ? 1 : dir;
    const ciclo = <T>(lista: readonly T[], atual: T): T => lista[(Math.max(0, lista.indexOf(atual)) + passo + lista.length) % lista.length]!;
    switch (id) {
      case 'dev:char':
        this.cycleCharacter(passo);
        break;
      case 'dev:comp':
        this.cycleCompanion(passo);
        break;
      case 'dev:fase':
        d.fase = ((d.fase - 1 + passo + PHASES.length) % PHASES.length) + 1;
        break;
      case 'dev:dur':
        d.duracaoS = ciclo(DEV_DURACOES, d.duracaoS);
        break;
      case 'dev:inv':
        d.invulneravel = !d.invulneravel;
        break;
      case 'dev:dano':
        d.danoMul = ciclo(DEV_DANOS, d.danoMul);
        break;
      case 'dev:cut':
        d.cutscenes = !d.cutscenes;
        break;
      default:
        return null;
    }
    return { type: 'settings' };
  }

  // ------------------------------------------------------------------ lobby (co-op local)
  /** Monta o lobby com os padrões: o personagem escolhido por último e, depois, os outros em ordem. */
  private prepararLobby(): void {
    const chars: CharacterId[] = [this.character, ...CHARACTER_ORDER.filter((c) => c !== this.character)];
    const devs = dispositivosPadrao(MAX_LOCAL_PLAYERS);
    this.lobby = chars.slice(0, MAX_LOCAL_PLAYERS).map((character, i) => ({ character, device: devs[i]! }));
    this.lobbyCount = Math.min(Math.max(2, this.lobbyCount), MAX_LOCAL_PLAYERS);
  }

  /** Próximo valor de `lista`, na direção `dir`, que ninguém mais está usando. */
  private proximoLivre<T>(lista: readonly T[], atual: T, dir: number, emUso: (v: T) => boolean): T {
    const n = lista.length;
    let k = lista.indexOf(atual);
    for (let t = 0; t < n; t++) {
      k = (k + dir + n) % n;
      if (!emUso(lista[k]!)) return lista[k]!;
    }
    return atual;
  }

  /** Muda um valor do lobby: dir = +1/-1 (setas) ou 0 (Enter avança). */
  private changeLobby(id: string, dir: number): MenuAction | null {
    const passo = dir === 0 ? 1 : dir;
    if (id === 'lobby:count') {
      this.lobbyCount = Math.min(MAX_LOCAL_PLAYERS, Math.max(2, this.lobbyCount + passo));
      this.conferirLobby();
      return null;
    }
    if (id === 'lobby:go') return { type: 'startLocal', players: this.lobby.slice(0, this.lobbyCount).map((j) => ({ ...j })) };
    const [, tipo, idx] = id.split(':');
    const i = Number(idx);
    const j = this.lobby[i];
    if (!j) return null;
    const ativos = this.lobby.slice(0, this.lobbyCount);
    if (tipo === 'char') j.character = this.proximoLivre(CHARACTER_ORDER, j.character, passo, (c) => ativos.some((o, k) => k !== i && o.character === c));
    else if (tipo === 'dev') j.device = this.proximoLivre(DEVICES, j.device, passo, (d) => ativos.some((o, k) => k !== i && o.device === d));
    return null;
  }

  /** Garante que os jogadores ativos não repetem personagem nem dispositivo (depois de aumentar o número de jogadores). */
  private conferirLobby(): void {
    const ativos = this.lobby.slice(0, this.lobbyCount);
    for (let i = 1; i < ativos.length; i++) {
      const j = ativos[i]!;
      const antes = ativos.slice(0, i);
      if (antes.some((o) => o.character === j.character)) j.character = CHARACTER_ORDER.find((c) => !ativos.some((o, k) => k !== i && o.character === c)) ?? j.character;
      if (antes.some((o) => o.device === j.device)) j.device = DEVICES.find((d) => !ativos.some((o, k) => k !== i && o.device === d)) ?? j.device;
    }
  }

  // ------------------------------------------------------------------ entrada
  /** Ativa o item sob o cursor (Enter, Espaço ou clique). */
  activate(): MenuAction | null {
    if (this.screen === 'select') return this.startAction();
    if (this.screen === 'upgrades' || this.screen === 'about' || this.screen === 'soon') return this.back();
    const item = this.items()[this.cursor];
    if (!item) return null;
    switch (item.id) {
      case 'solo':
        this.open('select');
        return null;
      case 'local':
        this.prepararLobby();
        this.open('lobby');
        return null;
      case 'online':
        return { type: 'online' };
      case 'upgrades':
      case 'controls':
      case 'options':
      case 'dev':
      case 'gallery':
      case 'codex':
      case 'about':
        this.open(item.id);
        return null;
      case 'cards':
        this.open('cards');
        this.cardsTab = 0;
        this.cursor = 0;
        return null;
      case 'resume':
        return { type: 'resume' };
      case 'quit':
        return { type: 'quit' };
      case 'back':
        return this.back();
      case 'reset': {
        this.settings.keymaps = defaultSettings().keymaps;
        return { type: 'settings' };
      }
      default:
        if (item.id === 'dev:go') return { type: 'start', character: this.character, companion: this.companion, dev: { ...this.settings.dev } };
        if (item.id.startsWith('dev:')) return this.changeDev(item.id, 0);
        if (item.id.startsWith('lobby:')) return this.changeLobby(item.id, 0);
        if (item.id.startsWith('key:')) {
          const [, p, a] = item.id.split(':');
          this.capturing = { player: Number(p), action: a as KeyAction };
          return null;
        }
        return this.changeOption(item.id, 0);
    }
  }

  /** Uma tecla do teclado. `code` é KeyboardEvent.code. */
  key(code: string): MenuAction | null {
    // Captura de tecla: a próxima tecla vira o novo atalho (Esc cancela).
    if (this.capturing) {
      const c = this.capturing;
      this.capturing = null;
      if (code === 'Escape') return null;
      return rebind(this.settings, c.player, c.action, code) ? { type: 'settings' } : null;
    }
    const up = code === 'ArrowUp' || code === 'KeyW';
    const down = code === 'ArrowDown' || code === 'KeyS';
    const left = code === 'ArrowLeft' || code === 'KeyA';
    const right = code === 'ArrowRight' || code === 'KeyD';
    const ok = code === 'Enter' || code === 'Space' || code === 'NumpadEnter';

    if (code === 'Escape' || code === 'Backspace') return this.back();
    // Tab abre as cartas a partir da pausa.
    if (code === 'Tab' && this.screen === 'pause') {
      this.open('cards');
      this.cardsTab = 0;
      this.cursor = 0;
      return null;
    }

    if (this.screen === 'select') {
      if (up) this.move(-1);
      else if (down) this.move(1);
      else if (left || right) {
        const d = right ? 1 : -1;
        if (this.cursor === 1) this.cycleCompanion(d);
        else this.cycleCharacter(d);
      } else if (ok) return this.startAction();
      return null;
    }
    if (this.screen === 'upgrades' || this.screen === 'about' || this.screen === 'soon') {
      return ok ? this.back() : null;
    }
    if (this.screen === 'gallery' || this.screen === 'codex') {
      const n = this.screen === 'gallery' ? COLLECTIBLES.length : CODEX_ORDER.length;
      const mais = this.screen === 'gallery' ? down : right || down;
      const menos = this.screen === 'gallery' ? up : left || up;
      if (mais) this.cursor = (this.cursor + 1) % n;
      else if (menos) this.cursor = (this.cursor - 1 + n) % n;
      else if (ok) return this.back();
      return null;
    }
    if (this.screen === 'cards') {
      const n = this.currentCards()?.entries.length ?? 0;
      if (up && n > 0) this.cursor = (this.cursor - 1 + n) % n;
      else if (down && n > 0) this.cursor = (this.cursor + 1) % n;
      else if ((left || right) && this.cards.length > 1) {
        this.cardsTab = (this.cardsTab + (right ? 1 : -1) + this.cards.length) % this.cards.length;
        this.cursor = 0;
      } else if (ok || code === 'Tab') return this.back();
      return null;
    }

    if (up) this.move(-1);
    else if (down) this.move(1);
    else if ((left || right) && this.screen === 'controls') {
      // Duas colunas (P1 e P2): as setas laterais pulam de uma para a outra.
      const n = this.items().length;
      const por = KEY_ACTIONS.length;
      if (this.cursor < por * 2) this.cursor = (this.cursor + por) % (por * 2);
      else this.cursor = Math.min(this.cursor, n - 1);
    } else if (left || right) {
      const item = this.items()[this.cursor];
      if (item && this.screen === 'options') return this.changeOption(item.id, right ? 1 : -1);
      if (item && this.screen === 'dev') return this.changeDev(item.id, right ? 1 : -1);
      if (item && this.screen === 'lobby') return this.changeLobby(item.id, right ? 1 : -1);
    } else if (ok) return this.activate();
    return null;
  }

  /** Mouse passou por cima de um item da lista (ou da linha da seleção). */
  hover(index: number): void {
    if (this.capturing) return;
    if (this.screen === 'cards') {
      if (index < 100) this.cursor = index;
      return;
    }
    if (this.screen === 'select') {
      if (index === 5) this.cursor = 1;
      else if (index === 6) this.cursor = 2;
      return;
    }
    this.cursor = index;
  }

  /** Clique em um item. Na seleção, `index` 0 a 4 escolhe o personagem, 5 o companheiro e 6 começa. */
  click(index: number): MenuAction | null {
    if (this.screen === 'select') {
      if (index < 5) {
        this.character = CHARACTER_ORDER[index]!;
        if (this.companion === this.character) this.companion = null;
        this.cursor = 0;
        return null;
      }
      if (index === 5) {
        this.cursor = 1;
        this.cycleCompanion(1);
        return null;
      }
      return this.startAction();
    }
    if (this.screen === 'gallery' || this.screen === 'codex') {
      this.cursor = index;
      return null;
    }
    if (this.screen === 'upgrades' || this.screen === 'about' || this.screen === 'soon') return this.back();
    if (this.screen === 'cards') {
      // Cliques nas abas (índices 100+) trocam de jogador; nas linhas, selecionam a carta.
      if (index >= 100) {
        this.cardsTab = index - 100;
        this.cursor = 0;
      } else this.cursor = index;
      return null;
    }
    if (this.capturing) {
      this.capturing = null;
      return null;
    }
    this.cursor = index;
    return this.activate();
  }
}

/** Texto do aviso "em breve". */
export function soonText(which: 'local' | 'online'): string[] {
  return SOON_TEXT[which]!;
}

