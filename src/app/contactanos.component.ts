import {
  Component,
  Input,
  ChangeDetectionStrategy,
  Inject,
  PLATFORM_ID,
  ViewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'contactanos-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="w-full bg-black text-white py-16 md:py-24 min-[1440px]:min-h-screen min-[1440px]:flex min-[1440px]:flex-col min-[1440px]:justify-center">
      <div class="mx-auto w-[90vw] flex flex-col justify-center min-[1440px]:flex-1">
        <!-- First Row: Logo and Video with space between -->
        <div
          class="flex flex-col md:grid md:grid-cols-2 items-center gap-12 mb-12 min-[1440px]:gap-16"
        >
          <!-- Logo -->
          <div
            class="flex items-center md:justify-start justify-center h-[195px] md:h-[200px] lg:h-[280px] min-[1440px]:h-[400px]"
          >
            <img
              [src]="logoSrc"
              alt="SPGA Logo"
              width="280"
              height="280"
              class="h-full w-auto ml-4"
            />
          </div>

          <!-- Video -->
          <div
            class="relative w-[320px] md:w-[330px] lg:w-[460px] h-[195px] md:h-[200px] lg:h-[280px] min-[1440px]:w-[600px] min-[1440px]:h-[360px] overflow-hidden ml-auto mr-4"
          >
            <video
              #videoElement
              *ngIf="isBrowser"
              [src]="videoSrc"
              loop
              [muted]="true"
              playsinline
              preload="auto"
              disablePictureInPicture
              disableRemotePlayback
              controlsList="nodownload nofullscreen noremoteplayback noplaybackrate"
              width="600"
              height="360"
              crossorigin="anonymous"
              style="z-index: 0; pointer-events: none;"
              class="hide-native-controls h-full w-full object-cover relative"
              (error)="onVideoError()"
            >
              Your browser does not support the video tag.
            </video>
            
            <!-- Transparent shield to block native controls on hover -->
            <div class="absolute inset-0 z-10 w-full h-full bg-transparent" aria-hidden="true" style="pointer-events: auto;"></div>

            <!-- Fallback image for SSR only -->
            <img
              *ngIf="!isBrowser"
              [src]="fallbackImageSrc"
              alt="Contact"
              width="600"
              height="360"
              class="h-full w-full object-cover relative z-0"
            />
          </div>
        </div>

        <!-- Second Row: Title and Contact Info aligned with logo/video above -->
        <div
          class="flex flex-col md:grid md:grid-cols-2 items-center md:items-start gap-12 mb-8 min-[1440px]:gap-16"
        >
          <!-- Contactanos Title (aligned with logo) -->
          <h2
            class="text-4xl md:text-5xl lg:text-6xl font-canela-deck font-light text-center md:text-left ml-4 min-[1440px]:text-7xl"
          >
            Contáctanos
          </h2>

          <!-- Contact Info (aligned with video) -->
          <div class="flex flex-col gap-6 items-center md:items-start w-[320px] md:w-[330px] lg:w-[460px] ml-auto mr-4 min-[1440px]:w-[600px] min-[1440px]:gap-8">
            <!-- WhatsApp -->
            <a
              [href]="getWhatsAppUrl()"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-4 text-lg md:text-xl font-canela-deck font-light hover:opacity-70 transition-opacity min-[1440px]:text-2xl min-[1440px]:gap-6"
            >
              <img
                src="assets/svgs/whatsapp.svg"
                alt="WhatsApp"
                class="w-6 h-6 md:w-7 md:h-7 min-[1440px]:w-9 min-[1440px]:h-9"
              />
              <span>{{ whatsappNumber }}</span>
            </a>

            <!-- Email -->
            <a
              [href]="'mailto:' + email"
              class="flex items-center gap-4 text-lg md:text-xl font-canela-deck font-light hover:opacity-70 transition-opacity min-[1440px]:text-2xl min-[1440px]:gap-6"
            >
              <svg
                class="w-6 h-6 md:w-7 md:h-7 min-[1440px]:w-9 min-[1440px]:h-9"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <span>{{ email }}</span>
            </a>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="w-full bg-black flex justify-center mt-8 min-[1440px]:mt-12">
        <div class="w-[90vw]">
          <div
            class="flex w-full flex-col items-center justify-between gap-4 border-t border-white/20 pt-8 text-sm text-white/70 md:flex-row md:items-center min-[1440px]:text-base"
          >
            <p class="text-center md:text-left">© Copyright SPGA GROUP. Venezuela</p>
            <div
              class="flex flex-col items-center gap-1 lg:flex-row lg:gap-8 lg:items-center"
            >
              <p *ngIf="designCredit" class="text-center md:text-right">
                Diseño por {{ designCredit }}
              </p>
              <p *ngIf="devCredit" class="text-center md:text-right">
                Desarrollo por {{ devCredit }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactanosComponent implements AfterViewInit {
  @ViewChild('videoElement') videoElement?: ElementRef<HTMLVideoElement>;
  @Input() logoSrc: string = '/assets/svgs/SPGA.svg';
  @Input() videoSrc: string = '';
  @Input() fallbackImageSrc: string = '';
  @Input() whatsappNumber: string = '+584143350763';
  @Input() email: string = 'groupspga@gmail.com';
  @Input() designCredit: string = 'Mayra Bottino';
  @Input() devCredit: string = 'Vicente Perez';

  isBrowser = false;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser =
      typeof window !== 'undefined' && isPlatformBrowser(this.platformId);
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    const video = this.videoElement?.nativeElement;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.disablePictureInPicture = true;
    if ('disableRemotePlayback' in video) {
      (video as any).disableRemotePlayback = true;
    }

    video.play().catch(() => {});
    // Try autoplay after a short delay when the page is settled
    setTimeout(() => video.play().catch(() => {}), 500);

    // Also attempt on first user interaction in case autoplay is blocked
    const onInteraction = () => {
      video.play().catch(() => {});
      document.removeEventListener('click', onInteraction);
      document.removeEventListener('touchstart', onInteraction);
    };
    document.addEventListener('click', onInteraction);
    document.addEventListener('touchstart', onInteraction);
  }

  onVideoError(): void {
    console.error('Video failed to load, checking src:', this.videoSrc);
  }

  getWhatsAppUrl(): string {
    const cleanNumber = this.whatsappNumber.replace(/[^0-9]/g, '');
    return `https://wa.me/${cleanNumber}`;
  }
}
