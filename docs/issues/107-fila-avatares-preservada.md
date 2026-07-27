# 107 — Fila de avatares sobrevive à troca de rodada

Tipo: AFK · Prioridade: P1 · Risco: baixo (transferência de estado no reset)

## Parent

PRD: docs/prd/2026-07-26-snake-live-v3-prd.md

## What to build

O reset de rodada cria estado novo do zero: a fila de comidas de avatar (`foodQueue`) e os
avatares que ainda estavam no tabuleiro são descartados. Espectador que digitou "food"
durante a tela de vitória/derrota perde a homenagem em silêncio. Preservar a fila ao
resetar e re-enfileirar os avatares que estavam no tabuleiro quando a rodada terminou, para
que entrem na rodada seguinte pela via normal de promoção da fila (com spawn seguro).

Arquivos-alvo: `src/main.ts` (`resetRound`), `src/game/GameState.ts` (criação de estado com
fila inicial), testes em `src/game/GameState.test.ts`.

User stories cobertas: 10, 11.

## Acceptance criteria

- [ ] Teste unitário: estado novo criado com fila preexistente mantém a fila e promove pela via normal
- [ ] Teste unitário: avatares no tabuleiro no fim da rodada são re-enfileirados sem duplicar quem já estava na fila
- [ ] HUD de fila (`queuedFoods`) reflete o valor preservado após reset
- [ ] `npx tsc --noEmit` limpo

## Blocked by

None — can start immediately.
