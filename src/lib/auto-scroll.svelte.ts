/**
 * Auto-scroll utility for drag operations
 * Provides automatic scrolling when cursor approaches container edges during drag operations
 */

export interface AutoScrollConfig {
    /** Size of the proximity zone from each edge in pixels (default: 50) */
    proximityZone?: number;
    /** Maximum scroll speed in pixels per frame (default: 8) */
    maxScrollSpeed?: number;
    /** Minimum scroll speed in pixels per frame (default: 1) */
    minScrollSpeed?: number;
    /** Speed multiplier when cursor is outside container bounds (default: 2) */
    outsideBoundsMultiplier?: number;
    /** Enable horizontal scrolling (default: true) */
    horizontalScroll?: boolean;
    /** Enable vertical scrolling (default: true) */
    verticalScroll?: boolean;
}

export interface ScrollableElement {
    readonly scrollLeft: number;
    readonly scrollTop: number;
    readonly scrollWidth: number;
    readonly scrollHeight: number;
    readonly clientWidth: number;
    readonly clientHeight: number;
    scrollBy(options: { left?: number; top?: number; behavior?: ScrollBehavior }): void;
    getBoundingClientRect(): DOMRect;
}

interface ScrollDirection {
    horizontal: 'left' | 'right' | null;
    vertical: 'up' | 'down' | null;
}

interface ScrollSpeed {
    horizontal: number;
    vertical: number;
}

export class AutoScroller {
    private animationId: number | null = null;
    private lastTimestamp = 0;
    private readonly config: Required<AutoScrollConfig>;
    private scrollableElement: ScrollableElement | null = null;
    private isActive = false;
    private currentDirection: ScrollDirection = { horizontal: null, vertical: null };
    private currentSpeed: ScrollSpeed = { horizontal: 0, vertical: 0 };

    // Throttling for performance
    private readonly THROTTLE_MS = 16; // ~60fps

    constructor(config: AutoScrollConfig = {}) {
        this.config = {
            proximityZone: config.proximityZone ?? 50,
            maxScrollSpeed: config.maxScrollSpeed ?? 8,
            minScrollSpeed: config.minScrollSpeed ?? 1,
            outsideBoundsMultiplier: config.outsideBoundsMultiplier ?? 2,
            horizontalScroll: config.horizontalScroll ?? true,
            verticalScroll: config.verticalScroll ?? true
        };
    }

    /**
     * Start auto-scrolling for a scrollable element
     */
    start(element: ScrollableElement): void {
        if (this.isActive && this.scrollableElement === element) return;

        this.stop();
        this.scrollableElement = element;
        this.isActive = true;
        this.lastTimestamp = 0;
        this.startAnimationLoop();
    }

    /**
     * Stop auto-scrolling
     */
    stop(): void {
        this.isActive = false;
        this.scrollableElement = null;
        this.currentDirection = { horizontal: null, vertical: null };
        this.currentSpeed = { horizontal: 0, vertical: 0 };

        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * Update cursor position to determine scroll direction and speed
     */
    updateCursor(clientX: number, clientY: number): void {
        if (!this.isActive || !this.scrollableElement) return;

        const element = this.scrollableElement;
        const rect = element.getBoundingClientRect();

        // Calculate relative position within element
        const relativeX = clientX - rect.left;
        const relativeY = clientY - rect.top;

        // Update scroll direction and speed based on cursor position
        this.updateScrollDirection(relativeX, relativeY, rect.width, rect.height);
        this.updateScrollSpeed(relativeX, relativeY, rect.width, rect.height, clientX, clientY, rect);
    }

    private updateScrollDirection(relativeX: number, relativeY: number, width: number, height: number): void {
        const { proximityZone, horizontalScroll, verticalScroll } = this.config;

        // Horizontal scrolling
        if (horizontalScroll) {
            if (relativeX < proximityZone) {
                this.currentDirection.horizontal = 'left';
            } else if (relativeX > width - proximityZone) {
                this.currentDirection.horizontal = 'right';
            } else {
                this.currentDirection.horizontal = null;
            }
        } else {
            this.currentDirection.horizontal = null;
        }

        // Vertical scrolling
        if (verticalScroll) {
            if (relativeY < proximityZone) {
                this.currentDirection.vertical = 'up';
            } else if (relativeY > height - proximityZone) {
                this.currentDirection.vertical = 'down';
            } else {
                this.currentDirection.vertical = null;
            }
        } else {
            this.currentDirection.vertical = null;
        }
    }

    private updateScrollSpeed(
        relativeX: number,
        relativeY: number,
        width: number,
        height: number,
        clientX: number,
        clientY: number,
        rect: DOMRect
    ): void {
        const { proximityZone, minScrollSpeed, maxScrollSpeed, outsideBoundsMultiplier } = this.config;

        // Calculate horizontal speed
        if (this.currentDirection.horizontal) {
            let distance: number;
            let isOutside = false;

            if (this.currentDirection.horizontal === 'left') {
                distance = Math.max(0, proximityZone - relativeX);
                isOutside = clientX < rect.left;
            } else {
                distance = Math.max(0, relativeX - (width - proximityZone));
                isOutside = clientX > rect.right;
            }

            // Calculate speed based on distance from edge
            const normalizedDistance = Math.min(1, distance / proximityZone);
            let speed = minScrollSpeed + (maxScrollSpeed - minScrollSpeed) * normalizedDistance;

            // Apply outside bounds multiplier
            if (isOutside) {
                speed *= outsideBoundsMultiplier;
            }

            this.currentSpeed.horizontal = speed;
        } else {
            this.currentSpeed.horizontal = 0;
        }

        // Calculate vertical speed
        if (this.currentDirection.vertical) {
            let distance: number;
            let isOutside = false;

            if (this.currentDirection.vertical === 'up') {
                distance = Math.max(0, proximityZone - relativeY);
                isOutside = clientY < rect.top;
            } else {
                distance = Math.max(0, relativeY - (height - proximityZone));
                isOutside = clientY > rect.bottom;
            }

            // Calculate speed based on distance from edge
            const normalizedDistance = Math.min(1, distance / proximityZone);
            let speed = minScrollSpeed + (maxScrollSpeed - minScrollSpeed) * normalizedDistance;

            // Apply outside bounds multiplier
            if (isOutside) {
                speed *= outsideBoundsMultiplier;
            }

            this.currentSpeed.vertical = speed;
        } else {
            this.currentSpeed.vertical = 0;
        }
    }

    private startAnimationLoop(): void {
        if (!this.isActive) return;

        this.animationId = requestAnimationFrame((timestamp) => {
            this.animate(timestamp);
            this.startAnimationLoop();
        });
    }

    private animate(timestamp: number): void {
        if (!this.isActive || !this.scrollableElement) return;

        // Throttle updates
        if (timestamp - this.lastTimestamp < this.THROTTLE_MS) return;
        this.lastTimestamp = timestamp;

        const element = this.scrollableElement;
        let scrollLeft = 0;
        let scrollTop = 0;

        // Calculate horizontal scroll
        if (this.currentDirection.horizontal && this.currentSpeed.horizontal > 0) {
            const maxScrollLeft = element.scrollWidth - element.clientWidth;
            const direction = this.currentDirection.horizontal === 'left' ? -1 : 1;
            scrollLeft = direction * this.currentSpeed.horizontal;

            // Clamp to scrollable bounds
            const newScrollLeft = Math.max(0, Math.min(maxScrollLeft, element.scrollLeft + scrollLeft));
            scrollLeft = newScrollLeft - element.scrollLeft;
        }

        // Calculate vertical scroll
        if (this.currentDirection.vertical && this.currentSpeed.vertical > 0) {
            const maxScrollTop = element.scrollHeight - element.clientHeight;
            const direction = this.currentDirection.vertical === 'up' ? -1 : 1;
            scrollTop = direction * this.currentSpeed.vertical;

            // Clamp to scrollable bounds
            const newScrollTop = Math.max(0, Math.min(maxScrollTop, element.scrollTop + scrollTop));
            scrollTop = newScrollTop - element.scrollTop;
        }

        // Apply scroll if needed
        if (Math.abs(scrollLeft) > 0.1 || Math.abs(scrollTop) > 0.1) {
            element.scrollBy({
                left: scrollLeft,
                top: scrollTop,
                behavior: 'instant'
            });
        }
    }

    /**
     * Check if auto-scrolling is currently active
     */
    get active(): boolean {
        return this.isActive;
    }

    /**
     * Get current scroll direction
     */
    get direction(): ScrollDirection {
        return { ...this.currentDirection };
    }

    /**
     * Get current scroll speed
     */
    get speed(): ScrollSpeed {
        return { ...this.currentSpeed };
    }
}