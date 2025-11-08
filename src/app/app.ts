import { Component, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import {
  OwlCarouselComponent,
  OwlCarouselOptions,
  OwlCarouselSlide,
} from './owl-carousel.component';
import {
  SimpleAutoCarouselComponent,
  SimpleAutoCarouselSlide,
  SimpleAutoCarouselOptions,
} from './simple-auto-carousel.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, OwlCarouselComponent, SimpleAutoCarouselComponent],
  templateUrl: './app.html',
  // Correct metadata key is styleUrls
  styleUrls: ['./app.css'],
})
export class App {
  protected readonly title = signal('spga-group');

  slides: OwlCarouselSlide[] = [
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
    {
      src: 'assets/pictures/first-image.png',
      alt: 'Slide 3',
      title: 'DISEÑO',
      subtitle: 'minimalista',
    },
    {
      src: 'assets/pictures/piscina.png',
      alt: 'Slide 4',
      title: 'ARQUITECTURA',
      subtitle: 'sostenible',
    },
  ];

  carouselOptions: OwlCarouselOptions = {
    loop: false, // disable looping so it stops at last slide
    items: 1,
    margin: 0,
    autoplay: false, // disabled per request: no autoscroll
    autoplayTimeout: 4000, // retained (ignored while autoplay false)
    autoplayHoverPause: false, // not needed now
    nav: false,
    dots: true, // still using progress bar implementation
    transitionSpeed: 500,
    responsive: {
      0: { items: 1 },
      768: { items: 1 },
      1024: { items: 1 },
    },
  };

  // Mini carousel (pale section)
  // miniSlides: OwlCarouselSlide[] = [
  //   { src: 'assets/pictures/first-image.png', alt: 'Mini 1' },
  //   { src: 'assets/pictures/piscina.png', alt: 'Mini 2' },
  //   { src: 'assets/pictures/first-image.png', alt: 'Mini 3' },
  // ];
  // miniIndex = 0;
  // private miniTimer: any = null;
  // miniInterval = 3000; // ms

  // ngOnInit(): void {
  //   this.startMiniAutoplay();
  // }
  // ngOnDestroy(): void {
  //   this.stopMiniAutoplay();
  // }

  // startMiniAutoplay() {
  //   this.stopMiniAutoplay();
  //   this.miniTimer = setInterval(() => this.nextMini(), this.miniInterval);
  // }
  // stopMiniAutoplay() {
  //   if (this.miniTimer) {
  //     clearInterval(this.miniTimer);
  //     this.miniTimer = null;
  //   }
  // }

  // nextMini() {
  //   this.miniIndex = (this.miniIndex + 1) % this.miniSlides.length;
  // }
  // prevMini() {
  //   this.miniIndex =
  //     (this.miniIndex - 1 + this.miniSlides.length) % this.miniSlides.length;
  // }
  // goToMini(i: number) {
  //   this.miniIndex = Math.max(0, Math.min(this.miniSlides.length - 1, i));
  // }

  // Services integrales auto carousel (independent from owl carousel)
  servicesSlides: SimpleAutoCarouselSlide[] = [
    {
      src: 'assets/pictures/first-image.png',
      alt: 'Servicio 1',
      title: 'Diseño integral',
    },
    {
      src: 'assets/pictures/piscina.png',
      alt: 'Servicio 2',
      title: 'Arquitectura moderna',
    },
    {
      src: 'assets/pictures/first-image.png',
      alt: 'Servicio 3',
      title: 'Interiorismo',
    },
    {
      src: 'assets/pictures/piscina.png',
      alt: 'Servicio 4',
      title: 'Renderización 3D',
    },
    {
      src: 'assets/pictures/first-image.png',
      alt: 'Servicio 5',
      title: 'Gestión de obra',
    },
    {
      src: 'assets/pictures/piscina.png',
      alt: 'Servicio 6',
      title: 'Landscape',
    },
  ];
  servicesCarouselOptions: SimpleAutoCarouselOptions = {
    items: 3,
    margin: 24,
    // Enable continuous smooth scrolling instead of discrete autoplay
    continuous: true,
    speedPxPerSec: 50, // tweak speed for desired visual pacing
    autoplay: false, // disabled because continuous mode handles motion
    transitionMs: 700,
    pauseOnHover: true,
    loop: true,
    responsive: {
      0: { items: 1 },
      640: { items: 2 },
      1024: { items: 3 },
    },
  };

  // Proyectos data (center card can be highlighted)
  projects: Array<{
    title: string;
    subtitle: string;
    hasModel?: boolean;
    image: string;
  }> = [
    {
      title: 'Casa Horizonte',
      subtitle: 'Residencial costera',
      hasModel: true,
      image: 'assets/pictures/first-image.png',
    },
    {
      title: 'Torre Central',
      subtitle: 'Edificio corporativo',
      hasModel: false,
      image: 'assets/pictures/piscina.png',
    },
    {
      title: 'Jardín Interior',
      subtitle: 'Espacio verde privado',
      hasModel: true,
      image: 'assets/pictures/first-image.png',
    },
  ];

  // Fullscreen 3D model overlay state
  loadingModel: boolean = false;
  modelError: string | null = null;
  showModel = false;
  private modelUrl =
    'https://cloud.chaos.com/collaboration/file/EFLiJhedGoTwo59qLXL2tY';
  safeModelUrl: SafeResourceUrl;

  constructor(private sanitizer: DomSanitizer) {
    this.safeModelUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      this.modelUrl
    );
  }

  openModel(index: number) {
    // Only open for first project as requested
    if (index !== 0) return;
    this.loadingModel = true;
    this.modelError = null;
    this.showModel = true;
    this.lockBodyScroll();
    // Fallback timeout in case iframe never fires load (X-Frame-Options / CSP blocking)
    setTimeout(() => {
      if (this.showModel && this.loadingModel) {
        this.modelError = 'No se pudo cargar el modelo 3D.';
        this.loadingModel = false;
      }
    }, 8000);
  }

  closeModel() {
    this.showModel = false;
    this.loadingModel = false;
    this.unlockBodyScroll();
  }

  onModelLoad() {
    this.loadingModel = false;
  }

  onModelError(_evt: Event) {
    this.loadingModel = false;
    this.modelError = 'Error al cargar el modelo.';
  }

  onKey(event: KeyboardEvent) {
    if (event.key === 'Escape' && this.showModel) {
      this.closeModel();
    }
  }

  private lockBodyScroll() {
    if (typeof document !== 'undefined')
      document.body.style.overflow = 'hidden';
  }
  private unlockBodyScroll() {
    if (typeof document !== 'undefined') document.body.style.overflow = '';
  }
}
