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
    <section class="w-full bg-black text-white py-16 md:py-24">
      <div class="container mx-auto px-6 md:px-12 lg:px-20">
        <!-- First Row: Logo and Video with space between -->
        <div class="flex flex-col lg:flex-row lg:justify-between items-center gap-12 mb-12">
          <!-- Logo -->
          <div class="flex items-center justify-center h-64 md:h-40 lg:h-48">
            <img [src]="logoSrc" alt="SPGA Logo" class="h-full w-auto" />
          </div>

          <!-- Video -->
          <div class="relative h-64 md:h-40 lg:h-48 overflow-hidden rounded-lg">
            <video
              #videoElement
              *ngIf="isBrowser"
              [src]="videoSrc"
              autoplay
              loop
              muted
              playsinline
              preload="auto"
              class="h-full w-full object-cover"
              (error)="onVideoError()"
            >
              Your browser does not support the video tag.
            </video>
            <!-- Fallback image for SSR or if video doesn't load -->
            <img
              *ngIf="!isBrowser || fallbackImageSrc"
              [src]="fallbackImageSrc"
              alt="Contact"
              class="h-full w-full object-cover"
            />
          </div>
        </div>

        <!-- Second Row: Title and Contact Info aligned with logo/video above -->
        <div class="flex flex-col lg:flex-row lg:justify-between items-center lg:items-start gap-12 mb-8">
          <!-- Contactanos Title (aligned with logo) -->
          <h2
            class="text-4xl md:text-5xl lg:text-6xl font-canela-deck font-light text-center lg:text-left"
          >
            Contáctanos
          </h2>

          <!-- Contact Info (aligned with video) -->
          <div class="flex flex-col gap-6 items-center lg:items-start lg:mr-24">
            <!-- WhatsApp -->
            <a
              [href]="getWhatsAppUrl()"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-4 text-lg md:text-xl hover:opacity-70 transition-opacity"
            >
              <img
                src="/assets/svgs/whatsapp.svg"
                alt="WhatsApp"
                class="w-6 h-6 md:w-7 md:h-7"
              />
              <span>{{ whatsappNumber }}</span>
            </a>

            <!-- Email -->
            <a
              [href]="'mailto:' + email"
              class="flex items-center gap-4 text-lg md:text-xl hover:opacity-70 transition-opacity"
            >
              <svg
                class="w-6 h-6 md:w-7 md:h-7"
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

        <!-- Footer Text -->
        <div
          class="border-t border-white/20 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-white/70 text-center md:text-left"
        >
          <p>© Copyright SPGA Group. Venezuela</p>
          <div class="flex flex-col lg:flex-row gap-1 lg:gap-8 items-center lg:items-end">
            <p *ngIf="designCredit">Diseño por {{ designCredit }}</p>
            <p *ngIf="devCredit">Desarrollo por {{ devCredit }}</p>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
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
  @Input() whatsappNumber: string = '+58000-00000';
  @Input() email: string = 'spgagroup@gmail.com';
  @Input() designCredit: string = 'Maya Bottino';
  @Input() devCredit: string = 'Vicente Perez';

  isBrowser = false;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser =
      typeof window !== 'undefined' && isPlatformBrowser(this.platformId);
  }

  ngAfterViewInit(): void {
    // Ensure video plays after view initialization
    if (this.isBrowser && this.videoElement) {
      const video = this.videoElement.nativeElement;
      // Attempt to play, catching any promise rejection
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.warn('Video autoplay failed, will retry:', error);
          // Retry after a short delay
          setTimeout(() => {
            video.play().catch((e) => console.error('Video play retry failed:', e));
          }, 100);
        });
      }
    }
  }

  onVideoError(): void {
    console.error('Video failed to load, checking src:', this.videoSrc);
  }

  getWhatsAppUrl(): string {
    const cleanNumber = this.whatsappNumber.replace(/[^0-9]/g, '');
    return `https://wa.me/${cleanNumber}`;
  }
}
