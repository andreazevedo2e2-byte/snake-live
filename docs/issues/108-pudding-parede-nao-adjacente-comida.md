# 108 — Pudding: parede nova nunca encosta na comida atual

Tipo: AFK · Prioridade: P2 · Risco: baixo (mais um filtro numa validação já robusta)

## Parent

PRD: docs/prd/2026-07-26-snake-live-v3-prd.md

## What to build

A colocação de parede do pudding já valida conectividade, blocos 2×2, distância ≥3 da
cabeça e alcançabilidade das comidas. Refinamento visual barato: exigir também que a parede
não fique adjacente (4-vizinhança; avaliar 8-vizinhança na implementação) à comida atual,
evitando o efeito de "cercar" a maçã e apertar o corredor de chegada.

Arquivos-alvo: `src/game/GameState.ts` (`maybeAddPuddingWall`), `src/game/GameState.test.ts`.

User stories cobertas: 14.

## Acceptance criteria

- [ ] Teste: nenhuma parede aceita adjacente a comida presente no tabuleiro (várias seeds)
- [ ] Win rate do pudding (teste existente) não piora
- [ ] `npx tsc --noEmit` limpo

## Blocked by

None — can start immediately.
