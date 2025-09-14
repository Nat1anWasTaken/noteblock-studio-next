// Shared editor UI state for channels/ruler (Svelte 5 runes)

export class EditorState {
    // Zoom represented as pixels per beat for stable feel across signatures
    pxPerBeat = $state(96); // default ~96px per beat
    minPxPerBeat = 2;
    maxPxPerBeat = 480;

    // Horizontal scroll sync across ruler and channel rows
    scrollLeft = $state(0);

    setPxPerBeat(px: number) {
        const clamped = Math.min(this.maxPxPerBeat, Math.max(this.minPxPerBeat, px));
        this.pxPerBeat = Math.round(clamped);
    }

    zoomIn(factor = 1.2) {
        this.setPxPerBeat(this.pxPerBeat * factor);
    }

    zoomOut(factor = 1.2) {
        this.setPxPerBeat(this.pxPerBeat / factor);
    }

    setScrollLeft(px: number) {
        this.scrollLeft = Math.max(0, px | 0);
    }
}

export const editorState = new EditorState();
