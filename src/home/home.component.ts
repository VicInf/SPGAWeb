import {
  Component,
  signal,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChildren,
  ViewChild,
  QueryList,
  Inject,
  PLATFORM_ID,
  HostListener,
  Renderer2,
} from '@angular/core';
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
import { ProjectCarouselComponent } from '../app/project-carousel.component';

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
    ProjectCarouselComponent,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements AfterViewInit, OnDestroy {
  protected readonly title = signal('spga-group');
  protected readonly mobileMenuOpen = signal(false);
  private observer: IntersectionObserver | null = null;
  protected aboutUsBgColor = '#e0ddcb';
  private readonly startColor = '#e0ddcb';
  private readonly endColor = '#000000';
  isBrowser = false;

  @ViewChild('header') header!: ElementRef;
  @ViewChild('heroLogo') heroLogo!: ElementRef;
  @ViewChild('heroText') heroText!: ElementRef;
  @ViewChild('headerBg') headerBg!: ElementRef;
  @ViewChild('headerLogo') headerLogo!: ElementRef;
  @ViewChild('heroVideo') heroVideo?: ElementRef<HTMLVideoElement>;

  @ViewChild(OwlCarouselComponent) owlCarousel!: OwlCarouselComponent;
  @ViewChild(RevealImageComponent) revealImage!: RevealImageComponent;

  constructor(
    private sanitizer: DomSanitizer,
    @Inject(PLATFORM_ID) private platformId: Object,
    private renderer: Renderer2,
  ) {
    this.isBrowser =
      typeof window !== 'undefined' && isPlatformBrowser(this.platformId);
    this.safeModelUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      'https://cloud.chaos.com/collaboration/file/EFLiJhedGoTwo59qLXL2tY',
    );
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    if (!isPlatformBrowser(this.platformId)) return;

    const scrollY = window.scrollY;
    const windowHeight = window.innerHeight;

    // Calculate progress: 0 at top, 1 when scrolled much less (faster transition)
    // Changed to 0.125 for very fast scaling
    const progress = Math.min(scrollY / (windowHeight * 0.125), 1);

    // Animate hero logo - smooth transition to header size/position
    if (this.heroLogo) {
      // Scale down from large (h-56/h-72/h-80) to header size (h-8/h-10)
      // From ~224-320px down to ~32-40px = scale to about 0.12-0.15
      const scale = 1 - progress * 0.87; // Shrinks to ~13% of original

      // Move to align with header logo position (left side of header)
      // Header logo is at left-2 sm:left-4 lg:left-8, hero starts at left-12
      // Need to move left (negative X) and up (negative Y)
      const translateX = progress * -30; // Move left to header position
      const translateY = progress * -40; // Move up to header vertical center

      // Fade out as it approaches header position
      const opacity = 1 - progress * 1; // Complete fade out

      this.renderer.setStyle(
        this.heroLogo.nativeElement,
        'transform',
        `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
      );
      this.renderer.setStyle(this.heroLogo.nativeElement, 'opacity', opacity);
    }

    // Fade out hero text early (at 20% progress)
    if (this.heroText) {
      const textOpacity = progress < 0.2 ? 1 - progress / 0.2 : 0;
      this.renderer.setStyle(
        this.heroText.nativeElement,
        'opacity',
        textOpacity,
      );
    }

    // Fade in header logo when animation completes (at 100% progress)
    if (this.headerLogo) {
      const headerOpacity = progress >= 1 ? 1 : 0;
      this.renderer.setStyle(
        this.headerLogo.nativeElement,
        'opacity',
        headerOpacity,
      );
    }

    // Fade in header background when reaching second section (80%+)
    if (this.headerBg) {
      if (scrollY > windowHeight * 0.8) {
        const bgProgress = Math.min(
          (scrollY - windowHeight * 0.8) / (windowHeight * 0.2),
          1,
        );
        this.headerBg.nativeElement.style.opacity = bgProgress;
      } else {
        this.headerBg.nativeElement.style.opacity = '0';
      }
    }

    // Scroll-controlled background transition for About Us section
    if (this.fadeInBackgrounds) {
      const aboutUsSection = this.fadeInBackgrounds.find(
        (el) => el.nativeElement.id === 'sobre-nosotros',
      );
      if (aboutUsSection) {
        const rect = aboutUsSection.nativeElement.getBoundingClientRect();
        // Calculate progress: starts when top enters viewport, fully black when 50% through
        // rect.top starts at windowHeight and goes down.
        // We want 0 progress when rect.top = windowHeight
        // and 1 progress when rect.top = windowHeight - (rect.height * 0.5)
        const totalDistance = rect.height * 0.5;
        const currentDistance = windowHeight - rect.top;
        const bgProgress = Math.min(
          Math.max(currentDistance / totalDistance, 0),
          1,
        );

        this.aboutUsBgColor = this.interpolateColor(
          this.startColor,
          this.endColor,
          bgProgress,
        );
      }
    }
  }

  private interpolateColor(
    color1: string,
    color2: string,
    progress: number,
  ): string {
    const r1 = parseInt(color1.substring(1, 3), 16);
    const g1 = parseInt(color1.substring(3, 5), 16);
    const b1 = parseInt(color1.substring(5, 7), 16);

    const r2 = parseInt(color2.substring(1, 3), 16);
    const g2 = parseInt(color2.substring(3, 5), 16);
    const b2 = parseInt(color2.substring(5, 7), 16);

    const r = Math.round(r1 + (r2 - r1) * progress);
    const g = Math.round(g1 + (g2 - g1) * progress);
    const b = Math.round(b1 + (b2 - b1) * progress);

    return `rgb(${r}, ${g}, ${b})`;
  }

  toggleMobileMenu() {
    this.mobileMenuOpen.update((v) => !v);
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
      src: 'assets/pictures/piscina.webp',
      alt: 'Slide 1',
      title: 'DISEÑO',
      subtitle: 'residencial',
    },
    {
      src: 'assets/pictures/piscina-1.webp',
      alt: 'Slide 2',
      title: 'DISEÑO',
      subtitle: 'comercial',
    },
    {
      src: 'assets/pictures/piscina-2.webp',
      alt: 'Slide 3',
      title: 'DISEÑO',
      subtitle: 'corporativo',
    },
    {
      src: 'assets/pictures/piscina-3.webp',
      alt: 'Slide 4',
      title: '',
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
    transitionSpeed: 800,
    responsive: {
      0: { items: 1 },
      768: { items: 1 },
      1024: { items: 1 },
    },
  };

  // Mini carousel (pale section)
  // miniSlides: OwlCarouselSlide[] = [
  //   { src: 'assets/pictures/first-image.webp', alt: 'Mini 1' },
  //   { src: 'assets/pictures/piscina.webp', alt: 'Mini 2' },
  //   { src: 'assets/pictures/first-image.webp', alt: 'Mini 3' },
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

  get carouselScrollHeight(): number {
    let growDistance = 550;
    if (
      this.isBrowser &&
      window.innerWidth >= 1024 &&
      window.innerWidth <= 1366
    ) {
      growDistance += window.innerHeight * 0.05;
    }
    return growDistance + this.slides.length * 300;
  }

  get carouselZoneHeight(): string {
    if (this.isBrowser && window.innerWidth < 1024) return 'auto';
    const base = this.carouselScrollHeight;
    let extra = '45vh';
    if (this.isBrowser) {
      if (window.innerWidth >= 1024 && window.innerWidth <= 1366) {
        extra = '65vh';
      } else if (window.innerWidth > 1440) {
        extra = '70vh';
      }
    }
    return `calc(${base}px + ${extra})`;
  }

  carouselScale =
    typeof window !== 'undefined' && window.innerWidth < 1024 ? 0.7 : 0.4;

  onCarouselScaleChange(scale: number) {
    this.carouselScale = scale;
  }

  get carouselWrapperHeight(): string {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      return '100vh';
    }
    return 'auto';
  }

  get revealZoneHeight(): string {
    return 'calc(575px + 92.5vh)';
  }

  // Services integrales auto carousel (independent from owl carousel)
  servicesSlides: SimpleAutoCarouselSlide[] = [
    {
      src: 'assets/pictures/Servicio.webp',
      alt: 'Diseño arquitectónico',
      title: 'Diseño arquitectónico',
      description:
        'Propuestas innovadoras y funcionales adaptadas a la visión del cliente.',
    },
    {
      src: 'assets/pictures/Servicio-1.webp',
      alt: 'Diseño de interiores',
      title: 'Diseño de interiores',
      description: 'Selección de materiales, colores, mobiliario y decoración.',
    },
    {
      src: 'assets/pictures/Servicio-2.webp',
      alt: 'Modelado y visualización 3D',
      title: 'Modelado y visualización 3D',
      description:
        'Visualizaciones fotorrealistas para previsualizar cada detalle del proyecto.',
    },
    {
      src: 'assets/pictures/Servicio-3.webp',
      alt: 'Planificación de proyectos',
      title: 'Planificación de proyectos',
      description:
        'Elaboración de planos y documentos técnicos conforme a normativas.',
    },
    {
      src: 'assets/pictures/Servicio-4.webp',
      alt: 'Supervisión de obras',
      title: 'Supervisión de obras',
      description:
        'Aseguramos la correcta ejecución del proyecto, garantizando calidad, plazos y cumplimiento normativo.',
    },
    {
      src: 'assets/pictures/Servicio-5.webp',
      alt: 'Consultoría y asesoramiento',
      title: 'Consultoría y asesoramiento',
      description:
        'Análisis de necesidades y entornos para soluciones efectivas.',
    },
    {
      src: 'assets/pictures/Servicio-6.webp',
      alt: 'Capacitaciones y talleres',
      title: 'Capacitaciones y talleres',
      description:
        'Formación especializada enfocada en optimizar procesos y actualizar conocimientos técnicos.',
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
      1920: { items: 4 },
    },
  };

  // Proyectos data (center card can be highlighted)
  projects: Array<{
    title: string;
    subtitle: string;
    hasModel?: boolean;
    image: string;
    images: string[]; // Added for carousel
    year: string;
    type: string;
    services?: string; // Added for carousel details
    modelUrl?: string; // Specific model URL override
  }> = [
    {
      title: 'HABITACIÓN AA',
      subtitle: 'Nursery Design',
      hasModel: true,
      modelUrl:
        'https://cloud.chaos.com/collaboration/n/SdMECnSMasJKFLmhupeW4e?t=pan',
      image:
        'https://res.cloudinary.com/dcdkxplno/image/upload/q_auto,f_auto,w_1000/v1781122617/00_Portada_bbj9m2.webp',
      images: [
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781122617/Imagen_01_uuwwag.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781122616/Imagen_02_eska2e.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781122616/Imagen_03_i9qa2t.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781122616/Imagen_04_vf44hr.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781122616/Imagen_05_afzqeq.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781122616/Imagen_06_byywh3.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781122616/Imagen_07_oqlio3.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781122616/Imagen_08_q2qzyt.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781122616/Imagen_09_js4aex.webp',
        'https://res.cloudinary.com/dcdkxplno/video/upload/v1781122617/Imagen_10_video_dq6lto.mp4',
      ],
      year: '2024',
      type: 'Residencial',
      services: 'Diseño arquitectónico e interiorismo.',
    },
    {
      title: 'SOUL BIKE',
      subtitle: 'BikeHub',
      hasModel: false,
      image:
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781122934/00_Portada_b1d9g3.webp',
      images: [
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781122934/Imagen_01_xpgwny.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781122934/Imagen_02_xql8i5.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781122934/Imagen_03_wenrul.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781122935/Imagen_04_eyxlyg.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781122936/Imagen_05_ylp3lo.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781122936/Imagen_06_xw8fhc.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781122937/Imagen_07_hl3220.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781122938/Imagen_08_b9qrja.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781624491/Imagen_09_ffoqh7.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781122939/Imagen_10_nkyxtm.webp',
        'https://res.cloudinary.com/dcdkxplno/video/upload/v1781122941/Imagen_11_video_rwsadk.mp4',
        'https://res.cloudinary.com/dcdkxplno/video/upload/v1781122973/Imagen_12_videos_eosbio.mp4',
        'https://res.cloudinary.com/dcdkxplno/video/upload/v1781122941/Imagen_13_video_fg3yug.mp4',
      ],
      year: '2024',
      type: 'Comercial',
      services: 'Diseño arquitectónico, interiorismo, supervisión de obra',
    },
    {
      title: 'LOBBY PETROCEDEÑO',
      subtitle: 'Corporate Hall & Gallery',
      hasModel: false,
      image:
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781122992/00_PORTADA_setesn.webp',
      images: [
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781122993/IMAGEN_01_fb90mu.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781122994/IMAGEN_02_ektxp7.webpp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781122995/IMAGEN_03_kmmj78.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781122995/IMAGEN_04_jnwymq.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781122996/IMAGEN_05_p4wys3.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781122996/IMAGEN_06_xzzi7p.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781122997/IMAGEN_07_bxqtbj.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781122998/IMAGEN_08_l0tuxq.webp',
      ],
      year: '2022',
      type: 'Corporativo',
      services: 'Diseño arquitectónico, interiorismo, supervisión de obra',
    },
    {
      title: 'APARTAMENTO IP',
      subtitle: 'Residential Interior & Concept Design',
      hasModel: false,
      image:
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123026/00_PORTADA_xxpkng.webp',
      images: [
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123025/IMAGEN_01_rogjtj.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123028/IMAGEN_02_zsidlk.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123027/IMAGEN_03_uccr1f.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123030/IMAGEN_03_w6ndog.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123030/IMAGEN_04_mv6obl.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123035/IMAGEN_05_wosxne.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123032/IMAGEN_06_zrgulv.webp',
        'https://res.cloudinary.com/dcdkxplno/video/upload/v1781123061/IMAGEN_07_video_xrz5b7.mp4',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123033/IMAGEN_08_n5fmld.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123034/IMAGEN_09_dtm1ua.webp',
        'https://res.cloudinary.com/dcdkxplno/video/upload/v1781123058/IMAGEN_10_video_dtoyxj.mp4',
      ],
      year: '2022',
      type: 'Residencial',
      services: 'Diseño arquitectónico, interiorismo.',
    },
    {
      title: 'CASA AV',
      subtitle: 'Residential Interior & Concept Design',
      hasModel: false,
      image:
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123593/00_Portada_bv6mwb.webp',
      images: [
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123594/Imagen_01_tk1rjn.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123595/Imagen_02_cyr2dy.webpp',
        'https://res.cloudinary.com/dcdkxplno/video/upload/v1781123613/Imagen_03_video_wcokcu.mp4',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123596/Imagen_04_ljw2xq.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123597/Imagen_05_eljln5.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123598/Imagen_06_kz8pci.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123599/Imagen_07_j05an6.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123600/Imagen_08_rpafmi.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123603/Imagen_09_wjxbw1.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123601/Imagen_10_advr2m.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123605/Imagen_11_v43iya.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123604/Imagen_12_u7d52e.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123608/Imagen_13_iqh7sj.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123606/Imagen_14_fmjcuv.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123607/Imagen_15_rm2bmr.webp',
      ],
      year: '2022',
      type: 'Residencial',
      services: 'Interiorismo.',
    },
    {
      title: 'LA SUITE SOCIAL',
      subtitle: 'High-End Interior Architecture',
      hasModel: true,
      modelUrl:
        'https://cloud.chaos.com/collaboration/n/5gXq6XejU89DRvkqhyoLRZ?t=pan',
      image:
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123637/00_Portada_iwwz7n.webp',
      images: [
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123639/Imagen_01_kjxjhy.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123635/Imagen_02_qju1z1.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123638/Imagen_03_oxzadr.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123632/Imagen_04_cuct5x.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123634/Imagen_05_arqeef.webpp',
        'https://res.cloudinary.com/dcdkxplno/video/upload/v1781124807/Imagen_06_video_ppsvcu.mp4',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123633/Imagen_07_ev0t6e.webp',
        'https://res.cloudinary.com/dcdkxplno/video/upload/v1781123647/Imagen_08_video_khxdon.mp4',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123630/Imagen_09_kmp8ma.webp',
        'https://res.cloudinary.com/dcdkxplno/image/upload/v1781123629/Imagen_10_j9sdq8.webp',
      ],
      year: '2024',
      type: 'Residencial',
      services: 'Arquitectura, interiorismo.',
    },
  ];

  // Carousel State
  isCarouselOpen = false;
  selectedProject: any = null;

  // Reveal image external text animation progress (0 full size, 1 fully shrunk)
  revealImageProgress: number = 0;

  heroVideoPlaying = false;

  // Fullscreen 3D model overlay state
  loadingModel: boolean = false;
  modelError: string | null = null;
  showModel = false;
  safeModelUrl: SafeResourceUrl;

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      // Use setTimeout to ensure DOM is fully rendered before observing
      setTimeout(() => {
        this.setupIntersectionObserver();
        this.setupHeroVideo();
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
      threshold: 0.1,
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          // Optional: Stop observing once visible if you want it to animate only once
          this.observer?.unobserve(entry.target);
        }
      });
    }, options);

    // Observe elements found by ViewChildren
    this.fadeInElements.forEach((el) => {
      this.observer?.observe(el.nativeElement);
    });

    this.fadeInBackgrounds.forEach((el) => {
      this.observer?.observe(el.nativeElement);
    });

    // Also observe elements by class name if they are not ViewChildren (e.g. static HTML)
    // This is a fallback/alternative way to grab elements
    const elements = document.querySelectorAll('.fade-in-section');
    elements.forEach((el) => {
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

    if (this.owlCarousel) {
      this.owlCarousel.bypassToLastSlide();
    }

    if (
      this.revealImage &&
      (sectionId === 'sobre-nosotros' || sectionId === 'contacto')
    ) {
      // scroll-driven — no bypass needed
    }

    const header = document.querySelector('header');
    const offset = header instanceof HTMLElement ? header.offsetHeight : 0;
    const targetPosition = target.getBoundingClientRect().top + window.scrollY;
    const scrollPosition = targetPosition - offset;

    window.scrollTo({ top: scrollPosition, behavior: 'auto' });
  }

  scrollToTop() {
    if (typeof window === 'undefined') return;

    if (this.owlCarousel) {
      this.owlCarousel.bypassToFirstSlide();
    }

    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  openModel(index: number) {
    const project = this.projects[index];
    if (!project?.hasModel) return;

    const url =
      project.modelUrl ||
      'https://cloud.chaos.com/collaboration/file/EFLiJhedGoTwo59qLXL2tY';
    console.log(
      `[DEBUG] Attempting to open model for index ${index}. Project Name: "${project.title}". URL: ${url}`,
    );
    this.safeModelUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);

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
    if (event.key === 'Escape') {
      if (this.showModel) this.closeModel();
      if (this.isCarouselOpen) this.closeCarousel();
    }
  }

  openCarousel(project: any) {
    this.selectedProject = project;
    this.isCarouselOpen = true;
    this.lockBodyScroll();
  }

  closeCarousel() {
    this.isCarouselOpen = false;
    this.selectedProject = null;
    this.unlockBodyScroll();
  }

  onRevealImageProgress(p: number) {
    this.revealImageProgress = p;
  }

  private setupHeroVideo(): void {
    if (!this.isBrowser) return;
    const video = this.heroVideo?.nativeElement;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.disablePictureInPicture = true;
    if ('disableRemotePlayback' in video) {
      (video as any).disableRemotePlayback = true;
    }

    const play = () => video.play().catch(() => {});
    play();

    // Retry at intervals in case the 48MB video takes time to load
    setTimeout(play, 500);
    setTimeout(play, 2000);
    setTimeout(play, 5000);

    // Fallback: try on first user interaction if autoplay is blocked
    const onInteraction = () => {
      play();
      document.removeEventListener('click', onInteraction);
      document.removeEventListener('touchstart', onInteraction);
    };
    document.addEventListener('click', onInteraction, { passive: true });
    document.addEventListener('touchstart', onInteraction, { passive: true });
  }

  onHeroVideoError(event: Event) {
    console.error('Hero video failed to load');
  }

  private lockBodyScroll() {
    if (typeof document !== 'undefined')
      document.body.style.overflow = 'hidden';
  }
  private unlockBodyScroll() {
    if (typeof document !== 'undefined') document.body.style.overflow = '';
  }
}
