import { carregarFontes } from './ui/theme';
import { aplicarTdah } from './combat/status';
import { montar } from './combat/vehicles';
import { CompanionInput, escolherCartasDaIA } from './ai/companion';
import { chooseAdvice } from './combat/advice';
import { banCard, chooseCard, rerollChoice } from './combat/leveling';
import { equiparArma } from './combat/sharedWeapons';
import type { SharedWeaponId } from './combat/sharedWeaponTypes';
import { chefeVivo } from './combat/bosses';
import { aoFimDaCutscene, irParaFase, pularTransicao, tickTransicao } from './combat/run';
import { MAX_LEVEL, STEP_S } from './data/balance';
import { tuningDaFase } from './data/acts';
import { xpToNext } from './engine/xp';
import { grantXp } from './combat/leveling';
import { POIS } from './data/interactions';
import { CHARACTERS, type CharacterId } from './data/characters';
import { cartasDoDispositivo, dispositivosPadrao, indiceDoControle, type DeviceId } from './data/controls';
import { centerOn, type Camera } from './engine/camera';
import { GamepadCardKeys, GamepadInput, KeyboardInput, MergedInput, NO_INPUT, trackKeyboard, type InputSource, type PlayerInput } from './engine/input';
import { GameLoop, advanceAccumulator } from './engine/loop';
import { centroDoGrupo, createWorld, stepWorld, type World } from './engine/world';
import { loadMeta, recordRun, saveMeta } from './game/meta';
import { defaultDev, emotionScaleOf, loadSettings, saveSettings, targetHeightOf, type DevSettings } from './game/settings';
import { Renderer } from './graphics/renderer';
import { skipDialogue } from './narrative/interactions';
import type { DebugInfo } from './ui/hud';
import { collectCards } from './ui/cardsInfo';
import { endPages } from './ui/endScreen';
import { INTRO_CUTSCENE } from './data/lucas';
import { interagir, tickCutscene } from './ui/cutscene';
import { cutsceneBotoes, dentro } from './ui/cutsceneView';
import { Menu, type MenuAction } from './ui/menu';
import { hitAt, toLogical } from './ui/menuView';
import { NetClient, type StartInfo } from './network/client';
import { LobbyView } from './network/lobbyView';
import { Lockstep, type NetCmd } from './network/lockstep';
import { NetGame } from './network/netgame';

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Canvas #game não encontrado.');

const params = new URLSearchParams(window.location.search);
const settings = loadSettings();
let meta = loadMeta();

const renderer = new Renderer(canvas);
renderer.sprites.carregarExternos();
carregarFontes();
renderer.sprites.carregarArmas();

/** Aplica as opções que mexem na tela: tamanho do texto, flashes e ciclo emocional. */
function applySettings(): void {
  // ?emotion=0 (atalho de teste) vale mais que a opção do menu.
  const emotionParam = params.get('emotion');
  renderer.emotionScale = emotionParam !== null ? Math.min(1, Math.max(0, Number(emotionParam))) : emotionScaleOf(settings.emotion);
  renderer.reduceFlash = settings.reduceFlash;
  renderer.autoCutscene = settings.autoCutscene;
  renderer.keymaps = settings.keymaps;
  renderer.fitToWindow(window.innerWidth, window.innerHeight, targetHeightOf(settings.textSize));
}
applySettings();
window.addEventListener('resize', applySettings);

// ?stress=300 liga o teste de carga (inimigos fixos, jogador invulnerável, cartas automáticas).
const stress = Math.max(0, Number(params.get('stress') ?? 0) || 0);

// ?char=mauro escolhe o personagem e pula o menu (atalho de teste).
const requested = params.get('char');

// ?give=pizza:3,chinelo:2 equipa armas do pool compartilhado já no início (para testar e balancear).
const WEAPON_IDS: readonly SharedWeaponId[] = ['pizza', 'roteador', 'chinelo', 'chicote', 'ventilador', 'panela', 'controle', 'mangueira', 'fogos'];
const giveParam = params.get('give') ?? '';

// ?fase=4 começa na fase 4 (1 a 8; a 8 é a Arena do Tempo), para ver chefes e mapas sem esperar.
const startFase = Math.max(0, Math.min(8, Number(params.get('fase') ?? 0) || 0));

// ?party=felipe,mauro,thaisa cria vários jogadores; os extras ficam parados (ou viram IA com ?ai=1).
// ?synergy=100 enche as barras de sinergia. ?nospawn=1 desliga os inimigos.
const party: CharacterId[] = (params.get('party') ?? '')
  .split(',')
  .filter((c): c is CharacterId => c in CHARACTERS)
  .slice(0, 5);
const synergyStart = Math.min(100, Math.max(0, Number(params.get('synergy') ?? 0) || 0));
const devAi = params.get('ai') === '1';
const devBossHp = Math.min(1, Math.max(0, Number(params.get('bosshp') ?? 0) || 0));
let devBossHpFeito = false;
const noSpawn = params.get('nospawn') === '1';
// ?status=tdah liga o TDAH no jogador 1. ?vehicle=1 monta o veiculo dele ja no inicio (dura bastante, para testar).
const devStatus = params.get('status');
const devVehicle = params.get('vehicle') === '1';
// ?down=0 derruba o jogador do slot 0 (ou 1, 2...) no inicio, para testar o reviver.
const devDown = params.get('down');
// ?level=15 começa no nível 15 (todas as escolhas de carta caem sozinhas). ?autopick=1 escolhe as cartas dos jogadores sozinho.
const startLevel = Math.max(1, Math.min(MAX_LEVEL, Number(params.get('level') ?? 1) || 1));
const autoPick = params.get('autopick') === '1' || startLevel > 1;
// ?at=sofa põe os jogadores perto de um ponto de interesse (testar as conversas). Ver POIS em data/interactions.ts.
const atPoi = POIS.find((p) => p.id === params.get('at'));

// ---------------------------------------------------------------- estado da partida
type Mode = 'menu' | 'playing' | 'paused';
let mode: Mode = 'menu';
const menu = new Menu(settings, meta);

interface RunConfig {
  characters: CharacterId[];
  /** Slots controlados pela IA. */
  aiSlots: number[];
  /** Co-op local: todos os slots são pessoas, cada uma com o seu dispositivo (teclado 1, teclado 2 ou controles). */
  coop: boolean;
  /** Dispositivo de cada jogador no co-op local. */
  devices: DeviceId[];
}
let config: RunConfig = { characters: ['felipe'], aiSlots: [], coop: false, devices: [] };
let runRecorded = false;
/** Modo dev da partida atual (escolhido no menu). Nulo numa partida normal. */
let devRun: DevSettings | null = null;

const newWorld = (): World => {
  const w = createWorld(config.characters, {
    seed: (Math.random() * 0xffffffff) >>> 0,
    stress,
    noSpawn,
    repeatInteractions: settings.repeatInteractions,
    dev: devRun ?? undefined,
    coopLeash: config.coop,
    cutscenes: (devRun ? devRun.cutscenes : true) && stress === 0 && !params.get('nocutscene') && noSpawn === false,
  });
  if (synergyStart > 0) {
    for (const par of w.synergy.pairs) par.bar = synergyStart;
    w.synergy.committee.bar = synergyStart;
  }
  const faseInicial = devRun ? devRun.fase : startFase;
  if (faseInicial > 0) irParaFase(w, faseInicial - 1);
  // ?dano=3 multiplica o dano dos jogadores (para chegar às fases finais de um chefe mais rápido).
  const devDano = Number(params.get('dano') ?? 0) || 0;
  if (devDano > 1 && !w.dev) w.dev = { ...defaultDev(), danoMul: devDano };
  // ?boss=1 pula a exploração da fase e chama o chefe na hora (para testar a luta).
  if (params.get('boss') === '1') w.tick = w.phaseStartTick + Math.ceil(tuningDaFase(w.act).durationS / STEP_S) + 1;
  if (startLevel > 1) {
    let xp = 0;
    for (let l = 1; l < startLevel; l++) xp += xpToNext(l);
    for (const p of w.players) grantXp(w, p, xp / p.xpMul);
  }
  if (atPoi) {
    w.players.forEach((p, i) => {
      p.x = p.prevX = atPoi.x + i * 12;
      p.y = p.prevY = atPoi.y + 24;
    });
  }
  if (devStatus === 'tdah' && w.players[0]) aplicarTdah(w.players[0], 600);
  if (devVehicle && w.players[0]) montar(w, w.players[0], 600);
  if (devDown !== null && w.players[Number(devDown)]) w.players[Number(devDown)]!.hp = 0;
  for (const part of giveParam.split(',')) {
    const [id, lv] = part.split(':');
    const weapon = WEAPON_IDS.find((x) => x === id);
    const p = w.players[0];
    if (weapon && p) equiparArma(p, weapon, Math.min(3, Math.max(1, Number(lv) || 1)));
  }
  return w;
};
let world: World = newWorld();

// ---------------------------------------------------------------- co-op online
// Cada navegador simula a partida inteira; só as entradas e os comandos viajam (ver network/lockstep.ts).
interface OnlineRun {
  game: NetGame;
  ls: Lockstep;
  /** Slot deste navegador. */
  slot: number;
  names: string[];
  /** Escolha de carta (ou conselho) já respondida: evita mandar a mesma resposta duas vezes. */
  answered: object | null;
  /** Rerolar e banir esperam o comando anterior valer, para um toque duplo não gastar dois. */
  cmdBlockUntil: number;
  lastStatus: string | null;
}
let net: OnlineRun | null = null;
const onlinePad = new GamepadCardKeys(0);

const client = new NetClient({
  room: (r) => {
    if (!net) lobby.update(r);
  },
  start: (info) => startOnlineRun(info),
  frames: (slot, f) => net?.ls.receive(slot, f),
  hash: (slot, tick, h) => net?.game.receiveHash(slot, tick, h),
  left: (slot, last) => {
    if (!net) return;
    net.ls.depart(slot, last);
    lobby.toast(`${net.names[slot] ?? 'Jogador'} saiu. O personagem fica parado e a IA assume em 15 s.`);
  },
  error: (msg) => lobby.showError(msg),
  closed: () => {
    if (net) leaveOnline('Conexão com o servidor perdida.');
    else lobby.reset('Conexão perdida. Tente de novo.');
  },
});
const lobby = new LobbyView({
  create: (name) => client.connect({ t: 'create', name }),
  join: (name, code) => client.connect({ t: 'join', name, code }),
  pick: (c) => client.send({ t: 'pick', character: c }),
  ready: (ready) => client.send({ t: 'ready', ready }),
  config: (delay, opts) => client.send({ t: 'cfg', delay, opts }),
  start: () => client.send({ t: 'start' }),
  leave: () => {
    client.close();
    lobby.hide();
  },
});

/** Abre o painel do co-op online (com `?sala=ABCD` na URL, já com o código preenchido). */
function openOnline(): void {
  lobby.open(params.get('sala') ?? '');
}

function startOnlineRun(info: StartInfo): void {
  lobby.hide();
  devRun = null;
  const chars = info.players.map((p) => p.character);
  config = { characters: chars, aiSlots: [], coop: true, devices: [] };
  const w = createWorld(chars, { seed: info.seed, repeatInteractions: info.opts.repeatInteractions, cutscenes: true });
  w.cutscene = { lines: INTRO_CUTSCENE.map((l) => ({ who: l.who, text: l.text, retrato: l.who })), index: 0 };
  world = w;
  const ls = new Lockstep({
    slots: chars.length,
    me: info.you,
    delay: info.delay,
    poll: () => {
      const i = mode === 'playing' ? new MergedInput(new KeyboardInput(keys, settings.keymaps[0]!), new GamepadInput(0)).poll() : NO_INPUT;
      keys.endStep();
      return i;
    },
    send: (frames) => client.sendFrames(frames),
  });
  const game = new NetGame(w, ls, { autoCut: info.opts.autoCutscene, sendHash: (tick, h) => client.sendHash(tick, h) });
  net = { game, ls, slot: info.you, names: info.players.map((p) => p.name), answered: null, cmdBlockUntil: 0, lastStatus: null };
  renderer.endPage = 0;
  renderer.endFrames = 0;
  renderer.aiSlots = [];
  renderer.coop = true;
  renderer.online = true;
  renderer.viewSlot = info.you;
  renderer.devices = [];
  runRecorded = false;
  meta = { ...meta, lastCharacter: chars[info.you] ?? meta.lastCharacter };
  saveMeta(meta);
  mode = 'playing';
  ligarSegundoPlano();
}

/** Sai do online e volta ao título. */
function leaveOnline(aviso = ''): void {
  client.close();
  net = null;
  renderer.online = false;
  renderer.viewSlot = 0;
  renderer.coop = false;
  renderer.aiSlots = [];
  config = { characters: ['felipe'], aiSlots: [], coop: false, devices: [] };
  world = newWorld();
  mode = 'menu';
  menu.meta = meta;
  menu.openTitle();
  lobby.setStatus(null);
  if (aviso) lobby.toast(aviso, 6000);
}

const souAnfitriao = (): boolean => client.room !== null && client.room.host === client.room.you;

/** Escolher, rerolar ou banir uma carta. Online, vira um comando que vale para todos no mesmo passo. */
function acaoDeCarta(tipo: 'pick' | 'ban' | 'reroll', slot: number, index: number): void {
  if (!net) {
    if (tipo === 'ban') banCard(world, slot, index);
    else if (tipo === 'pick') chooseCard(world, slot, index);
    else rerollChoice(world, slot);
    return;
  }
  const choice = world.choices[0];
  if (!choice || choice.slot !== net.slot) return;
  if (tipo === 'pick') {
    if (net.answered === choice) return;
    net.answered = choice;
    net.ls.command({ c: 'pick', i: index });
    return;
  }
  if (net.ls.tick < net.cmdBlockUntil) return;
  net.cmdBlockUntil = net.ls.tick + net.ls.delay + 3;
  net.ls.command(tipo === 'ban' ? { c: 'ban', i: index } : { c: 'reroll' });
}

/** Comando de cutscene, transição, conversa ou conselho. Fora do online, é a ação direta. */
function acaoDoJogo(cmd: NetCmd, local: () => void): void {
  if (net) net.ls.command(cmd);
  else local();
}

const keys = trackKeyboard(window);
let sources: InputSource[] = [];
/** Recria as fontes de entrada (depois de remapear teclas ou de começar uma partida). */
function rebuildInputs(): void {
  if (config.coop) {
    // Co-op local: cada jogador tem o seu dispositivo (P1: WASD + F/G; P2: setas + vírgula/ponto, remapeáveis; ou um controle).
    sources = config.devices.map((d) => {
      const pad = indiceDoControle(d);
      return pad >= 0 ? new GamepadInput(pad) : new KeyboardInput(keys, settings.keymaps[d === 'teclado2' ? 1 : 0]!);
    });
    cardPads = config.devices.map((d) => new GamepadCardKeys(Math.max(0, indiceDoControle(d))));
    return;
  }
  // Solo (com ou sem companheiro IA): teclado do P1, e o controle 1 também vale.
  sources = [new MergedInput(new KeyboardInput(keys, settings.keymaps[0]!), new GamepadInput(0))];
  for (const slot of config.aiSlots) sources[slot] = new CompanionInput(() => world, slot);
  cardPads = [new GamepadCardKeys(0)];
}
/** Controles para escolher cartas (A/B/X escolhem, Y rerola): um por jogador. */
let cardPads: GamepadCardKeys[] = [];

/** Dispositivo do jogador `slot` (no solo, sempre o teclado 1). */
function dispositivoDe(slot: number): DeviceId {
  return config.coop ? (config.devices[slot] ?? 'teclado1') : 'teclado1';
}

/** Teclas de carta do jogador `slot`. */
function teclasDeCarta(slot: number): { escolher: readonly string[]; rerolar: string | null } {
  return cartasDoDispositivo(dispositivoDe(slot), settings.keymaps);
}

function startRun(character: CharacterId, companion: CharacterId | null, dev: DevSettings | null = null): void {
  devRun = dev;
  config = { characters: companion ? [character, companion] : [character], aiSlots: companion ? [1] : [], coop: false, devices: [] };
  meta = { ...meta, lastCharacter: character, lastCompanion: companion };
  saveMeta(meta);
  beginRun();
}

function beginRun(): void {
  world = newWorld();
  // Cutscene inicial (só em partida normal, não no modo dev nem nos atalhos de teste).
  if (!devRun && startFase === 0 && stress === 0 && !params.get('nocutscene')) world.cutscene = { lines: INTRO_CUTSCENE.map((l) => ({ who: l.who, text: l.text, retrato: l.who })), index: 0 };
  renderer.endPage = 0;
  renderer.endFrames = 0;
  renderer.aiSlots = config.aiSlots;
  renderer.coop = config.coop;
  renderer.devices = config.devices;
  runRecorded = false;
  rebuildInputs();
  mode = 'playing';
}

function handleAction(a: MenuAction | null): void {
  if (!a) return;
  switch (a.type) {
    case 'start':
      startRun(a.character, a.companion, a.dev ?? null);
      break;
    case 'startLocal': {
      const players = a.players;
      devRun = null;
      config = { characters: players.map((q) => q.character), aiSlots: [], coop: true, devices: players.map((q) => q.device) };
      meta = { ...meta, lastCharacter: players[0]!.character, lastCompanion: players[1]?.character ?? null };
      saveMeta(meta);
      beginRun();
      break;
    }
    case 'online':
      openOnline();
      break;
    case 'resume':
      mode = 'playing';
      break;
    case 'quit':
      if (net) {
        leaveOnline();
        break;
      }
      mode = 'menu';
      menu.meta = meta;
      menu.openTitle();
      break;
    case 'settings':
      saveSettings(settings);
      applySettings();
      rebuildInputs();
      break;
  }
}

// Atalhos de teste: com ?char=, ?party=, ?stress= ou ?t= o jogo começa direto na partida.
if (requested || party.length > 0 || stress > 0 || startFase > 0 || params.get('give') || startLevel > 1) {
  const c: CharacterId = requested && requested in CHARACTERS ? (requested as CharacterId) : 'felipe';
  const chars = party.length > 0 ? party : [c];
  config = { characters: chars, aiSlots: devAi ? chars.map((_, i) => i).filter((i) => i > 0) : [], coop: params.get('coop') === '1' && chars.length >= 2, devices: dispositivosPadrao(chars.length) };
  beginRun();
}

const camera: Camera = { x: 0, y: 0 };
// Link de convite (?sala=ABCD): abre direto o painel do online.
if (params.get('sala') && !requested) openOnline();
let showDebug = stress > 0;

/** Clique ou Enter na cutscene: completa o texto ou passa para a próxima fala. */
function avancarCutscene(): void {
  acaoDoJogo({ c: 'cut', k: 'next' }, () => {
    const cs = world.cutscene;
    if (cs && interagir(cs) === 'fim') encerrarCutscene();
  });
}

/** Fecha a cutscene (acabou ou foi pulada). Se o grupo vai para outra fase, começa a transição. */
function encerrarCutscene(): void {
  acaoDoJogo({ c: 'cut', k: 'skip' }, () => {
    world.cutscene = null;
    aoFimDaCutscene(world);
  });
}

/** Liga ou desliga o modo automático das cutscenes (e guarda na opção). */
function alternarAutoCutscene(): void {
  if (net) {
    net.ls.command({ c: 'cut', k: 'auto' });
    return;
  }
  settings.autoCutscene = !settings.autoCutscene;
  saveSettings(settings);
  applySettings();
}

/** Pausa o jogo. Com `cartas`, já abre a tela com as cartas de todos (atalho Tab). */
function pause(cartas = false): void {
  if (mode !== 'playing' || world.status !== 'playing') return;
  mode = 'paused';
  menu.openPause(collectCards(world, config.aiSlots), cartas ? 'cards' : 'pause');
}

// ---------------------------------------------------------------- teclado
const MENU_KEYS = /^(Arrow|Space|Enter|Backspace|Numpad|Tab)/;
window.addEventListener('keydown', (e) => {
  if (lobby.visible) return; // digitando no painel do online
  if (mode !== 'playing') {
    if (e.repeat && menu.capturing) return;
    if (MENU_KEYS.test(e.code)) e.preventDefault();
    handleAction(menu.key(e.code));
    return;
  }
  if (e.repeat) return;
  // Cutscene: o jogo está parado; só valem avançar (Enter/Espaço), automático (A) e pular (Esc/S).
  if (world.cutscene) {
    e.preventDefault();
    if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') avancarCutscene();
    else if (e.code === 'KeyA') alternarAutoCutscene();
    else if (e.code === 'Escape' || e.code === 'KeyS') encerrarCutscene();
    return;
  }
  // Transição para a Arena do Tempo: Esc ou Enter pulam.
  if (world.transicao) {
    e.preventDefault();
    if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space') acaoDoJogo({ c: 'trans' }, () => pularTransicao(world));
    return;
  }
  if (e.code === 'Tab') {
    e.preventDefault();
    pause(true);
    return;
  }
  if (e.code === 'Escape') {
    if (world.status !== 'playing') {
      if (net) leaveOnline();
      else {
        mode = 'menu';
        menu.meta = meta;
        menu.openTitle();
      }
    } else pause();
  } else if (e.code === 'F3') {
    e.preventDefault();
    showDebug = !showDebug;
  } else if (e.code === 'Enter') {
    if (world.status !== 'playing') {
      if (renderer.endPage < endPages(world).length - 1) {
        renderer.endPage++;
        renderer.endFrames = 0;
      }
    } else if (world.interactions.dialogue) acaoDoJogo({ c: 'dlg' }, () => skipDialogue(world));
  } else {
    // Escolher carta, rerolar e banir: cada jogador usa as teclas dele (remapeáveis em Controles).
    const choice = world.choices[0];
    // O conselho do Lucas (chefe final) tem prioridade sobre as cartas; qualquer jogador pode escolher.
    if (world.advice) {
      const idx = indicesDeCarta(e.code);
      if (idx >= 0 && (!net || net.answered !== world.advice)) {
        if (net) net.answered = world.advice;
        acaoDoJogo({ c: 'advice', i: idx }, () => chooseAdvice(world, idx));
      }
      return;
    }
    if (choice && !config.aiSlots.includes(choice.slot) && (!net || choice.slot === net.slot)) {
      const t = teclasDeCarta(choice.slot);
      const index = t.escolher.indexOf(e.code);
      if (index >= 0) {
        // Shift + a tecla da carta bane; só a tecla escolhe.
        acaoDeCarta(e.shiftKey ? 'ban' : 'pick', choice.slot, index);
      } else if (t.rerolar === e.code) acaoDeCarta('reroll', choice.slot, 0);
    } else if (!choice && world.status !== 'playing' && e.code === 'KeyR') {
      if (!net) beginRun();
      else if (souAnfitriao()) client.send({ t: 'restart' });
    }
  }
});

/** Qual carta (0 a 2) uma tecla escolhe, em qualquer teclado do jogo; -1 se nenhuma. */
function indicesDeCarta(code: string): number {
  for (const m of settings.keymaps) {
    const i = [m.card1, m.card2, m.card3].indexOf(code);
    if (i >= 0) return i;
  }
  return -1;
}

// Perder o foco da janela pausa a partida.
window.addEventListener('blur', () => {
  if (!net) pause(); // online a partida não para: os outros jogadores continuam
});

// ---------------------------------------------------------------- mouse (menus)
canvas.addEventListener('mousemove', (e) => {
  if (mode === 'playing') return;
  const p = toLogical(canvas, e.clientX, e.clientY);
  const hit = hitAt(menu, p.x, p.y);
  canvas.style.cursor = hit >= 0 ? 'pointer' : 'default';
  if (hit >= 0) menu.hover(hit);
});
canvas.addEventListener('click', (e) => {
  // Na cutscene: os botões AUTO e PULAR, ou qualquer outro clique avança a fala.
  if (mode === 'playing' && world.cutscene) {
    const q = toLogical(canvas, e.clientX, e.clientY);
    const b = cutsceneBotoes();
    if (dentro(b.pular, q.x, q.y)) encerrarCutscene();
    else if (dentro(b.auto, q.x, q.y)) alternarAutoCutscene();
    else avancarCutscene();
    return;
  }
  if (mode === 'playing') return;
  const p = toLogical(canvas, e.clientX, e.clientY);
  const hit = hitAt(menu, p.x, p.y);
  if (hit >= 0) handleAction(menu.click(hit));
});

// ---------------------------------------------------------------- laço principal
const debug: DebugInfo = { fps: 60, simMs: 0 };
let lastRender = performance.now();
let uiTick = 0;

/** Soma a partida ao histórico quando ela termina (uma vez só). */
function registrarFim(): void {
  if (runRecorded || world.status === 'playing' || stress > 0) return;
  runRecorded = true;
  const kills = world.players.reduce((s, p) => s + p.kills, 0);
  meta = recordRun(meta, {
    character: config.characters[net?.slot ?? 0]!,
    victory: world.status === 'victory',
    kills,
    seconds: world.tick * STEP_S,
    collected: world.collected,
  });
  saveMeta(meta);
  menu.meta = meta;
}

/**
 * Aba escondida (ou janela coberta) não recebe requestAnimationFrame, e aí a partida de todos travaria esperando esta aba.
 * Um Worker (os timers dele não são freados) segue a simulação enquanto o desenho está parado.
 */
let bgWorker: Worker | null = null;
let bgLast = 0;
let bgAcc = 0;
function ligarSegundoPlano(): void {
  if (bgWorker) return;
  try {
    bgWorker = new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),16)'], { type: 'text/javascript' })));
  } catch {
    return; // sem Worker: a aba escondida só atrapalha os outros (aparece o aviso "esperando")
  }
  bgWorker.onmessage = () => {
    const now = performance.now();
    // Só assume quando o desenho parou (aba escondida, janela coberta ou minimizada).
    if (!net || now - lastRender < 100) {
      bgLast = 0;
      return;
    }
    if (bgLast === 0) bgLast = now;
    const adv = advanceAccumulator(bgAcc, now - bgLast);
    bgLast = now;
    bgAcc = adv.acc;
    for (let i = 0; i < adv.steps && net; i++) atualizarOnline(net);
  };
}

/** Um passo do laço no co-op online: a simulação só avança quando chegaram as entradas de todos. */
function atualizarOnline(n: OnlineRun): void {
  if (mode === 'menu') return;
  // O controle escolhe as cartas do próprio jogador (o teclado vai pelo keydown).
  const escolha = world.choices[0];
  if (mode === 'playing' && escolha && escolha.slot === n.slot && !world.advice) {
    const t = onlinePad.poll();
    if (t.pick != null) acaoDeCarta('pick', n.slot, t.pick);
    else if (t.reroll) acaoDeCarta('reroll', n.slot, 0);
  }
  const t0 = performance.now();
  n.game.update();
  debug.simMs += (performance.now() - t0 - debug.simMs) * 0.05;
  renderer.aiSlots = n.game.aiSlots;
  registrarFim();
  // Aviso na tela: esperando alguém (conexão lenta) ou jogos fora de sincronia.
  let aviso: string | null = null;
  if (n.game.desyncAt >= 0) aviso = `Os jogos saíram de sincronia (passo ${n.game.desyncAt}). Saiam da sala e entrem de novo.`;
  else if (n.game.stalled > 20) aviso = `Esperando ${n.ls.waitingFor().map((s) => n.names[s] ?? `P${s + 1}`).join(', ')}...`;
  if (aviso !== n.lastStatus) {
    n.lastStatus = aviso;
    lobby.setStatus(aviso);
  }
}

const loop = new GameLoop({
  update(): void {
    if (net) {
      atualizarOnline(net);
      return;
    }
    if (mode !== 'playing') return;
    // As cartas da IA se resolvem sozinhas (senão a simulação ficaria esperando).
    if (config.aiSlots.length > 0) escolherCartasDaIA(world, config.aiSlots);
    if (autoPick) while (world.choices.length > 0) chooseCard(world, world.choices[0]!.slot, 0);
    // Controles escolhem as cartas do próprio jogador.
    const escolha = world.choices[0];
    if (escolha && !config.aiSlots.includes(escolha.slot) && !world.advice) {
      const t = cardPads[escolha.slot]?.poll();
      if (t?.pick != null) chooseCard(world, escolha.slot, t.pick);
      else if (t?.reroll) rerollChoice(world, escolha.slot);
    }
    const inputs: PlayerInput[] = sources.map((s) => s.poll());
    keys.endStep(); // os toques rápidos já foram vistos neste passo
    const t0 = performance.now();
    stepWorld(world, inputs);
    // ?bosshp=0.4 ajusta a vida do chefe (fração da máxima) assim que ele nasce, para testar as fases finais.
    if (devBossHp > 0 && !devBossHpFeito) {
      const c = chefeVivo(world);
      if (c) {
        c.hp = c.aiX * devBossHp;
        devBossHpFeito = true;
      }
    }
    debug.simMs += (performance.now() - t0 - debug.simMs) * 0.05;
    registrarFim();
  },
  render(alpha: number): void {
    const now = performance.now();
    const dt = now - lastRender;
    lastRender = now;
    if (dt > 0) debug.fps += (1000 / dt - debug.fps) * 0.05;
    uiTick++;
    // Cutscene: o texto aparece e, no modo automático, as falas passam sozinhas (o jogo continua parado).
    // (Online, a cutscene e a transição andam por passo da simulação, em network/netgame.ts.)
    if (!net && mode === 'playing' && world.cutscene && tickCutscene(world.cutscene, settings.autoCutscene) === 'fim') encerrarCutscene();
    // Transição: o vórtice roda por quadros de tela; no meio a fase troca.
    if (!net && mode === 'playing' && !world.cutscene && world.transicao) tickTransicao(world);
    if (net) renderer.autoCutscene = net.game.autoCut;

    // ?sprites=1 mostra a folha de todos os quadros de todos os personagens (conferência da arte).
    if (params.get('sprites')) {
      renderer.drawSpriteSheet();
      return;
    }
    if (mode === 'menu') {
      renderer.renderMenu(menu, uiTick);
      return;
    }
    const p = world.players[0];
    const eu = net ? world.players[net.slot] : undefined;
    if (net && eu) {
      // Online: cada navegador segue o próprio personagem (ou o grupo, se ele caiu).
      if (eu.hp > 0) centerOn(camera, eu.prevX + (eu.x - eu.prevX) * alpha, eu.prevY + (eu.y - eu.prevY) * alpha);
      else {
        const c = centroDoGrupo(world);
        centerOn(camera, c.x, c.y);
      }
    } else if (config.coop) {
      // Co-op: a câmera segue o ponto médio dos jogadores vivos.
      let vivos = world.players.filter((q) => q.hp > 0);
      if (vivos.length === 0) vivos = world.players;
      let cx = 0;
      let cy = 0;
      for (const q of vivos) {
        cx += q.prevX + (q.x - q.prevX) * alpha;
        cy += q.prevY + (q.y - q.prevY) * alpha;
      }
      centerOn(camera, cx / Math.max(1, vivos.length), cy / Math.max(1, vivos.length));
    } else if (p) centerOn(camera, p.prevX + (p.x - p.prevX) * alpha, p.prevY + (p.y - p.prevY) * alpha);
    renderer.render(world, camera, mode === 'paused' ? 1 : alpha, showDebug ? debug : null);
    if (mode === 'paused') renderer.renderMenu(menu, uiTick);
  },
});
loop.start();
