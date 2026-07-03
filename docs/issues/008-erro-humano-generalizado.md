# 008 — Erro humano por rodada, em qualquer fase da partida

Tipo: AFK · Bloqueada por: 003 e 006 (as duas estratégias precisam existir)

## Parent

PRD: docs/prd/2026-07-02-snake-live-v2-prd.md

## What to build

O erro humano roteirizado (sorteado por rodada conforme a taxa de erro das configurações)
passa a morar junto da decisão de movimento e a funcionar em qualquer fase da partida — janela
preferencial no fim de jogo (mais dramático), fallback no meio da partida — escolhendo um
movimento ruim porém legal. Hoje o gatilho exige >72% de preenchimento, que em tabuleiros
grandes/labirintos nunca acontece: a taxa configurada vira mentira.

User stories cobertas: 10.

## Acceptance criteria

- [ ] Com RNG injetado, uma rodada sorteada para falhar executa exatamente um erro deliberado
- [ ] O erro acontece mesmo em tabuleiros grandes e modos com paredes (não exige fim de jogo)
- [ ] Taxa de erro 0% nas configurações = nenhuma derrota deliberada em simulação longa
- [ ] Taxa de erro 100% = toda rodada contém um erro deliberado
- [ ] O movimento errado é sempre legal (nunca reverso/parede em tick imediato)

## Blocked by

- 003 — estratégia de tabuleiro aberto
- 006 — solver com paredes
