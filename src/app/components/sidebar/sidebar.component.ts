import { Component, Input, inject, Renderer2, RendererFactory2, PLATFORM_ID, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { ThemeService } from '../../services/theme.service';
import { isPlatformBrowser } from '@angular/common';
import { filter } from 'rxjs/operators';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  active: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent implements OnInit {
  private router = inject(Router);
  private themeService = inject(ThemeService);
  private renderer: Renderer2;
  private isBrowser: boolean;

  @Input() accentColor: string = 'rgb(156, 39, 176)';

  navItems: NavItem[] = [
    { label: 'Home', icon: 'home', route: '/', active: true },
    { label: 'Library', icon: 'library_music', route: '/library', active: false },
    { label: 'History', icon: 'history', route: '/history', active: false },
  ];

  settingsItem: NavItem = { label: 'Settings', icon: 'settings', route: '/settings', active: false };

  constructor(
    rendererFactory: RendererFactory2,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.renderer = rendererFactory.createRenderer(null, null);
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit() {
    if (this.isBrowser) {
      this.renderer.setStyle(document.documentElement, '--accent-color', this.accentColor);
    }

    this.themeService.dominantColor$.subscribe(color => {
      if (this.isBrowser) {
        this.renderer.setStyle(document.documentElement, '--accent-color', color);
      }
    });

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.updateActiveItem(event.urlAfterRedirects);
      });

    this.updateActiveItem(this.router.url);
  }

  updateActiveItem(url: string): void {
    this.navItems.forEach(item => {
      item.active = url === item.route || url.startsWith(item.route + '/');
    });
    this.settingsItem.active = url === this.settingsItem.route || url.startsWith(this.settingsItem.route + '/');
  }
}