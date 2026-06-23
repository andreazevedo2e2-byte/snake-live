# Snake Live — Documento de Design (Spec)

- **Data:** 2026-06-23
- **Codinome:** Snake Live
- **Autor:** André (com Claude)
- **Status:** Aprovado para virar PRD

---

## 1. Visão geral & objetivo

Jogo de cobrinha **automatizado** que roda no PC do André ~3h/dia, é capturado no
OBS e transmitido como live no YouTube. Um **bot joga de verdade** (pathfinding) e o
**chat ao vivo interfere** no jogo. Inspirado no canal **MegoMG**, que faz lives diárias
de cobrinha interativa e bate 100k–250k+ visualizações.

**Objetivo da v1 (não é receita):** como o canal é novo e **sem monetização** (fora do
YPP), o foco é **retenção + volume de comentários + inscritos** para destravar a
monetização (~1.000 inscritos + 4.000h de exibição). Receita (AdSense/Super Chat) é
explicitamente um objetivo de **Fase 2**.

**Definição de sucesso da v1:** uma live de 3h roda sozinha, estável, bonita, com o chat
conseguindo interferir no jogo de forma visível, sem travar e sem precisar de operador.

---

## 2. Arquitetura técnica (3 camadas separadas)

A separação é proposital: dá para testar o jogo sem YouTube e trocar a fonte de eventos
(ex.: um simulador de chat para ensaio) sem tocar no jogo.

### 2.1 Camada Jogo (TypeScript + PixiJS)
Um jogo de cobrinha **normal e jogável**, com telas de Start / Victory / "I lost!",
animações de rosto, boost arco-íris e sons. **Não sabe nada sobre YouTube.** Recebe
eventos abstratos ("apareceu comida X", "acelerar") por uma interface.

- **Por que PixiJS (WebGL):** renderização por GPU torna desenhar dezenas de avatares
  tão barato quanto desenhar quadrados. Anima de rosto, brilho e arco-íris sem travar.

- **Scaffold:** partir do boilerplate [pixijs-typescript-starter](https://github.com/GuillaumeDesforges/pixijs-typescript-starter)
  (TS + PixiJS + Vite) em vez de configurar do zero. Cobrinha de referência:
  [QuinnChrest/Snake](https://github.com/QuinnChrest/Snake).

### 2.2 Camada Autopilot
O "cérebro" que dirige o jogo como um jogador faria:
- **Pathfinding** da cobra até a comida (melhor caminho, com proteções anti-morte-burra).
- **Simula cliques** da UI — ex.: clicar "Start" ~1s depois do game over / victory.
- **Base do algoritmo:** portar a ideia do [twanvl/snake](https://github.com/twanvl/snake)
  (MIT) — "Dynamic Hamiltonian Cycle Repair": mantém um ciclo seguro e pega atalhos. O
  original é quase-perfeito (0% de derrota); a gente **dosa** pra ela morrer de vez em
  quando (decisão "joga pra valer"). Referências alternativas: LPRowe/perfect-snake,
  chynl/snake.

### 2.3 Camada Backend (Node) — leitura do chat
**Caminho principal (recomendado): scraper, sem API oficial.** Usar
[youtube-chat (LinaTsukusu, MIT)](https://github.com/LinaTsukusu/youtube-chat), que lê o
chat **raspando a página** do YouTube — **sem API key, sem cota de 10k/dia, sem OAuth**.
Já entrega nome, **URL do avatar**, status de membro/mod/dono, texto + emojis, e ainda
**Super Chat (valor+cor) e flag de membro** (pronto pra Fase 2). O backend vira só "rodar a
lib + normalizar evento + repassar pro jogo via **WebSocket**".

**Plano B (fallback): API oficial do YouTube.** Se o scraper quebrar (YouTube muda a página),
cair pra `liveChatMessages` via OAuth + cota. Mantido **mapeado**, não construído na v1.

**Trade-off honesto:** scraper é mais frágil que a API oficial e a lib teve último release
em 2022 — pode exigir um **fork mais atual**. Em troca, elimina cota/OAuth e libera Super
Chat de graça. Aceito para a v1 (roda 3h/dia no PC, fácil de reiniciar se quebrar).

---

## 3. Mecânicas de jogo

- Cobra cresce **+1 quadrante por comida**.
- **Vitória = preencher o mapa inteiro** → tela "Victory".
- **Derrota = bater na parede ou no próprio corpo** → tela "I lost!".
- Em vitória OU derrota: o **Autopilot clica "Start" em ~1s** e a partida reinicia com a
  cobra de **tamanho 2**.
- **Comida base:** sempre há **1 maçã** no tabuleiro; ao ser comida, nasce outra
  instantaneamente (garante progresso mesmo com chat parado).
- **Tabuleiro:** começa em **~12×12** e é um botão de ajuste para calibrar a frequência de
  vitória (grande demais = nunca vence; pequeno = vence rápido demais).
- **Bot joga pra valer:** persegue a comida pelo melhor caminho com proteções, mas
  **pode** se enroscar e perder de verdade (alimenta clipes imprevisíveis).

---

## 4. Sistema de interação do chat

**Qualquer comentário** (sem exigir palavra-chave) dispara, de uma vez:
1. Enche um pouco a **barra de velocidade** (x1.6 → x6). Comentário é o gatilho — barato,
   em tempo real, e cria o ciclo "mais comentário → mais rápido → mais divertido".
2. Joga o **avatar de quem comentou como comida EXTRA** no tabuleiro (além da maçã base).
3. Dispara a **notificação "Add X Foods! @fulano"** (banner de feedback).
4. Credita pontos no **leaderboard de top viewers**.

- **Top comentarista da sessão** → vira **#1 HERO** (banner no topo) + selo **VIP** no
  leaderboard.
- **Fase 2:** Super Chat/membros assumem o papel de VIP e disparam o **boost arco-íris**
  (a cobra oscila cores ao comer um avatar VIP brilhante). A mecânica visual é construída
  na v1, só pluga em outra fonte depois.
- **Filtro de conteúdo (obrigatório):** nomes e avatares impróprios são bloqueados antes
  de aparecer na tela. Chat global = risco real de palavrão/imagem ruim.

### 4.1 Avatar como comida — requisitos de estabilidade

Viável e barato (a URL do avatar já vem no evento do chat; WebGL desenha imagem de graça),
**desde que** estes 4 itens sejam tratados — são **requisitos**, não opcionais:

1. **Limite no tabuleiro:** no máximo ~8–10 avatares-comida simultâneos; o excedente entra
   numa **fila** e aparece conforme abre espaço. Protege contra enxurrada de comentários.
2. **Cache com reaproveitamento:** o mesmo espectador carrega a foto **uma vez**; ao ser
   comida, a textura é **liberada**. Memória estável durante as 3h.
3. **Fallback:** foto que falha ao carregar → avatar padrão. O jogo nunca trava esperando
   imagem.
4. **CORS:** usar o CDN de avatares do YouTube com `crossOrigin`; se algum caso escapar,
   passar por um **proxy no próprio backend**.

---

## 5. Overlay / composição da tela

- **Núcleo:** tabuleiro central + barras de speed no topo + leaderboard "top viewers"
  embaixo.
- **Overlay v1:** caixa de **instruções** ("comment to add food!") + banner **#1 HERO** +
  **notificações de evento** ("Add X Foods!").
- **Fora da v1:** bolha de boas-vindas automática.
- **Identidade visual:** mesma vibe que comprovadamente funciona no nicho, mas com **marca
  própria** e mais capricho (paleta própria, brilhos, animações suaves). **Idioma: inglês**
  (público global, CPM maior).

---

## 6. Áudio

Som de "teclado" a cada virada (detalhe que dá sensação de real), som ao comer, som de
boost/arco-íris, jingles de Victory / "I lost". Tudo dentro do jogo (PixiJS + Howler ou
similar), capturado junto pelo OBS.

---

## 7. Operação

André abre o app no navegador, inicia a transmissão no OBS por ~3h, e o sistema roda
sozinho: joga, lê o chat, reinicia partidas. **Sem nuvem, sem VPS.** Infra = PC próprio.

---

## 8. Riscos & considerações (entram no PRD)

- **ToS do YouTube:** conteúdo repetitivo/automatizado pode ser interpretado como spam;
  usar avatar de terceiros tem implicação de privacidade; atenção à flag "feito para
  crianças" (afeta recursos e monetização). O **scraping** de chat também é área cinza de
  ToS ("take full responsibility").
- **Fragilidade do scraper:** o `youtube-chat` pode quebrar se o YouTube mudar a página
  (último release 2022). Mitigação: usar fork atualizado + **API oficial como fallback**
  (já mapeado). Como roda 3h/dia no PC, é fácil reiniciar/consertar.
- **Chat morto:** a maçã base garante que a tela nunca para, mas o "show" depende de gente
  comentando. **O crescimento inicial é o gargalo real** — vale pensar em estratégia de
  divulgação (Shorts, etc.) em paralelo.

---

## 9. Fases

- **v1 (agora):** tudo acima, com **VIP saindo de "top comentarista"**.
- **Fase 2 (pós-YPP):** Super Chat/membros como gatilho VIP + **boost arco-íris "de
  verdade"** + possíveis efeitos pagos.

---

## Decisões registradas (resumo)

| Tópico | Decisão |
|---|---|
| Objetivo v1 | Replicar MegoMG bonito; foco em crescimento (não receita) |
| Mecânicas de chat | Leaderboard top viewers + espectador vira comida + barras de velocidade |
| Formato da partida | Vence (enche o mapa) / perde (colisão) → auto-restart via clique simulado |
| Gatilho de velocidade | Comentários |
| Comportamento do bot | Joga pra valer (pathfinding real, pode morrer) |
| Público / idioma | Global, inglês |
| Infra | PC próprio + OBS, ~3h/dia |
| Status do canal | Novo, sem monetização → Super Chat é Fase 2 |
| Stack | Web app: TypeScript + PixiJS + backend Node, eventos via WebSocket |
| Leitura do chat | Scraper `youtube-chat` (sem cota/OAuth, dá Super Chat); API oficial = fallback |
| IA da cobra | Portar algoritmo do twanvl/snake (MIT), dosado pra às vezes morrer |
| Reaproveitamento | Scaffold pixijs-typescript-starter; refs: twanvl/snake, QuinnChrest/Snake |
| Visual | Mesma vibe, marca própria, mais bonito |
| Overlay v1 | Instruções + #1 HERO + notificação "Add X Foods" |
| Vitória | Preencher o mapa inteiro |
| Fonte de comida | 1 maçã base sempre + avatares extras via comentário |
| Tabuleiro | Começa ~12×12 (ajustável) |
