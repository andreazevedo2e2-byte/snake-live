# PRD — Snake Live v2: "toda configuração termina, toda comida é alcançável"

Data: 2026-07-02 · Autor: Claude (Fable) com André · Status: ready-for-agent

## Problem Statement

O Snake Live evoluiu de um modo único para 5 modos de jogo, 6 mapas, 2 estilos de cobra e um
painel de configurações — mas a maioria dessas combinações está quebrada na prática de live:

- Em **Blocos dinâmicos (pudding)** e **labirintos**, a cobra entra em "loop": continua comendo
  para sempre sem nunca fechar a rodada, porque a condição de vitória (encher o tabuleiro
  inteiro) é inatingível com paredes no caminho. Medido em simulação: 4 de 6 rodadas de pudding
  nunca terminam.
- Em **Labirinto final (maze_race)**, qualquer comida de avatar criada pelo chat conta como a
  fruta-alvo: 2 de 5 vitórias medidas foram "falsas", encerrando o labirinto sem chegar ao fim.
- Em **Mapa cheio (full_food)**, o autopilot desliga o ciclo Hamiltoniano (que venceria 100%
  das vezes) e usa heurística de exploração: 67% de derrota medida em tabuleiro 10×8.
- Em **mapas de bandeira com modo clássico**, vencer exige encher 384–640 células: nenhuma
  vitória medida; a rodada vira uma caminhada sem fim e o contador WINS nunca sobe.
- Comidas de avatar e comidas promovidas da fila nascem via `randomEmptyCell`, sem checagem de
  alcançabilidade — o caso raro "comida em lugar impossível → jogo travado" que motivou esta
  revisão.
- O **modo ensaio sumiu em silêncio**: o servidor não usa mais `FakeChatSource` (virou
  `SilentChatSource`), contradizendo o README; o streamer acha que está simulando chat e não está.
- Band-aids no `main.ts` (detector de loop + "loop breaker" que nem valida segurança do
  movimento, erro humano roteirizado que só dispara acima de 72% de preenchimento) mascaram a
  causa raiz em vez de resolvê-la, e o watchdog anti-travamento leva ~7–22 minutos para agir em
  tabuleiros grandes.
- Higiene: `tsc --noEmit` falha (2 funções mortas de validação de parede que nunca foram
  ligadas), mojibake "FranÃ§a" no painel de configurações, URL de repositório errada no
  package.json, texturas de avatar vazam a cada troca de tabuleiro (toda vitória/derrota
  recria o renderer sem liberar refs do cache), e camadas estáticas (mapa/paredes/fundo) são
  redesenhadas 60×/s — risco de aquecimento/degradação em lives de horas.

Para o streamer, o efeito é: a cobra parece burra, rodadas não terminam, vitórias mentem e o
overlay corre risco de degradar ao longo de uma live longa e sem supervisão.

## Solution

Reconstruir o miolo do jogo em torno de duas garantias:

1. **Toda configuração termina** — cada modo tem condição de vitória atingível e calibrada
   para o ritmo de live (rodadas de ~2–6 min), e o autopilot usa a estratégia certa para cada
   tipo de tabuleiro (ciclo Hamiltoniano com atalhos provadamente seguros em tabuleiro aberto;
   solver de caminho validado por simulação completa em tabuleiro com paredes). Derrotas
   continuam existindo, mas só as roteirizadas (erro humano configurável) ou de alta
   velocidade — nunca por burrice estrutural do algoritmo.
2. **Toda comida é alcançável** — um único ponto de spawn seguro para todos os caminhos
   (inicial, reposição, avatar do chat, promoção da fila) que exige alcançabilidade a partir
   da cabeça, mais uma regra de autocura: comida inalcançável por N ticks é realocada.

Além disso: restaurar o modo ensaio (chat fake) com chave explícita, remover os band-aids do
`main.ts` (a causa raiz morre no autopilot), consertar higiene de código/encoding, e cachear
camadas estáticas de render para a live rodar horas sem degradar.

## User Stories

1. Como streamer, quero que toda rodada termine em vitória ou derrota em poucos minutos, para
   que a live tenha ritmo e o contador de WINS se mova.
2. Como streamer, quero que a cobra jogue de forma visivelmente inteligente (reta até a fruta,
   sem círculos nem hesitação), para que o overlay pareça um jogador humano bom.
3. Como streamer, quero que no modo Labirinto final a vitória só aconteça na fruta-alvo, para
   que o clímax do labirinto não seja roubado por uma comida de chat.
4. Como espectador, quero que a comida com meu avatar apareça num lugar que a cobra consegue
   alcançar, para que minha contribuição seja comida na tela.
5. Como streamer, quero que comida presa (raro) se realoque sozinha em segundos, para que o
   jogo nunca fique refém de um spawn ruim.
6. Como streamer, quero que Mapa cheio seja vencido de forma consistente, para usá-lo como
   vitrine de perfeição (o modo é literalmente resolvível 100%).
7. Como streamer, quero que Blocos dinâmicos tenha alvo de frutas (não "encher o tabuleiro"),
   para que o modo tenha final e as paredes novas criem tensão até o alvo.
8. Como streamer, quero que Labirinto contínuo tenha meta de colheita (K frutas), para que o
   modo feche com celebração em vez de vagar para sempre.
9. Como streamer, quero que mapas de bandeira (grandes) usem vitória por meta de frutas, para
   que 32×20 não signifique "rodada de 3 horas".
10. Como streamer, quero definir a taxa de erro humano por rodada nas configurações e ver a
    cobra errar de forma crível (em qualquer fase da partida), para que derrotas pareçam
    humanas e não travamento.
11. Como streamer, quero que o watchdog de rodada travada aja em ~90 segundos com uma derrota
    teatral ("I LOST!"), para que mesmo um bug imprevisto vire conteúdo e a live siga.
12. Como streamer, quero ensaiar com chat simulado ligando uma chave explícita, para testar
    overlay, sons e ranking sem estar ao vivo — como o README promete.
13. Como streamer, quero que a velocidade efetiva tenha teto (6x), para que chat lotado ×
    multiplicador base não gere ticks de 29 ms ilegíveis.
14. Como espectador, quero que meu comentário "speed" acelere o jogo e meu "food" crie comida
    com meu avatar, com aviso na tela, para sentir que interfiro no jogo.
15. Como espectador, quero ver meu nome no ranking de top viewers com meu avatar, para
    competir pela posição.
16. Como streamer, quero que a bandeira escolhida apareça pintada corretamente e a cobra
    "pinte" o mapa nos temas de revelação (coração/creeper), para variedade visual entre lives.
17. Como streamer, quero que o overlay rode horas sem vazamento de memória nem aquecimento
    desnecessário, para deixar a live sem supervisão com segurança.
18. Como streamer, quero que o painel de configurações esteja em português correto (sem
    mojibake) e com rótulos coerentes, para configurar rápido antes da live.
19. Como streamer, quero que a tela de vitória conte a história do modo (tempo no labirinto,
    frutas no modo colheita, tabuleiro cheio no clássico), para o público entender o que foi
    conquistado.
20. Como streamer, quero que o modo crescimento continue subindo o nível a cada vitória (mapa
    maior), para dar sensação de progressão de longo prazo na live.
21. Como streamer, quero que o HUD mostre informação verdadeira (sem "SUBS 0" morto), para não
    parecer overlay quebrado.
22. Como desenvolvedor, quero `tsc --noEmit` e a suíte de testes passando no repositório, para
    que qualquer agente futuro trabalhe em base saudável.
23. Como desenvolvedor, quero simulações de matriz modo×tabuleiro nos testes com pisos de taxa
    de vitória, para que regressões de estratégia sejam pegas antes da live.
24. Como streamer, quero que o estilo Google Snake e o estilo suave continuem disponíveis e
    corretos em todos os modos, para variar a estética entre vídeos.
25. Como streamer, quero sons distintos para comer/virar/vitória/derrota/marco de velocidade
    respeitando o volume configurado, para a live ter identidade sonora.

## Implementation Decisions

**Autopilot — seletor de estratégia por tipo de tabuleiro (decisão central):**
- Tabuleiro sem paredes (classic, full_food, todos os mapas): ciclo Hamiltoniano fixo por
  rodada + atalhos restritos à ordem do ciclo (provadamente seguros — já implementado e
  validado com ~85% de vitória em beeline natural; full_food vira 100% por construção pois o
  ciclo visita cada célula exatamente uma vez). Remover o desvio `prefersExploration`: o ciclo
  também é o explorador perfeito para os temas de revelação.
- Tabuleiro com paredes (maze_race, maze_harvest, pudding): BFS até a comida validado por
  simulação do caminho inteiro + alcançabilidade da cauda no estado final; fallback
  perseguir-a-cauda ciente de paredes; último recurso maximizar espaço alcançável. Sem
  detector de loop no chamador: se não há caminho seguro, a estratégia degrada de forma
  determinística e o watchdog de 90 s cobre o imprevisto.
- Erro humano: manter o modelo "decidido por rodada" (`humanErrorRate` das configurações),
  mas o gatilho passa a funcionar em qualquer fase da partida (janela preferencial no fim de
  jogo, fallback no meio), escolhendo um movimento ruim porém legal. Remover o parâmetro de
  velocidade morto da assinatura de decisão.
- Remover de `main.ts`: `detectRepetitionLoop`, `pickLoopBreakerDirection`,
  `pickDifficultHumanMistake` (o erro roteirizado migra para perto da decisão de movimento) e
  o watchdog baseado em `w*h*5` ticks (vira tempo real ~90 s sem pontuar).

**Regras de jogo — condição de vitória por modo:**
- classic/full_food em tabuleiro pequeno (≤ ~150 células jogáveis): encher o tabuleiro (como
  hoje).
- classic em tabuleiro grande (mapas de bandeira etc.): vitória por meta de frutas
  proporcional (~35% das células jogáveis), com celebração "BOARD CLEARED" e contagem exibida.
- maze_race: vitória exclusivamente na fruta-alvo (id dedicado); comidas de avatar continuam
  valendo ponto e som, sem encerrar a rodada.
- maze_harvest: meta de K frutas (default proporcional ao tamanho do labirinto).
- pudding: meta de K frutas; a colocação de parede dinâmica passa a usar as validações hoje
  mortas (bloco sólido 2×2 proibido + conectividade global preservada), garantindo que nunca
  nasce bolsão isolado.
- Velocidade efetiva (chat × base) com teto 6x. Sem decaimento (decisão: catraca de hype é
  intencional; o modo "fixo" já existe para travar).

**Spawn de comida — ponto único e autocura:**
- Toda criação/reposição/promoção/avatar passa por um único caminho de spawn seguro:
  célula livre, alcançável a partir da cabeça (desconsiderando a cauda que vaga), com ≥2
  vizinhos livres quando houver candidatas; fallback explícito e logado.
- Regra de autocura no tick: comida inalcançável da cabeça por 8 ticks consecutivos é
  realocada para célula segura (evento raro; visível como "pulo" da fruta — aceitável).

**Servidor/ensaio:**
- Chave `SNAKE_CHAT=fake|silent|youtube` (com `SNAKE_LIVE_URL` para youtube). Default em
  desenvolvimento: `fake` — restaurando o comportamento documentado no README.

**Renderização/performance:**
- Camadas estáticas (overlay de mapa, paredes, fundo, grid) redesenham apenas quando o estado
  relevante muda (dirty-flag por hash de paredes/tema/hue quantizado); escrita de CSS var do
  hue apenas quando muda o valor quantizado.
- Corrigir vazamento: destruição do BoardRenderer libera as refs de textura de avatar no
  cache (hoje `replaceBoard` destrói sprites sem `release`).
- Overlay de status (GET READY/VICTORY/I LOST) dimensionado ao retângulo real do tabuleiro
  (não ao quadrado do layout).

**HUD/UI:**
- Remover "SUBS" morto; no lugar, badge de mapa+modo na barra superior do modo live.
- Corrigir encoding UTF-8 do index.html (mojibake "FranÃ§a") e revisar rótulos PT-BR.
- Tela de vitória por modo: labirinto mostra tempo da rodada; colheita mostra frutas; clássico
  mostra cobertura.
- package.json: URL do repositório corrigida para andreazevedo2e2-byte/snake-live.
- Remover código morto e zerar erros de `tsc --noEmit`.

**Fora do autopilot, sem mudança de interface pública:** `createGame(config)`, `tick(state)`,
`setDirection`, `enqueueAvatarFood` mantêm assinaturas; `GameConfig` ganha campos de meta de
frutas (com defaults calculados) sem quebrar chamadas existentes.

## Testing Decisions

- Um bom teste aqui exercita **comportamento externo em fronteiras puras**: estados terminais,
  taxas de vitória, invariantes de alcançabilidade — nunca detalhes internos de heurística.
- **Seams (todas já existentes — nenhuma nova):**
  1. Núcleo puro `createGame/tick/setDirection/enqueueAvatarFood` (prior art:
     `GameState.test.ts`);
  2. Decisão `decideMove(state)` via harness de partida completa `playToEnd` (prior art:
     `decideMove.test.ts`);
  3. Chat simulado `nextFakeChatEvent` determinístico (prior art: `FakeChatSource.test.ts`).
  Renderização/HUD seguem verificação manual via preview (prática atual do projeto).
- **Matriz modo×tabuleiro** em simulação com pisos: full_food = 100% de vitória;
  classic pequeno ≥ 85%; maze_race = 100% (e nunca por comida de avatar); maze_harvest ≥ 90%;
  pudding ≥ 85%; classic grande (bandeira) = 100% de término por meta dentro do teto de ticks.
- **Propriedade de spawn seguro:** para qualquer sequência de ticks + enqueues de avatar em
  qualquer modo, nenhuma comida permanece inalcançável da cabeça por mais de 8 ticks.
- **Propriedade do pudding:** após cada parede adicionada, o conjunto de células livres
  permanece conexo.
- Testes de erro humano com RNG injetado (decisão por rodada dispara no máximo uma vez).

## Out of Scope

- Integração real com YouTube (leitura de chat ao vivo já existe; sem mudanças além da chave
  de seleção de fonte).
- Curadoria de músicas CC0 (playlist segue vazia até o André escolher as faixas; o player já
  lida com playlist vazia).
- Novos mapas/temas além dos 6 existentes e novos modos além dos 5 existentes.
- Contador real de inscritos (SUBS sai do HUD em vez de ser integrado).
- Controles manuais/teclado para jogar; monetização; multi-idioma.

## Further Notes

- Evidências medidas em simulação (6–8 partidas por célula da matriz): pudding 4/6 sem
  término; maze_race 2/5 vitórias falsas via avatar; full_food 4/6 derrotas em 10×8; bandeira
  França 24×16 clássico 0/3 vitórias. Reproduzível com o harness `playToEnd` dos testes.
- O ciclo Hamiltoniano com atalhos seguros já está no repositório e validado (izena a base da
  estratégia de tabuleiro aberto); o trabalho é de *seleção de estratégia* e regras, não de
  pesquisa nova.
- A migração deve remover: `detectRepetitionLoop`/`pickLoopBreakerDirection`/
  `pickDifficultHumanMistake` do `main.ts`, `createsSolidBlock`/`isConnectedAfterWall` mortos
  (religando-os no pudding), e o caminho `randomEmptyCell` direto para comida de avatar.
- Risco conhecido: nos labirintos, corredores de largura 1 fazem a cobra longa "se seguir" — a
  meta de K frutas deve ser calibrada para o comprimento máximo confortável (~25–35% das
  células do corredor) para a rodada fechar antes de virar autobloqueio.
