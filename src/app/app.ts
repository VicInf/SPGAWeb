import {
  Component,
  signal,
  OnDestroy,
  HostListener,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('spga-group');
  // Carousel state
  slides = [
    {
      src: 'assets/pictures/first-image.png',
      alt: 'Slide 1',
      title: 'DISEÑO',
      subtitle: 'residencial',
    },
    {
      src: 'assets/pictures/piscina.png',
      alt: 'Slide 2',
      title: 'ARQUITECTURA',
      subtitle: 'moderna',
    },
  ];

  currentIndex = 0;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    // Removed autoplay logic
  }

  // Removed autoplay and navigation logic for continuous manual scrolling

  @HostListener('document:visibilitychange')
  onVisibilityChange() {
    if (isPlatformBrowser(this.platformId)) {
      // No need to pause or resume autoplay
    }
  }

  ngOnDestroy(): void {
    // Removed timer clearance as it's no longer needed
  }

  // Added goTo method to handle button-style navigation
  goTo(i: number) {
    if (i >= 0 && i < this.slides.length) {
      this.currentIndex = i;
    }
  }

  // Refined onScroll method to ensure smooth transitions between horizontal and vertical scrolling
  onScroll(event: WheelEvent) {
    const carouselSection = document.getElementById('carousel-section');
    if (!carouselSection) {
      console.log('Carousel section not found');
      return;
    }

    // Get the bounding rectangle of the carousel section
    const carouselRect = carouselSection.getBoundingClientRect();
    console.log('Carousel bounding rect:', carouselRect);

    // Adjust the logic to determine if the user is within the carousel section
    const isWithinCarousel =
      carouselRect.top < window.innerHeight && carouselRect.bottom > 0;

    console.log('Scroll event detected:', {
      deltaY: event.deltaY,
      currentIndex: this.currentIndex,
      isWithinCarousel,
    });

    if (isWithinCarousel) {
      // Prevent vertical scrolling and enable horizontal scrolling
      event.preventDefault();
      const scrollAmount = event.deltaY * 2; // Scale deltaY for better responsiveness
      carouselSection.scrollLeft += scrollAmount;

      // Update currentIndex based on scroll position
      const slideWidth = carouselSection.offsetWidth;
      this.currentIndex = Math.round(carouselSection.scrollLeft / slideWidth);

      console.log('Updated scroll position:', {
        scrollLeft: carouselSection.scrollLeft,
        slideWidth,
        currentIndex: this.currentIndex,
      });
    } else {
      // Allow vertical scrolling when leaving the carousel section
      window.scrollBy({ top: event.deltaY, behavior: 'smooth' });
      console.log('Vertical scrolling:', {
        scrollTop: carouselSection.scrollTop,
      });
    }
  }

  // Refined swipe functionality to ensure proper handling
  private startX = 0;
  private isSwiping = false;
  private carouselElement: HTMLElement | null = null;

  onSwipeStart(event: MouseEvent) {
    this.startX = event.clientX;
    this.isSwiping = true;
    this.carouselElement = document.getElementById('carousel-section');
  }

  onSwipeEnd(event: MouseEvent) {
    this.isSwiping = false;
    const endX = event.clientX;
    const deltaX = endX - this.startX;

    if (deltaX > 50) {
      this.prev();
    } else if (deltaX < -50) {
      this.next();
    }

    // Reset scroll position to align with the current slide
    if (this.carouselElement) {
      this.carouselElement.scrollLeft =
        this.currentIndex * this.carouselElement.offsetWidth;
    }
  }

  onSwipeMove(event: MouseEvent) {
    if (!this.isSwiping || !this.carouselElement) return;

    const deltaX = event.clientX - this.startX;
    this.carouselElement.scrollLeft -= deltaX;
    this.startX = event.clientX;
  }

  // Added next and prev methods to handle swipe navigation
  next() {
    this.currentIndex = (this.currentIndex + 1) % this.slides.length;
  }

  prev() {
    this.currentIndex =
      (this.currentIndex - 1 + this.slides.length) % this.slides.length;
  }
}
