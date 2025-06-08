import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlayerService } from '../../services/player.service';
import { ThemeService } from '../../services/theme.service';
import { isPlatformBrowser } from '@angular/common';

interface ThemeOption {
  label: string;
  value: string;
  icon: string;
}

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings-page.component.html',
  styleUrls: ['./settings-page.component.scss'],
})
export class SettingsPageComponent implements OnInit {
  themeOptions: ThemeOption[] = [
    { label: 'Dark', value: 'dark', icon: 'dark_mode' },
    { label: 'Light', value: 'light', icon: 'light_mode' },
    { label: 'Dynamic', value: 'dynamic', icon: 'color_lens' }, // Nueva opción para tema dinámico
  ];

  selectedTheme = 'dynamic'; // Por defecto, usa el tema dinámico
  autoplay = true;

  constructor(
    private playerService: PlayerService,
    private themeService: ThemeService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId) && typeof window !== 'undefined' && window.localStorage) {
      const savedTheme = localStorage.getItem('theme');
      this.selectedTheme = savedTheme || 'dynamic';
      this.applyTheme(this.selectedTheme);

      const savedAutoplay = localStorage.getItem('autoplay');
      this.autoplay = savedAutoplay ? JSON.parse(savedAutoplay) : true;
    } else {
      this.applyTheme(this.selectedTheme);
      this.autoplay = true;
    }
  }

  changeTheme(theme: string): void {
    this.selectedTheme = theme;
    this.applyTheme(theme);
    if (isPlatformBrowser(this.platformId) && typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('theme', theme);
    }
  }

  applyTheme(theme: string) {
    if (isPlatformBrowser(this.platformId) && typeof document !== 'undefined') {
      if (theme === 'dynamic') {
        // No aplicamos data-theme, dejamos que ThemeService maneje el color
        this.themeService.dominantColor$.subscribe(color => {
          document.documentElement.style.setProperty('--accent-color', color);
        });
      } else {
        document.documentElement.setAttribute('data-theme', theme);
      }
    }
  }

  toggleAutoplay(): void {
    this.autoplay = !this.autoplay;
    if (isPlatformBrowser(this.platformId) && typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('autoplay', JSON.stringify(this.autoplay));
    }
    this.playerService.setAutoplay(this.autoplay);
  }

  clearData(): void {
    if (confirm('¿Estás seguro de que quieres borrar todos los datos de la aplicación? Esta acción no se puede deshacer.')) {
      if (isPlatformBrowser(this.platformId) && typeof window !== 'undefined' && window.localStorage) {
        localStorage.clear();
      }
      this.playerService.clearHistory();
      this.selectedTheme = 'dynamic';
      this.autoplay = true;
      this.applyTheme('dynamic');
      console.log('Datos borrados');
    }
  }
}