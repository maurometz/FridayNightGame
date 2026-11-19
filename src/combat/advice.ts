import { ADVICE_CONFUSAO_S, ADVICE_UNIDADE, type AdviceDef } from '../data/bosses';
import type { World } from '../engine/world';
import { pushMessage } from './messages';
import { addShield } from './playerStats';
import { addBuff } from './teamEffects';

/** Conselho pendente do Lucas (fase 3 do Burocrata). O jogo pausa até alguém escolher. */
export interface PendingAdvice {
  options: AdviceDef[];
}

/**
 * Aplica o conselho escolhido. Um é útil (Fiquem juntos), um atrapalha (a estratégia de sempre confunde)
 * e um não faz nada.
 */
export function chooseAdvice(world: World, index: number): boolean {
  const advice = world.advice;
  const opt = advice?.options[index];
  if (!advice || !opt) return false;
  world.advice = null;

  switch (opt.effect) {
    case 'unidade':
      for (const p of world.players) {
        if (p.hp <= 0) continue;
        addBuff(p, { id: 'conselho', left: ADVICE_UNIDADE.durationS, damage: ADVICE_UNIDADE.damage });
        addShield(p, p.maxHp * ADVICE_UNIDADE.shieldFraction);
      }
      pushMessage(world, 'Lucas', 'Viu? Às vezes o óbvio funciona.', 3.5);
      break;
    case 'confusao':
      for (const p of world.players) p.confusedLeft = ADVICE_CONFUSAO_S;
      pushMessage(world, 'Lucas', 'Hm. Esse não era o melhor conselho.', 3.5);
      break;
    case 'nada':
      pushMessage(world, 'Lucas', 'Também não ajuda, eu sei.', 3.5);
      break;
  }
  return true;
}
