import {
  Injectable,
  Renderer2,
  RendererFactory2,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { BehaviorSubject, map, Observable, debounceTime } from 'rxjs';
import { FastAverageColor } from 'fast-average-color';
import { isPlatformBrowser } from '@angular/common';

interface ThemeColors {
  primary: string;
  primaryHover: string;
  accent: string;
  gradientStart: string;
  gradientEnd: string;
}

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private dominantColorSubject = new BehaviorSubject<string>('#6366f1');
  dominantColor$ = this.dominantColorSubject.asObservable();

  private themeColorsSubject = new BehaviorSubject<ThemeColors>({
    primary: '#6366f1',
    primaryHover: '#4f46e5',
    accent: '#06b6d4',
    gradientStart: '#6366f1',
    gradientEnd: '#8b5cf6',
  });
  themeColors$ = this.themeColorsSubject.asObservable();

  readonly gradient$: Observable<{ start: string; end: string }> =
    this.dominantColor$.pipe(
      debounceTime(100),
      map((color) => {
        const rgb = this.parseRGB(color);
        const darkerRgb = this.adjustColor(rgb, -0.3);
        const lighterRgb = this.adjustColor(rgb, 0.1);
        return {
          start: `rgb(${lighterRgb[0]}, ${lighterRgb[1]}, ${lighterRgb[2]})`,
          end: `rgb(${darkerRgb[0]}, ${darkerRgb[1]}, ${darkerRgb[2]})`,
        };
      })
    );

  private renderer: Renderer2;
  private fac = new FastAverageColor();
  private lastImageRequest: Promise<void> | null = null;
  private currentImageUrl: string | null = null;

  constructor(
    rendererFactory: RendererFactory2,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.renderer = rendererFactory.createRenderer(null, null);
    this.setDefaultTheme();
  }

  setDefaultTheme(): void {
    if (isPlatformBrowser(this.platformId)) {
      const defaultColors: ThemeColors = {
        primary: '#6366f1',
        primaryHover: '#4f46e5',
        accent: '#06b6d4',
        gradientStart: '#6366f1',
        gradientEnd: '#8b5cf6',
      };

      this.applyTheme(defaultColors);
      this.dominantColorSubject.next(defaultColors.primary);
      this.themeColorsSubject.next(defaultColors);
    }
  }

  updateThemeFromImage(
    imageUrl: string,
    song?: { artist?: string; type?: string }
  ): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Evitar procesar la misma imagen múltiples veces
    if (this.currentImageUrl === imageUrl) return;
    this.currentImageUrl = imageUrl;

    // Cancelar request anterior si existe
    this.lastImageRequest = null;

    const img = new Image();
    img.crossOrigin = 'Anonymous';

    this.lastImageRequest = new Promise<void>((resolve) => {
      img.onload = () => {
        this.fac
          .getColorAsync(img)
          .then((color) => {
            const themeColors = this.generateThemeFromColor(color);
            this.applyTheme(themeColors);
            this.dominantColorSubject.next(themeColors.primary);
            this.themeColorsSubject.next(themeColors);

            console.log('🎨 Theme updated from image:', themeColors);
            resolve();
          })
          .catch((e) => {
            console.error('❌ Error extracting average color:', e);
            this.setDefaultTheme();
            resolve();
          });
      };

      img.onerror = () => {
        console.error('❌ Error loading image:', imageUrl);
        this.setDefaultTheme();
        resolve();
      };
    });

    img.src = imageUrl;
  }

  private generateThemeFromColor(color: any): ThemeColors {
    const rgb = this.parseRGB(color.rgba);
    const hsl = this.rgbToHsl(rgb[0], rgb[1], rgb[2]);

    // Ajustar saturación y luminosidad para mejor contraste
    const adjustedHsl = [
      hsl[0], // Mantener el hue
      Math.max(0.4, Math.min(0.8, hsl[1])), // Saturación entre 40-80%
      color.isDark ? Math.max(0.3, hsl[2]) : Math.min(0.6, hsl[2]), // Ajustar luminosidad
    ];

    const primaryRgb = this.hslToRgb(
      adjustedHsl[0],
      adjustedHsl[1],
      adjustedHsl[2]
    );
    const primary = `rgb(${primaryRgb[0]}, ${primaryRgb[1]}, ${primaryRgb[2]})`;

    // Generar colores relacionados
    const primaryHoverRgb = this.adjustColor(primaryRgb, -0.1);
    const primaryHover = `rgb(${primaryHoverRgb[0]}, ${primaryHoverRgb[1]}, ${primaryHoverRgb[2]})`;

    // Accent color con hue complementario
    const accentHue = (adjustedHsl[0] + 0.5) % 1;
    const accentRgb = this.hslToRgb(accentHue, adjustedHsl[1], adjustedHsl[2]);
    const accent = `rgb(${accentRgb[0]}, ${accentRgb[1]}, ${accentRgb[2]})`;

    // Gradiente
    const gradientEndRgb = this.adjustColor(primaryRgb, 0.1);
    const gradientEnd = `rgb(${gradientEndRgb[0]}, ${gradientEndRgb[1]}, ${gradientEndRgb[2]})`;

    return {
      primary,
      primaryHover,
      accent,
      gradientStart: primary,
      gradientEnd,
    };
  }

  private applyTheme(colors: ThemeColors): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const root = document.documentElement;

    // Aplicar colores dinámicos
    this.safeSetStyle('--dynamic-primary', colors.primary);
    this.safeSetStyle('--dynamic-primary-hover', colors.primaryHover);
    this.safeSetStyle('--dynamic-accent', colors.accent);
    this.safeSetStyle('--dynamic-gradient-start', colors.gradientStart);
    this.safeSetStyle('--dynamic-gradient-end', colors.gradientEnd);

    // Aplicar gradiente al fondo del body
    const gradient = `radial-gradient(circle at top right, ${colors.gradientStart}, ${colors.gradientEnd} 40%, var(--bg-primary) 80%)`;
    this.safeSetStyle('background', gradient, document.body);
  }

  getDominantColor(): string {
    return this.dominantColorSubject.value;
  }

  getThemeColors(): ThemeColors {
    return this.themeColorsSubject.value;
  }

  private parseRGB(rgb: string): number[] {
    const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    return match
      ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])]
      : [99, 102, 241]; // Fallback al primary color
  }

  private adjustColor(rgb: number[], factor: number): number[] {
    return rgb.map((value) => {
      const adjusted =
        factor > 0 ? value + (255 - value) * factor : value * (1 + factor);
      return Math.max(0, Math.min(255, Math.round(adjusted)));
    });
  }

  private rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0,
      s = 0,
      l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }

    return [h, s, l];
  }

  private hslToRgb(h: number, s: number, l: number): [number, number, number] {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  private safeSetStyle(
    property: string,
    value: string,
    element: HTMLElement = document.documentElement
  ): void {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      const current = getComputedStyle(element)
        .getPropertyValue(property)
        .trim();
      if (current !== value) {
        this.renderer.setStyle(element, property, value);
      }
    } catch (error) {
      console.warn(`⚠️ Error setting style ${property}:`, error);
    }
  }
}
