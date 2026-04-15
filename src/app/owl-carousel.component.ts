import {
  Component,
  Input,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  HostListener,
  ChangeDetectionStrategy,
  Inject,
  PLATFORM_ID,
  NgZone,
} from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

export interface OwlCarouselSlide {
  src: string;
  alt?: string;
  title?: string;
  subtitle?: string;
}

export interface OwlCarouselOptions {
  items?: number; // items per view
  loop?: boolean;
  margin?: number; // px between items
  autoplay?: boolean;
  autoplayTimeout?: number; // ms
  autoplayHoverPause?: boolean;
  nav?: boolean;
  dots?: boolean;
  responsive?: { [minWidth: number]: { items?: number; margin?: number } };
  transitionSpeed?: number; // ms
  wheelControl?: boolean; // enable vertical wheel-to-slide control
  wheelThreshold?: number; // deltaY accumulation threshold
  keyboard?: boolean; // enable keyboard arrow navigation when focused
  progressClickable?: boolean; // clicking progress bar jumps
  announce?: boolean; // aria-live announcements
  ariaLabel?: string; // label for region
  // Reveal (entrance) animation
  revealOnEnter?: boolean; // scale up when first enters viewport
  revealScaleStart?: number; // initial scale (e.g. 0.7)
  revealDurationMs?: number; // animation duration
  revealEasing?: string; // CSS easing function
  revealScaleEnd?: number; // final scale when fully visible (default 1)
  revealScrollDriven?: boolean; // if true, scale progresses with scroll (intersection ratio)
  revealScrollDistance?: number; // px of additional page scroll after fully visible required to reach full scale
  revealVisibilityThreshold?: number; // fraction (0-1) of element height that must be visible to start growth (fallback if never fully fits)
  revealAutoAfterFull?: boolean; // if true, once fully visible animate to full scale over revealDurationMs instead of requiring further scroll
}

@Component({
  selector: 'owl-carousel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="owl-carousel-viewport"
      #viewport
      [style.transform]="revealTransform"
      [style.transition]="viewportTransitionStyle"
      [attr.role]="'region'"
      [attr.aria-label]="options.ariaLabel || 'Image carousel'"
      tabindex="0"
      (keydown)="onKeyDown($event)"
      (pointerdown)="onPointerDown($event)"
      (pointermove)="onPointerMove($event)"
      (pointerup)="onPointerUp($event)"
      (pointercancel)="onPointerUp($event)"
      (pointerleave)="onPointerUp($event)"
      (mouseenter)="onMouseEnter()"
      (mouseleave)="onMouseLeave()"
      [class.dragging]="pointerActive"
    >
      <div
        class="owl-overlay-gradient"
        *ngIf="options.nav || options.dots"
      ></div>
      <div
        #stage
        class="owl-carousel-stage"
        [style.transition]="stageTransition"
        [style.transform]="stageTransform"
      >
        <div
          class="owl-item"
          *ngFor="let slide of renderedSlides; let i = index"
          [style.width.px]="itemWidth"
          [style.marginRight.px]="itemMargin"
          [attr.data-index]="slide._realIndex"
        >
          <img
            [src]="slide.src"
            [alt]="slide.alt || 'Slide ' + (slide._realIndex + 1)"
            draggable="false"
          />
        </div>
      </div>

      <!-- Centered text overlay (fixed position, shows active slide text) -->
      <div
        *ngIf="getActiveSlide()?.title || getActiveSlide()?.subtitle"
        class="absolute inset-0 flex flex-col items-center justify-center text-white font-canela-deck pointer-events-none select-none"
        [style.opacity]="getTextOpacity()"
      >
        <span
          class="text-xl sm:text-2xl md:text-3xl"
          *ngIf="getActiveSlide()?.title"
          >{{ getActiveSlide()?.title }}</span
        >
        <span
          class="text-4xl sm:text-6xl md:text-7xl font-normal italic text-center px-4"
          *ngIf="getActiveSlide()?.subtitle"
          >{{ getActiveSlide()?.subtitle }}</span
        >
      </div>
      <!-- Progress bar (replaces dots) -->
      <div
        *ngIf="options.dots"
        class="owl-progress-wrapper"
        aria-label="Carousel progress"
      >
        <div
          class="owl-progress-track"
          (click)="onProgressClick($event)"
          [class.clickable]="options.progressClickable"
        >
          <div
            class="owl-progress-bar"
            [style.width.%]="
              slides.length ? ((currentIndex + 1) / slides.length) * 100 : 0
            "
          ></div>
        </div>
      </div>
      <div
        *ngIf="options.announce"
        class="visually-hidden"
        aria-live="polite"
        aria-atomic="true"
      >
        Slide {{ currentIndex + 1 }} of {{ slides.length }}
      </div>
    </div>
  `,
  styleUrls: ['./owl-carousel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OwlCarouselComponent implements AfterViewInit, OnDestroy {
  @Input() slides: OwlCarouselSlide[] = [];
  @Input() options: OwlCarouselOptions = {};

  @ViewChild('viewport', { static: true })
  viewportRef!: ElementRef<HTMLElement>;
  @ViewChild('stage', { static: true }) stageRef!: ElementRef<HTMLElement>;

  // State
  itemWidth = 0;
  itemMargin = 0;
  renderedSlides: any[] = [];
  currentIndex = 0;
  currentTransform = 0;
  stageTransition = 'transform 0s ease';
  stageTransform = 'translate3d(0,0,0)';
  private resizeObserver?: ResizeObserver;
  private boundaryPushAccumulator = 0; // tracks attempts to scroll past boundaries

  // Restored properties
  private isBrowser = false;
  private dragStartX = 0;
  private dragStartTransform = 0;
  pointerActive = false;
  private hasDragged = false;
  private dragStartTime = 0;
  private autoplayTimer: any = null;
  private transitionMs = 400;
  private wheelAccumulator = 0;
  private baseOffsetForWheel = 0;
  private lastAnnounceIndex = -1;
  announceMessage = '';
  private clonesPerSide = 0;
  private stageIndex = 0;
  private boundWheelHandler: ((ev: WheelEvent) => void) | null = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
  ) {
    this.isBrowser =
      typeof window !== 'undefined' && isPlatformBrowser(this.platformId);
  }

  // Reveal state
  revealActive = false;
  private revealObserver?: IntersectionObserver;
  private revealRatio = 0;
  private revealScaleCurrent = 1;
  private revealFullyVisibleAt: number | null = null;
  private scalingPhaseActive = false;
  private growthStarted = false;
  private lockScrollY: number | null = null;
  private scaledUp = false;

  // Scroll-driven phase state machine
  private _phase: 'idle' | 'scaling' | 'sliding' = 'idle';
  private _scaleTarget = 0.5;
  private _scaleRafId: number | null = null;
  private _isTransitioning = false;
  private _shrinkIntent = 0;
  private _recentEscape: 'up' | 'down' | null = null;
  get revealTransform() {
    if (this.options.revealScrollDriven) {
      return `scale(${this.revealScaleCurrent})`;
    }
    // fallback to class-based behavior (if classes still used elsewhere)
    return this.revealActive
      ? 'scale(1)'
      : `scale(${this.options.revealScaleStart || 0.5})`;
  }

  get viewportTransitionStyle(): string {
    // Disable CSS transition during scroll-driven scaling to prevent
    // overlapping 450ms transitions from restarting every frame (= jitter)
    if (this.options.revealScrollDriven) {
      return 'none';
    }
    return '';
  }

  getTextOpacity(): number {
    // 1. Initial Reveal Fade-in (Global Scale)
    // Map scale from start to end to opacity 0 to 1
    const startScale = this.options.revealScaleStart ?? 0.5;
    const endScale = this.options.revealScaleEnd ?? 1;
    const currentScale = this.revealScaleCurrent;

    // Start fading in when 80% of the way to full scale
    const fadeStartScale = startScale + (endScale - startScale) * 0.8;
    let revealOpacity = 0;

    if (currentScale >= fadeStartScale) {
      const fadeProgress =
        (currentScale - fadeStartScale) / (endScale - fadeStartScale);
      revealOpacity = Math.min(1, Math.max(0, fadeProgress));
    }

    // 2. Scroll-Driven Cross-Fade (Slide Transition)
    // Parse the current transform to get the offset
    const match = /translate3d\((-?\d+(?:\.\d+)?)px/.exec(this.stageTransform);
    const stageOffset = match ? Math.abs(parseFloat(match[1])) : 0;
    const slideWidth = this.itemWidth + this.itemMargin;

    let scrollOpacity = 1;

    if (slideWidth > 0) {
      const fractionalIndex = stageOffset / slideWidth;
      const remainder = fractionalIndex - Math.floor(fractionalIndex);

      // If remainder < 0.5: We are showing current slide. Fade out as we approach 0.5.
      // Opacity goes 1 -> 0 as remainder goes 0 -> 0.5
      if (remainder < 0.5) {
        scrollOpacity = 1 - remainder * 2;
      }
      // If remainder >= 0.5: We are showing next slide. Fade in as we leave 0.5.
      // Opacity goes 0 -> 1 as remainder goes 0.5 -> 1.0
      else {
        scrollOpacity = (remainder - 0.5) * 2;
      }
    }

    // Combine both opacities (multiply them)
    // This ensures text is hidden if carousel hasn't revealed yet,
    // AND fades correctly during scroll.
    return revealOpacity * scrollOpacity;
  }

  getActiveSlide(): OwlCarouselSlide | null {
    if (!this.slides || this.slides.length === 0) {
      return null;
    }

    // Calculate visual index from current transform to switch text at 50%
    const currentOffset = Math.abs(this.getCurrentStageOffset());
    const slideWidth = this.itemWidth + this.itemMargin;

    if (slideWidth <= 0) {
      return this.slides[this.currentIndex] || null;
    }

    const fractionalIndex = currentOffset / slideWidth;
    const visualPhysicalIndex = Math.round(fractionalIndex);

    // Convert physical index to logical index
    let logicalIndex = visualPhysicalIndex - this.clonesPerSide;

    // Normalize for loop
    const count = this.slides.length;
    logicalIndex = ((logicalIndex % count) + count) % count;

    return this.slides[logicalIndex] || null;
  }

  trackByIndex(index: number, item: number): number {
    return item; // Return the currentIndex value to force re-render when it changes
  }

  ngAfterViewInit(): void {
    // Final platform determination (DI fully resolved now)
    this.isBrowser =
      typeof window !== 'undefined' && isPlatformBrowser(this.platformId);
    if (!this.isBrowser) {
      // Server-side render: show initial (start) scale without any browser-only logic
      this.applyDefaultOptions(); // still apply options (will no-op responsive due to guards)
      this.revealScaleCurrent = this.options.revealScaleStart ?? 0.5;
      this.revealActive = true;
      return;
    }
    // Ensure structural directives available if using legacy *ngIf/*ngFor by dynamic import of CommonModule not needed in Angular >=17 if using @if/@for
    this.applyDefaultOptions();
    this.rebuild();
    if (this.options.autoplay) this.startAutoplay();
    if (this.options.revealScrollDriven) {
      requestAnimationFrame(() => {
        this.revealScaleCurrent = this.options.revealScaleStart ?? 0.5;
        this._scaleTarget = this.revealScaleCurrent;
        this._phase = 'idle';
        this.scaledUp = false;
        this.cdr.markForCheck();
      });
    } else if (this.options.revealOnEnter) {
      requestAnimationFrame(() => this.setupReveal());
    } else {
      this.revealActive = true; // immediate
    }

    // CRITICAL: Register wheel listener with { passive: false } so preventDefault() works.
    // Angular @HostListener does NOT support passive: false, and Chrome 73+ defaults
    // window-level wheel listeners to passive, silently ignoring preventDefault().
    this.boundWheelHandler = this.onWheel.bind(this);
    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('wheel', this.boundWheelHandler!, {
        passive: false,
      });
    });
  }

  ngOnDestroy(): void {
    this.stopAutoplay();
    this.releaseScrollLock();
    if (this.boundWheelHandler) {
      window.removeEventListener('wheel', this.boundWheelHandler);
      this.boundWheelHandler = null;
    }
    this._stopScaleAnimation();
  }

  private applyScrollLock() {
    if (!this.isBrowser || typeof document === 'undefined') return;
    // Simple overflow hidden - no position manipulation
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }

  private releaseScrollLock(restorePosition: boolean = true) {
    if (!this.isBrowser || typeof document === 'undefined') return;
    // Just remove overflow lock - no scroll position changes
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  }

  @HostListener('window:resize') onResize() {
    const prevItems = this.getItemsPerView();
    this.updateResponsive();
    const newItems = this.getItemsPerView();
    if (prevItems !== newItems) {
      this.rebuild();
    } else {
      this.computeItemMetrics();
      this.updateStageTransform();
    }
  }

  private applyDefaultOptions() {
    this.options = {
      items: 1,
      loop: true,
      margin: 0,
      autoplay: false,
      autoplayTimeout: 4000,
      autoplayHoverPause: true,
      nav: true,
      dots: true,
      responsive: {},
      transitionSpeed: 400,
      wheelControl: true,
      wheelThreshold: 120,
      keyboard: true,
      progressClickable: true,
      announce: true,
      ariaLabel: 'Image carousel',
      revealOnEnter: true,
      revealScaleStart: 0.5,
      revealDurationMs: 900,
      revealEasing: 'cubic-bezier(.22,.99,.36,1)',
      revealScaleEnd: 1,
      revealScrollDriven: true,
      revealScrollDistance: 300,
      revealVisibilityThreshold: 1,
      revealAutoAfterFull: false,
      ...this.options,
    };
    this.transitionMs = this.options.transitionSpeed || 400;
    this.updateResponsive();
    // Clamp reveal scale
    if (this.options.revealScaleStart && this.options.revealScaleStart <= 0)
      this.options.revealScaleStart = 0.01;
    if (!this.options.revealScaleEnd || this.options.revealScaleEnd < 0)
      this.options.revealScaleEnd = 1;
  }

  private updateResponsive() {
    if (!this.options.responsive) return;
    if (!this.isBrowser || typeof window === 'undefined') return; // SSR guard
    const width = window.innerWidth;
    const sorted = Object.keys(this.options.responsive)
      .map((k) => +k)
      .sort((a, b) => a - b);
    for (const bp of sorted) {
      if (width >= bp) {
        const conf = this.options.responsive[bp];
        if (conf.items) this.options.items = conf.items;
        if (conf.margin != null) this.options.margin = conf.margin;
      }
    }
  }

  @HostListener('window:scroll')
  onWindowScroll() {
    if (!this.isBrowser) return;

    // EXTREME LOCK: Rubber-band snap. If native browser smooth scrolling momentum
    // (from heavy wheel clicks or middle-click drags) ignores `overflow: hidden`,
    // instantly clamp the native scroll back to the strictly locked Y coordinate.
    if (this.lockScrollY !== null) {
      if (Math.abs(window.scrollY - this.lockScrollY) > 2) {
        window.scrollTo({ top: this.lockScrollY, behavior: 'auto' });
      }
      return; // Do not process other fallbacks while firmly locked
    }

    // Fallback trap for rapid native scrolling (e.g., scrollbar drag, middle-click auto-scroll, or extremely fast wheel)
    // Sometimes native scroll skips the wheel loop's engagement window. This guarantees a catch if they land on it.
    if (this._phase === 'idle' && this.lockScrollY === null && this._recentEscape === null) {
      const vp = this.viewportRef?.nativeElement;
      if (!vp) return;
      
      const hostEl = vp.parentElement || vp;
      const hostRect = hostEl.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const elHeight = hostRect.height || 1;
      
      const visiblePx = Math.max(0, Math.min(hostRect.bottom, vh) - Math.max(hostRect.top, 0));
      // Use Math.min(elHeight, vh) so a carousel taller than viewport still logically reaches 100% visible
      const fractionVisible = visiblePx / Math.min(elHeight, vh);

      if (fractionVisible >= 0.85) {
        const centeredOffset = hostRect.top - (vh - elHeight) / 2;
        const targetScrollY = Math.max(0, window.scrollY + centeredOffset);
        this.lockScrollY = targetScrollY;
        window.scrollTo({ top: targetScrollY, behavior: 'auto' });
        
        this._phase = this.scaledUp ? 'sliding' : 'scaling';
        if (this._phase === 'scaling') this._scaleTarget = this.revealScaleCurrent;
        this.applyScrollLock();
      }
    }
  }

  private getItemsPerView(): number {
    return Math.max(1, this.options.items || 1);
  }

  private rebuild() {
    this.stopAutoplay();
    const itemsPerView = this.getItemsPerView();
    this.clonesPerSide = this.options.loop ? itemsPerView : 0;

    // Build clones
    const clonesStart = this.slides.slice(-this.clonesPerSide).map((s, i) => ({
      ...s,
      _clone: true,
      _realIndex: this.slides.length - this.clonesPerSide + i,
    }));
    const clonesEnd = this.slides
      .slice(0, this.clonesPerSide)
      .map((s, i) => ({ ...s, _clone: true, _realIndex: i }));

    this.renderedSlides = [
      ...clonesStart,
      ...this.slides.map((s, i) => ({ ...s, _realIndex: i })),
      ...clonesEnd,
    ];

    this.currentIndex = Math.min(this.currentIndex, this.slides.length - 1);
    this.stageIndex = this.currentIndex + this.clonesPerSide;

    this.computeItemMetrics();
    this.updateStageTransform(false);

    if (this.options.autoplay) this.startAutoplay();
  }

  private computeItemMetrics() {
    const viewportEl = this.viewportRef.nativeElement;
    const itemsPerView = this.getItemsPerView();
    const totalMargin = (this.options.margin || 0) * (itemsPerView - 1);
    this.itemWidth = (viewportEl.clientWidth - totalMargin) / itemsPerView;
    this.itemMargin = this.options.margin || 0;
  }

  private activeAnimation: {
    startTime: number;
    startOffset: number;
    targetOffset: number;
    duration: number;
  } | null = null;

  private getCurrentStageOffset(): number {
    const match = /translate3d\((-?\d+(?:\.\d+)?)px/.exec(this.stageTransform);
    return match ? parseFloat(match[1]) : 0;
  }

  private updateStageTransform(animate = true) {
    const targetOffset = -this.stageIndex * (this.itemWidth + this.itemMargin);

    // Always disable CSS transition since we control it via JS or it's instant
    this.stageTransition = 'transform 0s ease';

    if (!animate) {
      this.activeAnimation = null;
      this.stageTransform = `translate3d(${targetOffset}px,0,0)`;
      this.cdr.markForCheck();
      return;
    }

    // Start JS animation
    const startOffset = this.getCurrentStageOffset();
    this.activeAnimation = {
      startTime: performance.now(),
      startOffset,
      targetOffset,
      duration: this.transitionMs,
    };

    const step = (now: number) => {
      const anim = this.activeAnimation;
      if (!anim) return;

      const elapsed = now - anim.startTime;
      let progress = elapsed / anim.duration;

      if (progress >= 1) {
        progress = 1;
        this.activeAnimation = null;
      }

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current =
        anim.startOffset + (anim.targetOffset - anim.startOffset) * eased;

      this.stageTransform = `translate3d(${current}px,0,0)`;
      this.cdr.markForCheck();

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  }

  private logicalToPhysical(index: number): number {
    return index + this.clonesPerSide;
  }

  next() {
    this.goTo(this.currentIndex + 1);
  }
  prev() {
    this.goTo(this.currentIndex - 1);
  }

  goTo(logicalIndex: number) {
    if (!this.slides.length) return;
    const count = this.slides.length;
    if (this.options.loop) {
      if (logicalIndex < 0) logicalIndex = count - 1;
      if (logicalIndex >= count) logicalIndex = 0;
    } else {
      logicalIndex = Math.max(0, Math.min(count - 1, logicalIndex));
    }
    this.currentIndex = logicalIndex;
    this.stageIndex = this.logicalToPhysical(logicalIndex);
    this.wheelAccumulator = 0;
    this.boundaryPushAccumulator = 0;
    this._shrinkIntent = 0;
    this.updateStageTransform(true);
    this._isTransitioning = true;
    setTimeout(() => (this._isTransitioning = false), this.transitionMs + 40);
    this.queueLoopAdjustment();
    this.updateAnnouncement();
  }

  private queueLoopAdjustment() {
    if (!this.options.loop) return;
    // After transition ends, detect if clone and jump
    setTimeout(() => {
      if (!this.options.loop) return;
      const count = this.slides.length;
      if (this.stageIndex >= count + this.clonesPerSide) {
        this.stageIndex = this.logicalToPhysical(0);
        this.updateStageTransform(false);
      } else if (this.stageIndex < this.clonesPerSide) {
        this.stageIndex = this.logicalToPhysical(count - 1);
        this.updateStageTransform(false);
      }
    }, this.transitionMs + 30);
  }

  // Autoplay methods
  private startAutoplay() {
    if (!this.options.autoplay) return;
    this.stopAutoplay();
    this.autoplayTimer = setInterval(() => {
      this.next();
    }, this.options.autoplayTimeout || 4000);
  }
  private stopAutoplay() {
    if (this.autoplayTimer) {
      clearInterval(this.autoplayTimer);
      this.autoplayTimer = null;
    }
  }
  onMouseEnter() {
    if (this.options.autoplayHoverPause) this.stopAutoplay();
  }
  onMouseLeave() {
    if (this.options.autoplay && this.options.autoplayHoverPause)
      this.startAutoplay();
  }

  // Drag / Pointer
  onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    // Prevent interaction while scaling
    if (!this.scaledUp) return;

    this.pointerActive = true;
    this.hasDragged = false;
    this.dragStartX = e.clientX;
    const match = /translate3d\((-?\d+(?:\.\d+)?)px/.exec(this.stageTransform);
    this.dragStartTransform = match ? parseFloat(match[1]) : 0;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    this.stageTransition = '';
    this.stopAutoplay();
  }
  onPointerMove(e: PointerEvent) {
    if (!this.pointerActive) return;
    const dx = e.clientX - this.dragStartX;
    if (Math.abs(dx) > 3) this.hasDragged = true;
    let next = this.dragStartTransform + dx;
    if (!this.options.loop) {
      const itemsPerView = this.getItemsPerView();
      const total = this.slides.length;
      const maxOffset = 0; // at first slide
      const minOffset =
        -Math.max(0, total - itemsPerView) * (this.itemWidth + this.itemMargin);
      // Apply mild resistance when exceeding boundaries
      if (next > maxOffset) next = maxOffset + (next - maxOffset) * 0.25;
      if (next < minOffset) next = minOffset + (next - minOffset) * 0.25;
    }
    this.stageTransform = `translate3d(${next}px,0,0)`;
  }
  onPointerUp(e: PointerEvent) {
    if (!this.pointerActive) return;
    this.pointerActive = false;
    const dx = e.clientX - this.dragStartX;
    const threshold = (this.itemWidth + this.itemMargin) * 0.3;
    let direction = 0;
    if (dx < -threshold) direction = 1;
    else if (dx > threshold) direction = -1;
    if (direction !== 0) {
      this.goTo(this.currentIndex + direction);
    } else {
      // snap back
      this.updateStageTransform(true);
    }
    if (this.options.autoplay) this.startAutoplay();
  }

  // Global wheel handling: symmetric grow/shrink to/from start scale regardless of cursor hover
  // NOTE: This is now registered manually in ngAfterViewInit with { passive: false }
  // instead of @HostListener, so preventDefault() works in Chrome 73+.
  private onWheel(event: WheelEvent) {
    if (!this.isBrowser) return; // SSR safety
    // Re-enter Angular zone so that state changes trigger change detection
    this.ngZone.run(() => this.handleWheel(event));
  }


  private handleWheel(event: WheelEvent) {
    const vp = this.viewportRef?.nativeElement;
    if (!vp) return;
    const rect = vp.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;

    const startScale = this.options.revealScaleStart ?? 0.5;
    const endScale = this.options.revealScaleEnd ?? 1;
    const count = this.slides.length;
    const epsilon = 0.002;

    if (!this.options.wheelControl || !count) return;

    // ── Raw delta with line-mode normalization ──
    let delta = event.deltaY;
    if (event.deltaMode === 1) delta *= 16; // line mode → pixels

    // ── Detect input device ──
    // Mouse wheels: deltaMode 1 (Firefox lines) or large pixel values (Chrome 100-120)
    // Touchpads: deltaMode 0 with small continuous values (1-40)
    const isMouse =
      event.deltaMode === 1 ||
      (event.deltaMode === 0 && Math.abs(event.deltaY) >= 100);

    // ── Visibility calculation (use HOST element, not scaled viewport) ──
    // The viewport div is scaled (e.g. 0.5×), making it report ~50vh height.
    // The host <owl-carousel> element has h-full with NO scale, so its rect
    // represents the actual section area that must fill the viewport.
    const hostEl = vp.parentElement || vp;
    const hostRect = hostEl.getBoundingClientRect();
    const elHeight = hostRect.height || 1;
    const visiblePx = Math.max(
      0,
      Math.min(hostRect.bottom, vh) - Math.max(hostRect.top, 0),
    );
    // Use Math.min(elHeight, vh) so a carousel taller than the screen can mathematically reach 1.0 (100%) visible
    const fractionVisible = visiblePx / Math.min(elHeight, vh);
    const isLocked = this.lockScrollY !== null;

    // Reset escape state if user leaves element entirely or reverses direction
    if (fractionVisible < 0.1) this._recentEscape = null;
    if (delta > 0 && this._recentEscape === 'up') this._recentEscape = null;
    if (delta < 0 && this._recentEscape === 'down') this._recentEscape = null;

    // ══════════════════════════════════════════
    // PHASE: IDLE — check whether to engage
    // ══════════════════════════════════════════
    if (this._phase === 'idle') {
      const visThreshold = isMouse ? 0.85 : 0.95;

      // Predict if this specific wheel event's momentum will push the carousel over the threshold.
      // We must `preventDefault` BEFORE the browser initiates native smooth scrolling,
      // because native smooth scrolling ignores `overflow: hidden` locks midway through the animation.
      // We assume a standard mouse notch travels at least 150px to ensure we catch violent flicks.
      const estimatedDelta = isMouse ? (Math.abs(delta) < 120 ? Math.sign(delta) * 150 : delta) : delta;
      const futureTop = hostRect.top - estimatedDelta;
      const futureBottom = hostRect.bottom - estimatedDelta;
      const futureVisiblePx = Math.max(0, Math.min(futureBottom, vh) - Math.max(futureTop, 0));
      const futureFraction = futureVisiblePx / Math.min(elHeight, vh);

      // Unconditional escape priority if recently broke the lock
      if (delta > 0 && this._recentEscape === 'down') return;
      if (delta < 0 && this._recentEscape === 'up') return;

      // Only allow the native scroll if the future position STILL won't cross our lock bounds!
      if (fractionVisible < visThreshold && futureFraction < visThreshold && !isLocked) {
        return; 
      }

      const centeredOffset = hostRect.top - (vh - elHeight) / 2;

      const alignPerfectly = () => {
        // Calculate the exact target pixel to perfectly center the carousel inside the frame.
        // This ensures not a single pixel is misaligned.
        const targetScrollY = Math.max(0, window.scrollY + centeredOffset);
        this.lockScrollY = targetScrollY;
        window.scrollTo({ top: targetScrollY, behavior: 'auto' });
      };

      if (delta > 0 && this.revealScaleCurrent < endScale - epsilon) {
        // Scrolling down into unscaled carousel → start growing
        event.preventDefault();
        this._phase = 'scaling';
        this._scaleTarget = this.revealScaleCurrent;
        alignPerfectly();
        this.applyScrollLock();
        // Fall through to scaling handler
      } else if (
        this.scaledUp &&
        this.revealScaleCurrent >= endScale - epsilon
      ) {
        // Re-engage at full scale (scrolled back into carousel from either direction)
        event.preventDefault();
        this._phase = 'sliding';
        alignPerfectly();
        this.applyScrollLock();
        // Fall through to sliding handler
      } else {
        return; // allow normal page scroll
      }
    }

    // ══════════════════════════════════════════
    // PHASE: SCALING (growing or shrinking)
    // ══════════════════════════════════════════
    if (this._phase === 'scaling') {
      event.preventDefault();

      const distance = (this.options.revealScrollDistance || 500) * 1.2;
      const totalSpan = endScale - startScale;

      if (isMouse) {
        // Fixed scale increment per mouse notch: ~14% of total span
        // This gives ~7 notches for full growth (0.5 → 1.0), animated smoothly
        const fixedStep = totalSpan * 0.14 * Math.sign(delta);
        this._scaleTarget += fixedStep;
      } else {
        // Touchpad: proportional to delta magnitude (many small events)
        const increment = (delta / distance) * totalSpan;
        this._scaleTarget += increment;
      }

      this._scaleTarget = Math.max(
        startScale,
        Math.min(endScale, this._scaleTarget),
      );

      if (isMouse) {
        // Mouse: use lerp animation for smooth interpolation between discrete notches
        this._startScaleAnimation();
      } else {
        // Touchpad: apply directly (events are continuous, no lerp needed)
        this._stopScaleAnimation();
        this.revealScaleCurrent = this._scaleTarget;
        this.cdr.markForCheck();
        this._checkScalePhaseTransition();
      }

      // If shrunk all the way down → release to normal page scroll
      if (
        delta < 0 &&
        this._scaleTarget <= startScale + epsilon
      ) {
        this._stopScaleAnimation();
        this.revealScaleCurrent = startScale;
        this._scaleTarget = startScale;
        this.scaledUp = false;
        this._phase = 'idle';
        this._recentEscape = 'up';
        this.releaseScrollLock(false);
        this.lockScrollY = null;
        this.cdr.markForCheck();
      }

      return;
    }

    // ══════════════════════════════════════════
    // PHASE: SLIDING (navigating between slides)
    // ══════════════════════════════════════════
    if (this._phase === 'sliding') {
      const atFirst = this.currentIndex === 0;
      const atLast = this.currentIndex === count - 1;
      const scrollingForward = delta > 0;

      // ── Boundary escape: last slide + forward ──
      // Escape immediately when at the last image, as requested, to smoothly continue page scroll downwards
      if (atLast && scrollingForward) {
        this._recentEscape = 'down';
        this._phase = 'idle';
        this.releaseScrollLock(false);
        this.lockScrollY = null;
        this.boundaryPushAccumulator = 0;
        return; // DON'T preventDefault → allow page scroll to continue
      }

      if (!scrollingForward) {
        this.boundaryPushAccumulator = 0;
      }

      // ── Shrink entry: first slide + scrolling up ──
      if (atFirst && !scrollingForward) {
        this._shrinkIntent += Math.abs(delta);
        const shrinkThreshold = isMouse ? 40 : 15;
        if (this._shrinkIntent >= shrinkThreshold) {
          event.preventDefault();
          // Reset slide state cleanly
          this.wheelAccumulator = 0;
          this.activeAnimation = null;
          this.updateStageTransform(false);
          // Transition to scaling (shrink direction)
          this._phase = 'scaling';
          this._scaleTarget = endScale;
          this._shrinkIntent = 0;
          // Apply initial shrink step
          const distance = (this.options.revealScrollDistance || 500) * 1.2;
          const totalSpan = endScale - startScale;
          if (isMouse) {
            this._scaleTarget -= totalSpan * 0.14;
          } else {
            this._scaleTarget += (delta / distance) * totalSpan;
          }
          this._scaleTarget = Math.max(
            startScale,
            Math.min(endScale, this._scaleTarget),
          );
          if (isMouse) {
            this._startScaleAnimation();
          } else {
            this.revealScaleCurrent = this._scaleTarget;
            this.cdr.markForCheck();
            this._checkScalePhaseTransition();
          }
          return;
        }
        event.preventDefault();
        return; // absorb while building shrink intent
      }
      this._shrinkIntent = 0;

      // ── Prevent default for all other sliding interactions ──
      event.preventDefault();

      // Don't navigate while a slide transition is animating
      if (this._isTransitioning) return;
      if (this.pointerActive) return;

      // ── Slide navigation ──
      if (isMouse) {
        // Mouse: one notch = one clean animated slide transition
        if (scrollingForward) {
          this.goTo(this.currentIndex + 1);
        } else {
          this.goTo(this.currentIndex - 1);
        }
      } else {
        // Touchpad: accumulator with smooth partial slide preview
        const threshold = this.options.wheelThreshold || 120;
        const slideSpan = this.itemWidth + this.itemMargin;

        // Direction reversal → reset accumulator
        if (
          (this.wheelAccumulator > 0 && delta < 0) ||
          (this.wheelAccumulator < 0 && delta > 0)
        ) {
          this.wheelAccumulator = 0;
          this.baseOffsetForWheel = this.getCurrentStageOffset();
        }

        if (this.wheelAccumulator === 0) {
          this.baseOffsetForWheel = this.getCurrentStageOffset();
        }

        // Cancel any in-flight JS animation so it doesn't fight positioning
        this.activeAnimation = null;

        this.wheelAccumulator += delta;
        const clamped = Math.max(
          -threshold,
          Math.min(threshold, this.wheelAccumulator),
        );
        const fraction = clamped / threshold;

        if (Math.abs(fraction) < 1) {
          const offset = this.baseOffsetForWheel - fraction * slideSpan;
          this.stageTransition = 'none';
          this.stageTransform = `translate3d(${offset}px,0,0)`;
          this.cdr.markForCheck();
        }

        if (clamped >= threshold) {
          this.goTo(this.currentIndex + 1);
          this.wheelAccumulator = 0;
        } else if (clamped <= -threshold) {
          this.goTo(this.currentIndex - 1);
          this.wheelAccumulator = 0;
        }
      }
    }
  }

  // ── Scale animation helpers (smooth lerp for mouse wheel) ──

  private _startScaleAnimation() {
    if (this._scaleRafId !== null) return; // already running

    const tick = () => {
      const diff = this._scaleTarget - this.revealScaleCurrent;

      if (Math.abs(diff) < 0.002) {
        // Close enough — snap to target and stop
        this.revealScaleCurrent = this._scaleTarget;
        this._scaleRafId = null;
        this.cdr.markForCheck();
        this._checkScalePhaseTransition();
        return;
      }

      // Lerp rate 0.18: smooth enough for mouse, fast enough overall
      this.revealScaleCurrent += diff * 0.18;
      this.cdr.markForCheck();
      this._scaleRafId = requestAnimationFrame(tick);
    };

    this._scaleRafId = requestAnimationFrame(tick);
  }

  private _checkScalePhaseTransition() {
    const startScale = this.options.revealScaleStart ?? 0.5;
    const endScale = this.options.revealScaleEnd ?? 1;
    const epsilon = 0.003;

    if (
      this._phase === 'scaling' &&
      this.revealScaleCurrent >= endScale - epsilon
    ) {
      this.revealScaleCurrent = endScale;
      this._scaleTarget = endScale;
      this.scaledUp = true;
      this._phase = 'sliding';
      if (this.lockScrollY == null) {
        this.lockScrollY = window.scrollY;
        this.applyScrollLock();
      }
      this.cdr.markForCheck();
    } else if (
      this._phase === 'scaling' &&
      this.revealScaleCurrent <= startScale + epsilon
    ) {
      this.revealScaleCurrent = startScale;
      this._scaleTarget = startScale;
      this.scaledUp = false;
      this._phase = 'idle';
      this.releaseScrollLock(false);
      this.lockScrollY = null;
      this.cdr.markForCheck();
    }
  }

  private _stopScaleAnimation() {
    if (this._scaleRafId !== null) {
      cancelAnimationFrame(this._scaleRafId);
      this._scaleRafId = null;
    }
  }

  // Keyboard navigation
  onKeyDown(ev: KeyboardEvent) {
    if (!this.options.keyboard) return;
    switch (ev.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        ev.preventDefault();
        this.goTo(this.currentIndex + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        ev.preventDefault();
        this.goTo(this.currentIndex - 1);
        break;
      case 'Home':
        ev.preventDefault();
        this.goTo(0);
        break;
      case 'End':
        ev.preventDefault();
        this.goTo(this.slides.length - 1);
        break;
    }
  }

  // Clickable progress track
  onProgressClick(ev: MouseEvent) {
    if (!this.options.progressClickable || !this.slides.length) return;
    const track = ev.currentTarget as HTMLElement;
    const rect = track.getBoundingClientRect();
    const ratio = (ev.clientX - rect.left) / rect.width;
    const target = Math.round(ratio * (this.slides.length - 1));
    this.goTo(target);
  }

  private updateAnnouncement() {
    if (!this.options.announce) return;
    if (this.currentIndex === this.lastAnnounceIndex) return;
    this.lastAnnounceIndex = this.currentIndex;
    const slide = this.slides[this.currentIndex];
    const labelParts: string[] = [];
    labelParts.push(`Slide ${this.currentIndex + 1} of ${this.slides.length}`);
    if (slide?.title) labelParts.push(slide.title);
    if (slide?.subtitle) labelParts.push(slide.subtitle);
    this.announceMessage = labelParts.join(' – ');
  }

  // Reveal on first intersection
  private setupReveal() {
    try {
      const vp = this.viewportRef?.nativeElement;
      if (!vp) {
        this.revealActive = true;
        return;
      }
      // Set CSS custom properties for animation parameters
      vp.style.setProperty(
        '--reveal-scale-start',
        String(this.options.revealScaleStart || 0.7),
      );
      vp.style.setProperty(
        '--reveal-duration',
        `${this.options.revealDurationMs || 900}ms`,
      );
      vp.style.setProperty(
        '--reveal-easing',
        this.options.revealEasing || 'cubic-bezier(.22,.99,.36,1)',
      );
      if (typeof IntersectionObserver === 'undefined') {
        this.revealActive = true;
        return;
      }
      this.revealObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              // Wait a frame to ensure initial class applied
              requestAnimationFrame(() => {
                this.revealActive = true;
                this.cdr.markForCheck();
              });
              this.revealObserver?.disconnect();
              break;
            }
          }
        },
        { threshold: 0.35 },
      );
      this.revealObserver.observe(vp);
    } catch {
      this.revealActive = true;
    }
  }

  // Scroll-driven reveal scaling using intersection ratio
  private updateRevealGrowth() {
    if (!this.scalingPhaseActive) return;
    const vp = this.viewportRef?.nativeElement;
    if (!vp) return;
    const rect = vp.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const elHeight = rect.height || 1;
    // Fraction of element visible
    const visible = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
    let fractionVisible = visible / elHeight;
    if (rect.bottom < 0 || rect.top > vh) fractionVisible = 0;
    fractionVisible = Math.max(0, Math.min(1, fractionVisible));

    const fitsViewport = elHeight <= vh;
    const fullyVisible = fitsViewport
      ? rect.top >= 0 && rect.bottom <= vh
      : fractionVisible >= (this.options.revealVisibilityThreshold || 0.85);

    // If element larger than viewport we accept threshold fraction instead of strict full visibility.
    if (!this.growthStarted) {
      if (fullyVisible) {
        this.growthStarted = true;
        if (this.options.revealAutoAfterFull) {
          this.startAutoFullGrowth();
          return; // auto animation handles it
        } else {
          this.revealFullyVisibleAt = window.scrollY;
        }
      } else {
        return; // still waiting to be fully visible / threshold reached
      }
    }

    if (this.options.revealAutoAfterFull) return; // auto path handled separately
    if (this.revealFullyVisibleAt == null) return; // scroll-driven path needs anchor
    const distance = this.options.revealScrollDistance || 500;
    const delta = window.scrollY - this.revealFullyVisibleAt;
    let progress = delta / distance;
    if (progress < 0) progress = 0;
    if (progress >= 1) {
      progress = 1;
      this.scalingPhaseActive = false; // enabling wheel slide control after this frame
    }
    const start = this.options.revealScaleStart ?? 0.5;
    const end = this.options.revealScaleEnd ?? 1;
    const eased = this.easeOutCubic(progress);
    const targetScale = start + (end - start) * eased;
    if (Math.abs(targetScale - this.revealScaleCurrent) > 0.0005) {
      this.revealScaleCurrent = targetScale;
      this.cdr.markForCheck();
    }
  }

  private startAutoFullGrowth() {
    const startScale = this.revealScaleCurrent;
    const endScale = this.options.revealScaleEnd ?? 1;
    const duration = this.options.revealDurationMs || 900;
    const startTime = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3); // reuse easeOutCubic
    const step = (now: number) => {
      const elapsed = now - startTime;
      let p = elapsed / duration;
      if (p > 1) p = 1;
      const eased = ease(p);
      this.revealScaleCurrent = startScale + (endScale - startScale) * eased;
      this.cdr.markForCheck();
      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        this.scalingPhaseActive = false; // enable wheel control
        // Mark as fully scaled so shrink logic (when attempting to go above first slide) can engage
        this.scaledUp = true;
      }
    };
    requestAnimationFrame(step);
  }

  private easeOutCubic(t: number) {
    return 1 - Math.pow(1 - t, 3);
  }
}
