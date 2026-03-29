# MorMaps

MorMaps is a lightweight browser app for planning FRC strategy on a blank field. It is designed to work well on an iPad: you can draw routes directly on the field, drop draggable team markers with numbers or logos, save each board state as a play step, and replay the full sequence like a strategy timeline.

## Features

- Blank field board with a clean SVG layout instead of a photo background
- Pen and eraser tools for freehand strategy drawing
- Team markers with team number, optional note, color, and optional uploaded logo
- Timeline snapshots via `Add Play Step`
- Playback mode that animates marker movement and progressively reveals new drawing for each saved step

## Run It

Because this project is static HTML, CSS, and JavaScript, there is no build step.

1. From `/Users/wolfnazari/MorMaps`, run `python3 -m http.server 4173`
2. Open [http://localhost:4173](http://localhost:4173)
3. On iPad, load the same local URL from your network or host it anywhere static files can be served

## How To Use

1. Add a team marker with a number, optional label, and optional logo
2. Drag markers into position on the field
3. Draw routes or notes directly on the board
4. Click `Add Play Step` to save that board state
5. Keep adjusting the board and saving more steps
6. Click `Play` to replay the whole strategy sequence

`Pause` freezes playback at the current frame so you can inspect it, and `Load` on any timeline item jumps back to that saved board state for editing.
