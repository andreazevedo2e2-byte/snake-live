# 007 — Blocos dinâmicos: paredes validadas (sem bolsões, sem blocos sólidos)

Tipo: AFK · Bloqueada por: 001 (as validações foram removidas lá; restaurar do histórico)

## Parent

PRD: docs/prd/2026-07-02-snake-live-v2-prd.md

## What to build

A colocação de parede dinâmica no modo pudding passa a usar as duas validações que foram
escritas mas nunca ligadas (restaurar do histórico do git): proibir formação de bloco sólido
2×2 de paredes e exigir que o conjunto de células livres permaneça conexo após cada parede.
Combinado com a fatia 002, isso garante que nunca nasce bolsão isolado onde uma comida
poderia ficar presa.

User stories cobertas: 5, 7.

## Acceptance criteria

- [ ] Teste de propriedade: após cada parede adicionada em partidas simuladas de pudding, o
      conjunto de células livres permanece conexo
- [ ] Teste: nenhuma configuração de paredes contém bloco sólido 2×2
- [ ] As validações são exercitadas pelos testes (não voltam a ser código morto)
- [ ] `npx tsc --noEmit` segue verde

## Blocked by

- 001 — higiene de base
