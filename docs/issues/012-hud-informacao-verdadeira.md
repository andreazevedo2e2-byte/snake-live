# 012 — HUD com informação verdadeira e overlay ajustado

Tipo: AFK · Bloqueada por: nenhuma — pode começar imediatamente

## Parent

PRD: docs/prd/2026-07-02-snake-live-v2-prd.md

## What to build

- Remover o contador "SUBS" morto (sempre 0) do modo live; no lugar, badge de mapa+modo na
  barra superior (o modo shorts já tem essa informação).
- Overlay de status (GET READY / VICTORY / I LOST) dimensionado ao retângulo real do
  tabuleiro (hoje cobre o quadrado do layout mesmo quando o tabuleiro é mais baixo).
- Revisão final dos textos PT-BR/EN exibidos no HUD para coerência (um idioma por superfície).

User stories cobertas: 18, 21.

## Acceptance criteria

- [ ] Modo live não exibe mais "SUBS 0"; badge de mapa+modo visível
- [ ] Overlay de status cobre exatamente a área do tabuleiro em tabuleiros não quadrados
- [ ] Verificação manual no preview dos dois modos de interface (live e shorts)

## Blocked by

None — can start immediately
