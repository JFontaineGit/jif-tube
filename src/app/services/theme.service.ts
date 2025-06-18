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
  // Color dominante actual, arranca con un verde oscuro
  private dominantColorSubject = new BehaviorSubject<string>('#1a4d4d');
  dominantColor$ = this.dominantColorSubject.asObservable();

  /* 
    Observable que genera un gradiente partiendo del color dominante,
    con un color más oscuro para el final
  */
  readonly gradient$: Observable<{ start: string; end: string }> =
    this.dominantColor$.pipe(
      map((color) => {
        const rgb = this.parseRGB(color);
        const darkerRgb = this.darkenColor(rgb, 0.2);
        return {
          start: color,
          end: `rgb(${darkerRgb[0]}, ${darkerRgb[1]}, ${darkerRgb[2]})`,
        };
      })
    );

  private renderer: Renderer2;
  private fac = new FastAverageColor(); // Librería para sacar el color promedio de una imagen
  private lastImageRequest: Promise<void> | null = null; // Guarda la última promesa de extracción para control

  constructor(
    rendererFactory: RendererFactory2,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.renderer = rendererFactory.createRenderer(null, null);
    this.setDefaultTheme(); // Arranca con tema predeterminado
  }

  // Setea un tema fijo, útil como fallback o inicio
  setDefaultTheme(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.dominantColorSubject.next('#3f0d84'); // morado fuerte
      this.safeSetStyle('--gradient-start', '#3f0d84');
      this.safeSetStyle('--gradient-end', '#05352e');
      this.safeSetStyle('--accent-color', '#1a4d4d');
    }
  }

  // Actualiza el tema según la imagen que se pase
  updateThemeFromImage(
    imageUrl: string,
    song?: { artist?: string; type?: string }
  ): void {
    if (!isPlatformBrowser(this.platformId)) return; // Solo navegador

    this.lastImageRequest = null;

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageUrl;

    this.lastImageRequest = new Promise<void>((resolve) => {
      img.onload = () => {
        this.fac
          .getColorAsync(img)
          .then((color) => {
            if (color.isDark) {
              this.dominantColorSubject.next(color.rgba);

              const rgb = this.parseRGB(color.rgba);
              const darkerRgb = this.darkenColor(rgb, 0.3);

              this.safeSetStyle('--gradient-start', color.rgba);
              this.safeSetStyle(
                '--gradient-end',
                `rgb(${darkerRgb[0]}, ${darkerRgb[1]}, ${darkerRgb[2]})`
              );
              this.safeSetStyle('--accent-color', color.rgba);
              console.log('Theme updated from image:', {
                '--gradient-start': color.rgba,
                '--gradient-end': `rgb(${darkerRgb[0]}, ${darkerRgb[1]}, ${darkerRgb[2]})`,
                '--accent-color': color.rgba,
              });
            } else {
              this.dominantColorSubject.next('#4a4a4a');

              this.safeSetStyle('--gradient-start', '#4a4a4a');
              this.safeSetStyle('--gradient-end', '#2a2a2a');
              this.safeSetStyle('--accent-color', '#4a4a4a');
              console.log('Light image fallback applied:', {
                '--gradient-start': '#2a2a2a',
                '--gradient-end': '#1a1a1a',
                '--accent-color': '#3f0d84',
              });
            }
            resolve();
          })
          .catch((e) => {
            // Si algo falla, aviso y vuelvo al tema base
            console.error('Error extracting average color:', e);
            this.setDefaultTheme();
            resolve();
          });
      };

      img.onerror = () => {
        // Si la imagen no carga, también fallback
        console.error('Error loading image:', imageUrl);
        this.setDefaultTheme();
        resolve();
      };
    });
  }

  // Devuelve el color dominante actual (el último seteado)
  getDominantColor(): string {
    return this.dominantColorSubject.value;
  }

  // Parseo la cadena 'rgba(123, 45, 67, ...)' y saco solo los números RGB
  private parseRGB(rgb: string): number[] {
    const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    return match
      ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])]
      : [15, 20, 25]; // un gris oscuro si no se pudo parsear bien
  }

  // Oscurece un color RGB según factor (0.2 = 20% más oscuro)
  private darkenColor(rgb: number[], factor: number): number[] {
    return rgb.map((value) => Math.max(0, Math.round(value * (1 - factor))));
  }

  /* 
    Setea la variable CSS si es que el valor nuevo es distinto al actual,
    para evitar estilos que se setean sin necesidad
  */
  private safeSetStyle(property: string, value: string): void {
    const current = getComputedStyle(document.documentElement)
      .getPropertyValue(property)
      .trim();
    if (current !== value) {
      this.renderer.setStyle(document.documentElement, property, value);
      console.log(`Set style ${property} to ${value} on :root`);
      // Verificar que se aplicó
      const computed = getComputedStyle(document.documentElement)
        .getPropertyValue(property)
        .trim();
      console.log(`Computed ${property} after set: ${computed}`);
    }
  }
}
