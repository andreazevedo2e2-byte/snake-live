# PRD — Snake Live v3: "labirinto de verdade, chat em português, live sem morte injusta"

Data: 2026-07-26 (revisado no mesmo dia para cobrir a auditoria completa) · Autor: Claude
(Fable) com André · Status: ready-for-agent
Base: auditoria completa pós-v2 (commit 17c058f), 100% do código lido, achados confirmados
por leitura de código e teste empírico. Substitui a primeira versão deste PRD, que cobria
só um subconjunto dos achados.

## Problem Statement

A v2 entregou as garantias "toda configuração termina, toda comida é alcançável", mas a
auditoria pós-lançamento encontrou oito bugs reais, uma investigação pendente e um conjunto
de melhorias de live:

- **O labirinto é fraco e incompleto (suspeita principal do André, confirmada).** O gerador
  nunca coloca parede nas células de borda, então todo o perímetro fica livre — um "anel"
  aberto ao redor do labirinto (confirmado: 52/52 e 60/60 células de borda livres em 16×12
  e 18×14). A cobra pode circular o tabuleiro sem entrar no labirinto, comida nasce no anel
  trivial, em dimensão par sobra faixa maciça de parede sem função, e a premissa do solver
  ("spanning tree sem loops") está errada — o anel é um loop gigante.
- **A interação da live só entende inglês.** O jogo é para um canal brasileiro, mas os
  comandos do chat são detectados por substring de "speed"/"food"/"add". Espectador que
  digita "comida", "velocidade" ou "rápido" é ignorado — o coração do produto falha para o
  público real.
- **O filtro de conteúdo não conhece palavrão em português.** A blocklist tem 6 palavras em
  inglês; nome/texto ofensivo em PT-BR aparece na tela (notificação + leaderboard) — risco
  de moderação/strike na live.
- **O watchdog de 90 s pode matar uma rodada saudável.** No maze_race só existe a
  fruta-alvo; num tabuleiro grande (até 36×24) o caminho pode levar mais de 90 s em
  velocidade base, e a rodada boa é encerrada como derrota.
- **full_food + comando "food" sobrepõe avatar em (0,0).** Com o tabuleiro inteiro cheio de
  comida não há célula vazia; o fallback devolve `{x:0,y:0}` e o avatar nasce em cima de
  comida/cobra.
- **Tabuleiro ímpar×ímpar degrada o autopilot em silêncio.** O painel aceita 9×7, mas o
  ciclo Hamiltoniano exige largura OU altura par; sem ciclo, classic/full_food perdem a
  garantia de vitória sem nenhum aviso.
- **O atalho de ciclo confia num invariante que o early game pode quebrar.** O BFS de
  atalho assume "células entre head e tail estão vazias", mas com score<3 a cobra usa
  caminhos gulosos fora do ciclo; o caminho planejado pode atravessar o corpo (dano hoje
  contido pela revalidação do primeiro passo).
- **O HUD promete "MORE CHAT = FASTER", mas só quem digita "speed" acelera.** O texto na
  tela mente para o espectador.
- **Regressão suspeita no maze_harvest:** o teste de win rate (>45%) falhou 2× seguidas com
  26,7% (4/15). A correção do labirinto muda a topologia — a investigação só faz sentido
  depois do novo gerador.
- **Qualidade de live:** scraper do YouTube que cai deixa a live sem chat até restart
  manual; espectador que digita "food" na tela de vitória perde a homenagem; HUD redesenha
  gráficos a 60 fps sem necessidade (live de 3 h com OBS); interface toda em inglês num
  canal PT-BR (decisão em aberto); comida do maze pode nascer colada na cobra; parede do
  pudding pode nascer encostada na maçã; e o André pediu mais capricho visual (paredes com
  relevo, partículas ao comer, sombra da cobra, contagem animada de score, limpeza de
  código morto).

## Solution

Do ponto de vista de quem assiste e de quem transmite a live:

1. **Labirintos que parecem labirintos.** O maze ocupa o tabuleiro inteiro, inclusive as
   bordas; a cobra é obrigada a navegar corredores de verdade, sem volta trivial pelo
   perímetro e sem faixas de parede mortas; opcionalmente com loops controlados ("braided").
2. **O chat brasileiro funciona.** "comida", "fruta", "velocidade", "rapido" etc. viram
   comandos, com matching por palavra (não substring solta) e lista final de palavras
   aprovada pelo André.
3. **A tela fica limpa para o YouTube.** Filtro de conteúdo com palavrões/slurs PT-BR,
   resistente a variações simples.
4. **Nenhuma rodada saudável morre no relógio.** O watchdog escala com tamanho/modo ou
   reseta por progresso — só dispara em travamento real.
5. **Toda homenagem acontece.** Avatar nunca nasce sobreposto (full_food troca uma comida
   existente pelo avatar), e "food" digitado na tela de fim entra na rodada seguinte.
6. **Qualquer configuração do painel joga bem.** Dimensões ímpar×ímpar são normalizadas;
   o atalho de ciclo nunca planeja caminho através do corpo.
7. **O HUD fala a verdade** — todo comentário permitido passa a dar um pouco de velocidade
   (recomendação; decisão a/b do André) — **e é econômico** (redesenho só quando muda algo).
8. **A live aguenta 3 horas sozinha:** scraper do YouTube com retry/backoff e fallback.
9. **Mais bonito em 9:16:** paredes com relevo, partículas ao comer, sombra na cobra,
   contagem animada, spawn de comida que força exploração — cada item independente e
   cortável pelo André.

## User Stories

1. Como streamer, quero que o labirinto ocupe o tabuleiro inteiro (bordas incluídas), para que a cobra navegue corredores de verdade em vez de circular o perímetro.
2. Como espectador, quero ver a cobra resolvendo o labirinto, para que o modo maze_harvest seja interessante de assistir.
3. Como streamer, quero que não exista faixa de parede maciça sem função, para que o mapa fique bonito em qualquer dimensão.
4. Como espectador brasileiro, quero digitar "comida" ou "velocidade" no chat e ver o efeito no jogo, para participar da live sem saber inglês.
5. Como streamer, quero que só palavras inteiras contem como comando, para que frases inocentes não disparem efeitos por substring.
6. Como streamer, quero que nomes/textos ofensivos em português nunca apareçam na tela, para não tomar strike de moderação no YouTube.
7. Como streamer, quero que uma rodada de maze_race em tabuleiro grande nunca seja morta pelo watchdog enquanto a cobra progride, para que vitórias legítimas aconteçam.
8. Como streamer, quero que o watchdog continue matando rodadas realmente travadas, para que a live nunca congele.
9. Como espectador, quero que meu avatar pedido em full_food apareça sem sobrepor comida ou cobra, para a homenagem ser visível e justa.
10. Como streamer, quero digitar qualquer largura/altura no painel e ter o autopilot com garantia de vitória, sem precisar saber de paridade.
11. Como streamer, quero que o autopilot nunca planeje caminho através do próprio corpo, para que não haja mortes burras raras em live longa.
12. Como espectador, quero que o texto do HUD corresponda ao que meu comentário faz de verdade, para não me sentir enganado.
13. Como streamer, quero que o win rate do maze_harvest volte a um patamar sólido e medido (n=50), para confiar que o modo fecha rodadas.
14. Como streamer, quero que a live continue recebendo chat mesmo se o scraper do YouTube falhar temporariamente, para não precisar reiniciar nada no meio da transmissão.
15. Como espectador, quero que meu "food" digitado na tela de vitória/derrota vire homenagem na rodada seguinte, para não me sentir ignorado.
16. Como espectador com avatar no tabuleiro, quero que meu avatar reapareça na rodada seguinte se a rodada acabar antes de a cobra me comer, para a homenagem não sumir.
17. Como streamer, quero que o HUD não redesenhe gráficos a cada frame sem mudança, para a live de 3 h com OBS ficar estável.
18. Como streamer, quero decidir se a interface fica em inglês (estética gamer) ou em PT-BR, para alinhar com o meu público.
19. Como streamer, quero que a comida do maze não nasça colada na cabeça da cobra, para que cada ponto tenha percurso visível.
20. Como streamer, quero que no maze_harvest as comidas se distribuam entre regiões do labirinto, para forçar exploração e variedade visual.
21. Como streamer, quero que a parede do pudding nunca nasça encostada na maçã atual, para não "cercar" visualmente o objetivo.
22. Como streamer, quero paredes com relevo/bevel 3D, partículas ao comer, sombra sob a cobra e contagem animada de score, para o jogo parecer polido em 9:16.
23. Como André (não-programador), quero cada melhoria visual como issue separada, para cortar o que eu não quiser sem afetar o resto.
24. Como mantenedor, quero código morto removido (SFX "boost" nunca chamado, counter `subscribers`, mojibake em comentário), para a base ficar limpa.

## Implementation Decisions

- **Gerador de labirinto:** reescrever a geração para grid efetivo de células ímpar
  (área jogável (2k+1)×(2j+1)) ocupando o tabuleiro todo — células de borda PODEM ser
  parede. Backtracking recursivo mantido (spanning tree), com passo opcional de "braiding"
  (remover N becos sem saída para loops controlados). Início da cobra e alvo continuam
  garantidamente conectados (o BFS de validação já existe e permanece).
- **Comandos do chat:** extrair o parsing de comandos de `main.ts` para um módulo puro
  (novo seam `src/chat/commands.ts`), com matching por palavra inteira sobre o texto
  normalizado e vocabulário PT+EN ("comida", "fruta", "maçã", "food", "add",
  "velocidade", "rapido"/"rápido", "speed"). **Lista final de palavras: decisão do André.**
- **Filtro de conteúdo:** expandir a blocklist com palavrões pesados e slurs PT-BR,
  matching resistente a variações simples (case já ok; leetspeak básico opcional).
- **Watchdog:** limite escalado por tamanho/modo — na ordem de
  `max(90 s, caminho_estimado × tick_efetivo × fator)` — OU reset do timer por progresso
  (distância ao alvo diminuindo) no maze_race. Cálculo vira função pura testável ao lado do
  `hasStalledTooLong` atual.
- **Avatar em full_food:** substituir uma comida basic existente pelo avatar (mantém a
  contagem de comidas) ou enfileirar até abrir célula — nunca cair no fallback `{0,0}`.
- **Paridade do tabuleiro:** normalização no painel (arredondar a altura para par quando
  largura e altura forem ambas ímpares), refletida de volta nos inputs. Nenhuma mudança no
  autopilot.
- **Atalho de ciclo:** excluir células do corpo no filtro do BFS de atalho. A revalidação
  do primeiro passo permanece como cinto de segurança.
- **HUD "MORE CHAT = FASTER":** duas opções — (a) todo comentário permitido dá +charge
  pequeno e credita leaderboard, comandos dão efeito maior (fiel ao texto, mais
  interativo); (b) corrigir o texto. **Recomendação: (a). Decisão do André.** Implementar
  atrás da decisão.
- **Investigação maze_harvest:** só DEPOIS do novo gerador. Medir n=50 com o solver atual
  (lookahead recursivo profundidade 5 + tail-chase no ramo com paredes); comparar
  antes/depois; ajustar solver apenas se a taxa não sustentar o limiar do teste.
- **Scraper YouTube:** retry com backoff (re-start do LiveChat) no servidor, log claro,
  opcional fallback para `silent` após N falhas consecutivas.
- **Fila de avatares:** preservar a fila no reset de rodada e re-enfileirar avatares que
  estavam no tabuleiro quando a rodada terminou.
- **Perf do HUD:** dirty-check — `Graphics` (clear+redraw) e textos só quando os valores
  mudarem; setters continuam sendo chamados pelo ticker, mas viram no-op sem mudança.
- **Localização PT-BR da interface:** traduzir tudo OU manter inglês (estética gamer).
  **Decisão do André em aberto** — planejada como issue opcional.
- **Spawn no maze:** manter a preferência por junções e adicionar distância mínima da
  cabeça; no maze_harvest, distribuir spawns entre regiões (ex.: quadrantes).
- **Pudding:** acrescentar à validação existente (conectividade, 2×2, distância ≥3 da
  cabeça, alcançabilidade) a regra "não adjacente à comida atual".
- **Visual e limpeza:** issues independentes — bevel 3D nas paredes, partículas ao comer
  (~300 ms), sombra sob segmentos, contagem animada de score, remoção de código morto
  (SFX "boost", counter `subscribers`, mojibake "â€”" no FakeChatSource).

## Testing Decisions

- Testes Vitest ao lado do código, como todo o repo. Testar comportamento externo (estado
  do jogo, decisões do autopilot, saída da função de parsing, resultado de rodadas
  simuladas), nunca detalhes internos.
- **Seams (na ordem de preferência, existentes primeiro):** funções puras de `GameState`;
  simulações `playToEnd`/`playConfigToEnd` em `decideMove.test.ts`; função pura de watchdog
  (`watchdog.test.ts` como prior art, relógio injetado); **novo seam** `src/chat/commands.ts`
  (parsing puro extraído de `main.ts` — único seam novo da v3, no ponto mais alto possível
  do fluxo de chat); `contentFilter` já é função pura testável.
- **Gerador de maze (propriedades):** nenhuma célula livre isolada (conectividade total);
  % de células de borda que são parede > 0; nenhuma linha/coluna interna 100% parede
  redundante ("faixa morta"); cobra inicial e alvo conectados; win rate do maze_harvest não
  pode piorar.
- **Comandos:** tabela de casos PT/EN, palavra inteira vs substring, acentos.
- **Filtro:** casos PT-BR, variações de caixa (e leetspeak se implementado).
- **Watchdog:** teste unitário puro do cálculo do limite/reset por progresso.
- **Paridade:** teste da normalização (9×7 → 9×8 etc.).
- **Atalho de ciclo:** propriedade — caminho retornado nunca contém célula do corpo,
  incluindo estados de early game fora do ciclo.
- **full_food:** avatar nunca sobrepõe comida/cobra; contagem de comidas preservada.
- **Win rates:** `playToEnd`/`playConfigToEnd` (prior art direto); investigação com n=50.
- **Higiene obrigatória:** `npx tsc --noEmit` limpo; `src/autopilot/debug.test.ts` deletado
  antes de encerrar qualquer fatia.

## Out of Scope

- Teleporte da maçã (corrigido, pudding-only), atalho mid-game ignorado (corrigido), loop
  extra no endgame (corrigido), vazamentos de textura (TextureCache com refcount+destroy),
  paredes do pudding já validadas, metas de vitória por modo, `SNAKE_CHAT=fake|silent|youtube`,
  teto 6×, auto-reconexão do cliente WS, decay do SpeedMeter (no-op por design), áudio com
  fallback sintetizado, paridade do growth mode — tudo já saudável.
- Pendências externas do André (não são issues): playlist CC0 e ensaio de 3 h no OBS.
- Novos modos de jogo, novos mapas, mudanças de infraestrutura/servidor de chat.

## Further Notes

- Ordem de execução importa: o novo gerador de maze (#101) muda a topologia e invalida
  qualquer medição prévia de win rate — a investigação (#109) e o refino de spawn (#114)
  vêm depois dele.
- Três decisões pendentes do André, todas destacadas no plano: lista final de palavras de
  comando (#102), opção a/b do HUD (#108), traduzir ou não a interface (#113).
- Numeração #101–#116 desta rodada (auditoria de 26/07) — não confundir com os arquivos
  antigos de `docs/issues/101-…`–`109-…`, que são de uma rodada anterior de planejamento.
- Plano 100% local (`docs/execucao/`), nunca publicado no GitHub.
