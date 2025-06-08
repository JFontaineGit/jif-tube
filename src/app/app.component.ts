import { Component, OnInit, Renderer2, RendererFactory2, Inject, PLATFORM_ID } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './services/theme.service'; // Ajusta la ruta según tu estructura de carpetas
import { SidebarComponent } from './components/sidebar/sidebar.component'; // Ajusta la ruta
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-root',
  template: `
    <div class="app-container">
      <app-sidebar [accentColor]="getDominantColor()"></app-sidebar>
      <router-outlet></router-outlet>
    </div>
  `,
  standalone: true,
  imports: [RouterOutlet, SidebarComponent],
  styles: [`
    .app-container {
      display: flex;
      height: 100vh;
      background: linear-gradient(to bottom, var(--gradient-start, #0f172a), var(--gradient-end, #1e2a44));
      transition: background 0.5s ease;
    }
  `]
})
export class AppComponent implements OnInit {
  private renderer: Renderer2;
  private themeService: ThemeService;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    themeService: ThemeService,
    rendererFactory: RendererFactory2
  ) {
    this.themeService = themeService;
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.themeService.gradient$.subscribe(gradient => {
        this.renderer.setStyle(document.documentElement, '--gradient-start', gradient.start);
        this.renderer.setStyle(document.documentElement, '--gradient-end', gradient.end);
      });

      this.themeService.dominantColor$.subscribe(color => {
        this.renderer.setStyle(document.documentElement, '--dominant-color', color);
        this.renderer.setStyle(document.documentElement, '--accent-color', color);
      });
    }
  }

  getDominantColor(): string {
    return this.themeService.getDominantColor();
  }
}