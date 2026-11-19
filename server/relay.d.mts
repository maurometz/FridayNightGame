/** Qualquer servidor HTTP/HTTP2 do Node (ou do Vite) que emita 'upgrade'. */
export interface UpgradeCapable {
  on(event: 'upgrade', listener: (...args: any[]) => void): unknown;
}

export const MAX_PLAYERS: number;
export const CHARACTERS: string[];
export const DELAYS: number[];
export function attachRelay(
  httpServer: UpgradeCapable,
  options?: { path?: string; log?: (msg: string) => void },
): { rooms: Map<string, unknown>; close: () => void };
