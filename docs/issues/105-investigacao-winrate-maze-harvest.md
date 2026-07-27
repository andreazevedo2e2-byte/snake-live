# 105 — Investigação: win rate do maze_harvest (caiu para ~27%)

Tipo: AFK · Prioridade: P1 · Risco: médio (pode revelar necessidade de ajuste no solver) · Bloqueada por: 101

## Parent

PRD: docs/prd/2026-07-26-snake-live-v3-prd.md

## What to build

O teste "maze_harvest wins a solid majority" (limiar >45%, n=15, 18×14) falhou 2× seguidas
com 26,7% (4/15). Amostra pequena, mas duas falhas seguidas sugerem regressão real ou taxa
verdadeira abaixo do limiar. Como a issue 101 muda a topologia do labirinto e altera essa
taxa de qualquer forma, a investigação vem DEPOIS do novo gerador.

Seguindo a regra "investigar e documentar antes de corrigir": criar doc local de
investigação com hipóteses, medições e conclusão. Medir n=50 com `playConfigToEnd` no
labirinto novo; comparar com medição de referência; se a taxa não sustentar o limiar com
folga, ajustar o solver do ramo com paredes (hoje: lookahead recursivo profundidade 5 +
tail-chase) e re-medir. Ajustar o n/limiar do teste para reduzir flakiness se a medição
mostrar variância alta.

Arquivos-alvo: `src/autopilot/decideMove.ts` (ramo `hasWalls`, se necessário),
`src/autopilot/decideMove.test.ts`, doc de investigação em `docs/execucao/`.

User stories cobertas: 9.

## Acceptance criteria

- [ ] Medição n=50 registrada em doc local (antes/depois de eventual ajuste, com seeds/condições)
- [ ] Teste de win rate do maze_harvest verde em 3 execuções consecutivas
- [ ] Limiar do teste justificado pela medição (margem contra flakiness documentada)
- [ ] Nenhuma outra suíte regrediu; `npx tsc --noEmit` limpo; `src/autopilot/debug.test.ts` inexistente

## Blocked by

- 101 — labirinto de tabuleiro inteiro (muda a topologia; medir antes é desperdício)
