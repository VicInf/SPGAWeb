import {
  Component,
  Input,
  ElementRef,
  HostListener,
  AfterViewInit,
  ChangeDetectionStrategy,
  Inject,
  PLATFORM_ID,
  Output,
  HostBinding,
  EventEmitter,
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
export class RevealImageComponent implements AfterViewInit {
  @Output() scaleProgress = new EventEmitter<number>();
  @Input() src!: string;
  @Input() alt?: string;
  // Now reversed: start at full scale (endScale) and shrink toward minScale
  @Input() endScale: number = 1; // full size initial
  @Input() minScale: number = 0.3; // smallest allowed scale when scrolling down (was startScale concept)
  @Input() scrollDistance: number = 500; // px required while fully visible to reach full scale
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
  private isBrowser = false;
  private scalingPhaseActive = true; // while growing
  private fullyVisibleAt: number | null = null; // scrollY anchor after fully visible (if not auto)
  private scaledUp = false;
  private lockScrollY: number | null = null; // maintain page position while scaling
  transform = 'scale(1)';
  private currentScale = this.endScale;
  // UI content animation state
  contentOpacity = 0; // fade in as image shrinks
  contentTransform = 'translateY(40px)'; // move upward while appearing

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private el: ElementRef<HTMLElement>,
    private cdr: ChangeDetectorRef
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
    requestAnimationFrame(() => this.evaluateGrowth());
  }

  @HostListener('window:scroll') onScroll() {
    if (!this.isBrowser) return;
    this.evaluateGrowth();
  }

  @HostListener('wheel', ['$event']) onWheel(ev: WheelEvent) {
    if (!this.isBrowser) return;
    const rect = this.el.nativeElement.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const fullyVisible = rect.top >= 0 && rect.bottom <= vh;
    const delta = ev.deltaY;
    const epsilon = 0.0001;

    // If not fully visible allow default scroll
    if (!fullyVisible) {
      this.lockScrollY = null;
      return;
    }

    // New logic: start at full size (endScale). Wheel scrolling DOWN shrinks toward minScale.
    // Scrolling UP regrows toward endScale.

    // Shrink when scrolling down and not at minScale
    if (delta > 0 && this.currentScale > this.minScale + epsilon) {
      if (this.lockScrollY == null) this.lockScrollY = window.scrollY;
      ev.preventDefault();
      this.restrictPageScroll();
      const span = this.endScale - this.minScale;
      const progress = (this.currentScale - this.minScale) / span; // 0..1
      let newProgress = progress - Math.abs(delta) / this.scrollDistance;
      if (newProgress < 0) newProgress = 0;
      this.currentScale = this.minScale + span * newProgress;
      this.updateTransform();
      this.updateContentReveal();
      // Release lock when reached min
      if (newProgress <= epsilon) this.lockScrollY = null;
      return;
    }

    // Grow back when scrolling up and below endScale
    if (delta < 0 && this.currentScale < this.endScale - epsilon) {
      if (this.lockScrollY == null) this.lockScrollY = window.scrollY;
      ev.preventDefault();
      this.restrictPageScroll();
      const span = this.endScale - this.minScale;
      const progress = (this.currentScale - this.minScale) / span;
      let newProgress = progress + Math.abs(delta) / this.scrollDistance;
      if (newProgress > 1) newProgress = 1;
      this.currentScale = this.minScale + span * newProgress;
      this.updateTransform();
      this.updateContentReveal();
      if (newProgress >= 1 - epsilon) this.lockScrollY = null; // allow page scroll after full regrow
      return;
    }
  }

  private evaluateGrowth() {
    // In reversed mode we do not auto-grow; we start at full size already.
    // We could optionally trigger an auto shrink but requirement specifies manual shrink via scroll.
    return;
  }

  private updateTransform() {
    // Calculate shrink progress: 0 at full size, 1 at minScale
    const span = this.endScale - this.minScale;
    const progress =
      span > 0 ? 1 - (this.currentScale - this.minScale) / span : 0;
    // translate upward as it shrinks (in vh)
    const translateVh = this.raiseAtMinVh * Math.min(1, Math.max(0, progress));
    this.transform = `translateY(-${translateVh}vh) scale(${this.currentScale})`;
    // when fully shrunk, put the element under other content by setting z-index to 0
    const EPS = 0.0001;
    // Only apply the z-index swap if the configured minScale is at or below the
    // threshold — this lets you avoid changing stacking for modest shrinks.
    if (
      this.minScale <= this.zIndexThreshold &&
      this.currentScale <= this.minScale + EPS
    )
      if (this.shrinkWithScale) {
        // Map scale endScale -> 100vh, minScale -> minScale * 100vh
        const base = 100; // base vh at full size
        const scaledVh = base * this.currentScale;
      }
    this.cdr.markForCheck();
  }

  private updateContentReveal() {
    // Progress: 0 at full scale, 1 at min scale
    const span = this.endScale - this.minScale;
    const progress = 1 - (this.currentScale - this.minScale) / span; // invert so shrinking increases progress
    // Opacity: start near 0, reach 1 around 40% shrink
    const opacity = Math.min(1, Math.max(0, progress * 1.4));
    // Vertical translate: from 40px down to 0
    const translateY = 40 - 40 * Math.min(1, progress * 1.2);
    this.contentOpacity = opacity;
    this.contentTransform = `translateY(${translateY}px)`;
    // Emit progress (0..1) where 0 == full size and 1 == fully shrunk
    try {
      this.scaleProgress.emit(Math.min(1, Math.max(0, progress)));
    } catch (e) {
      // no-op if parent isn't listening
    }
  }

  private restrictPageScroll() {
    if (this.lockScrollY !== null && window.scrollY !== this.lockScrollY) {
      window.scrollTo({ top: this.lockScrollY });
    }
  }
}
