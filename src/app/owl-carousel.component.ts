import {
  Component,
  Input,
  Output,
  EventEmitter,
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
  items?: number;
  loop?: boolean;
  margin?: number;
  autoplay?: boolean;
  autoplayTimeout?: number;
  autoplayHoverPause?: boolean;
  nav?: boolean;
  dots?: boolean;
  responsive?: { [minWidth: number]: { items?: number; margin?: number } };
  transitionSpeed?: number;
  keyboard?: boolean;
  progressClickable?: boolean;
  announce?: boolean;
  ariaLabel?: string;
}

@Component({
  selector: 'owl-carousel',
  standalone: true,
  imports: [],
  template: `
    <div
      class="owl-carousel-viewport"
      #viewport
      [style.transform]="viewportTransform"
      [attr.role]="'region'"
      [attr.aria-label]="options.ariaLabel || 'Image carousel'"
      tabindex="0"
      (keydown)="onKeyDown($event)"
      (pointerdown)="onPointerDown($event)"
      (pointermove)="onPointerMove($event)"
      (pointerup)="onPointerUp($event)"
      (pointercancel)="onPointerUp($event)"
      (pointerleave)="onPointerUp($event)"
    >
      @if (options.nav || options.dots) {
        <div class="owl-overlay-gradient"></div>
      }
      <div
        #stage
        class="owl-carousel-stage"
        [style.transition]="stageTransition"
        [style.transform]="stageTransform"
      >
        @for (slide of renderedSlides; track slide._realIndex; let i = $index) {
          <div
            class="owl-item"
            [style.width.px]="itemWidth"
            [style.marginRight.px]="itemMargin"
            [attr.data-index]="slide._realIndex"
          >
            <img
              [src]="slide.src"
              [alt]="slide.alt || 'Slide ' + (slide._realIndex + 1)"
              draggable="false"
              loading="lazy"
              width="1920"
              height="1080"
            />
          </div>
        }
      </div>

      @if (getActiveSlide()?.title || getActiveSlide()?.subtitle) {
        <div
          class="absolute inset-0 flex flex-col items-center justify-center text-white font-canela-deck pointer-events-none select-none"
          [class.text-fade-in]="_isSimple"
          [style.opacity]="getTextOpacity()"
        >
          @if (getActiveSlide()?.title) {
            <span
              class="text-xs sm:text-base font-neue font-medium leading-none -mb-3"
              >{{ getActiveSlide()?.title }}</span
            >
          }
          @if (getActiveSlide()?.subtitle) {
            <span
              class="text-[32px] sm:text-[64px] font-[200] italic text-center px-4"
              >{{ getActiveSlide()?.subtitle }}</span
            >
          }
        </div>
      }
      @if (options.dots) {
        <div class="owl-progress-wrapper" aria-label="Carousel progress">
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
      }
      @if (options.announce) {
        <div class="visually-hidden" aria-live="polite" aria-atomic="true">
          Slide {{ currentIndex + 1 }} of {{ slides.length }}
        </div>
      }
    </div>
  `,
  styleUrls: ['./owl-carousel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OwlCarouselComponent implements AfterViewInit, OnDestroy {
  @Input() slides: OwlCarouselSlide[] = [];
  @Input() options: OwlCarouselOptions = {};
  @Output() scaleChange = new EventEmitter<number>();

  @ViewChild('viewport', { static: true })
  viewportRef!: ElementRef<HTMLElement>;
  @ViewChild('stage', { static: true }) stageRef!: ElementRef<HTMLElement>;

  // State
  itemWidth = 0;
  itemMargin = 0;
  renderedSlides: any[] = [];
  currentIndex = 0;
  stageTransition = 'transform 0s ease';
  stageTransform = 'translate3d(0,0,0)';
  private stageIndex = 0;
  private transitionMs = 400;
  private autoplayTimer: any = null;
  private lastAnnounceIndex = -1;
  announceMessage = '';

  // Scroll-driven state
  revealScaleCurrent = 0.4;
  private _anchorScrollY: number | null = null;
  private _startScale = 0.4;
  private _growDistance = 550;
  private _slideScrollHeight = 300;
  private _isBypass = false;
  private _growthOffsetFactor = 0.55;
  _isSimple = false;

  // Swipe state
  private _pointerActive = false;
  private _pointerStartX = 0;
  private _pointerStartY = 0;
  private _swipeStartOffset = 0;
  private _pointerPrevX = 0;
  private _pointerPrevTime = 0;
  private _momentumRafId: number | null = null;

  get totalScrollHeight(): number {
    return this._growDistance + this.slides.length * this._slideScrollHeight;
  }

  get viewportTransform(): string | null {
    if (
      this.isBrowser &&
      typeof window !== 'undefined' &&
      window.innerWidth >= 1024
    ) {
      return `scale(${this.revealScaleCurrent})`;
    }
    return null;
  }

  private isBrowser = false;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef,
  ) {
    this.isBrowser =
      typeof window !== 'undefined' && isPlatformBrowser(this.platformId);
  }

  getTextOpacity(): number {
    const startScale = this._startScale;
    const endScale = 1;
    const currentScale = this.revealScaleCurrent;
    const progress = (currentScale - startScale) / (endScale - startScale);
    return Math.max(0, Math.min(1, progress));
  }

  getActiveSlide(): OwlCarouselSlide | null {
    if (!this.slides || this.slides.length === 0) {
      return null;
    }
    return this.slides[this.currentIndex] || null;
  }

  ngAfterViewInit(): void {
    this.isBrowser =
      typeof window !== 'undefined' && isPlatformBrowser(this.platformId);
    if (!this.isBrowser) {
      this.applyDefaultOptions();
      this.revealScaleCurrent = this._startScale;
      return;
    }

    this.applyDefaultOptions();
    this.rebuild();

    if (window.innerWidth < 1024) {
      this._isSimple = true;
      this.revealScaleCurrent = 1;
      this.scaleChange.emit(1);
    } else {
      this.revealScaleCurrent = this._startScale;
      if (window.innerWidth == 1024) {
        this._growthOffsetFactor = 0.35;
      } else if (window.innerWidth > 1024 && window.innerWidth < 1440) {
        this._growthOffsetFactor = 0.4;
        this._growDistance += window.innerHeight * 0.05;
      } else if (window.innerWidth >= 1440 && window.innerWidth <= 1920) {
        this._growthOffsetFactor = 0.375;
      } else if (window.innerWidth > 1920) {
        this._growthOffsetFactor = 0.35;
        this._growDistance += window.innerHeight * 0.1;
      }
    }

    if (this.options.autoplay) this.startAutoplay();

    requestAnimationFrame(() => {
      this._computeAnchor();
    });
  }

  ngOnDestroy(): void {
    this.stopAutoplay();
  }

  @HostListener('window:scroll')
  onWindowScroll() {
    if (!this.isBrowser || this._isBypass || this._isSimple) return;
    if (this._anchorScrollY === null) {
      this._computeAnchor();
      if (this._anchorScrollY === null) return;
    }

    const relY = window.scrollY - this._anchorScrollY;
    const growthRelY = relY + window.innerHeight * this._growthOffsetFactor;

    // Phase 1: Below viewport — shrink scale, no transform
    if (growthRelY <= 0) {
      const newScale = this._startScale;
      if (Math.abs(this.revealScaleCurrent - newScale) > 0.001) {
        this.revealScaleCurrent = newScale;
        this.stageTransform = 'translate3d(0,0,0)';
        this.cdr.markForCheck();
        this.scaleChange.emit(this.revealScaleCurrent);
      }
      return;
    }

    // Phase 2: Growing (growthRelY: 0 → _growDistance)
    if (growthRelY <= this._growDistance) {
      const t = growthRelY / this._growDistance;
      const eased = this._easeInOutCubic(t);
      const newScale = this._startScale + eased * (1 - this._startScale);
      if (Math.abs(this.revealScaleCurrent - newScale) > 0.001) {
        this.revealScaleCurrent = newScale;
        this.stageTransform = 'translate3d(0,0,0)';
        this.cdr.markForCheck();
        this.scaleChange.emit(this.revealScaleCurrent);
      }
      return;
    }

    // Phase 3: Full scale + continuous smooth sliding
    if (this.revealScaleCurrent !== 1) {
      this.revealScaleCurrent = 1;
      this.scaleChange.emit(this.revealScaleCurrent);
    }

    const slideSpan = this.itemWidth + this.itemMargin;
    if (slideSpan > 0) {
      const totalSlides = this.slides.length;
      const scrollRange = this._slideScrollHeight * totalSlides;
      const slideRelY = growthRelY - this._growDistance;
      let fraction = slideRelY / scrollRange;
      fraction = Math.max(0, Math.min(1, fraction));

      const totalTranslate = -(totalSlides - 1) * slideSpan;
      const targetX = fraction * totalTranslate;

      this.stageTransform = `translate3d(${targetX}px,0,0)`;
      this.stageTransition = 'none';

      const newIndex = Math.round(fraction * (totalSlides - 1));
      if (newIndex !== this.currentIndex) {
        this.currentIndex = newIndex;
        this.updateAnnouncement();
      }
    }
    this.cdr.markForCheck();
  }

  private _computeAnchor() {
    const vp = this.viewportRef?.nativeElement;
    if (!vp) return;
    const hostEl = vp.parentElement;
    if (!hostEl) return;

    let targetEl = hostEl;
    const scrollZone = hostEl.closest('.carousel-scroll-zone');
    if (scrollZone) {
      targetEl = scrollZone as HTMLElement;
    }

    const rect = targetEl.getBoundingClientRect();
    this._anchorScrollY = window.scrollY + rect.top;
  }

  public bypassToLastSlide() {
    if (!this.slides.length) return;
    this._isBypass = true;
    this._anchorScrollY = null;
    this.revealScaleCurrent = 1;
    const slideSpan = this.itemWidth + this.itemMargin;
    const targetX = -(this.slides.length - 1) * slideSpan;
    this.stageTransform = `translate3d(${targetX}px,0,0)`;
    this.stageTransition = 'none';
    this.currentIndex = this.slides.length - 1;
    this.cdr.markForCheck();
    setTimeout(() => {
      this._isBypass = false;
      this._computeAnchor();
    }, 1500);
  }

  public bypassToFirstSlide() {
    if (!this.slides.length) return;
    this._isBypass = true;
    this._anchorScrollY = null;
    this.revealScaleCurrent = this._startScale;
    this.stageTransform = 'translate3d(0,0,0)';
    this.stageTransition = 'none';
    this.currentIndex = 0;
    this.cdr.markForCheck();
    setTimeout(() => {
      this._isBypass = false;
      this._computeAnchor();
    }, 100);
  }

  @HostListener('window:resize') onResize() {
    const prevItems = this.getItemsPerView();
    this.updateResponsive();
    const newItems = this.getItemsPerView();
    if (prevItems !== newItems) {
      this.rebuild();
    } else {
      this.computeItemMetrics();
    }
  }

  private applyDefaultOptions() {
    this.options = {
      items: 1,
      margin: 0,
      autoplay: false,
      autoplayTimeout: 4000,
      autoplayHoverPause: true,
      nav: true,
      dots: true,
      responsive: {},
      transitionSpeed: 400,
      keyboard: true,
      progressClickable: true,
      announce: true,
      ariaLabel: 'Image carousel',
      ...this.options,
    };
    this.transitionMs = this.options.transitionSpeed || 400;
    this.updateResponsive();
  }

  private updateResponsive() {
    if (!this.options.responsive) return;
    if (!this.isBrowser || typeof window === 'undefined') return;
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

  private getItemsPerView(): number {
    return Math.max(1, this.options.items || 1);
  }

  private rebuild() {
    this.stopAutoplay();
    this.renderedSlides = this.slides.map((s, i) => ({
      ...s,
      _realIndex: i,
    }));
    this.currentIndex = 0;
    this.stageTransform = 'translate3d(0,0,0)';
    this.stageTransition = 'none';
    this.computeItemMetrics();
    if (this.options.autoplay) this.startAutoplay();
  }

  private computeItemMetrics() {
    const viewportEl = this.viewportRef.nativeElement;
    const itemsPerView = this.getItemsPerView();
    const totalMargin = (this.options.margin || 0) * (itemsPerView - 1);
    this.itemWidth = (viewportEl.clientWidth - totalMargin) / itemsPerView;
    this.itemMargin = this.options.margin || 0;
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
    logicalIndex = Math.max(0, Math.min(count - 1, logicalIndex));
    this.currentIndex = logicalIndex;
    this.stageIndex = logicalIndex;
    this.updateStageTransform(true);
    this.updateAnnouncement();
  }

  private getCurrentStageOffset(): number {
    const match = /translate3d\((-?\d+(?:\.\d+)?)px/.exec(this.stageTransform);
    return match ? parseFloat(match[1]) : 0;
  }

  private updateStageTransform(animate = true) {
    const targetOffset = -this.stageIndex * (this.itemWidth + this.itemMargin);
    this.stageTransition = 'transform 0s ease';

    if (!animate) {
      this.stageTransform = `translate3d(${targetOffset}px,0,0)`;
      this.cdr.markForCheck();
      return;
    }

    const startOffset = this.getCurrentStageOffset();
    const startTime = performance.now();
    const duration = this.transitionMs;

    const step = (now: number) => {
      const elapsed = now - startTime;
      let progress = elapsed / duration;
      if (progress >= 1) progress = 1;

      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startOffset + (targetOffset - startOffset) * eased;

      this.stageTransform = `translate3d(${current}px,0,0)`;
      this.cdr.markForCheck();

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
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

  // Keyboard navigation
  onKeyDown(ev: KeyboardEvent) {
    if (!this.options.keyboard) return;
    switch (ev.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        ev.preventDefault();
        this.next();
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        ev.preventDefault();
        this.prev();
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

  // Pointer-based swipe
  onPointerDown(event: PointerEvent) {
    if (!this._isSimple || !this.slides.length) return;
    this._cancelMomentum();
    this._pointerActive = true;
    this._pointerStartX = event.clientX;
    this._pointerStartY = event.clientY;
    this._swipeStartOffset = this.getCurrentStageOffset();
    this._pointerPrevX = event.clientX;
    this._pointerPrevTime = performance.now();
    this.stageTransition = 'none';
    this.stopAutoplay();
  }

  onPointerMove(event: PointerEvent) {
    if (!this._pointerActive) return;
    const deltaX = event.clientX - this._pointerStartX;
    const deltaY = event.clientY - this._pointerStartY;
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
      this._pointerActive = false;
      return;
    }
    const newOffset = this._swipeStartOffset + deltaX;
    const boundedOffset = this._clampOffset(newOffset);
    this.stageTransform = `translate3d(${boundedOffset}px,0,0)`;
    this._updateCurrentIndex(boundedOffset);
    this._pointerPrevX = event.clientX;
    this._pointerPrevTime = performance.now();
    this.cdr.markForCheck();
  }

  onPointerUp(event: PointerEvent) {
    if (!this._pointerActive) return;
    this._pointerActive = false;
    const dt = performance.now() - this._pointerPrevTime;
    const velocity = dt > 0 ? (event.clientX - this._pointerPrevX) / dt : 0;
    this._startMomentum(velocity);
    if (this.options.autoplay) this.startAutoplay();
  }

  private _clampOffset(offset: number): number {
    const maxOffset = 0;
    const minOffset =
      -(this.slides.length - 1) * (this.itemWidth + this.itemMargin);
    return Math.max(minOffset, Math.min(maxOffset, offset));
  }

  private _updateCurrentIndex(offset: number) {
    const slideSpan = this.itemWidth + this.itemMargin;
    const idx = Math.round(-offset / slideSpan);
    const clamped = Math.max(0, Math.min(this.slides.length - 1, idx));
    if (clamped !== this.currentIndex) {
      this.currentIndex = clamped;
      this.updateAnnouncement();
    }
  }

  private _startMomentum(velocity: number) {
    const friction = 0.92;
    const minVelocity = 0.3;
    let v = velocity;
    let offset = this.getCurrentStageOffset();

    const step = () => {
      v *= friction;
      if (Math.abs(v) < minVelocity) {
        this._momentumRafId = null;
        return;
      }
      offset += v * 16;
      offset = this._clampOffset(offset);
      this.stageTransform = `translate3d(${offset}px,0,0)`;
      this._updateCurrentIndex(offset);
      this.cdr.markForCheck();
      this._momentumRafId = requestAnimationFrame(step);
    };
    this._momentumRafId = requestAnimationFrame(step);
  }

  private _cancelMomentum() {
    if (this._momentumRafId !== null) {
      cancelAnimationFrame(this._momentumRafId);
      this._momentumRafId = null;
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

  private _easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
}
