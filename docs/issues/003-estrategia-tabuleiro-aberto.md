# 003 — Estratégia única de tabuleiro aberto (ciclo + atalhos) para todos os modos sem parede

Tipo: AFK · Bloqueada por: nenhuma — pode começar imediatamente

## Parent

PRD: docs/prd/2026-07-02-snake-live-v2-prd.md

## What to build

Em qualquer configuração SEM paredes (modo clássico, mapa cheio, qualquer tema de mapa,
qualquer modo de cor), o autopilot usa a estratégia de ciclo Hamiltoniano com atalhos
restritos à ordem do ciclo (já presente no repositório). Remover o desvio "prefere exploração"
que hoje desliga o ciclo quando cores do mapa ou mapa cheio estão ativos — o ciclo é o
explorador perfeito: visita toda célula, pinta todo tema de revelação e resolve o mapa cheio
por construção. Remover também o parâmetro de velocidade morto da assinatura de decisão.

User stories cobertas: 2, 6, 16.

## Acceptance criteria

- [ ] Simulação: mapa cheio 10×8 vence 100% das partidas (o ciclo come uma célula por passo)
- [ ] Simulação: clássico ≥85% de vitória em 6×6/8×8/10×8 (piso já demonstrado)
- [ ] Simulação: modo de cor "mapa" em tabuleiro sem paredes termina em vitória (sem vagar)
- [ ] A decisão de movimento não recebe mais parâmetro de velocidade sem uso
- [ ] Movimento continua "humano": beeline até a fruta em tabuleiro aberto, nunca vira na
      véspera de comer (testes existentes de naturalidade seguem verdes)

## Blocked by

None — can start immediately
