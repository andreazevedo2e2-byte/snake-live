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

Planejamento concluído. Implementação ainda não iniciada.

## Stack (planejada)

TypeScript · PixiJS (WebGL) · Node · WebSocket · `youtube-chat` (scraper) · Howler (áudio)
