/**
 * Estados dos chefes: 0 = andando e esperando o próximo ataque; 1, 2 e 3 = preparando/descansando.
 * As Salsichas usam também EXAUSTO (cachorro deitado sem vigor) e CARGA (investida do Toddy).
 */
export const BOSS_STATE = { LIVRE: 0, AQUECENDO: 1, PREPARANDO: 2, DESCANSANDO: 3, EXAUSTO: 4, CARGA: 5 } as const;
