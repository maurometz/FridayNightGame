// Lógica das cutscenes (sem desenho): texto que aparece letra por letra, avançar com clique, passar sozinho
// (modo automático) e pular. O jogo fica pausado enquanto `world.cutscene` existir (engine/world.ts).

export interface CutsceneLine {
  /** Nome por extenso de quem fala (vazio = narração). */
  who: string;
  text: string;
  /** Id do retrato (imagem em retratos/ ou o genérico, se não houver). */
  retrato?: string;
}

export interface CutsceneState {
  lines: CutsceneLine[];
  index: number;
  /** Quadros desde que a linha atual começou (o texto aparece com ele). */
  t?: number;
  /** Quadros desde que a cutscene abriu (barras e escurecimento entram com ele). */
  open?: number;
}

/** Quantas letras aparecem por quadro (a 60 quadros por segundo são cerca de 50 letras por segundo). */
export const LETRAS_POR_QUADRO = 0.85;
/** Quadros de espera depois do texto completo, no modo automático: um tempo fixo mais um pouco por letra. */
export const ESPERA_AUTO_BASE = 70;
export const ESPERA_AUTO_POR_LETRA = 3;

const linhaAtual = (cs: CutsceneState): CutsceneLine | undefined => cs.lines[Math.min(cs.index, cs.lines.length - 1)];

/** Quantas letras da linha atual já estão na tela. */
export function letrasVisiveis(cs: CutsceneState): number {
  return Math.floor((cs.t ?? 0) * LETRAS_POR_QUADRO);
}

/** Quadros que o texto leva para aparecer inteiro. */
export function quadrosParaCompletar(text: string): number {
  return Math.ceil(text.length / LETRAS_POR_QUADRO);
}

/** O texto da linha atual já está inteiro na tela? */
export function linhaCompleta(cs: CutsceneState): boolean {
  const l = linhaAtual(cs);
  return !l || letrasVisiveis(cs) >= l.text.length;
}

/** Mostra a linha atual inteira, de uma vez. */
export function completarLinha(cs: CutsceneState): void {
  const l = linhaAtual(cs);
  if (l) cs.t = Math.max(cs.t ?? 0, quadrosParaCompletar(l.text));
}

/**
 * Clique, Enter ou Espaço: se o texto ainda está aparecendo, completa; senão vai para a próxima linha.
 * Devolve o que aconteceu. Em 'fim' a cutscene acabou (quem chamou apaga `world.cutscene`).
 */
export function interagir(cs: CutsceneState): 'completou' | 'proxima' | 'fim' {
  if (!linhaCompleta(cs)) {
    completarLinha(cs);
    return 'completou';
  }
  cs.index++;
  cs.t = 0;
  return cs.index >= cs.lines.length ? 'fim' : 'proxima';
}

/** Quadros que o modo automático espera, depois do texto completo, antes de passar para a próxima linha. */
export function esperaAuto(text: string): number {
  return ESPERA_AUTO_BASE + text.length * ESPERA_AUTO_POR_LETRA;
}

/**
 * Chamado uma vez por quadro de tela: anima a entrada e, no modo automático, passa as linhas sozinho.
 * Devolve 'fim' quando a última linha acabou.
 */
export function tickCutscene(cs: CutsceneState, auto: boolean): 'fim' | null {
  cs.open = (cs.open ?? 0) + 1;
  cs.t = (cs.t ?? 0) + 1;
  const l = linhaAtual(cs);
  if (auto && l && cs.t >= quadrosParaCompletar(l.text) + esperaAuto(l.text)) {
    cs.index++;
    cs.t = 0;
    if (cs.index >= cs.lines.length) return 'fim';
  }
  return null;
}

/** Cor de fundo do retrato genérico (placeholder), estável para o mesmo id. */
export function matizDoRetrato(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}
