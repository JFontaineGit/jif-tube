import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StorageService } from '../../services/core/storage.service';
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
    { label: 'Dynamic', value: 'dynamic', icon: 'color_lens' },
  ];

  selectedTheme = 'dynamic';
  autoplay = true;

  constructor(
    private playerService: PlayerService,
    private themeService: ThemeService,
    private storage: StorageService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    this.storage.get<string>('theme').subscribe((savedTheme) => {
      this.selectedTheme = savedTheme || 'dynamic';
      this.applyTheme(this.selectedTheme);
    });

    this.storage.get<boolean>('autoplay').subscribe((savedAutoplay) => {
      this.autoplay = savedAutoplay ?? true;
    });
  }

  changeTheme(theme: string): void {
    this.selectedTheme = theme;
    this.applyTheme(theme);
    this.storage.save('theme', theme).subscribe();
  }

  applyTheme(theme: string) {
    if (isPlatformBrowser(this.platformId) && typeof document !== 'undefined') {
      if (theme === 'dynamic') {
        // No aplicamos data-theme, dejamos que ThemeService maneje el color
        this.themeService.dominantColor$.subscribe((color) => {
          document.documentElement.style.setProperty('--accent-color', color);
        });
      } else {
        document.documentElement.setAttribute('data-theme', theme);
      }
    }
  }

  toggleAutoplay(): void {
    this.autoplay = !this.autoplay;
    this.storage.save('autoplay', this.autoplay).subscribe();
    this.playerService.setAutoplay(this.autoplay);
  }

  clearData(): void {
    if (
      confirm(
        '¿Estás seguro de que quieres borrar todos los datos de la aplicación? Esta acción no se puede deshacer.'
      )
    ) {
      this.storage.clearStorage().subscribe(() => {
        this.playerService.clearHistory();
        this.selectedTheme = 'dynamic';
        this.autoplay = true;
        this.applyTheme('dynamic');
        console.log('Datos borrados');
      });
    }
  }
}
