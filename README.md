# Life

A browser game of cells. Paint a spark, hatch a glider, survive the daily soup.

Play it: [https://sebby1770.github.io/life/](https://sebby1770.github.io/life/)

Life used to be **gol-rs**, a Rust terminal toy for Conway's Game of Life. This is the same engine in spirit — B3/S23, wrap, methuselahs — rebuilt as a website game with a title screen, a campaign, and a score.

## Play

Open `index.html` in a browser, or from the project root:

```bash
npm start
# python3 -m http.server 4173
```

Then visit [http://localhost:4173](http://localhost:4173).

No build step. No npm dependencies. GitHub Pages can serve the repo root as-is.

## How to play

Cells live and die by **B3/S23**: a dead cell with three neighbors is born; a live cell with two or three neighbors stays; everyone else dies.

- Drag to paint. Shift or right-drag to erase.
- **Space** pauses. **.** steps. **U** undoes. **N** cycles stamps. **[** **]** change speed.
- Space-drag or middle-drag pans; the wheel zooms.
- Challenges cap how many cells you may paint before **Run**. Stars (1–3) are saved in `localStorage`.

## Screens

1. **Title** — wordmark over the hero, then Sandbox / Challenges / Daily / How to Play.
2. **Sandbox** — playground with stamps, wrap, speed, undo, HighLife / Seeds / Day & Night, share links (`location.hash`).
3. **Challenges** — ten puzzles with budgets, hints, and stars.
4. **Daily** — a 40×24 soup (density 0.32) seeded from today's date. Score = peak population × 10 + generations lived, capped at 400.

### Campaign

| # | Name | Budget | Win |
|---|---|---|---|
| 1 | Spark | 3 | Period-2 oscillator (blinker) |
| 2 | Still | 6 | Still life, population ≥ 4, four gens |
| 3 | Glider School | 5 | A glider |
| 4 | Toad | 6 | Period-2 oscillator with pop 6 |
| 5 | Beacon | 8 | Period-2 beacon (pop 6↔8) |
| 6 | Peak 16 | 12 | Population ≥ 16 within 200 gens |
| 7 | Methuselah | 5 | Lasts ≥ 60 gens before still or empty |
| 8 | Lightweight | 9 | LWSS |
| 9 | Garden | 7 | Paint the loaf silhouette |
| 10 | Keep Alive | 1 / 8 gens | Seed 42, last 80 gens with pop > 0 |

## Tests

```bash
npm test
# node --test tests/*.test.js
```

CI runs the same command on Node 20.

## License

MIT. See `LICENSE`.
