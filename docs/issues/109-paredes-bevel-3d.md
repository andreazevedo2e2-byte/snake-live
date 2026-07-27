# 109 — Visual: paredes com relevo/bevel 3D (maze e pudding)

Tipo: AFK · Prioridade: P2 · Risco: baixo (só renderização; cortável pelo André)

## Parent

PRD: docs/prd/2026-07-26-snake-live-v3-prd.md

## What to build

Paredes hoje são blocos chapados. Desenhá-las com relevo/bevel 3D (face clara em cima,
escura embaixo, na paleta do mapa de cor ativo) nos modos maze e pudding. Maior impacto
visual para live 9:16 entre as melhorias de design. Respeitar o cache de camadas estáticas
existente (paredes não são redesenhadas a cada frame).

Arquivos-alvo: `src/render/` (BoardRenderer / camada de paredes).

User stories cobertas: 15, 20.

## Acceptance criteria

- [ ] Paredes com bevel visível nos 6 mapas de cor, sem quebrar contraste com cobra/comida
- [ ] Camada estática continua cacheada (sem redesenho por frame); sem regressão de FPS perceptível
- [ ] Validação manual: screenshot dos modos maze e pudding antes/depois
- [ ] `npx tsc --noEmit` limpo

## Blocked by

None — can start immediately (visual fica melhor após 101, mas não depende dela).
