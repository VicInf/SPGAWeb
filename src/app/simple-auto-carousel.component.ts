import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  Input,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  OnInit,
  Inject,
  PLATFORM_ID,
} from '@angular/core';

export interface SimpleAutoCarouselSlide {
  src: string;
  alt?: string;
  title?: string;
  subtitle?: string;
}

export interface SimpleAutoCarouselOptions {
  items?: number; // items visible per view
  margin?: number; // px gap
  autoplay?: boolean;
  autoplayInterval?: number; // ms between moves
  transitionMs?: number; // slide animation duration
  pauseOnHover?: boolean;
  loop?: boolean;
  responsive?: { [minWidth: number]: { items?: number; margin?: number } };
  continuous?: boolean; // if true, ignore discrete next() and scroll smoothly
  speedPxPerSec?: number; // speed for continuous mode
}

@Component({
  selector: 'simple-auto-carousel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="sac-viewport"
      #viewport
      (mouseenter)="onEnter()"
      (mouseleave)="onLeave()"
    >
      <div
        class="sac-track"
        #track
        [style.transform]="trackTransform"
        [style.transition]="trackTransition"
      >
        <div
          class="sac-item"
          *ngFor="let slide of rendered; let i = index"
          [style.width.px]="itemWidth"
          [style.marginRight.px]="itemMargin"
          [attr.data-index]="i"
        >
          <img
            [src]="slide.src"
            [alt]="slide.alt || 'Slide ' + (i + 1)"
            draggable="false"
          />
          <div class="sac-caption" *ngIf="slide.title || slide.subtitle">
            <span class="sac-title" *ngIf="slide.title">{{ slide.title }}</span>
            <span class="sac-subtitle" *ngIf="slide.subtitle">{{
              slide.subtitle
            }}</span>
          </div>
        </div>
      </div>
    </div>
    <div class="sac-nav" aria-label="Carousel navigation">
      <button
        type="button"
        class="sac-nav-btn"
        (click)="onPrevClick()"
        [attr.aria-label]="'Previous slide'"
      >
        &lt;
      </button>
      <span class="sac-counter" aria-live="polite">
        {{ displayIndex }}/{{ slides.length || 0 }}
      </span>
      <button
        type="button"
        class="sac-nav-btn"
        (click)="onNextClick()"
        [attr.aria-label]="'Next slide'"
      >
        &gt;
      </button>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      .sac-viewport {
        position: relative;
        overflow: hidden;
        width: 100%;
      }
      .sac-track {
        display: flex;
        will-change: transform;
      }
      .sac-item {
        position: relative;
        flex: 0 0 auto;
        user-select: none;
        height: 50vh;
      }
      .sac-item img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .sac-caption {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #fff;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
        pointer-events: none;
      }
      .sac-title {
        font-size: 1rem;
        letter-spacing: 0.5px;
      }
      .sac-subtitle {
        font-size: 2rem;
        font-weight: 600;
      }
      .sac-nav {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin-top: 2rem;
        font-family: inherit;
        user-select: none;
      }
      .sac-nav-btn {
        width: 44px;
        height: 44px;
        border: 1px solid #000;

        color: #000;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 1.1rem;
        line-height: 1;
        padding: 0;
        transition: background 0.2s ease, color 0.2s ease;
      }
      .sac-nav-btn:hover:not(:disabled) {
        background: #000;
        color: #fff;
      }
      .sac-nav-btn:disabled {
        opacity: 0.4;
        cursor: default;
      }
      .sac-counter {
        min-width: 72px;
        text-align: center;
        font-size: 0.95rem;
        font-weight: 500;
        letter-spacing: 0.5px;
      }
    `,
  ],
})
export class SimpleAutoCarouselComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  @Input() slides: SimpleAutoCarouselSlide[] = [];
  @Input() options: SimpleAutoCarouselOptions = {} as SimpleAutoCarouselOptions;

  @ViewChild('viewport', { static: true })
  viewportRef!: ElementRef<HTMLDivElement>;
  @ViewChild('track', { static: true }) trackRef!: ElementRef<HTMLDivElement>;

  private isBrowser = false;
  private autoplayTimer: any = null;
  private transitionMs = 600;
  private currentIndex = 0;
  private clonesPerSide = 0;
  private rafId: number | null = null;
  private lastTs = 0;
  private offsetX = 0; // raw offset for continuous mode
  private trackCycleWidth = 0; // width of one logical sequence (slides only)
  private paused = false;
  private viewportWidth = 0; // cached viewport width for center calculations

  rendered: SimpleAutoCarouselSlide[] = [];
  itemWidth = 0;
  itemMargin = 0;
  trackTransform = 'translate3d(0,0,0)';
  trackTransition = '';

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser =
      typeof window !== 'undefined' && isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    // Only apply option defaults here; defer DOM-dependent build until AfterViewInit.
    this.applyDefaults();
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) {
      // Server: skip measurements (DOM not available); rendered static with defaults.
      return;
    }
    window.addEventListener('resize', this.onResize);
    // Defer build so layout stabilizes and prevents ExpressionChanged errors.
    requestAnimationFrame(() => {
      this.build();
      if (this.options.autoplay && !this.options.continuous)
        this.startAutoplay();
    });
  }

  ngOnDestroy(): void {
    this.stopAutoplay();
    if (this.isBrowser) window.removeEventListener('resize', this.onResize);
  }

  private applyDefaults() {
    this.options = {
      items: 3,
      margin: 16,
      autoplay: true,
      autoplayInterval: 4000,
      transitionMs: 600,
      pauseOnHover: true,
      loop: true,
      responsive: {},
      continuous: false,
      speedPxPerSec: 40,
      ...this.options,
    };
    this.transitionMs = this.options.transitionMs || 600;
    this.updateResponsive();
  }

  private updateResponsive() {
    if (!this.isBrowser) return;
    const width = window.innerWidth;
    const responsive = this.options.responsive || {};
    const points = Object.keys(responsive)
      .map((k) => +k)
      .sort((a, b) => a - b);
    for (const bp of points) {
      if (width >= bp) {
        const conf = responsive[bp];
        if (conf.items) this.options.items = conf.items;
        if (conf.margin != null) this.options.margin = conf.margin;
      }
    }
  }

  private build() {
    this.clonesPerSide = this.options.loop ? this.options.items || 1 : 0;
    if (this.options.continuous) {
      // For continuous marquee, just duplicate the full sequence to allow seamless wrap.
      this.rendered = [...this.slides, ...this.slides];
    } else {
      const startClones = this.slides.slice(-this.clonesPerSide);
      const endClones = this.slides.slice(0, this.clonesPerSide);
      this.rendered = [...startClones, ...this.slides, ...endClones];
    }
    this.currentIndex = 0;
    // Compute metrics only in browser; SSR safe guard inside computeMetrics
    this.computeMetrics();
    this.updateTransform(false);
    if (this.options.continuous) this.startContinuous();
  }

  private computeMetrics() {
    if (!this.isBrowser) {
      this.itemWidth = 0;
      this.itemMargin = Number.isFinite(this.options.margin)
        ? (this.options.margin as number)
        : 0;
      this.viewportWidth = 0;
      return;
    }
    const vp = this.viewportRef?.nativeElement as any;
    if (!vp || typeof vp.getBoundingClientRect !== 'function') {
      // Defer until next frame if element not ready
      requestAnimationFrame(() => this.computeMetrics());
      return;
    }
    const rect = vp.getBoundingClientRect();
    const rawWidth = vp.clientWidth || rect.width || 0;
    this.viewportWidth = rawWidth;
    const items = Math.max(1, this.options.items || 1);
    const margin = Number.isFinite(this.options.margin)
      ? (this.options.margin as number)
      : 0;
    const totalMargin = margin * (items - 1);
    // Guard against division by zero creating NaN
    this.itemWidth = items > 0 ? (rawWidth - totalMargin) / items : rawWidth;
    if (!Number.isFinite(this.itemWidth) || this.itemWidth <= 0) {
      // Fallback: evenly sized items defaulting to rawWidth if layout not ready yet
      this.itemWidth = rawWidth / items || 0;
    }
    this.itemMargin = margin;
    if (this.options.continuous) {
      // width of one logical sequence (only original slides, excluding duplicate)
      this.trackCycleWidth =
        this.slides.length * (this.itemWidth + this.itemMargin);
    }
  }

  private updateTransform(animate = true) {
    if (this.options.continuous) {
      // In continuous mode we set transform via RAF; skip discrete logic.
      return;
    }
    const physicalIndex = this.currentIndex + this.clonesPerSide;
    const step = this.itemWidth + this.itemMargin || 0;
    let offset = -physicalIndex * step;
    if (!Number.isFinite(offset)) offset = 0; // guard against NaN producing ExpressionChanged errors
    this.trackTransition = animate
      ? `transform ${this.transitionMs}ms ease`
      : '';
    this.trackTransform = `translate3d(${offset}px,0,0)`;
    if (animate && this.options.loop) {
      setTimeout(() => {
        const count = this.slides.length;
        if (this.currentIndex >= count) {
          this.currentIndex = 0;
          this.trackTransition = '';
          this.updateTransform(false);
        } else if (this.currentIndex < 0) {
          this.currentIndex = count - 1;
          this.trackTransition = '';
          this.updateTransform(false);
        }
      }, this.transitionMs + 30);
    }
  }

  private next() {
    if (this.options.continuous) return; // ignore discrete advance
    this.currentIndex++;
    this.updateTransform(true);
  }

  private startAutoplay() {
    this.stopAutoplay();
    if (!this.options.autoplay) return;
    if (this.options.continuous) return; // continuous handled by RAF
    this.autoplayTimer = setInterval(
      () => this.next(),
      this.options.autoplayInterval || 4000
    );
  }

  private stopAutoplay() {
    if (this.autoplayTimer) {
      clearInterval(this.autoplayTimer);
      this.autoplayTimer = null;
    }
  }

  onEnter() {
    // Hover should no longer pause in continuous mode per new requirement.
    if (this.options.pauseOnHover && !this.options.continuous) {
      this.stopAutoplay();
    }
  }
  onLeave() {
    if (
      this.options.pauseOnHover &&
      this.options.autoplay &&
      !this.options.continuous
    )
      this.startAutoplay();
  }

  private onResize = () => {
    const prevItems = this.options.items;
    this.updateResponsive();
    if (prevItems !== this.options.items) {
      this.build();
    } else {
      this.computeMetrics();
      this.updateTransform(false);
      if (this.options.continuous && this.trackRef) {
        // Force immediate style update so width adjustments take effect.
        this.applyContinuousTransform();
      }
    }
  };

  // Continuous scrolling logic
  private startContinuous() {
    this.cancelContinuous();
    if (!this.isBrowser) return;
    this.offsetX = 0;
    this.lastTs = performance.now();
    const step = () => {
      if (!this.options.continuous) return; // safety
      const now = performance.now();
      const dt = (now - this.lastTs) / 1000; // seconds
      this.lastTs = now;
      if (!this.paused) {
        const speed = this.options.speedPxPerSec || 40;
        this.offsetX += speed * dt;
        if (this.trackCycleWidth > 0) {
          // Wrap offset to avoid growing indefinitely
          if (this.offsetX >= this.trackCycleWidth) {
            this.offsetX -= this.trackCycleWidth;
          }
        }
        this.applyContinuousTransform();
      }
      this.rafId = requestAnimationFrame(step);
    };
    this.rafId = requestAnimationFrame(step);
  }

  private applyContinuousTransform() {
    // Position track so first logical sequence scrolls left.
    // We duplicate slides, so visible region always filled.
    const translate = -this.offsetX;
    // Direct DOM style manipulation avoids Angular change detection overhead.
    if (this.trackRef?.nativeElement) {
      this.trackRef.nativeElement.style.transform = `translate3d(${translate}px,0,0)`;
      this.trackRef.nativeElement.style.transition = 'none';
    }
  }

  private cancelContinuous() {
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  // Navigation click handlers supporting both discrete and continuous modes
  onPrevClick() {
    if (this.options.continuous) {
      this.stopAutoscroll();
      this.stepToCentered(-1);
    } else {
      this.stopAutoscroll();
      this.currentIndex--;
      this.updateTransform(true);
    }
  }

  onNextClick() {
    if (this.options.continuous) {
      this.stopAutoscroll();
      this.stepToCentered(1);
    } else {
      this.stopAutoscroll();
      this.next();
    }
  }

  // Continuous mode: center the target slide in the viewport after stepping
  private stepToCentered(dir: number) {
    const step = this.itemWidth + this.itemMargin;
    if (
      !Number.isFinite(step) ||
      step <= 0 ||
      this.trackCycleWidth <= 0 ||
      this.viewportWidth <= 0
    )
      return;
    const currentCenter = this.computeCenterIndex();
    let target = (currentCenter + dir) % this.slides.length;
    if (target < 0) target += this.slides.length;
    this.centerOnIndex(target);
  }

  private computeCenterIndex(): number {
    const step = this.itemWidth + this.itemMargin;
    if (!Number.isFinite(step) || step <= 0 || this.trackCycleWidth <= 0)
      return 0;
    const logicalOffset = this.offsetX % this.trackCycleWidth;
    const centerDistance = logicalOffset + this.viewportWidth / 2;
    const idx = Math.floor(centerDistance / step) % this.slides.length;
    return idx >= 0 ? idx : 0;
  }

  private centerOnIndex(index: number) {
    const step = this.itemWidth + this.itemMargin;
    if (
      !Number.isFinite(step) ||
      step <= 0 ||
      this.trackCycleWidth <= 0 ||
      this.viewportWidth <= 0
    )
      return;
    // Desired offset so that slide's center aligns with viewport center
    let desired = index * step - (this.viewportWidth / 2 - this.itemWidth / 2);
    // Normalize desired into [0, trackCycleWidth)
    desired =
      ((desired % this.trackCycleWidth) + this.trackCycleWidth) %
      this.trackCycleWidth;
    this.offsetX = desired;
    this.applyContinuousTransform();
  }

  // Stop any automatic motion (continuous RAF or discrete autoplay)
  private stopAutoscroll() {
    if (this.options.continuous) {
      // Cancel RAF loop and mark paused to prevent restart unless rebuilt
      this.cancelContinuous();
      this.paused = true;
      this.options.speedPxPerSec = 0; // defensive; ensures no residual speed used if restarted manually
    } else {
      this.stopAutoplay();
    }
  }

  // Display index (1-based) for template
  get displayIndex(): number {
    if (this.options.continuous) {
      const step = this.itemWidth + this.itemMargin;
      if (!Number.isFinite(step) || step <= 0) return 1;
      if (this.trackCycleWidth <= 0) return 1;
      const logicalOffset = this.offsetX % this.trackCycleWidth;
      const centerDistance = logicalOffset + this.viewportWidth / 2; // position of viewport center along cycle
      const idx = Math.floor(centerDistance / step) % this.slides.length;
      return (idx >= 0 ? idx : 0) + 1;
    }
    // Discrete mode: choose middle visible item
    const itemsVisible = Math.max(1, this.options.items || 1);
    const centerOffset = Math.floor(itemsVisible / 2); // for even counts picks lower middle
    const idx = (this.currentIndex + centerOffset) % this.slides.length;
    return (idx >= 0 ? idx : 0) + 1;
  }
}
