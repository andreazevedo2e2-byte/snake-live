# 101 — Labirinto ocupa o tabuleiro inteiro (mata o anel de borda)

Tipo: AFK · Prioridade: P0 · Risco: médio (muda topologia dos 2 modos maze; win rates serão remedidos)

## Parent

PRD: docs/prd/2026-07-26-snake-live-v3-prd.md

## What to build

Reescrever a geração de labirinto para que as células de borda POSSAM ser parede: hoje todo
o perímetro fica livre por construção, criando um anel trivial que a cobra usa para circular
o tabuleiro sem entrar no labirinto, além de deixar faixas de parede maciças sem função em
tabuleiros de dimensão par e permitir comida em área trivial.

O grid de células do maze deve ter dimensões ímpares efetivas — área jogável (2k+1)×(2j+1) —
ocupando o tabuleiro todo. Backtracking recursivo mantido (spanning tree). Passo opcional de
"braiding": remover N becos sem saída aleatórios para criar loops controlados e visual mais
rico. A conexão garantida entre célula inicial da cobra e alvo permanece (BFS de validação
já existe). Atualizar o comentário do solver que descreve a topologia ("spanning tree sem
loops") para refletir a realidade nova.

Arquivos-alvo: `src/game/GameState.ts` (`generateMazeWalls`), `src/autopilot/decideMove.ts`
(comentário/premissa do ramo com paredes), testes em `src/game/GameState.test.ts`.

User stories cobertas: 1, 2, 3.

## Acceptance criteria

- [ ] Propriedade: nenhuma célula livre isolada (todas as células livres conectadas por BFS), várias seeds e dimensões (pares, ímpares, mistas)
- [ ] Propriedade: % de células de borda que são parede > 0 em todas as dimensões testadas
- [ ] Propriedade: nenhuma linha/coluna interna 100% parede encostada em corredor paralelo 100% livre (a "faixa morta" de dimensão par)
- [ ] Célula inicial da cobra e alvo do maze_race conectados (teste existente continua verde)
- [ ] Win rate maze_harvest (teste existente, 18×14) não piora em relação à medição pré-mudança
- [ ] `npx tsc --noEmit` limpo; `src/autopilot/debug.test.ts` inexistente ao final

## Blocked by

None — can start immediately.
