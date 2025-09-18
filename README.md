# Noteblock Studio Next

Web-based piano‑roll editor and player for Minecraft Note Block songs. Import `.nbs` files, edit in a modern timeline, and export to a portable `.nbx` project format — all in the browser.

## Features
- Import `.nbs` via `@nbsjs/core`; convert to editable tracks
- Tempo track with time‑signature support and metronome
- Note channels per instrument/layer with sections
- Playback with Web Audio (pooled samples, optional reverb) and loop modes
- Save/Open `.nbx` archives (ZIP with JSON metadata and channels)

## Quick Start
This repo uses `pnpm` (enforced). Node 18+ recommended.

```sh
pnpm install
pnpm dev
```

Then open the shown URL and:
- Choose “Import NBS” to load a song, or “Open NBX” to resume a project
- Edit tracks in the editor view and press Play to audition
- Use File actions to download your project as `.nbx`

## Tech
- Svelte 5 + SvelteKit (Vite)
- Tailwind CSS v4
- Web Audio API for playback
- `@nbsjs/core` for `.nbs` parsing

## Status
Early work‑in‑progress; some actions (e.g., “Create Empty”, MIDI import) are not implemented yet.
