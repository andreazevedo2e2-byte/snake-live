# 005 — Labirinto final: vitória só na fruta-alvo

Tipo: AFK · Bloqueada por: nenhuma — pode começar imediatamente

## Parent

PRD: docs/prd/2026-07-02-snake-live-v2-prd.md

## What to build

No modo labirinto final (maze_race), somente a fruta-alvo (posicionada no ponto mais distante
do labirinto) encerra a rodada com vitória. Comidas de avatar criadas pelo chat continuam
existindo, valendo ponto, som e notificação — mas não encerram a rodada. Hoje 2 de 5 vitórias
medidas foram "falsas" (avatar do chat comido a caminho conta como chegada).

User stories cobertas: 3, 14.

## Acceptance criteria

- [ ] Teste: comer comida de avatar em maze_race soma ponto e NÃO encerra a rodada
- [ ] Teste: comer a fruta-alvo encerra com vitória
- [ ] Simulação com chat simulado injetando avatares: 100% das vitórias acontecem na fruta-alvo
- [ ] O autopilot prioriza o alvo mas ainda desvia para avatares no caminho quando seguro

## Blocked by

None — can start immediately
