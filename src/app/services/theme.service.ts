import { Injectable, Renderer2, RendererFactory2, Inject, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, map } from 'rxjs';
import { FastAverageColor } from 'fast-average-color';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private dominantColorSubject = new BehaviorSubject<string>('rgb(15, 20, 25)');
  dominantColor$ = this.dominantColorSubject.asObservable();

  gradient$ = this.dominantColor$.pipe(
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

  constructor(
    rendererFactory: RendererFactory2,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.renderer = rendererFactory.createRenderer(null, null);
    // Establecer el tema YouTube Music por defecto
    this.setYouTubeMusicTheme();
  }

  setYouTubeMusicTheme(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.renderer.setStyle(document.documentElement, '--gradient-start', '#0f1419');
      this.renderer.setStyle(document.documentElement, '--gradient-end', '#1a4d4d');
      this.dominantColorSubject.next('rgb(15, 20, 25)');
    }
  }

  updateThemeFromImage(imageUrl: string, song?: { artist?: string; type?: string }): void {
    if (isPlatformBrowser(this.platformId)) {
      const fac = new FastAverageColor();
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = imageUrl;

      img.onload = () => {
        fac.getColorAsync(img)
          .then(color => {
            this.dominantColorSubject.next(color.rgba);
            const rgb = this.parseRGB(color.rgba);
            const darkerRgb = this.darkenColor(rgb, 0.3);
            this.renderer.setStyle(document.documentElement, '--gradient-start', color.rgba);
            this.renderer.setStyle(document.documentElement, '--gradient-end', 
              `rgb(${darkerRgb[0]}, ${darkerRgb[1]}, ${darkerRgb[2]})`);
          })
          .catch(e => {
            console.error('Error al extraer el color promedio:', e);
            this.setYouTubeMusicTheme(); // Volver al tema por defecto
          });
      };

      img.onerror = () => {
        console.error('Error al cargar la imagen:', imageUrl);
        this.setYouTubeMusicTheme(); 
      };
    }
  }

  getDominantColor(): string {
    return this.dominantColorSubject.value;
  }

  private parseRGB(rgb: string): number[] {
    const match = rgb.match(/rgb$$(\d+),\s*(\d+),\s*(\d+)$$/) || rgb.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+/);
    return match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])] : [15, 20, 25];
  }

  private darkenColor(rgb: number[], factor: number): number[] {
    return rgb.map(value => Math.max(0, Math.round(value * (1 - factor))));
  }

  private getFallbackColor(song?: { artist?: string; type?: string }): string {
    return 'rgb(15, 20, 25)';
  }
}