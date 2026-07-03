# 010 — Teto de velocidade efetiva

Tipo: AFK · Bloqueada por: nenhuma — pode começar imediatamente

## Parent

PRD: docs/prd/2026-07-02-snake-live-v2-prd.md

## What to build

A velocidade efetiva (multiplicador do chat × multiplicador base das configurações) ganha
teto de 6x. Hoje o produto chega a 14,4x → ticks de ~29 ms, mais rápidos que a própria
animação da cobra (mínimo 48 ms), virando borrão ilegível. A barra de velocidade do HUD
reflete o valor efetivo já limitado.

User stories cobertas: 13.

## Acceptance criteria

- [ ] Teste: chat no máximo × base 2.4 resulta em velocidade efetiva 6.0
- [ ] Intervalo mínimo de tick nunca fica abaixo de `base/6`
- [ ] Barra e rótulo de velocidade no HUD nunca exibem valor acima do teto

## Blocked by

None — can start immediately
