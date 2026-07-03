# 004 — Vitória por meta de frutas (rodadas que terminam)

Tipo: AFK · Bloqueada por: nenhuma — pode começar imediatamente

## Parent

PRD: docs/prd/2026-07-02-snake-live-v2-prd.md

## What to build

Condições de vitória calibradas para ritmo de live, por modo:

- clássico/mapa cheio em tabuleiro pequeno (≤ ~150 células jogáveis): encher o tabuleiro
  (comportamento atual);
- clássico em tabuleiro grande (mapas de bandeira etc.): vitória ao atingir meta de frutas
  proporcional (~35% das células jogáveis);
- labirinto contínuo (maze_harvest): meta de K frutas proporcional ao labirinto;
- blocos dinâmicos (pudding): meta de K frutas.

A meta entra na configuração do jogo com default calculado (sem quebrar chamadas existentes)
e fica visível no HUD (progresso até a meta). A tela de vitória conta a história do modo:
tempo no labirinto, frutas na colheita, cobertura no clássico.

User stories cobertas: 1, 7, 8, 9, 19.

## Acceptance criteria

- [ ] Simulação: pudding 16×12 e maze_harvest 18×14 terminam (vitória ou derrota) em 100% das
      partidas dentro do teto de ticks — zero rodadas eternas
- [ ] Simulação: clássico em 24×16 (bandeira) termina por meta em 100% das partidas
- [ ] Clássico 10×8 segue vencendo por tabuleiro cheio (regressão zero no modo principal)
- [ ] HUD mostra progresso rumo à meta quando a vitória é por meta
- [ ] Tela de vitória exibe métrica do modo (tempo/frutas/cobertura)

## Blocked by

None — can start immediately
