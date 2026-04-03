# MorMaps

MorMaps is a lightweight browser app for planning FRC strategy on the 2026 field image. It is designed to work well on an iPad: you can draw routes directly on the field, drop draggable team markers with numbers or logos, save each board state as a play step, and replay the full sequence like a strategy timeline.

## Features

- Real 2026 field image as the draw surface
- Pen and eraser tools for freehand strategy drawing
- Team markers with team number, optional note, color, alliance outline, and optional uploaded logo
- TBA event sync for `2026CALAS` and `2026CAASV`, including team colors and tap-to-place match lineups
- Timeline snapshots via `Add Play Step`
- Playback mode that animates marker movement and progressively reveals new drawing for each saved step

## Run It

Because this project is static HTML, CSS, and JavaScript, there is no build step.

1. From `/Users/wolfnazari/MorMaps`, run `python3 -m http.server 4173`
2. Open [http://localhost:4173](http://localhost:4173)
3. On iPad, load the same local URL from your network or host it anywhere static files can be served

## How To Use

1. Add a team marker with a number, optional label, and optional logo
2. Or paste a TBA read key, choose `2026CALAS` or `2026CAASV`, and click `Load Event`
3. Tap a match card to auto-place both alliances onto the field
4. Drag markers into position on the field if you want to tweak the setup
5. Draw routes or notes directly on the board
6. Click `Add Play Step` to save that board state
7. Keep adjusting the board and saving more steps
8. Click `Play` to replay the whole strategy sequence

`Pause` freezes playback at the current frame so you can inspect it, and `Load` on any timeline item jumps back to that saved board state for editing.

The TBA key is stored in browser local storage on the device so you do not need to paste it every time. The app uses TBA's read API with the `X-TBA-Auth-Key` header and shows attribution in the UI.

If you later move the TBA request behind a Netlify Function, `TBA_API_KEY` is a sensible Netlify environment variable name. This static browser version does not read Netlify environment variables directly at runtime.
