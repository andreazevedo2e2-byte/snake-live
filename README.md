# Snake Live

Jogo de cobrinha **automatizado** para lives interativas no YouTube (formato 9:16). Um bot
joga sozinho e o chat ao vivo interfere no jogo: cada comentário vira comida (o avatar do
espectador), enche a barra de velocidade e sobe no ranking de _top viewers_.

Inspirado no canal **MegoMG**. Roda localmente (PixiJS no navegador, capturado pelo OBS),
lê o chat sem API key (scraper), e toca música copyright-free de fundo.

## Documentos

- **Design (spec):** [`docs/superpowers/specs/2026-06-23-snake-live-design.md`](docs/superpowers/specs/2026-06-23-snake-live-design.md)
- **PRD:** [`docs/prd/2026-06-23-snake-live-prd.md`](docs/prd/2026-06-23-snake-live-prd.md)

## Status

v1 implementado (TDD nas partes puras: jogo, autopilot, chat, leaderboard, speed meter,
texture cache). Falta apenas: curar a playlist de música CC0 (`public/assets/music/playlist.json`,
vazia por padrão) e fazer o ensaio de estabilidade de 3h com OBS antes de ir ao ar.

Os efeitos sonoros ficam em `public/assets/sfx/` e comecam com pacotes CC0: Kenney UI Audio
para cliques/teclas e Snake sprites & sound para comer/morrer. Creditos e links estao em
`public/assets/sfx/CREDITS.md`.

## Como rodar

```bash
npm install
npm test       # roda a suíte de testes (vitest)
npm run dev    # frontend (vite) + backend de chat juntos
```

Por padrão o backend usa um chat falso (`FakeChatSource`) pra ensaiar sem estar ao vivo.
Pra ler o chat real de uma live, defina a URL antes de rodar o backend:

```bash
SNAKE_LIVE_URL="https://www.youtube.com/watch?v=SEU_VIDEO_ID" npm run dev:server
```

## Stack

TypeScript · PixiJS (WebGL) · Node · WebSocket · `youtube-chat` (scraper) · Howler (áudio) · Vitest (TDD)
