import { Injectable, Renderer2, RendererFactory2, Inject, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, map } from 'rxjs';
import { FastAverageColor } from 'fast-average-color'; // Importación según documentación
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private dominantColorSubject = new BehaviorSubject<string>('rgb(0,0,1)'); // Alice blue por defecto
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
  }

  updateThemeFromImage(imageUrl: string, song?: { artist?: string; type?: string }): void {
    if (isPlatformBrowser(this.platformId)) {
      const fac = new FastAverageColor(); // Instancia de la clase según documentación
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = imageUrl;

      img.onload = () => {
        fac.getColorAsync(img)
          .then(color => {
            this.dominantColorSubject.next(color.rgba); // Usamos rgba directamente
          })
          .catch(e => {
            console.error('Error al extraer el color promedio:', e);
            this.dominantColorSubject.next(this.getFallbackColor(song));
          });
      };

      img.onerror = () => {
        console.error('Error al cargar la imagen:', imageUrl);
        this.dominantColorSubject.next(this.getFallbackColor(song));
      };
    }
  }

  getDominantColor(): string {
    return this.dominantColorSubject.value;
  }

  private parseRGB(rgb: string): number[] {
    const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/) || rgb.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+/);
    return match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])] : [240, 248, 255];
  }

  private darkenColor(rgb: number[], factor: number): number[] {
    return rgb.map(value => Math.max(0, Math.round(value * (1 - factor))));
  }

  private getFallbackColor(song?: { artist?: string; type?: string }): string {
    if (!song) return 'rgb(240, 248, 255)';
    const artistLower = song.artist?.toLowerCase();
    const type = song.type;

    if (artistLower?.includes('pop')) return 'rgb(245, 222, 179)';
    if (artistLower?.includes('rock')) return 'rgb(211, 211, 211)';
    if (type === 'official-video') return 'rgb(144, 238, 144)';
    if (type === 'album-track') return 'rgb(221, 160, 221)';
    return 'rgb(240, 248, 255)';
  }
}