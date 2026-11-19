import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../data/balance';

/** Câmera: posição do canto superior esquerdo da vista, em pixels do mundo. */
export interface Camera {
  x: number;
  y: number;
}

/** Centraliza a câmera num ponto do mundo. */
export function centerOn(cam: Camera, worldX: number, worldY: number): void {
  cam.x = worldX - LOGICAL_WIDTH / 2;
  cam.y = worldY - LOGICAL_HEIGHT / 2;
}
