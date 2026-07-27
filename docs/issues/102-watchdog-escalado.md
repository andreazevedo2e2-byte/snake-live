# 102 — Watchdog escala com tabuleiro/modo (não mata maze_race grande)

Tipo: AFK · Prioridade: P0 · Risco: baixo (função pura + 1 ponto de uso)

## Parent

PRD: docs/prd/2026-07-26-snake-live-v3-prd.md

## What to build

O watchdog fixo de 90 s mata rodada saudável de maze_race em tabuleiro grande (até 36×24):
só existe a fruta-alvo na célula mais distante, e o percurso pode legitimamente passar de
90 s em velocidade base. Trocar o limite fixo por um dos dois (decidir na implementação,
registrando o porquê no código):

- limite escalado: `max(90 s, células × tick_efetivo × fator)` em função de tamanho e modo; ou
- reset do timer por progresso: no maze_race, distância ao alvo diminuindo reinicia a contagem.

O cálculo vira função pura testável ao lado de `hasStalledTooLong`. Rodada realmente travada
continua morrendo em tempo razoável (derrota teatral + reinício), que é a função do watchdog.

Arquivos-alvo: `src/game/watchdog.ts`, `src/main.ts` (ponto de disparo), `src/game/watchdog.test.ts`.

User stories cobertas: 5, 6.

## Acceptance criteria

- [ ] Teste unitário do cálculo do limite (ou do reset por progresso) com relógio injetado, sem timers reais
- [ ] Cenário 36×24 maze_race em velocidade base: percurso saudável simulado NÃO dispara o watchdog
- [ ] Cenário travado (sem pontuar e sem progresso): watchdog dispara dentro do novo limite
- [ ] Modos não-maze mantêm comportamento atual (90 s) ou o limite escalado equivalente documentado
- [ ] `npx tsc --noEmit` limpo

## Blocked by

None — can start immediately.
