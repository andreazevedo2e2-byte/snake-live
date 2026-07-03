# 011 — Render: camadas estáticas com cache + conserto de vazamento de texturas

Tipo: AFK · Bloqueada por: nenhuma — pode começar imediatamente

## Parent

PRD: docs/prd/2026-07-02-snake-live-v2-prd.md

## What to build

Duas frentes de robustez para lives de horas:

1. **Cache de camadas estáticas**: overlay de mapa (hoje até 640 retângulos redesenhados
   60×/s nos mapas de bandeira), paredes, fundo e grade só redesenham quando o estado
   relevante muda (paredes/tema/células reveladas/hue quantizado). Escrita da CSS var de hue
   no documento apenas quando o valor quantizado muda.
2. **Vazamento**: a troca de tabuleiro (toda vitória/derrota/aplicação de configurações
   recria o renderer) destrói sprites de avatar sem liberar as referências no cache de
   texturas — liberar corretamente na destruição do renderer.

User stories cobertas: 17.

## Acceptance criteria

- [ ] Teste (contagem de refs do cache): criar e destruir o tabuleiro com comidas de avatar
      presentes devolve o cache ao estado inicial
- [ ] Camada de mapa/paredes não redesenha em frames sem mudança de estado (verificável por
      contador de draw interno em teste ou instrumentação temporária)
- [ ] Preview em mapa de bandeira grande mantém FPS estável e visual idêntico ao atual
- [ ] Nenhuma regressão visual nos dois estilos de cobra (verificação manual no preview)

## Blocked by

None — can start immediately
