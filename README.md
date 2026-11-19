# A Profecia de Sexta-Feira

Roguelike 2D bullet heaven do grupo Comitê, para navegador. Projeto privado, para uso entre amigos.

## Como rodar

Requer Node 20 ou superior.

```
npm install && npm run dev
```

Outros comandos:

```
npm run build     # verifica os tipos e gera o build estático em dist/
npm run preview   # serve o build localmente
npm test          # testes (Vitest)
```

## Controles

- **P1:** WASD para mover, F para ação, G para Ultimate.
- **P2:** setas para mover, Numpad 1 para ação, Numpad 2 para Ultimate.
- **Conselho do Lucas (chefe final):** teclas 1, 2 ou 3.
- **Escolher carta:** teclas 1, 2 ou 3. **R** rerola as cartas e **Shift + 1, 2 ou 3** bane a carta (2 de cada por partida).
- **Recomeçar após o fim de jogo:** R.
- **Painel de desempenho:** F3.

Para jogar com outro personagem, use `?char=` na URL, por exemplo `http://localhost:5173/?char=mauro`. Os cinco personagens têm kit próprio (`?char=felipe`, `mauro`, `melissa`, `thaisa` ou `thayssa`). Com a Thayssa, a tecla F alterna o modo da aura. Com a Melissa, a tecla F faz a Investida depois de escolher a carta dela. Pelo menu, escolha o personagem (e um companheiro IA) em Solo. Esc pausa; Tab mostra as cartas de todos (as suas e as dos aliados); Enter pula as conversas.

O ataque é automático. A Fase 1 usa cartas provisórias, e os sprites são formas coloridas.

## Co-op online

Cada pessoa joga no próprio navegador, com um personagem (de 2 a 5 jogadores). No título, escolha **Co-op Online**: uma pessoa cria a sala e passa o código de 4 letras (ou o link, clicando no código) para as outras; todo mundo escolhe o personagem e marca "Pronto", e quem criou inicia.

Como o jogo roda só no navegador, é preciso um servidor que repasse as mensagens entre os jogadores (ele não roda o jogo):

- **Mesma rede (LAN):** `npm run dev` e os amigos abrem `http://<ip-do-seu-pc>:5173`.
- **Pela internet:** `npm run build && npm run online` (porta 5174, ou `PORT=...`) e exponha a porta com ngrok, cloudflared ou redirecionamento de porta. O servidor entrega o jogo e o relay no mesmo endereço.
- Servidor em outro endereço: `?server=wss://meu-servidor/coop` na URL.

Como funciona: cada navegador simula a partida inteira (a simulação é determinística) e só as entradas viajam (lockstep). Escolhas de carta, cutscenes e conversas viram comandos que valem para todos no mesmo passo. A cada 2 s os navegadores trocam um checksum; se divergirem, aparece um aviso. O anfitrião escolhe o atraso de entrada (rápido, normal ou estável) no lobby.

Quem sai no meio da partida fica parado por 15 s e depois a IA joga com o personagem. Reconectar não é suportado. Esc abre o menu sem pausar (os outros continuam). Se a partida acabar, o anfitrião aperta R para recomeçar.

Limites conhecidos: navegadores diferentes podem divergir nas funções matemáticas (use o mesmo navegador, de preferência Chrome ou Edge, em todos); com a aba escondida o desenho para, mas a simulação continua; sem lobby, não dá para entrar com a partida em andamento.

## Atalhos de teste

- `?char=mauro`: escolhe o personagem.
- `?give=pizza:3,chinelo:2`: já começa com armas do pool compartilhado nesses níveis (pizza, roteador, chinelo, chicote, ventilador, panela, controle, mangueira, fogos).
- `?t=290`: começa no segundo 290 da partida (por exemplo, para ver o Golem aos 5:00 ou o ciclo emocional).
- `?party=felipe,mauro`: cria vários jogadores (até 5). Só o primeiro é controlado; os outros ficam parados perto (ou viram IA com `&ai=1`).
- `?nospawn=1`: sem inimigos. `?at=sofa`: leva os jogadores a um ponto de conversa (`sofa`, `cozinha`, `quintal`, `rua`, `calendario`, `patio`, `banco`). Use junto com `&t=130` para ver uma conversa de queda.
- `?level=18`: começa no nível 18 (as cartas caem sozinhas). `?autopick=1`: escolhe as cartas do jogador sozinho.
- `?status=tdah` liga o debuff de TDAH no jogador 1; `?vehicle=1` monta o veículo do jogador 1 no início.
- `?down=0` derruba o jogador do slot 0 no início (`?down=1` o aliado), para testar o reviver.
- `?sprites=1`: visualizador da arte dos personagens e inimigos.
- `?synergy=100`: já começa com as barras de sinergia cheias. Aperte G para usar a Ultimate.
- `?emotion=0`: desliga as paletas do ciclo emocional (valores entre 0 e 1 reduzem a intensidade).
- `?stress=300`: veja a seção abaixo.

## Teste de carga

Abra `http://localhost:5173/?stress=300` com o servidor de desenvolvimento rodando. O jogo mantém 300 inimigos na tela, o jogador fica invulnerável e as cartas são escolhidas automaticamente. O painel mostra FPS e o tempo de cada passo de simulação. O mesmo cenário, com 5 jogadores, roda no `npm test`.

## Estrutura

Em resumo:

- `src/engine/`: loop de passo fixo (60 Hz), entrada abstrata, câmera, escala, RNG com seed e o `World` da simulação.
- `src/entities/`: jogadores, e depois inimigos, projéteis e gemas.
- `src/graphics/`: renderizador. Hoje usa retângulos provisórios, os sprites entram na Fase 6.
- `src/data/`: balanceamento, atributos dos personagens e controles.
- `src/network/`: co-op online (cliente do relay, lockstep, lobby em HTML). `server/`: relay WebSocket e servidor de produção.

## Princípios de arquitetura

- A simulação (`stepWorld`) não conhece canvas, teclado nem rede. Ela recebe um `PlayerInput` por jogador. Isso permite o co-op local e o online sem refatorar.
- Resolução lógica de 480x270, com escala inteira e `imageSmoothingEnabled = false`.
- Balanceamento e textos ficam em `src/data/`, não espalhados pelo código.
