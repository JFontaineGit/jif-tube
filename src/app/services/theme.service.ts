import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FastAverageColor } from 'fast-average-color';
import Color, { type ColorInstance } from 'color';

const COLOR_KEY = '--ytmusic-album-color';
const DARK_COLOR_KEY = '--ytmusic-album-color-dark';
const RATIO_KEY = '--ytmusic-album-color-ratio';
const BASE_GRADIENT =
  'linear-gradient(135deg, #0b1120 0%, #111827 45%, #030712 100%)';
const SURFACE_SOLID = 'rgba(15, 23, 42, 0.94)';
const SURFACE_MUTED = 'rgba(13, 20, 32, 0.88)';
const SURFACE_SOFT = 'rgba(8, 13, 23, 0.92)';
const SURFACE_CARD = 'rgba(17, 25, 40, 0.78)';
const SURFACE_OVERLAY = 'rgba(10, 15, 25, 0.7)';
const SURFACE_GLASS = 'rgba(17, 25, 40, 0.55)';
const NAVBAR_SOLID = 'rgba(15, 23, 42, 0.95)';
const NAVBAR_BLUR = 'rgba(15, 23, 42, 0.6)';
const PLAYER_GLOW = 'rgba(15, 23, 42, 0.55)';

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
      this.applyDynamicSurfaces(palette);
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
    this.resetDynamicSurfaces();
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

  private applyDynamicSurfaces(palette: ThemePalette): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const gradient = `linear-gradient(135deg, color-mix(in srgb, rgba(${palette.rgb}, 0.35) 60%, #0b1120 40%) 0%, color-mix(in srgb, rgba(${palette.darkRgb}, 0.45) 65%, #111827 35%) 45%, color-mix(in srgb, rgba(${palette.darkRgb}, 0.65) 70%, #030712 30%) 100%)`;

    document.documentElement.style.setProperty('--app-dynamic-gradient', gradient);
    document.documentElement.style.setProperty(
      '--app-surface-solid',
      `color-mix(in srgb, rgba(${palette.darkRgb}, 0.85) 65%, ${SURFACE_SOLID} 35%)`
    );
    document.documentElement.style.setProperty(
      '--app-surface-muted',
      `color-mix(in srgb, rgba(${palette.rgb}, 0.75) 55%, ${SURFACE_MUTED} 45%)`
    );
    document.documentElement.style.setProperty(
      '--app-surface-soft',
      `color-mix(in srgb, rgba(${palette.darkRgb}, 0.7) 60%, ${SURFACE_SOFT} 40%)`
    );
    document.documentElement.style.setProperty(
      '--app-card-surface',
      `color-mix(in srgb, rgba(${palette.rgb}, 0.65) 55%, ${SURFACE_CARD} 45%)`
    );
    document.documentElement.style.setProperty(
      '--app-overlay',
      `color-mix(in srgb, rgba(${palette.darkRgb}, 0.6) 55%, ${SURFACE_OVERLAY} 45%)`
    );
    document.documentElement.style.setProperty(
      '--app-glass',
      `color-mix(in srgb, rgba(${palette.rgb}, 0.55) 60%, ${SURFACE_GLASS} 40%)`
    );
    document.documentElement.style.setProperty(
      '--app-navbar-solid',
      `color-mix(in srgb, rgba(${palette.darkRgb}, 0.8) 60%, ${NAVBAR_SOLID} 40%)`
    );
    document.documentElement.style.setProperty(
      '--app-navbar-blur',
      `color-mix(in srgb, rgba(${palette.darkRgb}, 0.55) 60%, ${NAVBAR_BLUR} 40%)`
    );
    document.documentElement.style.setProperty(
      '--app-player-glow',
      `color-mix(in srgb, rgba(${palette.rgb}, 0.58) 60%, ${PLAYER_GLOW} 40%)`
    );
  }

  private resetDynamicSurfaces(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    document.documentElement.style.setProperty('--app-dynamic-gradient', BASE_GRADIENT);
    document.documentElement.style.setProperty('--app-surface-solid', SURFACE_SOLID);
    document.documentElement.style.setProperty('--app-surface-muted', SURFACE_MUTED);
    document.documentElement.style.setProperty('--app-surface-soft', SURFACE_SOFT);
    document.documentElement.style.setProperty('--app-card-surface', SURFACE_CARD);
    document.documentElement.style.setProperty('--app-overlay', SURFACE_OVERLAY);
    document.documentElement.style.setProperty('--app-glass', SURFACE_GLASS);
    document.documentElement.style.setProperty('--app-navbar-solid', NAVBAR_SOLID);
    document.documentElement.style.setProperty('--app-navbar-blur', NAVBAR_BLUR);
    document.documentElement.style.setProperty('--app-player-glow', PLAYER_GLOW);
  }
}