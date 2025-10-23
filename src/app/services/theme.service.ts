import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FastAverageColor } from 'fast-average-color';
import Color, { type ColorInstance } from 'color';

const COLOR_KEY = '--ytmusic-album-color';
const DARK_COLOR_KEY = '--ytmusic-album-color-dark';
const RATIO_KEY = '--ytmusic-album-color-ratio';

declare global {
  interface DocumentEventMap {
    videodatachange: CustomEvent<{ videoId: string }>;
  }
}

interface PluginConfig {
  enabled: boolean;
  ratio: number;
}

interface ThemePalette {
  color: ColorInstance;
  darkColor: ColorInstance;
  rgb: string;
  darkRgb: string;
  hex: string;
}

interface UpdateOptions {
  apply?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private fac = new FastAverageColor();
  private color?: ColorInstance;
  private darkColor?: ColorInstance;
  private config: PluginConfig = { enabled: true, ratio: 0.5 };
  private initialized = false;
  private listenerRef: ((event: CustomEvent) => Promise<void>) | null = null;
  private paletteCache = new Map<string, ThemePalette>();
  private activeThumbnail: string | null = null;
  private requestId = 0;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  init(playerApi: any): void {
    if (!isPlatformBrowser(this.platformId) || this.initialized || !this.config.enabled) {
      return;
    }

    this.initialized = true;
    this.setRatio(this.config.ratio);

    const handler = async (event: CustomEvent) => {
      if (event.detail?.name !== 'dataloaded') return;

      const playerResponse = playerApi.getPlayerResponse();
      const thumbnail = playerResponse?.videoDetails?.thumbnail?.thumbnails?.at(0);
      if (!thumbnail) return;

      await this.updateFromThumbnail(thumbnail.url);
    };

    this.listenerRef = handler;
    document.addEventListener('videodatachange', handler);
  }

  async updateFromThumbnail(thumbnailUrl: string, options: UpdateOptions = {}): Promise<ThemePalette | null> {
    if (!isPlatformBrowser(this.platformId) || !thumbnailUrl) {
      return null;
    }

    const apply = options.apply ?? true;
    const normalizedUrl = this.normalizeThumbnailUrl(thumbnailUrl);
    const currentRequest = apply ? ++this.requestId : this.requestId;

    try {
      const palette = await this.extractPalette(normalizedUrl);
      if (!palette) {
        return null;
      }

      if (!apply) {
        return palette;
      }

      if (this.activeThumbnail === normalizedUrl && this.color) {
        return palette;
      }

      if (apply && currentRequest < this.requestId) {
        return palette;
      }

      this.color = palette.color;
      this.darkColor = palette.darkColor;
      this.activeThumbnail = normalizedUrl;

      document.documentElement.style.setProperty(COLOR_KEY, palette.rgb);
      document.documentElement.style.setProperty(DARK_COLOR_KEY, palette.darkRgb);

      const alpha = (await this.getAlpha()) ?? 1;
      this.updateColor(alpha);
      console.log('Color dominante extraído de thumbnail:', palette.hex);
      return palette;
    } catch (err) {
      if (apply) {
        this.resetPalette();
      }
      console.error('Error extracting color from thumbnail:', err);
      return null;
    }
  }

  setConfig(newConfig: Partial<PluginConfig>): void {
    this.config = { ...this.config, ...newConfig };
    if (this.initialized && this.config.enabled) {
      this.setRatio(this.config.ratio);
    }
  }

  private setRatio(ratio: number): void {
    document.documentElement.style.setProperty(RATIO_KEY, `${Math.round(ratio * 100)}%`);
  }

  private getMixedColor(color: string, key: string, alpha = 1, ratioMultiply?: number): string {
    const keyColor = `rgba(var(${key}), ${alpha})`;
    let colorRatio = `var(${RATIO_KEY}, 50%)`;
    let originalRatio = `calc(100% - var(${RATIO_KEY}, 50%))`;
    if (ratioMultiply) {
      colorRatio = `calc(var(${RATIO_KEY}, 50%) * ${ratioMultiply})`;
      originalRatio = `calc(100% - calc(var(${RATIO_KEY}, 50%) * ${ratioMultiply}))`;
    }
    return `color-mix(in srgb, ${color} ${originalRatio}, ${keyColor} ${colorRatio})`;
  }

  updateColor(alpha: number): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const variableMap = {
      '--ytmusic-color-black1': '#212121',
      '--ytmusic-color-black2': '#181818',
      '--ytmusic-color-black3': '#030303',
      '--ytmusic-color-black4': '#030303',
      '--ytmusic-color-blackpure': '#000',
      '--dark-theme-background-color': '#212121',
      '--yt-spec-base-background': '#0f0f0f',
      '--yt-spec-raised-background': '#212121',
      '--yt-spec-menu-background': '#282828',
      '--yt-spec-static-brand-black': '#212121',
      '--yt-spec-static-overlay-background-solid': '#000',
      '--yt-spec-static-overlay-background-heavy': 'rgba(0,0,0,0.8)',
      '--yt-spec-static-overlay-background-medium': 'rgba(0,0,0,0.6)',
      '--yt-spec-static-overlay-background-medium-light': 'rgba(0,0,0,0.3)',
      '--yt-spec-static-overlay-background-light': 'rgba(0,0,0,0.1)',
      '--yt-spec-general-background-a': '#181818',
      '--yt-spec-general-background-b': '#0f0f0f',
      '--yt-spec-general-background-c': '#030303',
      '--yt-spec-snackbar-background': '#030303',
      '--yt-spec-filled-button-text': '#030303',
      '--yt-spec-black-1': '#282828',
      '--yt-spec-black-2': '#1f1f1f',
      '--yt-spec-black-3': '#161616',
      '--yt-spec-black-4': '#0d0d0d',
      '--yt-spec-black-pure': '#000',
      '--yt-spec-black-pure-alpha-5': 'rgba(0,0,0,0.05)',
      '--yt-spec-black-pure-alpha-10': 'rgba(0,0,0,0.1)',
      '--yt-spec-black-pure-alpha-15': 'rgba(0,0,0,0.15)',
      '--yt-spec-black-pure-alpha-30': 'rgba(0,0,0,0.3)',
      '--yt-spec-black-pure-alpha-60': 'rgba(0,0,0,0.6)',
      '--yt-spec-black-pure-alpha-80': 'rgba(0,0,0,0.8)',
      '--yt-spec-black-1-alpha-98': 'rgba(40,40,40,0.98)',
      '--yt-spec-black-1-alpha-95': 'rgba(40,40,40,0.95)',
    };

    Object.entries(variableMap).forEach(([variable, baseColor]) => {
      document.documentElement.style.setProperty(variable, this.getMixedColor(baseColor, COLOR_KEY, alpha), 'important');
    });

    document.body.style.setProperty('background', this.getMixedColor('rgba(3, 3, 3)', DARK_COLOR_KEY, alpha), 'important');
    document.documentElement.style.setProperty(
      '--ytmusic-background',
      this.getMixedColor('rgba(3, 3, 3)', DARK_COLOR_KEY, alpha),
      'important'
    );
  }

  async getAlpha(): Promise<number | null> {
    return null;
  }

  destroy(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.initialized = false;
    if (this.listenerRef) {
      document.removeEventListener('videodatachange', this.listenerRef);
      this.listenerRef = null;
    }
  }

  private async extractPalette(thumbnailUrl: string): Promise<ThemePalette | null> {
    if (this.paletteCache.has(thumbnailUrl)) {
      return this.paletteCache.get(thumbnailUrl)!;
    }

    const albumColor = await new Promise<{ hex: string }>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = async () => {
        try {
          const result = await this.fac.getColorAsync(img);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = () => reject(new Error(`Error loading thumbnail for color extraction: ${thumbnailUrl}`));
      img.src = thumbnailUrl;
    });

    if (!albumColor?.hex) {
      return null;
    }

    let primary = Color(albumColor.hex).rgb();
    let dark = primary.darken(0.3).rgb();
    primary = primary.darken(0.15).rgb();

    while (primary.luminosity() > 0.5) {
      primary = primary.darken(0.05);
      dark = dark.darken(0.05);
    }

    const palette: ThemePalette = {
      color: primary,
      darkColor: dark,
      rgb: `${Math.round(primary.red())}, ${Math.round(primary.green())}, ${Math.round(primary.blue())}`,
      darkRgb: `${Math.round(dark.red())}, ${Math.round(dark.green())}, ${Math.round(dark.blue())}`,
      hex: albumColor.hex,
    };

    this.paletteCache.set(thumbnailUrl, palette);
    return palette;
  }

  private resetPalette(): void {
    this.color = undefined;
    this.darkColor = undefined;
    this.activeThumbnail = null;
    document.documentElement.style.setProperty(COLOR_KEY, '0, 0, 0');
    document.documentElement.style.setProperty(DARK_COLOR_KEY, '0, 0, 0');
  }

  private normalizeThumbnailUrl(url: string): string {
    if (!url) {
      return url;
    }

    try {
      const parsed = new URL(url, window.location.origin);
      if (parsed.protocol === 'http:') {
        parsed.protocol = 'https:';
      }
      parsed.hash = '';
      return parsed.toString();
    } catch {
      return url.replace('http://', 'https://');
    }
  }
}