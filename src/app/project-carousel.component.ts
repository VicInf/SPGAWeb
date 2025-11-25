import { Component, EventEmitter, Input, Output, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'project-carousel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="carousel-container">
      <!-- Close Button -->
      <button class="close-btn" (click)="onClose()">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <!-- Main Image -->
      <div class="main-content">
        <div class="image-wrapper" *ngIf="images && images.length > 0">
          <img 
            [src]="images[currentIndex]" 
            [alt]="title" 
            class="main-image"
          />
        </div>
      </div>

      <!-- Footer Controls -->
      <div class="footer">
        <!-- Left: Title | Year -->
        <div class="project-info-left">
          <span class="project-title">{{ title }}</span>
          <span class="separator">|</span>
          <span class="project-year">{{ year }}</span>
        </div>

        <!-- Center: Navigation -->
        <div class="navigation-controls">
          <button class="nav-btn prev" (click)="prev()">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          
          <div class="counter">
            {{ currentIndex + 1 }}/{{ images.length }}
          </div>

          <button class="nav-btn next" (click)="next()">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </div>

        <!-- Right: Services -->
        <div class="project-info-right">
          {{ services }}
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./project-carousel.component.css']
})
export class ProjectCarouselComponent {
  @Input() images: string[] = [];
  @Input() title: string = '';
  @Input() year: string = '';
  @Input() type: string = '';
  @Input() services: string = '';

  @Output() close = new EventEmitter<void>();

  currentIndex: number = 0;

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      this.onClose();
    } else if (event.key === 'ArrowLeft') {
      this.prev();
    } else if (event.key === 'ArrowRight') {
      this.next();
    }
  }

  onClose() {
    this.close.emit();
  }

  next() {
    if (!this.images.length) return;
    this.currentIndex = (this.currentIndex + 1) % this.images.length;
  }

  prev() {
    if (!this.images.length) return;
    this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length;
  }
}
