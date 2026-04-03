# MorMaps

MorMaps is a lightweight browser app for planning FRC strategy on the 2026 field image. It is designed to work well on an iPad: you can draw routes directly on the field, drop draggable team markers with numbers or logos, save each board state as a play step, and replay the full sequence like a strategy timeline.

## Features

- Real 2026 field image as the draw surface
- Pen and eraser tools for freehand strategy drawing
- Team markers from TBA rosters and selected matches, with team color and alliance outline
- TBA event sync for `2026CALAS` and `2026CAASV`, including team colors and tap-to-place match lineups through a Netlify function
- Timeline snapshots via `Add Play Step`
- Playback mode that animates marker movement and progressively reveals new drawing for each saved step

## Run It

Because this project is static HTML, CSS, JavaScript, and a Netlify function, there is no frontend build step.

1. From `/Users/wolfnazari/MorMaps`, run `python3 -m http.server 4173`
2. Open [http://localhost:4173](http://localhost:4173)
3. On iPad, load the same local URL from your network or host it anywhere static files can be served

To test TBA sync locally, use `netlify dev` instead of a plain static server so `/.netlify/functions/tba` is available.

## How To Use

1. Choose `2026CALAS` or `2026CAASV`, and click `Load Event`
2. Tap a team in the roster to add it, or tap a match card to auto-place both alliances
3. Drag markers into position on the field if you want to tweak the setup
4. Draw routes or notes directly on the board
5. Click `Add Play Step` to save that board state
6. Keep adjusting the board and saving more steps
7. Click `Play` to replay the whole strategy sequence

`Pause` freezes playback at the current frame so you can inspect it, and `Load` on any timeline item jumps back to that saved board state for editing.

Set `TBA_API_KEY` in Netlify for the site. The browser calls `/.netlify/functions/tba`, and that function sends the `X-TBA-Auth-Key` header to TBA server-side. The key never appears in the UI.

The Netlify environment variable name is `TBA_API_KEY`.
