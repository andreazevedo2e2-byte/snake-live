# 106 — Comida do maze nasce longe da cobra e distribuída pelo labirinto

Tipo: AFK · Prioridade: P1 · Risco: baixo (refina heurística de spawn existente) · Bloqueada por: 101

## Parent

PRD: docs/prd/2026-07-26-snake-live-v3-prd.md

## What to build

Com o anel de borda eliminado (101), a comida já não nasce em área trivial — mas ainda pode
nascer colada na cabeça da cobra. Refinar o spawn nos modos maze: manter a preferência por
junções (3+ vizinhos livres) já existente em `pickSafeSpawn`, adicionar distância mínima da
posição atual da cobra, e no maze_harvest distribuir spawns entre regiões do labirinto
(ex.: quadrantes) para forçar exploração.

Arquivos-alvo: `src/game/GameState.ts` (`pickSafeSpawn` e chamadas), `src/game/GameState.test.ts`.

User stories cobertas: 4, 12, 13.

## Acceptance criteria

- [ ] Teste: em modos maze, spawn respeita distância mínima da cabeça quando existe célula candidata (fallback documentado quando não existe)
- [ ] Teste: no maze_harvest, sequência de spawns cobre múltiplas regiões do tabuleiro (não concentra numa só)
- [ ] Alcançabilidade da comida preservada (testes existentes verdes)
- [ ] Win rate do maze_harvest não piora
- [ ] `npx tsc --noEmit` limpo

## Blocked by

- 101 — a topologia nova muda o espaço de candidatos a spawn
