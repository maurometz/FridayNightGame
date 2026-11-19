/** Normaliza um ângulo para o intervalo (-π, π]. */
export function wrapAngle(a: number): number {
  let r = a % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  else if (r <= -Math.PI) r += Math.PI * 2;
  return r;
}

const DEG = Math.PI / 180;

/**
 * O atacante está nas costas do inimigo? As costas são o arco (padrão 90°) oposto à frente.
 * `facing` é a direção da frente do inimigo, em radianos.
 */
export function inBackArc(
  facing: number,
  enemyX: number,
  enemyY: number,
  attackerX: number,
  attackerY: number,
  arcDeg = 90,
): boolean {
  const toAttacker = Math.atan2(attackerY - enemyY, attackerX - enemyX);
  const diff = Math.abs(wrapAngle(toAttacker - (facing + Math.PI)));
  return diff <= (arcDeg * DEG) / 2;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
