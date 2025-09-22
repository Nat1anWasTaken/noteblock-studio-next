import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

export async function downloadAsArrayBuffer(url: string): Promise<ArrayBuffer> {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.arrayBuffer(); // <— 直接拿到 ArrayBuffer
}

/**
 * Generate a unique channel ID.
 * Prefers crypto.randomUUID when available, falls back to timestamp + counter.
 */
let idCounter = 0;
export function generateChannelId(): string {
    try {
        // Prefer crypto.randomUUID when available
        if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function')
            return (crypto as any).randomUUID();
    } catch {}
    return `ch_${Date.now()}_${++idCounter}`;
}
