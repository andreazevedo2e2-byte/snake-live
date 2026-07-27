# 103 — Painel normaliza tabuleiro ímpar×ímpar (preserva o ciclo Hamiltoniano)

Tipo: AFK · Prioridade: P0 · Risco: baixo (normalização de input)

## Parent

PRD: docs/prd/2026-07-26-snake-live-v3-prd.md

## What to build

O painel aceita largura e altura ambas ímpares (ex.: 9×7), mas o ciclo Hamiltoniano exige
largura OU altura par — com ambas ímpares o autopilot cai em greedy puro e classic/full_food
perdem a garantia de vitória, sem aviso nenhum. Normalizar na leitura do painel: quando
ambas forem ímpares, arredondar a altura para par (respeitando os clamps existentes), e
refletir o valor efetivo de volta nos inputs para o streamer ver o que valeu.

Arquivos-alvo: `src/main.ts` (`buildConfigFromInputs` + `syncInputsFromConfig`); extrair o
cálculo para função pura testável (o repo já testa lógica de jogo fora do DOM).

User stories cobertas: 7.

## Acceptance criteria

- [ ] Teste unitário da normalização: 9×7 → 9×8 (ou equivalente documentado); dimensões com pelo menos uma par passam intactas
- [ ] Clamps existentes (largura [8,36], altura [6,24], mínimos por mapa/modo) preservados
- [ ] Inputs do painel refletem o valor efetivo após normalização
- [ ] Com qualquer entrada do painel, `getCycle`/`buildCycleOrder` nunca retorna null para classic/full_food
- [ ] `npx tsc --noEmit` limpo

## Blocked by

None — can start immediately.
