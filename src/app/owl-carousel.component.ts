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
        <span class="text-xl sm:text-2xl md:text-3xl" *ngIf="getActiveSlide()?.title">{{ getActiveSlide()?.title }}</span>
        <span class="text-4xl sm:text-6xl md:text-7xl font-normal italic text-center px-4" *ngIf="getActiveSlide()?.subtitle">{{
          getActiveSlide()?.subtitle
        }}</span>
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

  @ViewChild('viewport', { static: true }) viewportRef!: ElementRef<HTMLElement>;
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
  private wheelAnimating = false;
  private baseOffsetForWheel = 0;
  private lastAnnounceIndex = -1;
  announceMessage = '';
  private clonesPerSide = 0;
  private stageIndex = 0;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef
  ) {
    this.isBrowser =
      typeof window !== 'undefined' && isPlatformBrowser(this.platformId);
  }

  // Reveal state
  revealActive = false; // becomes true once revealed
  private revealObserver?: IntersectionObserver;
  private revealRatio = 0; // (legacy) intersection ratio
  private revealScaleCurrent = 1;
  private revealFullyVisibleAt: number | null = null; // scrollY when became fully visible
  private scalingPhaseActive = false; // true while growing from start scale to end scale
  private growthStarted = false; // anchor established and growth active
  private lockScrollY: number | null = null; // capture page scroll when locking
  private scaledUp = false; // reached full scale once
  get revealTransform() {
    if (this.options.revealScrollDriven) {
      return `scale(${this.revealScaleCurrent})`;
    }
    // fallback to class-based behavior (if classes still used elsewhere)
    return this.revealActive
      ? 'scale(1)'
      : `scale(${this.options.revealScaleStart || 0.5})`;
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
       const fadeProgress = (currentScale - fadeStartScale) / (endScale - fadeStartScale);
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
        scrollOpacity = 1 - (remainder * 2);
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
    logicalIndex = (logicalIndex % count + count) % count;
    
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
      // Initialize scaling phase (start at configured start scale)
      requestAnimationFrame(() => {
        this.revealScaleCurrent = this.options.revealScaleStart ?? 0.5;
        this.scalingPhaseActive = true;
        this.cdr.markForCheck();
        // First evaluation in case it's already fully visible
        this.updateRevealGrowth();
      });
    } else if (this.options.revealOnEnter) {
      requestAnimationFrame(() => this.setupReveal());
    } else {
      this.revealActive = true; // immediate
    }
  }

  ngOnDestroy(): void {
    this.stopAutoplay();
    this.releaseScrollLock();
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
      wheelThreshold: 280,
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
      revealScrollDistance: 500,
      revealVisibilityThreshold: 1,
      revealAutoAfterFull: true,
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

    // Check if carousel left viewport and should release lock
    if (this.lockScrollY !== null && this.scaledUp) {
      const vp = this.viewportRef?.nativeElement;
      if (vp) {
        const rect = vp.getBoundingClientRect();
        const vh = window.innerHeight || document.documentElement.clientHeight;
        const fullyVisible = rect.top >= 0 && rect.bottom <= vh;

        // Release lock if carousel is no longer fully visible
        if (!fullyVisible) {
          this.lockScrollY = null;
          this.releaseScrollLock();
        }
      }
    }

    if (this.options.revealScrollDriven) this.updateRevealGrowth();
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
      duration: this.transitionMs
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
      const current = anim.startOffset + (anim.targetOffset - anim.startOffset) * eased;
      
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
    this.wheelAccumulator = 0; // reset wheel progression
    this.boundaryPushAccumulator = 0; // reset boundary push
    this.updateStageTransform(true);
    this.wheelAnimating = true;
    setTimeout(() => (this.wheelAnimating = false), this.transitionMs + 40);
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
  @HostListener('window:wheel', ['$event'])
  onWheel(event: WheelEvent) {
    if (!this.isBrowser) return; // SSR safety
    const vp = this.viewportRef?.nativeElement;
    let fullyVisible = false;
    if (vp) {
      const rect = vp.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      fullyVisible = rect.top >= 0 && rect.bottom <= vh;
    }
    const delta = event.deltaY;
    const startScale = this.options.revealScaleStart ?? 0.5;
    const endScale = this.options.revealScaleEnd ?? 1;
    const distance = this.options.revealScrollDistance || 500;
    const epsilon = 0.0001;
    const count = this.slides.length;
    const atFirst = this.currentIndex === 0;

    if (!this.options.wheelControl || !count) return;
    if (!fullyVisible) {
      // Release any lock if leaving full visibility
      this.lockScrollY = null;
      this.releaseScrollLock();
      this.boundaryPushAccumulator = 0;
      return; // allow normal page scroll
    }
    // LINEAR progress approach for consistent feel both directions
    const totalSpan = endScale - startScale;
    const currentProgress = (this.revealScaleCurrent - startScale) / totalSpan; // 0..1

    // Shrink only if at first slide, scaledUp and scrolling up
    if (
      atFirst &&
      this.scaledUp &&
      delta < 0 &&
      this.revealScaleCurrent > startScale + epsilon
    ) {
      if (this.lockScrollY == null) {
        this.lockScrollY = window.scrollY;
        this.applyScrollLock();
      }
      event.preventDefault();
      // Don't enforce position during shrink phase - let it stay where it is
      const deltaProgress = Math.abs(delta) / distance; // linear
      let newProgress = currentProgress - deltaProgress;
      if (newProgress < 0) newProgress = 0;
      this.revealScaleCurrent = startScale + totalSpan * newProgress;
      if (newProgress <= 0 + epsilon) {
        this.revealScaleCurrent = startScale;
        this.scaledUp = false;
        // release lock so further upward scroll scrolls page
        this.releaseScrollLock(false); // Don't restore position, let scroll continue naturally
        this.lockScrollY = null;
      }
      this.cdr.markForCheck();
      return;
    }

    // If not fully scaled (initial entrance or after shrink) grow BEFORE slide navigation
    if (!this.scaledUp) {
      if (delta > 0 && this.revealScaleCurrent < endScale - epsilon) {
        if (this.lockScrollY == null) {
          this.lockScrollY = window.scrollY;
          this.applyScrollLock();
        }
        event.preventDefault();
        // Don't enforce position during grow phase - let it stay where it is
        const deltaProgress = Math.abs(delta) / distance;
        let newProgress = currentProgress + deltaProgress;
        if (newProgress > 1) newProgress = 1;
        this.revealScaleCurrent = startScale + totalSpan * newProgress;
        if (newProgress >= 1 - epsilon) {
          this.revealScaleCurrent = endScale;
          this.scaledUp = true;
        }
        this.cdr.markForCheck();
      }
      return; // while not scaledUp, never move slides
    }

    // At this point: fully scaledUp - prevent vertical scrolling while navigating carousel
    if (this.pointerActive) return;

    // Check if at boundaries (for non-looping carousels)
    const atLast = this.currentIndex === count - 1;
    // atFirst already declared above
    const tryingToGoForward = delta > 0;

    // ONLY allow escape if at the LAST slide and scrolling forward
    if (!this.options.loop && atLast && tryingToGoForward) {
      // At last slide, scrolling down -> release lock and allow page scroll to continue
      this.releaseScrollLock(false); // Don't restore position, let scroll continue naturally
      this.lockScrollY = null;
      this.boundaryPushAccumulator = 0;
      return; // don't preventDefault, allow vertical scroll past carousel
    }

    // For looping carousels: allow escape after persistent forward scrolling
    if (this.options.loop && tryingToGoForward) {
      this.boundaryPushAccumulator += Math.abs(delta);
      const loopEscapeThreshold = 1200; // need more persistent scrolling to escape loop
      if (this.boundaryPushAccumulator >= loopEscapeThreshold) {
        this.releaseScrollLock(false); // Don't restore position, let scroll continue naturally
        this.lockScrollY = null;
        this.boundaryPushAccumulator = 0;
        return; // allow vertical scroll past carousel
      }
    } else if (!tryingToGoForward) {
      // Reset accumulator when scrolling backward
      this.boundaryPushAccumulator = 0;
    }

    // For all other cases: maintain scroll lock and prevent vertical scrolling
    if (this.lockScrollY == null) {
      this.lockScrollY = window.scrollY;
      this.applyScrollLock();
    }
    event.preventDefault();
    // No need to enforce position - position: fixed on body prevents scrolling
    if (this.wheelAnimating) return; // keep lock but ignore until animation done

    const threshold = this.options.wheelThreshold || 280;
    const slideSpan = this.itemWidth + this.itemMargin;
    this.baseOffsetForWheel = -this.stageIndex * slideSpan;

    // Process slide navigation
    this.wheelAccumulator += delta;
    const clamped = Math.max(
      -threshold,
      Math.min(threshold, this.wheelAccumulator)
    );
    const fraction = clamped / threshold;
    if (Math.abs(fraction) < 1) {
      const offset = this.baseOffsetForWheel - fraction * slideSpan;
      this.stageTransition = '';
      this.stageTransform = `translate3d(${offset}px,0,0)`;
    }
    if (clamped >= threshold) {
      this.goTo(this.currentIndex + 1);
      this.wheelAccumulator = 0;
    } else if (clamped <= -threshold) {
      this.goTo(this.currentIndex - 1);
      this.wheelAccumulator = 0;
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
        String(this.options.revealScaleStart || 0.7)
      );
      vp.style.setProperty(
        '--reveal-duration',
        `${this.options.revealDurationMs || 900}ms`
      );
      vp.style.setProperty(
        '--reveal-easing',
        this.options.revealEasing || 'cubic-bezier(.22,.99,.36,1)'
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
        { threshold: 0.35 }
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
