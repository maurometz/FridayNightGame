import { INSTRUMENTS, INSTRUMENT_ORDER, type InstrumentId } from '../data/instruments';

/** Efeitos das cartas exclusivas do Felipe que mudam regras (ligados ao escolher a carta). */
export interface FelipeMods {
  /** Bis no Show: ao esgotar, o próximo instrumento dispara uma rajada extra. */
  bis: boolean;
  /** Afinação de Ouvido: afinação pela metade e Violão com menos dispersão. */
  afinacaoOuvido: boolean;
  /** Roadie de Madrugada: cada abate devolve 1 de munição ao instrumento ativo. */
  roadie: boolean;
  /** Passagem de Som: a primeira troca de cada ato não tem afinação. */
  passagemSom: boolean;
  /** Ensaio Geral: a Bateria dispara sozinha com 3 ou mais inimigos por perto. */
  ensaioGeral: boolean;
  /** Setlist Surpresa: a Espiral sorteia duas anomalias. */
  setlist: boolean;
  /** Microfone de Feedback: o Kazoo atordoa os inimigos em que ricocheteia. */
  microfone: boolean;
  /** Turnê de Bolso: a cada 60 s, todos os instrumentos disparam em sequência. */
  turne: boolean;
  /** Encore do Felipe: ao esgotar um instrumento, ele recarrega 30%. */
  encore: boolean;
  /** Pedal de Distorção: Violão e Kazoo causam +30% de dano. */
  pedal: boolean;
  /** Solo de Improviso: depois de trocar de instrumento, o primeiro ataque causa o dobro. */
  solo: boolean;
  /** Fã-Clube da Madrugada: a cada 20 abates, +3% de dano permanente (até 10 vezes). */
  fa: boolean;
  // ---- Cartas de equipe ----
  /** Coro de Apoio: aliados próximos +5% de dano enquanto o Felipe ataca. */
  coro: boolean;
  /** Sinal de Passagem: ao trocar de instrumento, o aliado mais próximo recarrega mais rápido. */
  sinal: boolean;
  /** Intervalo Compartilhado: ao esgotar uma munição, aliados próximos recarregam mais rápido. */
  intervalo: boolean;
  /** Quem Canta Junto: aliados que atacam o mesmo inimigo causam +10% de dano. */
  quemCanta: boolean;
  /** Passa a Vez: a cada 45 s, empresta um instrumento ao aliado mais próximo. */
  passaAVez: boolean;
  /** Requiem da Morte: quem cai se levanta com a melodia (uma vez a cada 90 s). */
  requiem: boolean;
}

export interface FelipeState {
  readonly type: 'felipe';
  /** Instrumentos liberados, na ordem de rotação. */
  owned: InstrumentId[];
  ammo: Record<InstrumentId, number>;
  maxAmmo: Record<InstrumentId, number>;
  active: InstrumentId;
  /** Segundos restantes de afinação (sem atacar). */
  tuneLeft: number;
  /** Segundos até o próximo ataque. */
  cd: number;
  /** Para detectar o toque da tecla de ação (troca manual). */
  prevAction: boolean;
  attackCount: number;
  speedBuffLeft: number;
  turneTimer: number;
  turneQueue: InstrumentId[];
  turneDelay: number;
  ensaioCd: number;
  bisPending: boolean;
  /** Último ato em que a troca gratuita (Passagem de Som) foi usada. */
  freeSwitchAct: number;
  /** Segundos desde o último ataque (Coro de Apoio). */
  sinceAttack: number;
  /** Segundos até o próximo empréstimo de instrumento (Passa a Vez). */
  passaTimer: number;
  /** Multiplicador da recarga dos instrumentos guardados (Camarim Reservado). */
  rechargeMul: number;
  /** O próximo ataque vale o dobro (Solo de Improviso). */
  soloReady: boolean;
  /** Abates desde o último degrau do Fã-Clube e degraus já conquistados. */
  fanKills: number;
  fanStacks: number;
  /** Segundos ate o Requiem da Morte poder tocar de novo. */
  requiemCd: number;
  mods: FelipeMods;
}

export function createFelipeState(): FelipeState {
  const ammo = {} as Record<InstrumentId, number>;
  const maxAmmo = {} as Record<InstrumentId, number>;
  for (const id of INSTRUMENT_ORDER) {
    maxAmmo[id] = INSTRUMENTS[id].maxAmmo;
    ammo[id] = maxAmmo[id];
  }
  return {
    type: 'felipe',
    owned: ['violao', 'bateria', 'flauta', 'kazoo'],
    ammo,
    maxAmmo,
    active: 'violao',
    tuneLeft: 0,
    cd: 0,
    prevAction: false,
    attackCount: 0,
    speedBuffLeft: 0,
    turneTimer: 0,
    turneQueue: [],
    turneDelay: 0,
    ensaioCd: 0,
    bisPending: false,
    freeSwitchAct: -1,
    sinceAttack: 999,
    passaTimer: 0,
    rechargeMul: 1,
    soloReady: false,
    fanKills: 0,
    fanStacks: 0,
    requiemCd: 0,
    mods: {
      requiem: false,
      coro: false,
      sinal: false,
      intervalo: false,
      quemCanta: false,
      passaAVez: false,
      bis: false,
      afinacaoOuvido: false,
      roadie: false,
      passagemSom: false,
      ensaioGeral: false,
      setlist: false,
      microfone: false,
      turne: false,
      encore: false,
      pedal: false,
      solo: false,
      fa: false,
    },
  };
}
