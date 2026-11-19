import { describe, expect, it } from 'vitest';
import { defaultMeta } from '../game/meta';
import { defaultSettings } from '../game/settings';
import { Menu } from './menu';
import { KEY_ACTIONS } from '../game/settings';

const novo = (): Menu => new Menu(defaultSettings(), defaultMeta());
const aperta = (m: Menu, ...codes: string[]): ReturnType<Menu['key']> => {
  let r: ReturnType<Menu['key']> = null;
  for (const c of codes) r = m.key(c) ?? r;
  return r;
};

describe('menu principal', () => {
  it('tem as sete entradas do GDD, na ordem, e o Modo Dev no fim', () => {
    expect(novo().items().map((i) => i.label)).toEqual(['Solo', 'Co-op Local', 'Co-op Online', 'Melhorias', 'Controles', 'Opções', 'Sobre', 'Galeria do Mauro', 'Códice', 'Modo Dev']);
  });

  it('navega com setas e WASD, dando a volta nas pontas', () => {
    const m = novo();
    m.key('ArrowUp');
    expect(m.cursor).toBe(9);
    m.key('KeyS');
    expect(m.cursor).toBe(0);
  });

  it('Co-op Local abre o lobby com 2 jogadores, cada um com personagem e dispositivo próprios', () => {
    const m = novo();
    aperta(m, 'ArrowDown', 'Enter');
    expect(m.screen).toBe('lobby');
    expect(m.lobbyCount).toBe(2);
    const a = m.items().find((i) => i.id === 'lobby:go');
    expect(a).toBeDefined();
    m.cursor = m.items().findIndex((i) => i.id === 'lobby:go');
    const start = m.key('Enter');
    expect(start).toMatchObject({ type: 'startLocal' });
    if (start?.type !== 'startLocal') throw new Error('ação');
    expect(start.players).toHaveLength(2);
    expect(start.players[0]!.device).toBe('teclado1');
    expect(start.players[1]!.device).toBe('teclado2');
    expect(new Set(start.players.map((p) => p.character)).size).toBe(2);
  });

  it('o lobby vai até 5 jogadores, sem repetir personagem nem dispositivo', () => {
    const m = novo();
    aperta(m, 'ArrowDown', 'Enter'); // abre o lobby, cursor em "Jogadores"
    for (let i = 0; i < 6; i++) m.key('ArrowRight');
    expect(m.lobbyCount).toBe(5);
    m.cursor = m.items().findIndex((i) => i.id === 'lobby:go');
    const start = m.key('Enter');
    if (start?.type !== 'startLocal') throw new Error('ação');
    expect(start.players).toHaveLength(5);
    expect(new Set(start.players.map((p) => p.character)).size).toBe(5);
    expect(new Set(start.players.map((p) => p.device)).size).toBe(5);
    m.cursor = 0;
    for (let i = 0; i < 8; i++) m.key('ArrowLeft');
    expect(m.lobbyCount).toBe(2);
  });

  it('trocar o personagem ou o dispositivo de um jogador pula os que já estão em uso', () => {
    const m = novo();
    aperta(m, 'ArrowDown', 'Enter');
    const quem = m.items().findIndex((i) => i.id === 'lobby:char:0');
    m.cursor = quem;
    const antes = m.lobby[0]!.character;
    m.key('ArrowRight');
    expect(m.lobby[0]!.character).not.toBe(antes);
    expect(m.lobby[0]!.character).not.toBe(m.lobby[1]!.character);
    m.cursor = m.items().findIndex((i) => i.id === 'lobby:dev:0');
    m.key('ArrowRight');
    expect(m.lobby[0]!.device).not.toBe('teclado2');
    expect(m.lobby[0]!.device).not.toBe(m.lobby[1]!.device);
  });

  it('Online pede para abrir o painel do co-op online e o menu continua no título', () => {
    const m = novo();
    aperta(m, 'ArrowDown', 'ArrowDown');
    expect(m.key('Enter')).toEqual({ type: 'online' });
    expect(m.screen).toBe('title');
  });

  it('Solo continua deixando escolher "nenhum" companheiro', () => {
    const m = novo();
    m.key('Enter');
    expect(m.screen).toBe('select');
    expect(m.companionChoices()).toContain(null);
  });

  it('Melhorias e Sobre abrem e fecham', () => {
    const m = novo();
    aperta(m, 'ArrowDown', 'ArrowDown', 'ArrowDown', 'Enter');
    expect(m.screen).toBe('upgrades');
    m.key('Enter');
    expect(m.screen).toBe('title');
  });
});

describe('seleção de personagem (Solo)', () => {
  it('Solo abre a seleção com o cursor em JOGAR; Enter começa com o personagem padrão', () => {
    const m = novo();
    m.key('Enter');
    expect(m.screen).toBe('select');
    expect(m.key('Enter')).toEqual({ type: 'start', character: 'felipe', companion: null });
  });

  it('setas trocam de personagem e o companheiro nunca é o mesmo personagem', () => {
    const m = novo();
    m.key('Enter');
    m.key('ArrowRight');
    expect(m.character).toBe('mauro');
    m.key('ArrowUp'); // linha do companheiro
    m.key('ArrowRight');
    expect(m.companion).toBe('felipe');
    // Trocar o personagem para o companheiro atual limpa o companheiro.
    m.key('ArrowUp'); // linha do personagem
    m.cursor = 0;
    m.key('ArrowLeft');
    expect(m.character).toBe('felipe');
    expect(m.companion).toBeNull();
    expect(m.companionChoices()).not.toContain('felipe');
  });

  it('Esc na seleção volta ao título; lembra as últimas escolhas da meta', () => {
    const meta = { ...defaultMeta(), lastCharacter: 'thaisa' as const, lastCompanion: 'thayssa' as const };
    const m = new Menu(defaultSettings(), meta);
    expect(m.character).toBe('thaisa');
    expect(m.companion).toBe('thayssa');
    m.key('Enter');
    m.key('Escape');
    expect(m.screen).toBe('title');
  });

  it('companheiro salvo igual ao personagem é descartado', () => {
    const m = new Menu(defaultSettings(), { ...defaultMeta(), lastCharacter: 'mauro', lastCompanion: 'mauro' });
    expect(m.companion).toBeNull();
  });
});

describe('opções', () => {
  function abre(m: Menu): void {
    aperta(m, 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'Enter'); // Opções é o 6º item
    expect(m.screen).toBe('options');
  }

  it('setas mudam volume e emitem "settings"', () => {
    const m = novo();
    abre(m);
    const antes = m.settings.musicVolume;
    expect(m.key('ArrowRight')).toEqual({ type: 'settings' });
    expect(m.settings.musicVolume).toBe(antes + 1);
    m.key('ArrowLeft');
    m.key('ArrowLeft');
    expect(m.settings.musicVolume).toBe(antes - 1);
  });

  it('Enter alterna mudo, flashes e o ciclo emocional', () => {
    const m = novo();
    abre(m);
    m.cursor = 2;
    m.key('Enter');
    expect(m.settings.muted).toBe(true);
    m.cursor = 4;
    m.key('Enter');
    expect(m.settings.reduceFlash).toBe(true);
    m.cursor = 5;
    m.key('Enter');
    expect(m.settings.emotion).toBe('reduzido');
    m.key('Enter');
    expect(m.settings.emotion).toBe('desligado');
    m.cursor = 6;
    m.key('Enter');
    expect(m.settings.textSize).toBe('grande');
  });

  it('volume nunca passa de 0 a 10', () => {
    const m = novo();
    abre(m);
    for (let i = 0; i < 20; i++) m.key('ArrowRight');
    expect(m.settings.musicVolume).toBe(10);
    for (let i = 0; i < 20; i++) m.key('ArrowLeft');
    expect(m.settings.musicVolume).toBe(0);
  });
});

describe('controles', () => {
  function abre(m: Menu): void {
    aperta(m, 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'Enter'); // Controles é o 5º item
    expect(m.screen).toBe('controls');
  }

  it('Enter espera uma tecla e a tecla vira o atalho', () => {
    const m = novo();
    abre(m);
    m.cursor = 4; // Ação do P1
    m.key('Enter');
    expect(m.capturing).toEqual({ player: 0, action: 'action' });
    expect(m.key('KeyZ')).toEqual({ type: 'settings' });
    expect(m.settings.keymaps[0]!.action).toBe('KeyZ');
    expect(m.capturing).toBeNull();
  });

  it('Esc cancela a captura sem mudar nada e sem sair da tela', () => {
    const m = novo();
    abre(m);
    m.cursor = 0;
    m.key('Enter');
    m.key('Escape');
    expect(m.screen).toBe('controls');
    expect(m.settings.keymaps[0]!.up).toBe('KeyW');
  });

  it('usar uma tecla que já é de outra ação troca as duas', () => {
    const m = novo();
    abre(m);
    m.cursor = 4;
    m.key('Enter');
    m.key('KeyG'); // era a Ultimate
    expect(m.settings.keymaps[0]!.action).toBe('KeyG');
    expect(m.settings.keymaps[0]!.ultimate).toBe('KeyF');
  });

  it('restaurar padrões', () => {
    const m = novo();
    abre(m);
    m.cursor = 0;
    m.key('Enter');
    m.key('KeyI');
    m.cursor = KEY_ACTIONS.length * 2;
    expect(m.key('Enter')).toEqual({ type: 'settings' });
    expect(m.settings.keymaps[0]!.up).toBe('KeyW');
  });

  it('as setas laterais alternam entre as colunas P1 e P2', () => {
    const m = novo();
    abre(m);
    m.cursor = 2;
    m.key('ArrowRight');
    expect(m.cursor).toBe(2 + KEY_ACTIONS.length);
    m.key('ArrowLeft');
    expect(m.cursor).toBe(2);
  });
});

describe('pausa', () => {
  it('Esc na pausa continua a partida; "Voltar ao menu" sai', () => {
    const m = novo();
    m.openPause();
    expect(m.key('Escape')).toEqual({ type: 'resume' });
    m.openPause();
    expect(m.items().map((i) => i.id)).toEqual(['resume', 'cards', 'controls', 'options', 'quit']);
    m.cursor = 4;
    expect(m.key('Enter')).toEqual({ type: 'quit' });
  });

  it('opções abertas pela pausa voltam para a pausa', () => {
    const m = novo();
    m.openPause();
    m.cursor = 3;
    m.key('Enter');
    expect(m.screen).toBe('options');
    m.key('Escape');
    expect(m.screen).toBe('pause');
  });
});

describe('mouse', () => {
  it('clicar em um item o ativa; clicar na seleção escolhe e começa', () => {
    const m = novo();
    m.click(0);
    expect(m.screen).toBe('select');
    m.click(3);
    expect(m.character).toBe('thaisa');
    expect(m.click(6)).toEqual({ type: 'start', character: 'thaisa', companion: null });
  });

  it('passar o mouse na seleção não bagunça o cursor', () => {
    const m = novo();
    m.click(0);
    m.hover(2); // portrait
    expect(m.cursor).toBe(2);
    m.hover(5);
    expect(m.cursor).toBe(1);
  });
});

describe('tela de cartas da pausa', () => {
  const cartas = [
    { slot: 0, characterId: 'felipe' as const, label: 'Felipe', stats: '', entries: [1, 2, 3].map((n) => ({ id: `c${n}`, name: `Carta ${n}`, description: '', rarity: 'comum' as const, kind: 'passive' as const, level: 1, maxLevel: 1 })) },
    { slot: 1, characterId: 'mauro' as const, label: 'Mauro (IA)', stats: '', entries: [] },
  ];

  it('Cartas aparece no menu de pausa e abre a tela; Esc volta para a pausa', () => {
    const m = novo();
    m.openPause(cartas);
    m.cursor = 1;
    expect(m.items()[1]!.id).toBe('cards');
    m.key('Enter');
    expect(m.screen).toBe('cards');
    m.key('Escape');
    expect(m.screen).toBe('pause');
  });

  it('o atalho Tab abre direto nas cartas, e Tab de novo volta', () => {
    const m = novo();
    m.openPause(cartas, 'cards');
    expect(m.screen).toBe('cards');
    m.key('Tab');
    expect(m.screen).toBe('pause');
    m.key('Tab');
    expect(m.screen).toBe('cards');
  });

  it('setas laterais trocam de jogador e as verticais andam pela lista, dando a volta', () => {
    const m = novo();
    m.openPause(cartas, 'cards');
    m.key('ArrowDown');
    m.key('ArrowDown');
    expect(m.cursor).toBe(2);
    m.key('ArrowDown');
    expect(m.cursor).toBe(0);
    m.key('ArrowRight');
    expect(m.cardsTab).toBe(1);
    expect(m.currentCards()!.label).toBe('Mauro (IA)');
    m.key('ArrowRight');
    expect(m.cardsTab).toBe(0);
  });

  it('clicar numa aba troca de jogador', () => {
    const m = novo();
    m.openPause(cartas, 'cards');
    m.click(101);
    expect(m.cardsTab).toBe(1);
  });
});

describe('Modo Dev', () => {
  function abreDev(m: Menu): void {
    m.key('ArrowUp'); // o Modo Dev é o último item
    m.key('Enter');
    expect(m.screen).toBe('dev');
  }

  it('abre pelo último item do título e mostra fase, duração, invulnerável, dano e cutscenes', () => {
    const m = novo();
    abreDev(m);
    expect(m.items().map((i) => i.label)).toEqual(['Personagem', 'Companheiro', 'Fase inicial', 'Duração da fase', 'Invulnerável', 'Dano causado', 'Cutscenes', 'Começar', 'Voltar']);
  });

  it('as setas mudam a fase (de 1 a 8, dando a volta), a duração, a invulnerabilidade e o dano', () => {
    const m = novo();
    abreDev(m);
    m.cursor = 2;
    expect(m.key('ArrowRight')).toEqual({ type: 'settings' });
    expect(m.settings.dev.fase).toBe(2);
    m.key('ArrowLeft');
    m.key('ArrowLeft');
    expect(m.settings.dev.fase).toBe(8); // a Arena do Tempo
    m.cursor = 3;
    m.key('ArrowRight');
    expect(m.settings.dev.duracaoS).toBe(5);
    m.cursor = 4;
    m.key('Enter');
    expect(m.settings.dev.invulneravel).toBe(true);
    m.cursor = 5;
    m.key('ArrowRight');
    expect(m.settings.dev.danoMul).toBe(2);
  });

  it('Começar emite "start" com o personagem escolhido e o modo dev', () => {
    const m = novo();
    abreDev(m);
    m.settings.dev.fase = 6;
    m.settings.dev.invulneravel = true;
    m.cursor = 7;
    const a = m.key('Enter');
    expect(a).toMatchObject({ type: 'start', dev: { fase: 6, invulneravel: true } });
  });

  it('Solo normal começa sem modo dev', () => {
    const m = novo();
    m.key('Enter');
    expect(m.screen).toBe('select');
    expect(m.key('Enter')).not.toHaveProperty('dev');
  });

  it('Esc volta ao título', () => {
    const m = novo();
    abreDev(m);
    m.key('Escape');
    expect(m.screen).toBe('title');
  });
});

describe('Galeria do Mauro e Códice', () => {
  function abre(m: Menu, rotulo: string): void {
    const i = m.items().findIndex((x) => x.label === rotulo);
    m.cursor = i;
    m.key('Enter');
  }

  it('a Galeria lista os 14 itens, com setas e Esc', () => {
    const m = novo();
    abre(m, 'Galeria do Mauro');
    expect(m.screen).toBe('gallery');
    m.key('ArrowDown');
    expect(m.cursor).toBe(1);
    m.key('ArrowUp');
    m.key('ArrowUp');
    expect(m.cursor).toBe(13);
    m.key('Escape');
    expect(m.screen).toBe('title');
  });

  it('o Códice troca de personagem com as setas laterais e dá a volta', () => {
    const m = novo();
    abre(m, 'Códice');
    expect(m.screen).toBe('codex');
    m.key('ArrowLeft');
    expect(m.cursor).toBe(4);
    m.key('ArrowRight');
    expect(m.cursor).toBe(0);
    expect(m.click(3)).toBeNull();
    expect(m.cursor).toBe(3);
  });
});

describe('Cutscenes nas opções', () => {
  it('o Modo Dev liga e desliga as cutscenes (começam ligadas)', () => {
    const m = novo();
    m.key('ArrowUp');
    m.key('Enter');
    expect(m.settings.dev.cutscenes).toBe(true);
    m.cursor = 6;
    expect(m.key('Enter')).toEqual({ type: 'settings' });
    expect(m.settings.dev.cutscenes).toBe(false);
  });

  it('as Opções têm "Cutscenes passam sozinhas", desligado por padrão', () => {
    const m = novo();
    m.cursor = 5;
    m.key('Enter');
    expect(m.screen).toBe('options');
    const i = m.items().findIndex((x) => x.label === 'Cutscenes passam sozinhas');
    expect(i).toBeGreaterThan(-1);
    expect(m.settings.autoCutscene).toBe(false);
    m.cursor = i;
    expect(m.key('Enter')).toEqual({ type: 'settings' });
    expect(m.settings.autoCutscene).toBe(true);
  });
});
