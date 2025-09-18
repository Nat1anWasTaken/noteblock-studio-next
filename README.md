<div align="center">
  <a href="https://github.com/Nat1anWasTaken/noteblock-studio-next">
    <img src="static/noteblock.png" alt="Logo" width="80" height="80">
  </a>

<h3 align="center">Noteblock Studio Next</h3>

  <p align="center">
    A modern, web-based music editor for Minecraft Note Block musics.
    <br />
    <a href="https://github.com/Nat1anWasTaken/noteblock-studio-next"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://github.com/Nat1anWasTaken/noteblock-studio-next">View Demo</a>
    ·
    <a href="https://github.com/Nat1anWasTaken/noteblock-studio-next/issues">Report Bug</a>
    ·
    <a href="https://github.com/Nat1anWasTaken/noteblock-studio-next/issues">Request Feature</a>

  </p>
</div>

## Features

- Import `.nbs` via `@nbsjs/core`; convert to editable tracks
- Tempo track with time‑signature support and metronome
- Multi-Platform support (Windows, macOS, Linux)
- Smooth playback with Web Audio API
- Save/Open `.nbx` archives (ZIP with JSON metadata and channels)
- Desktop App (Planned)

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
