// Tela HTML do co-op online: criar sala, entrar com o código e o lobby (personagem, pronto, configuração).
// É um painel por cima do canvas; o jogo em si continua no canvas.

import { CHARACTERS, type CharacterId } from '../data/characters';
import type { RoomState } from './client';

const ORDER: readonly CharacterId[] = ['felipe', 'mauro', 'melissa', 'thaisa', 'thayssa'];
const DELAY_LABEL: Record<number, string> = { 4: 'Rápido (conexão ótima)', 6: 'Normal', 10: 'Estável (conexão ruim)' };
const NAME_KEY = 'profecia.online.nome';

export interface LobbyHandlers {
  create(name: string): void;
  join(name: string, code: string): void;
  pick(c: CharacterId): void;
  ready(ready: boolean): void;
  config(delay: number, opts: { repeatInteractions: boolean; autoCutscene: boolean }): void;
  start(): void;
  /** Sai da sala ou fecha o painel (volta ao menu). */
  leave(): void;
}

const CSS = `
.on-status{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:40;display:none;max-width:92vw;background:#070914ee;border:2px solid #FFB43C;color:#FFB43C;font:400 14px Tiny5,Silkscreen,monospace;padding:6px 12px;text-transform:uppercase;text-align:center;pointer-events:none}
.on-status.on{display:block}
.on-status.warn{border-color:#FF5A6A;color:#FF5A6A}
.on-wrap{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(7,9,20,.94);z-index:50;font-family:Tiny5,Silkscreen,monospace;color:#FFF1D6}
.on-wrap.on{display:flex}
.on-box{width:min(560px,94vw);max-height:94vh;overflow:auto;background:#0B1030;border:3px solid #FFB43C;box-shadow:0 0 0 3px #070914,0 0 24px #FF4FA3aa;padding:18px 20px}
.on-box h1{margin:0 0 4px;font:400 28px 'Jersey 10',Silkscreen,monospace;color:#FF4FA3;letter-spacing:2px;text-transform:uppercase;text-shadow:0 0 8px #FF4FA388}
.on-box h2{margin:14px 0 6px;font:400 13px Silkscreen,monospace;color:#3FF0FF;text-transform:uppercase;letter-spacing:1px}
.on-box p{margin:4px 0;font-size:15px;color:#8F9AD0;line-height:1.3}
.on-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:6px 0}
.on-box input[type=text]{background:#070914;border:2px solid #3A4170;color:#FFF1D6;font:inherit;font-size:18px;padding:6px 8px;outline:none;text-transform:none;min-width:0;flex:1}
.on-box input[type=text]:focus{border-color:#3FF0FF}
.on-box input.code{text-transform:uppercase;letter-spacing:6px;text-align:center;max-width:120px;flex:none;font-size:22px}
.on-btn{background:#070914;color:#FFF1D6;border:2px solid #3FF0FF;font:400 13px Silkscreen,monospace;text-transform:uppercase;padding:8px 12px;cursor:pointer;letter-spacing:1px}
.on-btn:hover:not(:disabled){background:#3FF0FF;color:#070914}
.on-btn.pri{border-color:#FFB43C;color:#FFB43C}
.on-btn.pri:hover:not(:disabled){background:#FFB43C;color:#070914}
.on-btn:disabled{opacity:.35;cursor:default}
.on-err{min-height:20px;color:#FF5A6A;font-size:15px;margin-top:8px}
.on-code{font:400 40px 'Jersey 10',Silkscreen,monospace;color:#FFB43C;letter-spacing:10px;text-align:center;border:2px dashed #FFB43C;padding:2px 0 0 10px;cursor:pointer;user-select:all}
.on-mem{display:grid;grid-template-columns:1fr;gap:4px;margin:4px 0}
.on-m{display:flex;align-items:center;gap:8px;padding:5px 8px;border:2px solid #3A4170;background:#070914;font-size:16px}
.on-m.me{border-color:#3FF0FF}
.on-m .ch{color:#FFB43C;margin-left:auto;text-transform:uppercase}
.on-m .st{color:#7DFF8A;font-size:13px;text-transform:uppercase;min-width:60px;text-align:right}
.on-m .st.no{color:#6B7299}
.on-m .host{color:#FF4FA3;font-size:12px;text-transform:uppercase}
.on-chars{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
.on-chars button{min-height:46px;padding:4px 2px;font-size:11px;line-height:1.1}
.on-chars button.sel{background:#3FF0FF;color:#070914}
.on-chars button.tk{opacity:.3}
.on-chk{display:flex;align-items:center;gap:6px;font-size:15px;color:#8F9AD0}
.on-box select{background:#070914;color:#FFF1D6;border:2px solid #3A4170;font:inherit;font-size:15px;padding:5px}
@media (max-width:480px){.on-chars{grid-template-columns:repeat(3,1fr)}}
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export class LobbyView {
  private readonly wrap = el('div', 'on-wrap');
  private readonly box = el('div', 'on-box');
  private room: RoomState | null = null;
  private err = '';
  private name = loadName();
  private codeDraft = '';

  private readonly statusEl = el('div', 'on-status');
  private toastTimer = 0;
  private statusText: string | null = null;

  constructor(private readonly h: LobbyHandlers) {
    const style = el('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.wrap.appendChild(this.box);
    document.body.append(this.wrap, this.statusEl);
  }

  /** Aviso fixo no alto da tela (esperando alguém, jogos fora de sincronia). Nulo apaga. */
  setStatus(text: string | null): void {
    this.statusText = text;
    if (this.toastTimer === 0) this.paintStatus(text);
  }

  /** Aviso rápido (alguém saiu...). Depois volta para o aviso fixo, se houver. */
  toast(text: string, ms = 4500): void {
    window.clearTimeout(this.toastTimer);
    this.paintStatus(text);
    this.toastTimer = window.setTimeout(() => {
      this.toastTimer = 0;
      this.paintStatus(this.statusText);
    }, ms);
  }

  private paintStatus(text: string | null): void {
    this.statusEl.textContent = text ?? '';
    this.statusEl.classList.toggle('on', !!text);
    this.statusEl.classList.toggle('warn', !!text && text.includes('sincronia'));
  }

  get visible(): boolean {
    return this.wrap.classList.contains('on');
  }

  /** Abre o painel de entrada (criar ou entrar). `code` já vem preenchido pelo link `?sala=`. */
  open(code = ''): void {
    this.room = null;
    this.err = '';
    this.codeDraft = code.toUpperCase().slice(0, 4);
    this.wrap.classList.add('on');
    this.drawEntry();
  }

  hide(): void {
    this.wrap.classList.remove('on');
  }

  showError(msg: string): void {
    this.err = msg;
    const e = this.box.querySelector('.on-err');
    if (e) e.textContent = msg;
  }

  /** Estado novo da sala (chega a cada mudança). */
  update(room: RoomState): void {
    this.room = room;
    this.err = '';
    this.wrap.classList.add('on');
    this.drawRoom();
  }

  /** Voltou para a tela de entrada (conexão caiu ou saímos da sala). */
  reset(msg = ''): void {
    this.room = null;
    this.err = msg;
    if (this.visible) this.drawEntry();
  }

  // ------------------------------------------------------------------ entrada
  private drawEntry(): void {
    const b = this.box;
    b.replaceChildren();
    b.appendChild(el('h1', undefined, 'Co-op Online'));
    b.appendChild(el('p', undefined, 'Cada pessoa joga no próprio navegador, com um personagem. Uma cria a sala e passa o código de 4 letras para as outras.'));

    b.appendChild(el('h2', undefined, 'Seu nome'));
    const nome = el('input');
    nome.type = 'text';
    nome.maxLength = 14;
    nome.placeholder = 'Como te chamam?';
    nome.value = this.name;
    nome.addEventListener('input', () => {
      this.name = nome.value;
      try {
        localStorage.setItem(NAME_KEY, this.name);
      } catch {
        /* sem armazenamento: tudo bem */
      }
    });
    b.appendChild(nome);

    b.appendChild(el('h2', undefined, 'Criar uma sala'));
    const criar = el('button', 'on-btn pri', 'Criar sala');
    criar.addEventListener('click', () => this.h.create(this.nick()));
    b.appendChild(criar);

    b.appendChild(el('h2', undefined, 'Entrar numa sala'));
    const row = el('div', 'on-row');
    const code = el('input', 'code');
    code.type = 'text';
    code.maxLength = 4;
    code.placeholder = 'ABCD';
    code.value = this.codeDraft;
    code.addEventListener('input', () => {
      code.value = code.value.toUpperCase().replace(/[^A-Z]/g, '');
      this.codeDraft = code.value;
    });
    const entrar = el('button', 'on-btn', 'Entrar');
    const tentar = (): void => {
      if (this.codeDraft.length === 4) this.h.join(this.nick(), this.codeDraft);
      else this.showError('O código tem 4 letras.');
    };
    entrar.addEventListener('click', tentar);
    code.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') tentar();
    });
    row.append(code, entrar);
    b.appendChild(row);

    const err = el('div', 'on-err', this.err);
    b.appendChild(err);
    const voltar = el('button', 'on-btn', 'Voltar ao menu');
    voltar.addEventListener('click', () => this.h.leave());
    b.appendChild(voltar);
  }

  private nick(): string {
    return this.name.trim() || 'Jogador';
  }

  // ------------------------------------------------------------------ sala
  private drawRoom(): void {
    const room = this.room;
    if (!room) return;
    const b = this.box;
    b.replaceChildren();
    const eu = room.members.find((m) => m.id === room.you);
    const souHost = room.host === room.you;
    b.appendChild(el('h1', undefined, 'Sala de espera'));
    b.appendChild(el('p', undefined, 'Código da sala (clique para copiar o link):'));
    const code = el('div', 'on-code', room.code);
    code.addEventListener('click', () => {
      const link = `${window.location.origin}${window.location.pathname}?sala=${room.code}`;
      void navigator.clipboard?.writeText(link).then(
        () => this.flash(code, 'Link copiado!', room.code),
        () => {},
      );
    });
    b.appendChild(code);

    b.appendChild(el('h2', undefined, `Jogadores (${room.members.length}/5)`));
    const lista = el('div', 'on-mem');
    for (const m of room.members) {
      const linha = el('div', m.id === room.you ? 'on-m me' : 'on-m');
      linha.appendChild(el('span', undefined, m.name));
      if (m.id === room.host) linha.appendChild(el('span', 'host', 'anfitrião'));
      linha.appendChild(el('span', 'ch', m.character ? CHARACTERS[m.character].name : '—'));
      const ok = m.ready || m.id === room.host;
      linha.appendChild(el('span', ok ? 'st' : 'st no', ok ? 'pronto' : 'escolhendo'));
      lista.appendChild(linha);
    }
    b.appendChild(lista);

    b.appendChild(el('h2', undefined, 'Seu personagem'));
    const chars = el('div', 'on-chars');
    for (const c of ORDER) {
      const dono = room.members.find((m) => m.character === c);
      const btn = el('button', 'on-btn' + (eu?.character === c ? ' sel' : '') + (dono && dono.id !== room.you ? ' tk' : ''), CHARACTERS[c].name);
      btn.disabled = !!dono && dono.id !== room.you;
      btn.title = CHARACTERS[c].title;
      btn.addEventListener('click', () => this.h.pick(c));
      chars.appendChild(btn);
    }
    b.appendChild(chars);

    if (souHost) {
      b.appendChild(el('h2', undefined, 'Configuração (anfitrião)'));
      const row = el('div', 'on-row');
      const sel = el('select');
      for (const d of [4, 6, 10]) {
        const o = el('option', undefined, DELAY_LABEL[d]);
        o.value = String(d);
        o.selected = room.delay === d;
        sel.appendChild(o);
      }
      const rep = this.chk('Repetir conversas', this.opts.repeatInteractions);
      const auto = this.chk('Cutscenes sozinhas', this.opts.autoCutscene);
      const enviar = (): void => {
        this.opts = { repeatInteractions: rep.input.checked, autoCutscene: auto.input.checked };
        this.h.config(Number(sel.value), this.opts);
      };
      sel.addEventListener('change', enviar);
      rep.input.addEventListener('change', enviar);
      auto.input.addEventListener('change', enviar);
      row.append(sel, rep.label, auto.label);
      b.appendChild(row);
      b.appendChild(el('p', undefined, 'Atraso de entrada: quanto maior, mais suave com internet lenta, mas os controles respondem um pouco mais tarde.'));
    }

    b.appendChild(el('div', 'on-err', this.err));
    const acoes = el('div', 'on-row');
    if (souHost) {
      const todos = room.members.every((m) => m.character !== null && (m.ready || m.id === room.host));
      const ini = el('button', 'on-btn pri', 'Iniciar partida');
      ini.disabled = !todos;
      ini.addEventListener('click', () => this.h.start());
      acoes.appendChild(ini);
      if (!todos) acoes.appendChild(el('p', undefined, 'Esperando todo mundo ficar pronto.'));
    } else {
      const pronto = eu?.ready ?? false;
      const btn = el('button', 'on-btn pri', pronto ? 'Não estou pronto' : 'Estou pronto!');
      btn.disabled = !eu?.character;
      btn.addEventListener('click', () => this.h.ready(!pronto));
      acoes.appendChild(btn);
      acoes.appendChild(el('p', undefined, 'O anfitrião inicia a partida.'));
    }
    const sair = el('button', 'on-btn', 'Sair da sala');
    sair.addEventListener('click', () => this.h.leave());
    acoes.appendChild(sair);
    b.appendChild(acoes);
  }

  private opts = { repeatInteractions: false, autoCutscene: false };

  private chk(texto: string, marcado: boolean): { label: HTMLLabelElement; input: HTMLInputElement } {
    const label = el('label', 'on-chk');
    const input = el('input');
    input.type = 'checkbox';
    input.checked = marcado;
    label.append(input, texto);
    return { label, input };
  }

  private flash(target: HTMLElement, text: string, back: string): void {
    target.textContent = text;
    window.setTimeout(() => {
      if (target.isConnected) target.textContent = back;
    }, 1200);
  }
}
