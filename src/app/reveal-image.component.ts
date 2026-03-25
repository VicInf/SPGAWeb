import {
  Component,
  Input,
  ElementRef,
  HostListener,
  AfterViewInit,
  OnDestroy,
  ChangeDetectionStrategy,
  Inject,
  PLATFORM_ID,
  Output,
  HostBinding,
  EventEmitter,
  NgZone,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'reveal-image',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="reveal-image-viewport" #vp [style.transform]="transform">
      <img
        [src]="src"
        [alt]="alt || 'Featured image'"
        draggable="false"
        class="w-full h-full object-cover select-none"
      />
      <!-- Overlay headline (buttons removed) -->
      <div
        class="absolute inset-0 flex flex-col items-center justify-end pointer-events-none"
        [style.opacity]="contentOpacity"
        [style.transform]="contentTransform"
      ></div>
      <ng-content></ng-content>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
        position: relative;
      }
      .reveal-image-viewport {
        width: 100%;
        height: 100%;
        will-change: transform;
        transition: transform 0.05s linear;
        position: relative;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RevealImageComponent implements AfterViewInit, OnDestroy {
  @Output() scaleProgress = new EventEmitter<number>();
  @Input() src!: string;
  @Input() alt?: string;
  // Now reversed: start at full scale (endScale) and shrink toward minScale
  @Input() endScale: number = 1; // full size initial
  @Input() minScale: number = 0.3; // smallest allowed scale when scrolling down (was startScale concept)
  @Input() scrollDistance: number = 250; // px required while fully visible to reach full scale
  @Input() autoAfterFull: boolean = true; // mimic owl revealAutoAfterFull
  @Input() shrinkWithScale: boolean = true; // enable shrinking host height
  // When true, move the image upward as it shrinks. Value is how many viewport
  // height units (vh) the image should be raised at full shrink (minScale).
  @Input() raiseAtMinVh: number = 12;
  // z-index behavior: when the component reaches minScale and the minScale is
  // less than or equal to zIndexThreshold, the host z-index will be set to
  // zIndexAtMin so it sits beneath other content. Defaults match your request.
  @Input() zIndexAtMin: string = '0';
  @Input() zIndexThreshold: number = 0.35;
  // Fraction (0-1) of component height that must be visible before shrink begins.
  @Input() visibilityThreshold: number = 0.85;
  // Must reach this (>= visibilityThreshold) before first shrink/grow interaction begins
  @Input() startVisibilityThreshold: number = 0.95;
  // Optional: element top must be within this px distance from viewport top for first interaction (0 disables)
  @Input() requireTopNear: number = 0;
  private isBrowser = false;
  private lockScrollY: number | null = null; // scrollY when lock was acquired (same pattern as owl-carousel)
  private midScale = false; // true once we've started moving away from initial extreme
  private hasEngagedOnce = false; // true after first successful engagement
  transform = 'scale(1)';
  private currentScale = this.endScale;
  // UI content animation state
  contentOpacity = 0; // fade in as image shrinks
  contentTransform = 'translateY(40px)'; // move upward while appearing
  // Bound handler reference for cleanup
  private boundWheelHandler: ((ev: WheelEvent) => void) | null = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private el: ElementRef<HTMLElement>,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    this.isBrowser =
      typeof window !== 'undefined' && isPlatformBrowser(this.platformId);
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) {
      this.currentScale = this.endScale;
      this.updateTransform();
      return;
    }
    // Initialize at full scale
    this.currentScale = this.endScale;
    this.updateTransform();

    // CRITICAL: Register wheel listener with { passive: false } so preventDefault() works.
    // Angular @HostListener does NOT support passive: false, and Chrome 73+ defaults
    // window-level wheel listeners to passive, which silently ignores preventDefault().
    this.boundWheelHandler = this.onWheel.bind(this);
    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('wheel', this.boundWheelHandler!, { passive: false });
    });
  }

  ngOnDestroy(): void {
    // Clean up the manual wheel listener
    if (this.boundWheelHandler) {
      window.removeEventListener('wheel', this.boundWheelHandler);
      this.boundWheelHandler = null;
    }
    this.releaseScrollLock();
  }

  private applyScrollLock() {
    if (!this.isBrowser || typeof document === 'undefined') return;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }

  private releaseScrollLock() {
    if (!this.isBrowser || typeof document === 'undefined') return;
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  }

  private onWheel(ev: WheelEvent) {
    if (!this.isBrowser) return;
    // Re-enter Angular zone so state changes trigger change detection
    this.ngZone.run(() => this.handleWheel(ev));
  }

  private handleWheel(ev: WheelEvent) {
    const rect = this.el.nativeElement.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;

    // Fraction-based visibility check.
    // The strict fullyVisible check (rect.top >= 0 && rect.bottom <= vh) is
    // IMPOSSIBLE for a 100vh element at scale(1): it requires rect.top === 0.
    // Instead, check if at least 75% of the element is within the viewport.
    const elHeight = rect.height || 1;
    const visiblePx = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
    const fractionVisible = visiblePx / elHeight;

    // Use stricter threshold for first engagement, then relax
    const threshold = this.hasEngagedOnce
      ? this.visibilityThreshold
      : this.startVisibilityThreshold;
    let engaged = fractionVisible >= threshold;

    // Optional: require element top to be near viewport top
    if (engaged && !this.hasEngagedOnce && this.requireTopNear > 0) {
      engaged = rect.top >= 0 && rect.top <= this.requireTopNear;
    }

    const delta = ev.deltaY;
    const span = this.endScale - this.minScale;
    if (span <= 0) return;

    // ── Sticky Lock Logic (mirrors owl-carousel) ──────────────────────
    // Once we have established a lock AND moved away from the starting extreme,
    // we stay locked ("sticky") regardless of visibility changes.
    // This prevents the page from scrolling while mid-scale.
    const isSticky = this.lockScrollY !== null && this.midScale;

    if (!isSticky && !engaged) {
      // Not sufficiently visible and not sticky → release and let page scroll
      if (this.lockScrollY !== null) {
        this.lockScrollY = null;
        this.releaseScrollLock();
      }
      return;
    }

    // ── At full size scrolling DOWN → begin shrink, lock page ──────────
    if (delta > 0 && this.isAtFullSize() && !this.midScale) {
      // First scroll down while at full size → establish lock
      if (this.lockScrollY === null) {
        this.lockScrollY = window.scrollY;
        this.applyScrollLock();
      }
      ev.preventDefault();
      this.midScale = true;
      this.hasEngagedOnce = true;
      this.applyScaleDelta(delta);
      return;
    }

    // ── At min size scrolling DOWN → release lock, let page continue ──
    if (delta > 0 && this.isAtMinSize()) {
      this.lockScrollY = null;
      this.midScale = false;
      this.releaseScrollLock();
      return; // don't preventDefault → allow page scroll
    }

    // ── At full size scrolling UP → release lock, let page continue ───
    if (delta < 0 && this.isAtFullSize()) {
      this.lockScrollY = null;
      this.midScale = false;
      this.releaseScrollLock();
      return; // don't preventDefault → allow page scroll
    }

    // ── At min size scrolling UP → begin grow, lock page ──────────────
    if (delta < 0 && this.isAtMinSize() && !this.midScale) {
      if (this.lockScrollY === null) {
        this.lockScrollY = window.scrollY;
        this.applyScrollLock();
      }
      ev.preventDefault();
      this.midScale = true;
      this.applyScaleDelta(delta);
      return;
    }

    // ── Mid-scale: always lock and prevent scroll ─────────────────────
    if (this.lockScrollY === null) {
      this.lockScrollY = window.scrollY;
      this.applyScrollLock();
    }
    ev.preventDefault();
    this.applyScaleDelta(delta);
  }

  /**
   * Apply wheel delta to the current scale, clamped to [minScale, endScale].
   * Scrolling down (delta > 0) shrinks, scrolling up (delta < 0) grows.
   */
  private applyScaleDelta(delta: number) {
    const span = this.endScale - this.minScale;
    const currentProgress = (this.currentScale - this.minScale) / span; // 0..1
    const deltaProgress = Math.abs(delta) / this.scrollDistance;
    // delta > 0 → shrink (decrease progress), delta < 0 → grow (increase progress)
    let newProgress =
      currentProgress + (delta < 0 ? deltaProgress : -deltaProgress);
    if (newProgress < 0) newProgress = 0;
    if (newProgress > 1) newProgress = 1;
    const targetScale = this.minScale + span * newProgress;

    if (Math.abs(targetScale - this.currentScale) > 0.0001) {
      this.currentScale = targetScale;
      this.updateTransform();
      this.updateContentReveal();
      this.scaleProgress.emit(1 - newProgress); // 0 full → 1 min
    }

    // If we just arrived at an extreme, clear midScale so next wheel event
    // in the same direction will release the lock
    if (this.isAtFullSize() || this.isAtMinSize()) {
      this.midScale = false;
    }
  }

  private updateTransform() {
    // Calculate shrink progress: 0 at full size, 1 at minScale
    const span = this.endScale - this.minScale;
    const progress =
      span > 0 ? 1 - (this.currentScale - this.minScale) / span : 0;
    // translate upward as it shrinks (in vh)
    const translateVh = this.raiseAtMinVh * Math.min(1, Math.max(0, progress));
    this.transform = `translateY(-${translateVh}vh) scale(${this.currentScale})`;
    this.cdr.markForCheck();
  }

  private updateContentReveal() {
    // Progress: 0 at full scale, 1 at min scale
    const span = this.endScale - this.minScale;
    const progress = 1 - (this.currentScale - this.minScale) / span;
    // Opacity: start near 0, reach 1 around 40% shrink
    const opacity = Math.min(1, Math.max(0, progress * 1.4));
    // Vertical translate: from 40px down to 0
    const translateY = 40 - 40 * Math.min(1, progress * 1.2);
    this.contentOpacity = opacity;
    this.contentTransform = `translateY(${translateY}px)`;
    try {
      this.scaleProgress.emit(Math.min(1, Math.max(0, progress)));
    } catch (e) {
      // no-op
    }
  }

  private isAtFullSize(): boolean {
    return this.currentScale >= this.endScale - 0.0001;
  }
  private isAtMinSize(): boolean {
    return this.currentScale <= this.minScale + 0.0001;
  }
}
