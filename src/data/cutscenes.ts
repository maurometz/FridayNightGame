// Cutscenes de chefe (LORE seção 6): a introdução (antes da luta) e a derrota (depois dela).
// Os encontros de resgate vivem em `youth.ts`. O jogo pausa enquanto a cena roda (Enter avança, Esc pula).
// `who`: id de personagem do Comitê, 'lucas', ou o nome já escrito por extenso (o chefe, o jovem...).

export interface CutsceneLine {
  readonly who: string;
  readonly text: string;
}

const L = (who: string, text: string): CutsceneLine => ({ who, text });

/** Falas antes da luta, por id de chefe. */
export const BOSS_INTRO: Readonly<Record<string, readonly CutsceneLine[]>> = {
  salsichas: [
    L('mauro', 'Eu li o relatório. Eram quatro cachorros salsichas. O relatório não dizia o tamanho.'),
    L('Geraldo', 'AU.'),
    L('Monet', 'AU AU.'),
    L('thaisa', 'Eles estão olhando para a minha coxinha.'),
    L('Toddy', 'AU AU AU!'),
    L('Bucky', '(late, já em trenzinho)'),
    L('felipe', 'Ninguém corre. Ninguém corre. ...Todo mundo corre.'),
  ],
  juninho: [
    L('Juninho', 'Atenção! Vocês estão em cima do meu gramado. E eu tenho um cronograma muito específico para este parque.'),
    L('felipe', 'O parque é público, Juninho.'),
    L('Juninho', 'Público é um conceito. Gestão é uma realidade.'),
    L('felipe', '...O quê?'),
    L('Juninho', 'Mariana, Melina, apresentem-se! Temos visitantes e precisamos causar uma boa primeira impressão.'),
    L('Mariana', 'EU JÁ ME APRESENTEI DUAS VEZES NO CAMINHO!'),
    L('Melina', 'Que emocionante. Eu fico aqui, de braço cruzado, sendo útil.'),
    L('Juninho', 'Excelente iniciativa, Melina. Gosto de funcionárias proativas.'),
    L('melissa', 'Elas estão pintadas de azul. Inteiras.'),
    L('Juninho', 'É a identidade visual da empresa.'),
    L('thayssa', 'Que empresa?'),
    L('Juninho', 'A empresa que estamos construindo.'),
    L('Mariana', 'ELE AINDA NÃO TEM NEM UM CNPJ!'),
    L('Juninho', 'Toda grande empresa começa com uma visão. E a minha visão é... ESTE PARQUE!'),
  ],
  rm: [
    L('melissa', '...Gente. Ele é MUITO mais bonito ao vivo.'),
    L('thayssa', 'Mel, respira. Você está fazendo aquela cara.'),
    L('RM', 'Senhoras, senhores... e Melissa. Que bom que vieram.'),
    L('mauro', 'Já temos compromisso. Todas as sextas.'),
    L('RM', 'Ora, não pretendo roubar a noite de vocês. Só gostaria de um número especial. A Melissa e eu, no palco.'),
    L('mauro', 'Eu... não sei se isso foi um convite ou uma ameaça.'),
    L('RM', 'Por que escolher apenas um?'),
    L('melissa', '(a luz roxa já está puxando ela pelo cinto)'),
    L('thayssa', 'Segurem a Melissa! Segurem a Melissa!'),
  ],
  christopher: [
    L('lucas', 'Aviso importante, Escolhidos: o Christopher é um conceito. Ele não escuta.'),
    L('thaisa', 'Qual conceito?'),
    L('lucas', 'Destruição. Com a mentalidade de uma criança de quatro anos.'),
    L('Christopher', 'EU QUERO! ME OLHA! ME OLHA!'),
    L('felipe', 'Eu olho. Eu olho. Olhem para ele, gente.'),
    L('Christopher', 'NINGUÉM ME OLHA DIREITO!'),
    L('mauro', 'Anotando: não tirar o olho do conceito.'),
  ],
  ale: [
    L('Alê', 'ATENÇÃO, ATENÇÃO! Formar fila! Aqui é retiro, não é bagunça!'),
    L('felipe', 'Alê, somos nós. O Comitê.'),
    L('Alê', 'Comitê? Que Comitê? Eu só organizo retiros e eventos.'),
    L('thayssa', 'Foi você que criou o Comitê, Alê.'),
    L('Alê', 'Eu? Eu não me lembro de nada disso. Cronograma! Apito!'),
    L('mauro', '(sussurrando) Ele criou sem saber. Ano passado.'),
    L('Alê', 'Quem fala fora de hora faz vinte polichinelos! (apita)'),
  ],
  tiagow: [
    L('Tiago W', 'Ah, os famosos Escolhidos. Meu irmão me falou bastante de vocês. Quase nada de bom.'),
    L('lucas', 'Tiago. Eu pedi que você não viesse.'),
    L('Tiago W', 'E eu li o seu pedido. Com atenção. E ri.'),
    L('melissa', 'Quem é esse?'),
    L('lucas', 'Meu irmão mais velho. Ele sabe de tudo e não tem medo de nada.'),
    L('Tiago W', 'Isso não é verdade. Eu tenho medo de uma coisa. Mas não vou falar qual.'),
    L('felipe', 'O evento começa daqui a pouco, Tiago. Sai da frente.'),
    L('Tiago W', 'Depois de mim, é só a parte fácil.'),
  ],
  tempo: [
    L('felipe', 'O relógio parou. Todos os relógios pararam.'),
    L('mauro', 'Não é bug. Eu conferi.'),
    L('O Tempo', 'O tempo sempre anda. Isso não é pessoal.'),
    L('thaisa', 'Eu sei.'),
    L('thayssa', 'A gente sabe. Mas a gente veio mesmo assim.'),
    L('O Tempo', 'Eu não destruo nada. Eu só passo.'),
    L('melissa', 'Então passa. A gente fica junto enquanto isso.'),
    L('felipe', 'Vamos tocar mais alto do que o relógio.'),
  ],
};

/** Falas depois da derrota, por id de chefe. */
export const BOSS_DEFEAT: Readonly<Record<string, readonly CutsceneLine[]>> = {
  salsichas: [
    L('Geraldo', '(boceja e deita)'),
    L('Bucky', '(rola de barriga para cima)'),
    L('thaisa', 'Eles só queriam coxinha. Eu entendo.'),
    L('felipe', 'Eu também entendo, e não gostei de entender.'),
    L('mauro', 'Resolvido. Próximo item da lista: achar os jovens.'),
  ],
  juninho: [
    L('Juninho', 'Isso... não estava no cronograma.'),
    L('Melina', 'Eu avisei que dava ruim. Ninguém me escuta.'),
    L('Mariana', 'EU QUERO REVANCHE! ...Mas depois do almoço.'),
    L('felipe', 'Juninho, o parque continua público.'),
    L('Juninho', 'Certo. Certo. Vou precisar revisar toda a estratégia de ocupação territorial.'),
    L('felipe', 'Você vai parar de tentar tomar o parque?'),
    L('Juninho', 'Não foi isso que eu disse. Vou fazer uma reunião sobre isso.'),
    L('Melina', 'Mais uma?'),
    L('Juninho', 'Uma reunião de alinhamento. Com ata, pauta e coffee break.'),
    L('thayssa', 'Chama a Gabi. Ela cuida de você.'),
    L('Juninho', 'A Gabi está no conselho administrativo?'),
  ],
  rm: [
    L('RM', 'Ah... parece que o espetáculo de vocês teve um final diferente do que eu imaginei.'),
    L('melissa', '(sacode a cabeça, voltando a si) ...Eu fiquei em transe, né?'),
    L('thayssa', 'Foi bem rápido. Mas foi bem forte.'),
    L('mauro', 'Bom que você voltou. Digo... o grupo fica melhor completo.'),
    L('melissa', 'Aham. Completo. Passa pra lá e deixa eu passar.'),
    L('RM', 'Não se preocupem. Toda boa apresentação merece uma salva de palmas... e vocês conseguiram a minha.'),
    L('RM', '*faz uma reverência exageradamente elegante*'),
    L('RM', 'Até nosso próximo espetáculo.'),
  ],
  christopher: [
    L('Christopher', '(fica quieto) ...Vocês olharam para mim.'),
    L('thaisa', 'A gente olhou o tempo todo, querido.'),
    L('Christopher', 'Posso voltar a ser um conceito agora?'),
    L('lucas', 'Pode, Christopher. Boa soneca.'),
    L('felipe', 'Eu acho que ele só queria um abraço.'),
  ],
  ale: [
    L('Alê', 'Hm. Vocês seguiram o cronograma melhor do que eu esperava.'),
    L('mauro', 'Alê, você criou o Comitê. Sabia?'),
    L('Alê', 'Eu? Que Comitê?'),
    L('felipe', 'Deixa pra lá. Depois a gente conta.'),
    L('Alê', 'Vinte polichinelos para todo mundo. Em nome da amizade.'),
  ],
  tiagow: [
    L('Tiago W', 'Interessante. Eu não tinha previsto esse movimento.'),
    L('lucas', 'Eu avisei, Tiago.'),
    L('Tiago W', 'Mmm. O evento vai ser bom. Eu pesquisei.'),
    L('felipe', 'Pronto. O último evento do ano vai acontecer.'),
    L('thaisa', 'Ninguém falou "último".'),
    L('felipe', 'Eu sei. Eu estou cantando mais baixo.'),
  ],
  tempo: [
    L('O Tempo', 'Vocês não me venceram. Eu continuo.'),
    L('thayssa', 'A gente sabe. A gente só não vai embora de verdade.'),
    L('O Tempo', 'Isso...'),
    L('thaisa', 'A gente se vê. Eu sei que a gente se vê.'),
    L('felipe', 'Eu toco, vocês cantam, mesmo em chamada.'),
    L('lucas', 'Toda profecia tem um último capítulo. Mas o capítulo seguinte não tem número.'),
  ],
};

/** Transição Ivoti → Parcão: encontro no portal. */
export const PORTAL_INTRO: readonly CutsceneLine[] = [
  L('lucas', 'Chegaram! Estes são meus aprendizes: Marina, Matias e Gideão.'),
  L('Matias', 'Prazer. Sou o mais experiente da turma, sem dúvida alguma.'),
  L('Marina', '(acena em silêncio)'),
  L('Gideão', '(sorri para todo mundo ao mesmo tempo)'),
  L('lucas', 'Abriremos o portal para o Parcão. Tragam o que for preciso.'),
];
