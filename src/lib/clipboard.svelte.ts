import type { Note, NoteSection, TempoChange } from './types';

export interface ClipboardData {
    type: 'sections' | 'notes' | 'tempo-changes';
    operation: 'copy' | 'cut';
    timestamp: number;
    source: {
        channelIndex?: number;
        sectionIndex?: number;
    };
    data: {
        sections?: Array<{
            section: NoteSection;
            originalChannelIndex: number;
            originalSectionIndex: number;
        }>;
        notes?: Array<{
            note: Note;
            originalChannelIndex: number;
            originalSectionIndex: number;
        }>;
        tempoChanges?: TempoChange[];
    };
}

export class ClipboardStore {
    private _clipboardData = $state<ClipboardData | null>(null);
    private readonly STORAGE_KEY = 'noteblock-clipboard';

    constructor() {
        this.loadFromStorage();
        this.setupStorageListener();
    }

    get clipboardData() {
        return this._clipboardData;
    }

    get hasData() {
        return this._clipboardData !== null;
    }

    get operationType() {
        return this._clipboardData?.operation;
    }

    get dataType() {
        return this._clipboardData?.type;
    }

    /**
     * Copy sections to clipboard
     */
    copySections(
        sections: Array<{ section: NoteSection; channelIndex: number; sectionIndex: number }>
    ) {
        const clipboardData: ClipboardData = {
            type: 'sections',
            operation: 'copy',
            timestamp: Date.now(),
            source: {},
            data: {
                sections: sections.map(({ section, channelIndex, sectionIndex }) => ({
                    section: this.deepClone(section),
                    originalChannelIndex: channelIndex,
                    originalSectionIndex: sectionIndex
                }))
            }
        };

        this.setClipboardData(clipboardData);
    }

    /**
     * Cut sections to clipboard
     */
    cutSections(
        sections: Array<{ section: NoteSection; channelIndex: number; sectionIndex: number }>
    ) {
        const clipboardData: ClipboardData = {
            type: 'sections',
            operation: 'cut',
            timestamp: Date.now(),
            source: {},
            data: {
                sections: sections.map(({ section, channelIndex, sectionIndex }) => ({
                    section: this.deepClone(section),
                    originalChannelIndex: channelIndex,
                    originalSectionIndex: sectionIndex
                }))
            }
        };

        this.setClipboardData(clipboardData);
    }

    /**
     * Copy notes to clipboard (for piano roll)
     */
    copyNotes(notes: Array<{ note: Note; channelIndex: number; sectionIndex: number }>) {
        const clipboardData: ClipboardData = {
            type: 'notes',
            operation: 'copy',
            timestamp: Date.now(),
            source: {
                channelIndex: notes[0]?.channelIndex,
                sectionIndex: notes[0]?.sectionIndex
            },
            data: {
                notes: notes.map(({ note, channelIndex, sectionIndex }) => ({
                    note: this.deepClone(note),
                    originalChannelIndex: channelIndex,
                    originalSectionIndex: sectionIndex
                }))
            }
        };

        this.setClipboardData(clipboardData);
    }

    /**
     * Cut notes to clipboard (for piano roll)
     */
    cutNotes(notes: Array<{ note: Note; channelIndex: number; sectionIndex: number }>) {
        const clipboardData: ClipboardData = {
            type: 'notes',
            operation: 'cut',
            timestamp: Date.now(),
            source: {
                channelIndex: notes[0]?.channelIndex,
                sectionIndex: notes[0]?.sectionIndex
            },
            data: {
                notes: notes.map(({ note, channelIndex, sectionIndex }) => ({
                    note: this.deepClone(note),
                    originalChannelIndex: channelIndex,
                    originalSectionIndex: sectionIndex
                }))
            }
        };

        this.setClipboardData(clipboardData);
    }

    /**
     * Copy tempo changes to clipboard
     */
    copyTempoChanges(tempoChanges: TempoChange[]) {
        const clipboardData: ClipboardData = {
            type: 'tempo-changes',
            operation: 'copy',
            timestamp: Date.now(),
            source: {},
            data: {
                tempoChanges: tempoChanges.map((change) => this.deepClone(change))
            }
        };

        this.setClipboardData(clipboardData);
    }

    /**
     * Clear clipboard
     */
    clear() {
        this._clipboardData = null;
        this.saveToStorage();
    }

    /**
     * Get clipboard sections for pasting
     */
    getSections(): Array<{
        section: NoteSection;
        originalChannelIndex: number;
        originalSectionIndex: number;
    }> | null {
        if (this._clipboardData?.type !== 'sections') return null;
        return this._clipboardData.data.sections || null;
    }

    /**
     * Get clipboard notes for pasting
     */
    getNotes(): Array<{
        note: Note;
        originalChannelIndex: number;
        originalSectionIndex: number;
    }> | null {
        if (this._clipboardData?.type !== 'notes') return null;
        return this._clipboardData.data.notes || null;
    }

    /**
     * Get clipboard tempo changes for pasting
     */
    getTempoChanges(): TempoChange[] | null {
        if (this._clipboardData?.type !== 'tempo-changes') return null;
        return this._clipboardData.data.tempoChanges || null;
    }

    private setClipboardData(data: ClipboardData) {
        this._clipboardData = data;
        this.saveToStorage();
    }

    private saveToStorage() {
        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                if (this._clipboardData) {
                    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._clipboardData));
                } else {
                    localStorage.removeItem(this.STORAGE_KEY);
                }
            } catch (error) {
                console.warn('Failed to save clipboard to localStorage:', error);
            }
        }
    }

    private loadFromStorage() {
        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                const stored = localStorage.getItem(this.STORAGE_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored) as ClipboardData;
                    // Only load if timestamp is recent (within 24 hours)
                    const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
                    if (Date.now() - parsed.timestamp < MAX_AGE) {
                        this._clipboardData = parsed;
                    } else {
                        localStorage.removeItem(this.STORAGE_KEY);
                    }
                }
            } catch (error) {
                console.warn('Failed to load clipboard from localStorage:', error);
                localStorage.removeItem(this.STORAGE_KEY);
            }
        }
    }

    private setupStorageListener() {
        if (typeof window !== 'undefined') {
            const handleStorageChange = (event: StorageEvent) => {
                if (event.key === this.STORAGE_KEY) {
                    this.loadFromStorage();
                }
            };

            window.addEventListener('storage', handleStorageChange);

            // Cleanup function (though in practice this store will live for the app lifetime)
            return () => {
                window.removeEventListener('storage', handleStorageChange);
            };
        }
    }

    private deepClone<T>(obj: T): T {
        return JSON.parse(JSON.stringify(obj));
    }
}

export const clipboard = new ClipboardStore();
