# PRD — Snake Live (v1)

- **Data:** 2026-06-23
- **Fonte:** [spec de design](../superpowers/specs/2026-06-23-snake-live-design.md)
- **Status:** ready-for-agent
- **Escopo:** v1 (crescimento pré-monetização). Super Chat/AdSense = Fase 2.

---

## Problem Statement

O André quer um canal de YouTube de lives diárias de "cobrinha interativa" — no modelo do
canal MegoMG, que roda 3h/dia e bate 100k–250k+ visualizações por live. Hoje ele não tem
nenhuma das peças: nem o jogo, nem a conexão com o chat ao vivo, nem a automação que mantém
a live de pé sozinha. Construir isso do zero, à mão, seria lento e frágil — e qualquer
instabilidade ao vivo (tela travada, jogo morto, palavrão na tela, strike de música)
arruína a sessão e o crescimento do canal.

A dor concreta: **"Como eu coloco no ar uma live de cobrinha, bonita e em 9:16, que joga
sozinha por ~3h, em que o chat do YouTube de verdade interfere no jogo (vira comida, acelera,
sobe no ranking), sem eu precisar operar nada e sem riscos que quebrem a sessão?"**

## Solution

Um **app web local** (TypeScript + PixiJS) que o André abre no navegador e o OBS captura,
transmitindo como live no YouTube em formato **vertical 9:16**. O app tem três camadas
separadas:

1. **Jogo** — cobrinha jogável e bonita (telas Start / Victory / "I lost!"), animações de
   rosto, boost arco-íris, sons e **música de fundo CC0**.
2. **Autopilot** — um bot que joga de verdade (pathfinding) e simula os cliques de UI
   (ex.: aperta "Start" sozinho ~1s depois do fim da partida).
3. **Backend de chat** — lê o chat da live **raspando a página** (lib `youtube-chat`, sem
   API key / sem cota / sem OAuth), normaliza cada mensagem num evento de domínio e o
   entrega ao jogo via WebSocket.

Do ponto de vista do **espectador**: ele comenta qualquer coisa, e na hora a foto dele vira
uma comida no tabuleiro, a barra de velocidade enche, aparece um aviso "Add food!" com o
@dele, e ele sobe no ranking de top viewers (podendo virar o **#1 HERO**). A comunicação é
quase toda por **ícones/emojis/números** (inglês com texto mínimo) — dá pra entender sem
saber inglês, igual à referência.

Do ponto de vista do **André (operador)**: ele inicia a transmissão no OBS, informa a URL da
própria live e o sistema roda sozinho por 3h — joga, lê o chat, reinicia partidas, nunca
deixa a tela parada e bloqueia conteúdo impróprio antes de aparecer.

## User Stories

### Espectador (viewer)
1. Como espectador, quero que **qualquer comentário meu** apareça como uma comida no
   tabuleiro, pra sentir que participo do jogo de verdade.
2. Como espectador, quero que a comida seja a **minha foto de perfil**, pra me reconhecer na
   tela e me sentir parte do jogo.
3. Como espectador, quero ver um **aviso "Add food! @meu_nome"** quando meu comentário entra,
   pra ter feedback imediato de que minha ação fez algo.
4. Como espectador, quero que meus comentários **encham a barra de velocidade**, pra sentir
   que o chat coletivamente controla o ritmo do jogo.
5. Como espectador, quero aparecer numa **lista de top viewers** com foto, nome e ícones, pra
   competir por destaque.
6. Como espectador que mais interage, quero virar o **#1 HERO** em destaque no topo, pra ser
   reconhecido como o protagonista da sessão.
7. Como espectador, quero entender **o que fazer sem ler muito texto**, só pelos ícones e
   emojis, mesmo sem saber inglês.
8. Como espectador, quero ver a cobra **reagir visualmente** (vira o rosto pro lado que anda,
   abre a boca antes de comer, brilha/arco-íris num evento especial), pra a live ser
   divertida de assistir.
9. Como espectador, quero ouvir **sons** (clique de teclado nas viradas, som ao comer) e
   **música de fundo**, pra a live ter vida e parecer um jogo "real".
10. Como espectador, quero ver a **vitória (encheu o mapa)** e a **derrota (bateu)** com
    telas claras de Victory / "I lost!", pra ter clímax e tensão a cada partida.
11. Como espectador, NÃO quero ver **palavrões ou imagens impróprias** de outros usuários na
    tela, pra a experiência não ser arruinada.

### Bot / jogo
12. Como o jogo, quero **sempre ter 1 maçã base** no tabuleiro (ao ser comida, nasce outra),
    pra a cobra sempre ter pra onde ir e a tela nunca ficar parada.
13. Como o jogo, quero que **cada comida aumente a cobra em 1 quadrante**, seguindo a regra
    clássica.
14. Como o jogo, quero **vencer ao preencher o mapa inteiro** e **perder ao colidir** com
    parede ou com o próprio corpo.
15. Como o autopilot, quero **buscar a comida pelo melhor caminho** com proteções pra não me
    enroscar burramente, mas **podendo morrer de verdade** às vezes (jogo autêntico).
16. Como o autopilot, quero **clicar "Start" sozinho ~1s** depois de Victory/"I lost!", pra a
    próxima partida começar sem operador, **resetando a cobra pra tamanho 2**.
17. Como o jogo, quero **limitar quantos avatares-comida** ficam no tabuleiro ao mesmo tempo
    (e enfileirar o excedente), pra uma enxurrada de comentários não me travar.
18. Como o jogo, quero **reaproveitar a foto** de quem comenta várias vezes (cache) e
    **liberar a textura** quando a comida é comida, pra a memória ficar estável nas 3h.
19. Como o jogo, quero um **avatar padrão de fallback** quando a foto de alguém falha ao
    carregar, pra nunca travar esperando uma imagem.

### Chat / backend
20. Como o backend, quero **ler o chat da live sem API key/cota/OAuth** (scraper), pra não
    "ficar surdo" no meio da sessão por estouro de cota.
21. Como o backend, quero **normalizar cada mensagem** num evento de domínio
    (`{autor, avatarUrl, tipo, isMember, isMod}`), pra o jogo não saber nada do YouTube.
22. Como o backend, quero **detectar Super Chat e membros** já na v1 (mesmo sem usá-los),
    pra a Fase 2 só "plugar" sem reescrever a leitura.
23. Como o backend, quero **filtrar conteúdo impróprio** (nome/texto) antes de emitir o
    evento, pra nada ruim chegar na tela.
24. Como o operador, quero **trocar a fonte de chat por um simulador** (chat falso) com uma
    troca de configuração, pra ensaiar a live e rodar testes sem estar ao vivo.
25. Como o sistema, quero **cair pra API oficial (fallback)** se o scraper quebrar, sem
    reescrever o jogo — caminho mapeado, não construído na v1.

### Operação / robustez
26. Como o André, quero **abrir o app e o OBS e deixar rodar 3h sozinho**, sem operar nada.
27. Como o André, quero **informar só a URL da minha live** pra o sistema saber qual chat
    ler, sem configurar credenciais.
28. Como o André, quero que **música protegida nunca toque** (só CC0), pra eu não tomar
    strike/desmonetização.
29. Como o André, quero o app rodando **em localhost** durante a live (sem depender de
    nuvem), e poder **subir o frontend no Vercel depois** como conveniência.
30. Como o André, quero que o jogo **se recupere de erros** (foto quebrada, mensagem
    malformada, queda momentânea do chat) **sem derrubar a sessão**.
31. Como o André, quero a tela em **9:16 vertical, bonita e bem estruturada**, pronta pra
    Shorts/mobile.

## Implementation Decisions

### Arquitetura
- **3 camadas desacopladas:** `game` (estado + render PixiJS), `autopilot` (pathfinding +
  controle de UI), `chat` (scraper + normalização). O `game` recebe **eventos abstratos**
  por uma interface `EventSource`; não conhece YouTube.
- **App local único** (um processo Node/Vite) serve o frontend, roda o scraper e expõe o
  **WebSocket** de eventos. Roda em **localhost**; OBS captura. Sem serverless pro backend.
- **`EventSource` plugável:** implementações `YouTubeChatSource` (real) e `FakeChatSource`
  (simulador) por trás da mesma interface — usada em dev, testes e ensaio.

### Jogo (módulo `game`)
- **Núcleo puro e headless** (`GameState`): tabuleiro N×N, cobra, comidas (base + avatares),
  tick, direção, colisão, vitória/derrota. Sem dependência de PixiJS — é onde mora a lógica
  testável.
- **Render** (PixiJS/WebGL) é uma camada *sobre* o estado: lê `GameState` e desenha. Render
  nunca contém regra de jogo.
- **Tabuleiro inicial ~12×12** (parametrizável) pra calibrar frequência de vitória.
- **Comidas:** 1 maçã base sempre presente; avatares de comentários são comidas extras.
  Limite de ~8–10 avatares simultâneos no tabuleiro; excedente em **fila**. Texturas em
  **cache LRU** com liberação ao consumir; **fallback** de avatar.
- **Estados/telas:** `Start` → `Playing` → (`Victory` | `Lost`) → auto-`Start`. Máquina de
  estados explícita.
- **Áudio:** efeitos (virada/teclado, comer, boost, jingles) + **música CC0** em camada
  própria (Howler ou equivalente), shuffle + crossfade + loop.

### Autopilot (módulo `autopilot`)
- **Função pura** `decideMove(GameState) → Direction`. Algoritmo portado da ideia do
  twanvl/snake ("Hamiltonian cycle repair" com atalhos seguros), **dosado** com um parâmetro
  de "risco/imperfeição" pra ela às vezes morrer de verdade.
- **Driver de UI** separado: observa o estado e dispara o clique de "Start" ~1s após o fim.

### Chat (módulo `chat`)
- `YouTubeChatSource` encapsula `youtube-chat` (scraper, MIT). Entrada: URL/ID da live.
  Saída: stream de `ChatEvent` normalizado.
- **Normalização:** `{ id, authorName, authorChannelId, avatarUrl, text, isMember, isMod,
  isOwner, superchat?: {amount, color} }`.
- **Filtro de conteúdo:** lista de bloqueio + heurísticas sobre `authorName`/`text` antes de
  emitir. (Avatar impróprio é mitigado pelo fallback + possibilidade de skip.)
- **Mapeamento de evento → jogo:** *todo* `ChatEvent` de mensagem dispara, atomicamente:
  (a) incremento da barra de velocidade, (b) spawn de avatar-comida (respeitando limite/fila),
  (c) notificação "Add food! @autor", (d) crédito no leaderboard. **#1 HERO** = maior
  acumulado da sessão.
- **Fase 2 (não construído agora, só reservado):** `superchat`/`isMember` → comida VIP
  brilhante + boost arco-íris.

### Apresentação
- **Layout 9:16 (1080×1920).** Composição: barras de speed no topo, tabuleiro no centro,
  leaderboard "top viewers" embaixo, banner #1 HERO no topo, caixa de instruções com ícones,
  notificações de evento. **Texto mínimo, inglês, ícones/emojis/números.**
- **Identidade visual:** mesma vibe da referência (que comprova funcionar no nicho), mas com
  paleta/marca próprias e mais capricho (brilhos, animações suaves).

### Reaproveitamento
- Scaffold: `pixijs-typescript-starter`. Refs de cobra/render: `QuinnChrest/Snake`.
- Bot: ideia de `twanvl/snake` (MIT). Chat: `youtube-chat` (MIT, possivelmente um fork
  atualizado).

## Testing Decisions

**O que é um bom teste aqui:** testar **comportamento externo** dos módulos, não detalhe de
implementação nem pixels. Os 3 seams (todos no ponto mais alto possível):

1. **`game` (estado puro):** dado um `GameState` + uma sequência de inputs (tick, direção,
   "spawn comida em (x,y)"), verificar o estado resultante: cresce ao comer, perde ao colidir,
   vence ao encher, mantém 1 maçã base, respeita o limite de avatares e a fila. **Não usa
   PixiJS.** É o seam de maior valor.
2. **`autopilot` (pura):** dado um `GameState` montado, verificar que `decideMove` escolhe um
   movimento seguro/coerente (ex.: não anda pra dentro do próprio corpo; persegue a comida
   quando é seguro). Casos de borda de "quase-armadilha".
3. **`chat` (adaptador):** dado um payload cru de mensagem (fixtures, incluindo Super Chat,
   membro, nome com palavrão, avatar ausente), verificar o `ChatEvent` normalizado e que o
   **filtro** bloqueia o que deve. O scraper de terceiro **não** é unit-testado; é isolado
   atrás da interface.

**Prior art:** projeto novo, sem testes ainda — estes 3 seams **estabelecem** o padrão
(testes de módulo puro + fixtures de adaptador). `FakeChatSource` serve tanto aos testes
quanto ao ensaio manual.

**Fora dos testes automatizados:** fidelidade visual/animação/áudio e captura no OBS são
validadas manualmente (rodando a live de ensaio com `FakeChatSource`).

## Out of Scope

- **Monetização (Fase 2):** Super Chat como gatilho VIP, boost arco-íris "pago", membros,
  AdSense. A leitura já detecta esses eventos, mas a v1 não os usa como mecânica.
- **Deploy do backend em nuvem/Vercel:** v1 roda em localhost. Frontend no Vercel é
  conveniência futura.
- **API oficial do YouTube / OAuth:** só como fallback mapeado, não construído.
- **24/7:** v1 é ~3h/dia, manual de iniciar (OBS).
- **Bolha de boas-vindas automática** (cortada do overlay v1).
- **Multiplataforma (TikTok/Twitch):** só YouTube na v1.
- **Painel/configurador visual:** configuração por arquivo/env por ora.

## Further Notes

- **Risco real nº1 = crescimento, não tecnologia.** A maçã base garante tela viva, mas o
  "show" depende de ter gente comentando. Vale estratégia de divulgação (Shorts) em paralelo —
  fora do escopo de código, mas registrado.
- **Fragilidade do scraper:** `youtube-chat` (último release 2022) pode quebrar com mudanças
  do YouTube; usar fork atualizado e manter o fallback de API mapeado. Como roda 3h/dia
  local, é fácil reiniciar/consertar.
- **ToS / "made for kids":** conteúdo automatizado/repetitivo e uso de avatares de terceiros
  têm implicações; atenção à flag "feito para crianças" (afeta recursos e receita).
- **Música:** começo com um conjunto CC0; o André pode curar depois.
- **Calibragem:** tamanho do tabuleiro e "risco" do bot são os botões pra ajustar ritmo e
  frequência de vitória/derrota — esperar afinar com testes/ensaios.
