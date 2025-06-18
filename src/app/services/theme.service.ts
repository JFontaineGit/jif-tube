import {
  Injectable,
  Renderer2,
  RendererFactory2,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { FastAverageColor } from 'fast-average-color';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private dominantColorSubject = new BehaviorSubject<string>('#1a4d4d');
  dominantColor$ = this.dominantColorSubject.asObservable();

  readonly gradient$: Observable<{ start: string; end: string }> = this.dominantColor$.pipe(
    map(color => {
      const rgb = this.parseRGB(color);
      const darkerRgb = this.darkenColor(rgb, 0.2);
      return {
        start: color,
        end: `rgb(${darkerRgb[0]}, ${darkerRgb[1]}, ${darkerRgb[2]})`,
      };
    })
  );

  private renderer: Renderer2;
  private fac = new FastAverageColor();
  private lastImageRequest: Promise<void> | null = null;

  constructor(
    rendererFactory: RendererFactory2,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.renderer = rendererFactory.createRenderer(null, null);
    this.setYouTubeMusicTheme();
  }

  setYouTubeMusicTheme(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.dominantColorSubject.next('#1a4d4d');
      this.safeSetStyle('--gradient-start', '#0f1419');
      this.safeSetStyle('--gradient-end', '#1a4d4d');
      this.safeSetStyle('--accent-color', '#1a4d4d');
    }
  }

  updateThemeFromImage(imageUrl: string, song?: { artist?: string; type?: string }): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.lastImageRequest = null;

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageUrl;

    this.lastImageRequest = new Promise<void>((resolve) => {
      img.onload = () => {
        this.fac.getColorAsync(img)
          .then(color => {
            if (color.isDark) {
              this.dominantColorSubject.next(color.rgba);

              const rgb = this.parseRGB(color.rgba);
              const darkerRgb = this.darkenColor(rgb, 0.3);

              this.safeSetStyle('--gradient-start', color.rgba);
              this.safeSetStyle('--gradient-end', `rgb(${darkerRgb[0]}, ${darkerRgb[1]}, ${darkerRgb[2]})`);
              this.safeSetStyle('--accent-color', color.rgba);
            } else {
              this.dominantColorSubject.next('#4a4a4a');

              this.safeSetStyle('--gradient-start', '#4a4a4a');
              this.safeSetStyle('--gradient-end', '#2a2a2a');
              this.safeSetStyle('--accent-color', '#4a4a4a');
            }
            resolve();
          })
          .catch(e => {
            console.error('Error extracting average color:', e);
            this.setYouTubeMusicTheme();
            resolve();
          });
      };

      img.onerror = () => {
        console.error('Error loading image:', imageUrl);
        this.setYouTubeMusicTheme();
        resolve();
      };
    });
  }

  getDominantColor(): string {
    return this.dominantColorSubject.value;
  }

  private parseRGB(rgb: string): number[] {
    const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    return match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])] : [15, 20, 25];
  }

  private darkenColor(rgb: number[], factor: number): number[] {
    return rgb.map(value => Math.max(0, Math.round(value * (1 - factor))));
  }

  private safeSetStyle(property: string, value: string): void {
    const current = getComputedStyle(document.documentElement).getPropertyValue(property).trim();
    if (current !== value) {
      this.renderer.setStyle(document.documentElement, property, value);
    }
  }
}
