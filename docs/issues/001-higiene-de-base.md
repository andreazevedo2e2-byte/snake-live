# 001 — Higiene de base: tsc limpo, encoding, metadados

Tipo: AFK · Bloqueada por: nenhuma — pode começar imediatamente

## Parent

PRD: docs/prd/2026-07-02-snake-live-v2-prd.md

## What to build

Deixar o repositório saudável para as fatias seguintes: typecheck verde, painel de
configurações sem mojibake, metadados do pacote corretos. As duas funções de validação de
parede hoje mortas são removidas nesta fatia (o histórico do git as preserva; a fatia 007 as
restaura e liga no modo pudding).

## Acceptance criteria

- [ ] `npx tsc --noEmit` passa sem erros
- [ ] `npx vitest run` continua verde
- [ ] O painel de configurações exibe "Bandeira da França" corretamente (sem "FranÃ§a"),
      arquivo salvo em UTF-8, e os rótulos PT-BR revisados
- [ ] package.json aponta para o repositório real (andreazevedo2e2-byte/snake-live)
- [ ] Nenhuma função exportada ou privada sem uso permanece nos módulos do jogo

## Blocked by

None — can start immediately
