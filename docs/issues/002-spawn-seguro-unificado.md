# 002 — Spawn de comida seguro e unificado, com autocura

Tipo: AFK · Bloqueada por: nenhuma — pode começar imediatamente

## Parent

PRD: docs/prd/2026-07-02-snake-live-v2-prd.md

## What to build

Um único caminho de spawn seguro para TODAS as origens de comida (inicial, reposição da
básica, comida de avatar do chat, promoção da fila): a célula escolhida deve estar livre e
alcançável a partir da cabeça da cobra (desconsiderando a cauda que vaga), preferindo células
com ≥2 vizinhos livres quando existirem candidatas. Além disso, regra de autocura no tick:
qualquer comida que permaneça inalcançável da cabeça por 8 ticks consecutivos é realocada
para uma célula segura.

Isso elimina a classe de bug "comida nasce atrás de parede / em bolsão e o jogo trava
esperando" relatada em produção.

## Acceptance criteria

- [ ] Teste de propriedade: para sequências de ticks + enqueues de avatar em todos os modos
      (classic, full_food, maze_race, maze_harvest, pudding), nenhuma comida permanece
      inalcançável da cabeça por mais de 8 ticks
- [ ] Comida de avatar enfileirada e promovida nasce alcançável nos modos com paredes
- [ ] Nenhum uso direto de célula-aleatória-livre para comida fora do caminho único de spawn
- [ ] Suíte existente continua verde

## Blocked by

None — can start immediately
