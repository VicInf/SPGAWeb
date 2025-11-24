import { Component, signal, AfterViewInit, OnDestroy, ElementRef, ViewChildren, QueryList, Inject, PLATFORM_ID } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  OwlCarouselComponent,
  OwlCarouselOptions,
  OwlCarouselSlide,
} from '../app/owl-carousel.component';
import {
  SimpleAutoCarouselComponent,
  SimpleAutoCarouselSlide,
  SimpleAutoCarouselOptions,
} from '../app/simple-auto-carousel.component';
import { RevealImageComponent } from '../app/reveal-image.component';
import { ContactanosComponent } from '../app/contactanos.component';

@Component({
  selector: 'home-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    OwlCarouselComponent,
    SimpleAutoCarouselComponent,
    RevealImageComponent,
    ContactanosComponent,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements AfterViewInit, OnDestroy {
  protected readonly title = signal('spga-group');
  protected readonly mobileMenuOpen = signal(false);
  private observer: IntersectionObserver | null = null;

  toggleMobileMenu() {
    this.mobileMenuOpen.update(v => !v);
    if (this.mobileMenuOpen()) {
      this.lockBodyScroll();
    } else {
      this.unlockBodyScroll();
    }
  }
  
  @ViewChildren('fadeInElement') fadeInElements!: QueryList<ElementRef>;
  @ViewChildren('fadeInBackground') fadeInBackgrounds!: QueryList<ElementRef>;

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
      title: 'DISEÑO',
      subtitle: 'comercial',
    },
    {
      src: 'assets/pictures/first-image.png',
      alt: 'Slide 3',
      title: 'DISEÑO',
      subtitle: 'corporativo',
    },
    {
      src: 'assets/pictures/piscina.png',
      alt: 'Slide 4',
      title: 'DISEÑO',
      subtitle: 'visualización 3D',
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
      src: 'assets/pictures/Servicio.png',
      alt: 'Diseño arquitectónico',
      title: 'Diseño arquitectónico',
      description: 'Propuestas innovadoras y funcionales adaptadas a la visión del cliente.',
    },
    {
      src: 'assets/pictures/Servicio-1.png',
      alt: 'Diseño de interiores',
      title: 'Diseño de interiores',
      description: 'Selección de materiales, colores, mobiliario y decoración.',
    },
    {
      src: 'assets/pictures/Servicio-2.png',
      alt: 'Modelado y visualización 3D',
      title: 'Modelado y visualización 3D',
      description: 'Visualizaciones fotorrealistas para previsualizar cada detalle del proyecto.',
    },
    {
      src: 'assets/pictures/Servicio-3.png',
      alt: 'Planificación de proyectos',
      title: 'Planificación de proyectos',
      description: 'Elaboración de planos y documentos técnicos conforme a normativas.',
    },
    {
      src: 'assets/pictures/Servicio-4.png',
      alt: 'Supervisión de obras',
      title: 'Supervisión de obras',
      description: 'Propuestas innovadoras y funcionales adaptadas a la visión del cliente.',
    },
    {
      src: 'assets/pictures/Servicio-5.png',
      alt: 'Consultoría y asesoramiento',
      title: 'Consultoría y asesoramiento',
      description: 'Análisis de necesidades y entornos para soluciones efectivas.',
    },
    {
      src: 'assets/pictures/Servicio-6.png',
      alt: 'Capacitaciones y talleres',
      title: 'Capacitaciones y talleres',
      description: 'Propuestas innovadoras y funcionales adaptadas a la visión del cliente.',
    },
  ];
  servicesCarouselOptions: SimpleAutoCarouselOptions = {
    items: 3,
    margin: 0,
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
    year: string;
    type: string;
  }> = [
    {
      title: 'Casa Horizonte',
      subtitle: 'Residencial costera',
      hasModel: true,
      image: 'assets/pictures/first-image.png',
      year: '2024',
      type: 'Residencial',
    },
    {
      title: 'Torre Central',
      subtitle: 'Edificio corporativo',
      hasModel: false,
      image: 'assets/pictures/piscina.png',
      year: '2023',
      type: 'Comercial',
    },
    {
      title: 'Jardín Interior',
      subtitle: 'Espacio verde privado',
      hasModel: true,
      image: 'assets/pictures/first-image.png',
      year: '2024',
      type: 'Residencial',
    },
  ];

  // Reveal image external text animation progress (0 full size, 1 fully shrunk)
  revealImageProgress: number = 0;

  // Fullscreen 3D model overlay state
  loadingModel: boolean = false;
  modelError: string | null = null;
  showModel = false;
  private modelUrl =
    'https://cloud.chaos.com/collaboration/file/EFLiJhedGoTwo59qLXL2tY';
  safeModelUrl: SafeResourceUrl;

  constructor(private sanitizer: DomSanitizer, @Inject(PLATFORM_ID) private platformId: Object) {
    this.safeModelUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      this.modelUrl
    );
  }

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      // Use setTimeout to ensure DOM is fully rendered before observing
      setTimeout(() => {
        this.setupIntersectionObserver();
      }, 0);
    }
  }

  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  private setupIntersectionObserver() {
    const options = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          // Optional: Stop observing once visible if you want it to animate only once
          this.observer?.unobserve(entry.target);
        }
      });
    }, options);

    // Observe elements found by ViewChildren
    this.fadeInElements.forEach(el => {
      this.observer?.observe(el.nativeElement);
    });

    this.fadeInBackgrounds.forEach(el => {
      this.observer?.observe(el.nativeElement);
    });

    // Also observe elements by class name if they are not ViewChildren (e.g. static HTML)
    // This is a fallback/alternative way to grab elements
    const elements = document.querySelectorAll('.fade-in-section');
    elements.forEach(el => {
      this.observer?.observe(el);
    });
  }

  scrollToSection(sectionId: string, event?: Event) {
    event?.preventDefault();
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }

    const target = document.getElementById(sectionId);
    if (!target) return;

    const header = document.querySelector('header');
    const offset = header instanceof HTMLElement ? header.offsetHeight : 0;
    const targetPosition = target.getBoundingClientRect().top + window.scrollY;
    const scrollPosition = targetPosition - offset;

    window.scrollTo({ top: scrollPosition, behavior: 'smooth' });
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

  onRevealImageProgress(p: number) {
    this.revealImageProgress = p;
  }

  private lockBodyScroll() {
    if (typeof document !== 'undefined')
      document.body.style.overflow = 'hidden';
  }
  private unlockBodyScroll() {
    if (typeof document !== 'undefined') document.body.style.overflow = '';
  }
}
