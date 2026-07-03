# 006 — Solver de tabuleiro com paredes + remoção dos band-aids

Tipo: AFK · Bloqueada por: 004 (metas tornam os pisos de vitória mensuráveis)

## Parent

PRD: docs/prd/2026-07-02-snake-live-v2-prd.md

## What to build

Estratégia dedicada para tabuleiros COM paredes (labirintos e blocos dinâmicos): caminho BFS
até a comida validado por simulação do caminho inteiro (a cobra ainda alcança a própria cauda
no estado final), fallback determinístico de perseguir a cauda ciente de paredes, último
recurso maximizar espaço alcançável.

Com a causa raiz resolvida, remover os band-aids do laço principal: detector de repetição,
"loop breaker" (que escolhe movimentos sem validar segurança) e o watchdog baseado em
`largura×altura×5` ticks — substituído por watchdog de tempo real (~90 s sem pontuar → derrota
teatral "I LOST!" + reinício automático).

User stories cobertas: 2, 11.

## Acceptance criteria

- [ ] Simulação: maze_harvest ≥90% e pudding ≥85% de vitória com as metas da fatia 004
- [ ] Simulação: maze_race 100% de chegada ao alvo
- [ ] Nenhuma função de detecção/quebra de loop resta no laço principal
- [ ] Watchdog dispara em ~90 s sem pontuação (teste com relógio injetado/acelerado) e
      reinicia a rodada com derrota
- [ ] Zero movimentos ilegais/suicidas em 10k ticks simulados por modo

## Blocked by

- 004 — vitória por meta de frutas
