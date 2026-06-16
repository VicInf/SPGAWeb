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
  EventEmitter,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

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
        [style.object-fit]="objectFit"
      />
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
        width: 100%;
        height: 100%;
        overflow: hidden;
        position: relative;
        pointer-events: none;
      }

      .reveal-image-viewport {
        width: 100%;
        height: 100%;
        will-change: transform;
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
  @Input() endScale: number = 1;
  @Input() minScale: number = 0.3;
  @Input() scrollDistance: number = 550;
  @Input() mobileMinScale: number = 0.7;
  @Input() mobileBreakpoint: number = 1024;

  private isBrowser = false;
  private _anchorScrollY: number | null = null;
  isMobile = false;
  objectFit = 'cover';
  revealScaleCurrent = 1;
  transform = 'none';
  contentOpacity = 0;
  contentTransform = 'translateY(40px)';

  constructor(
    private el: ElementRef<HTMLElement>,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {
    this.isBrowser =
      typeof window !== 'undefined' && isPlatformBrowser(this.platformId);
  }

  private get effectiveStartScale(): number {
    return this.isMobile ? 2.5 : this.endScale;
  }

  private get effectiveMinScale(): number {
    return this.isMobile ? this.mobileMinScale : this.minScale;
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) {
      this.revealScaleCurrent = this.endScale;
      this.updateTransform();
      return;
    }

    this.isMobile = window.innerWidth < this.mobileBreakpoint;
    this.objectFit = this.isMobile ? 'contain' : 'cover';
    this.revealScaleCurrent = this.effectiveStartScale;
    this.updateTransform();
    this.updateContentReveal();

    requestAnimationFrame(() => {
      this._computeAnchor();
    });
  }

  ngOnDestroy(): void {
    // nothing to clean up
  }

  @HostListener('window:scroll')
  onWindowScroll() {
    if (!this.isBrowser || this._anchorScrollY === null) return;

    const relY = window.scrollY - this._anchorScrollY;
    const offset = this.isBrowser && window.innerWidth >= 820 ? 300 : 0;
    const adjustedRelY = Math.max(0, relY - offset);
    const progress = Math.max(0, Math.min(1, adjustedRelY / Math.max(1, this.scrollDistance - offset)));
    const span = this.effectiveStartScale - this.effectiveMinScale;
    const newScale = this.effectiveStartScale - progress * span;

    if (Math.abs(newScale - this.revealScaleCurrent) > 0.001) {
      this.revealScaleCurrent = newScale;
      this.updateTransform();
      this.updateContentReveal();
      this.cdr.markForCheck();
    }
  }

  private _computeAnchor() {
    const hostEl = this.el.nativeElement;
    const rect = hostEl.getBoundingClientRect();
    this._anchorScrollY = window.scrollY + rect.top;
  }

  private updateTransform() {
    const span = this.effectiveStartScale - this.effectiveMinScale;
    const progress =
      span > 0 ? 1 - (this.revealScaleCurrent - this.effectiveMinScale) / span : 0;
    const translateVh = 12 * Math.min(1, Math.max(0, progress));
    this.transform = `translateY(-${translateVh}vh) scale(${this.revealScaleCurrent})`;
    this.cdr.markForCheck();
  }

  private updateContentReveal() {
    const span = this.effectiveStartScale - this.effectiveMinScale;
    const progress = 1 - (this.revealScaleCurrent - this.effectiveMinScale) / span;
    const opacity = Math.min(1, Math.max(0, progress * 1.4));
    const translateY = 40 - 40 * Math.min(1, progress * 1.2);
    this.contentOpacity = opacity;
    this.contentTransform = `translateY(${translateY}px)`;
    this.scaleProgress.emit(Math.min(1, Math.max(0, progress)));
  }
}
