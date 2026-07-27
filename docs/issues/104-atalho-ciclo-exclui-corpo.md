# 104 — Atalho de ciclo nunca planeja caminho através do corpo

Tipo: AFK · Prioridade: P0 · Risco: baixo (filtro adicional em BFS existente)

## Parent

PRD: docs/prd/2026-07-26-snake-live-v3-prd.md

## What to build

O BFS de atalho de ciclo confia no invariante "células com rank entre head e tail estão
vazias", mas o early game (score < 3) usa caminhos gulosos fora do ciclo e pode quebrar o
invariante — o caminho planejado pode atravessar células do corpo. Hoje o dano é contido
pela revalidação do primeiro passo, mas o plano é inválido por construção. Correção barata:
excluir células do corpo no filtro do BFS (checagem contra um set do corpo). A revalidação
do primeiro passo permanece como cinto de segurança.

Arquivos-alvo: `src/autopilot/decideMove.ts` (`cycleShortcutPath`), `src/autopilot/decideMove.test.ts`.

User stories cobertas: 8.

## Acceptance criteria

- [ ] Teste de propriedade: caminho retornado pelo atalho nunca contém célula do corpo, incluindo estado de early game construído fora do ciclo
- [ ] Testes de win rate existentes (classic/full_food) continuam verdes
- [ ] `npx tsc --noEmit` limpo; `src/autopilot/debug.test.ts` inexistente ao final

## Blocked by

None — can start immediately.
