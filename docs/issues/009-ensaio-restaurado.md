# 009 — Modo ensaio restaurado (chave de fonte de chat)

Tipo: AFK · Bloqueada por: nenhuma — pode começar imediatamente

## Parent

PRD: docs/prd/2026-07-02-snake-live-v2-prd.md

## What to build

O servidor de chat passa a selecionar a fonte por variável de ambiente:
`SNAKE_CHAT=fake|silent|youtube` (com `SNAKE_LIVE_URL` para youtube). Default em
desenvolvimento: `fake` — restaurando o comportamento documentado no README (hoje o servidor
sobe silencioso e o modo ensaio simplesmente não existe, embora o gerador fake continue no
repositório com testes).

User stories cobertas: 12, 14, 15.

## Acceptance criteria

- [ ] `npm run dev` sem variáveis gera eventos de chat simulados (comida com avatar + speed
      aparecem no preview)
- [ ] `SNAKE_CHAT=silent` sobe sem eventos; `SNAKE_CHAT=youtube` + `SNAKE_LIVE_URL` usa a
      fonte real
- [ ] README descreve a chave e os três modos com exatidão
- [ ] Log de inicialização declara qual fonte está ativa

## Blocked by

None — can start immediately
