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
    <div
      class="reveal-image-viewport"
      #vp
      [style.transform]="transform"
      [style.transition]="'none'"
    >
      <img
        [src]="src"
        [alt]="alt || 'Featured image'"
        draggable="false"
        class="w-full h-full select-none"
        [class.object-cover]="!isMobileClass"
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

      @media (max-width: 767px) {
        .reveal-image-viewport {
          height: 50%;
          margin-top: 35%;
        }
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
  private _isMobile = false;

  @HostBinding('class.is-mobile')
  get isMobileClass(): boolean {
    return this._isMobile;
  }

  private lockScrollY: number | null = null;
  private midScale = false;
  private hasEngagedOnce = false;
  transform = 'scale(1)';
  private currentScale = this.endScale;
  // UI content animation state
  contentOpacity = 0;
  contentTransform = 'translateY(40px)';
  // Bound handler reference for cleanup
  private boundWheelHandler: ((ev: WheelEvent) => void) | null = null;
  // Scale animation (smooth lerp for mouse wheel)
  private _scaleTarget = this.endScale;
  private _scaleRafId: number | null = null;
  public bypassActive = false;
  private _recentEscape: 'up' | 'down' | null = null;

  public bypassToShrunk() {
    this.bypassActive = true;
    this._stopScaleAnimation();
    this.currentScale = this.minScale;
    this.midScale = false;
    this.lockScrollY = null;
    this.releaseScrollLock();
    this.updateTransform();
    this.updateContentReveal();
    setTimeout(() => {
      this.bypassActive = false;
    }, 1500);
  }

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private el: ElementRef<HTMLElement>,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
  ) {
    this.isBrowser =
      typeof window !== 'undefined' && isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      this._isMobile =
        window.innerWidth <= 768 ||
        window.matchMedia('(pointer: coarse)').matches;
    }
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) {
      this.currentScale = this.endScale;
      this.updateTransform();
      return;
    }

    // Mobile detection: already evaluated in constructor (if browser)

    if (this._isMobile) {
      // Fix at minScale, no scroll-driven interaction
      this.currentScale = this.minScale;
      this._scaleTarget = this.minScale;
      this.midScale = false;
      this.updateTransform();
      this.updateContentReveal();
      return; // Skip wheel listener — no grow/shrink on mobile
    }

    // Initialize at full scale
    this.currentScale = this.endScale;
    this.updateTransform();

    // CRITICAL: Register wheel listener with { passive: false } so preventDefault() works.
    // Angular @HostListener does NOT support passive: false, and Chrome 73+ defaults
    // window-level wheel listeners to passive, which silently ignores preventDefault().
    this.boundWheelHandler = this.onWheel.bind(this);
    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('wheel', this.boundWheelHandler!, {
        passive: false,
      });
    });
  }

  ngOnDestroy(): void {
    if (this.boundWheelHandler) {
      window.removeEventListener('wheel', this.boundWheelHandler);
      this.boundWheelHandler = null;
    }
    this._stopScaleAnimation();
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
    if (this.bypassActive) return;
    const vp = this.el.nativeElement;
    const vh = window.innerHeight || document.documentElement.clientHeight;

    // ── Raw delta with line-mode normalization ──
    let delta = ev.deltaY;
    if (ev.deltaMode === 1) delta *= 16;

    // ── Detect input device ──
    const isMouse =
      ev.deltaMode === 1 || (ev.deltaMode === 0 && Math.abs(ev.deltaY) >= 100);

    // ── Visibility (host element, unscaled) ──
    const hostRect = vp.getBoundingClientRect();
    const elHeight = hostRect.height || 1;
    const visiblePx = Math.max(
      0,
      Math.min(hostRect.bottom, vh) - Math.max(hostRect.top, 0),
    );
    const fractionVisible = visiblePx / Math.min(elHeight, vh);

    const span = this.endScale - this.minScale;
    if (span <= 0) return;

    const isLocked = this.lockScrollY !== null;

    // Reset escape state if user leaves element entirely or reverses direction
    if (fractionVisible < 0.1) this._recentEscape = null;
    if (delta > 0 && this._recentEscape === 'up') this._recentEscape = null;
    if (delta < 0 && this._recentEscape === 'down') this._recentEscape = null;

    if (!isLocked) {
      const visThreshold = isMouse ? 0.85 : 0.95;

      // Predict if this specific wheel event's momentum will push the image over the threshold.
      const estimatedDelta = isMouse
        ? Math.abs(delta) < 120
          ? Math.sign(delta) * 150
          : delta
        : delta;

      const futureTop = hostRect.top - estimatedDelta;
      const futureBottom = hostRect.bottom - estimatedDelta;
      const futureVisiblePx = Math.max(
        0,
        Math.min(futureBottom, vh) - Math.max(futureTop, 0),
      );
      const futureFraction = futureVisiblePx / Math.min(elHeight, vh);

      // Unconditional escape priority if recently broke the lock
      if (delta > 0 && this._recentEscape === 'down') return;
      if (delta < 0 && this._recentEscape === 'up') return;

      // Only allow the native scroll if the future position STILL won't cross our lock bounds!
      if (fractionVisible < visThreshold && futureFraction < visThreshold) {
        return;
      }

      // Engage!
      const engageLock = () => {
        this.lockScrollY = window.scrollY;
        this.applyScrollLock();
      };

      if (delta > 0 && this.isAtFullSize()) {
        // Scrolling down into full-sized image → begin shrink
        ev.preventDefault();
        engageLock();
        this.midScale = true;
        this.hasEngagedOnce = true;
        return; // Absorb first click
      } else if (delta < 0 && this.isAtMinSize()) {
        // Scrolling up into shrunk image → begin grow
        ev.preventDefault();
        engageLock();
        this.midScale = true;
        return; // Absorb first click
      } else {
        return; // normal page scroll
      }
    }

    // ── Mid-scale / Locked Logic ──
    ev.preventDefault();

    // ── At full size scrolling UP → release lock ──
    if (delta < 0 && this.isAtFullSize()) {
      this._recentEscape = 'up';
      this.lockScrollY = null;
      this.midScale = false;
      this.releaseScrollLock();
      return;
    }

    // ── At min size scrolling DOWN → release lock ──
    if (delta > 0 && this.isAtMinSize()) {
      this._recentEscape = 'down';
      this.lockScrollY = null;
      this.midScale = false;
      this.releaseScrollLock();
      return;
    }

    // midScale state logic
    if (!this.midScale) {
      this.midScale = true;
    }

    this.applyScaleDelta(delta, isMouse);
  }

  /**
   * Apply wheel delta to the current scale, clamped to [minScale, endScale].
   * Scrolling down (delta > 0) shrinks, scrolling up (delta < 0) grows.
   */
  private applyScaleDelta(delta: number, isMouse: boolean) {
    const span = this.endScale - this.minScale;
    const distance = this.scrollDistance * 1.2;

    if (isMouse) {
      // Mouse: fixed step per notch (~14% of span), animated via lerp
      const fixedStep = span * 0.14 * (delta < 0 ? 1 : -1);
      this._scaleTarget += fixedStep;
    } else {
      // Touchpad: proportional to delta
      const deltaProgress = Math.abs(delta) / distance;
      const currentProgress = (this._scaleTarget - this.minScale) / span;
      let newProgress =
        currentProgress + (delta < 0 ? deltaProgress : -deltaProgress);
      if (newProgress < 0) newProgress = 0;
      if (newProgress > 1) newProgress = 1;
      this._scaleTarget = this.minScale + span * newProgress;
    }

    // Clamp target
    this._scaleTarget = Math.max(
      this.minScale,
      Math.min(this.endScale, this._scaleTarget),
    );

    if (isMouse) {
      // Mouse: smooth lerp animation
      this._startScaleAnimation();
    } else {
      // Touchpad: apply directly (continuous events, no lerp needed)
      this._stopScaleAnimation();
      this.currentScale = this._scaleTarget;
      this.updateTransform();
      this.updateContentReveal();
    }

    // If we just arrived at an extreme, clear midScale
    if (this.isAtFullSize() || this.isAtMinSize()) {
      this.midScale = false;
    }
  }

  // ── Scale animation helpers (smooth lerp for mouse wheel) ──

  private _startScaleAnimation() {
    if (this._scaleRafId !== null) return;

    const tick = () => {
      const diff = this._scaleTarget - this.currentScale;

      if (Math.abs(diff) < 0.002) {
        this.currentScale = this._scaleTarget;
        this._scaleRafId = null;
        this.updateTransform();
        this.updateContentReveal();
        if (this.isAtFullSize() || this.isAtMinSize()) {
          this.midScale = false;
        }
        return;
      }

      this.currentScale += diff * 0.18;
      this.updateTransform();
      this.updateContentReveal();
      this._scaleRafId = requestAnimationFrame(tick);
    };

    this._scaleRafId = requestAnimationFrame(tick);
  }

  private _stopScaleAnimation() {
    if (this._scaleRafId !== null) {
      cancelAnimationFrame(this._scaleRafId);
      this._scaleRafId = null;
    }
  }

  private updateTransform() {
    if (this._isMobile) {
      this.transform = 'none';
      this.cdr.markForCheck();
      return;
    }
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
