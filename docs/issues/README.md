# Issues — Snake Live v2

Fatias verticais do PRD [2026-07-02-snake-live-v2-prd.md](../prd/2026-07-02-snake-live-v2-prd.md).
Todas AFK (sem decisão humana pendente — decisões já tomadas no PRD). Publicação no GitHub
pendente de autorização do André; por ora vivem aqui.

| # | Fatia | Bloqueada por |
|---|-------|---------------|
| 001 | Higiene de base (tsc, encoding, metadados) | — |
| 002 | Spawn de comida seguro unificado + autocura | — |
| 003 | Estratégia de tabuleiro aberto (todos os modos sem parede) | — |
| 004 | Vitória por meta de frutas (rodadas terminam) | — |
| 005 | maze_race só vence na fruta-alvo | — |
| 006 | Solver com paredes + remoção dos band-aids + watchdog 90s | 004 |
| 007 | Pudding com paredes validadas (conectividade + sem 2×2) | 001 |
| 008 | Erro humano por rodada em qualquer fase | 003, 006 |
| 009 | Ensaio restaurado (SNAKE_CHAT) | — |
| 010 | Teto de velocidade efetiva 6x | — |
| 011 | Render com cache de camadas + conserto de vazamento | — |
| 012 | HUD com informação verdadeira + overlay ajustado | — |

Ordem sugerida de execução: 001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → 011 → 012.
As independentes (009–012) podem intercalar a qualquer momento.

Critério global de pronto: `npx tsc --noEmit` verde, `npx vitest run` verde, verificação
manual no preview (porta 5180) dos modos alterados.
