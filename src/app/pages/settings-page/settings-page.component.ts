import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlayerService } from '../../services/player.service';

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
    { label: 'System', value: 'system', icon: 'settings_suggest' },
  ];

  selectedTheme = 'dark';
  autoplay = true;

  constructor(private playerService: PlayerService) {}

  ngOnInit() {
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        this.selectedTheme = savedTheme;
        this.applyTheme(savedTheme);
      } else {
        this.applyTheme(this.selectedTheme);
      }

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
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('theme', theme);
    }
  }

  applyTheme(theme: string) {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  toggleAutoplay(): void {
    this.autoplay = !this.autoplay;
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('autoplay', JSON.stringify(this.autoplay));
    }
    this.playerService.setAutoplay(this.autoplay);
  }

  clearData(): void {
    if (confirm('Are you sure you want to clear all app data? This action cannot be undone.')) {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.clear();
      }
      this.playerService.clearHistory();
      this.selectedTheme = 'dark';
      this.autoplay = true;
      this.applyTheme('dark');
      console.log('Data cleared');
    }
  }
}
