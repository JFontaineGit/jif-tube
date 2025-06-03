import { Injectable } from '@angular/core';
import { BehaviorSubject, map } from 'rxjs';
import ColorThief from 'color-thief';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private colorThief = new ColorThief();
  private dominantColorSubject = new BehaviorSubject<string>('rgb(30, 41, 59)'); // Color por defecto
  dominantColor$ = this.dominantColorSubject.asObservable();

  // Generar un gradiente dinámico basado en el color predominante
  gradient$ = this.dominantColor$.pipe(
    map(color => {
      const rgb = this.parseRGB(color); // Extraer valores RGB
      const darkerRgb = this.darkenColor(rgb, 0.5); // Oscurecer el color para el gradiente
      return {
        start: color,
        end: `rgb(${darkerRgb[0]}, ${darkerRgb[1]}, ${darkerRgb[2]})`,
      };
    })
  );

  /**
   * Extrae el color predominante de una imagen y actualiza el tema.
   * @param imageUrl - URL de la imagen de la carátula.
   */
  updateThemeFromImage(imageUrl: string): void {
    const img = new Image();
    img.crossOrigin = 'Anonymous'; // Necesario para imágenes de dominios externos
    img.src = imageUrl;

    img.onload = () => {
      try {
        const color = this.colorThief.getColor(img);
        const rgbColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        this.dominantColorSubject.next(rgbColor);
      } catch (error) {
        console.error('Error al extraer el color predominante:', error);
        this.dominantColorSubject.next('rgb(30, 41, 59)'); // Fallback
      }
    };

    img.onerror = () => {
      console.error('Error al cargar la imagen para extraer el color');
      this.dominantColorSubject.next('rgb(30, 41, 59)'); // Fallback
    };
  }

  /**
   * Obtiene el color predominante actual.
   * @returns El color predominante en formato RGB.
   */
  getDominantColor(): string {
    return this.dominantColorSubject.value;
  }

  /**
   * Parsea un string RGB a un array de números.
   * @param rgb - Color en formato 'rgb(r, g, b)'.
   * @returns Array con los valores [r, g, b].
   */
  private parseRGB(rgb: string): number[] {
    const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
    }
    return [30, 41, 59]; // Fallback
  }

  /**
   * Oscurece un color RGB en un porcentaje dado.
   * @param rgb - Array con valores [r, g, b].
   * @param factor - Factor de oscurecimiento (0 a 1).
   * @returns Array con los valores oscurecidos [r, g, b].
   */
  private darkenColor(rgb: number[], factor: number): number[] {
    return rgb.map(value => Math.max(0, Math.round(value * (1 - factor))));
  }
}