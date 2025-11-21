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
  // Fraction (0-1) of component height that must be visible before shrink begins.
  @Input() visibilityThreshold: number = 0.85;
  // Must reach this (>= visibilityThreshold) before first shrink/grow interaction begins
  @Input() startVisibilityThreshold: number = 0.95;
  // Optional: element top must be within this px distance from viewport top for first interaction (0 disables)
  @Input() requireTopNear: number = 0;
  private isBrowser = false;
  private shrinkLockAnchor: number | null = null; // scrollY held while mid-shrink/regrow
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
    // Maintain lock if active and mid-scale
    if (
      this.shrinkLockAnchor !== null &&
      !this.isAtExtreme() &&
      window.scrollY !== this.shrinkLockAnchor
    ) {
      window.scrollTo({ top: this.shrinkLockAnchor });
    }
  }

  @HostListener('window:wheel', ['$event']) onWheel(ev: WheelEvent) {
    if (!this.isBrowser) return;
    const rect = this.el.nativeElement.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const elHeight = rect.height || 1;
    const visible = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
    let fractionVisible = visible / elHeight;
    if (rect.bottom < 0 || rect.top > vh) fractionVisible = 0;
    fractionVisible = Math.max(0, Math.min(1, fractionVisible));
    const baseThreshold = Math.max(
      0.05,
      Math.min(1, this.visibilityThreshold || 0.85)
    );
    const startThreshold = Math.max(
      baseThreshold,
      Math.min(1, this.startVisibilityThreshold || baseThreshold)
    );
    const topNearPass =
      this.requireTopNear <= 0 || rect.top <= this.requireTopNear;
    // Before lock established: need startThreshold AND topNear
    if (this.shrinkLockAnchor == null) {
      if (fractionVisible < startThreshold || !topNearPass) return;
    } else {
      // After start: only require base threshold to continue scaling
      if (fractionVisible < baseThreshold) return;
    }

    const delta = ev.deltaY;
    const span = this.endScale - this.minScale;
    if (span <= 0) return;
    // Establish lock on first interaction within threshold visibility
    if (this.shrinkLockAnchor == null) this.shrinkLockAnchor = window.scrollY;

    // If mid-scale, prevent page scroll
    if (!this.isAtExtreme()) {
      ev.preventDefault();
      if (window.scrollY !== this.shrinkLockAnchor)
        window.scrollTo({ top: this.shrinkLockAnchor });
    }
    // Compute linear progress (1 full size -> 0 min size direction we emit later)
    const currentProgress = (this.currentScale - this.minScale) / span; // 0..1
    const deltaProgress = Math.abs(delta) / this.scrollDistance;
    let newProgress =
      currentProgress + (delta < 0 ? deltaProgress : -deltaProgress);
    if (newProgress < 0) newProgress = 0;
    if (newProgress > 1) newProgress = 1;
    const targetScale = this.minScale + span * newProgress;
    if (Math.abs(targetScale - this.currentScale) > 0.0001) {
      this.currentScale = targetScale;
      this.updateTransform();
      this.updateContentReveal();
      this.scaleProgress.emit(1 - newProgress); // 0 full -> 1 min
    }
    if (this.isAtExtreme()) {
      // Release lock so page can continue
      this.shrinkLockAnchor = null;
    }
  }

  private evaluateGrowth() {
    /* simplified: wheel drives scaling; scroll only enforces lock */
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
    // (Optional future: host height / z-index adjustments removed for clarity here)
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

  private isAtFullSize(): boolean {
    return this.currentScale >= this.endScale - 0.0001;
  }
  private isAtMinSize(): boolean {
    return this.currentScale <= this.minScale + 0.0001;
  }
  private isAtExtreme(): boolean {
    return this.isAtFullSize() || this.isAtMinSize();
  }
}
