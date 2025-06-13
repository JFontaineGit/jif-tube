import { Component, Input, OnInit, Renderer2, RendererFactory2 } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../services/theme.service'; 

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
  @Input() accentColor: string = 'rgb(156, 39, 176)'; // Valor por defecto
  

  navItems: NavItem[] = [
    { label: 'Home', icon: 'home', route: '/', active: true },
    { label: 'Library', icon: 'library_music', route: '/library', active: false },
    { label: 'History', icon: 'history', route: '/history', active: false },
  ];

  settingsItem: NavItem = { label: 'Settings', icon: 'settings', route: '/settings', active: false };

  private renderer: Renderer2;
  private isBrowser: boolean;

  constructor(
    private router: Router,
    private themeService: ThemeService,
    rendererFactory: RendererFactory2,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {
    this.renderer = rendererFactory.createRenderer(null, null);
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit() {
    this.themeService.dominantColor$.subscribe(color => {
      this.accentColor = color;
      if (this.isBrowser) {
        this.renderer.setStyle(document.documentElement, '--accent-color', color);
      }
    });
    this.updateActiveItem(this.router.url);
    this.router.events.subscribe((event: any) => {
      if (event.url) {
        this.updateActiveItem(event.url);
      }
    });
  }

  updateActiveItem(url: string): void {
    this.navItems.forEach((item) => (item.active = false));
    this.settingsItem.active = false;

    const activeItem = this.navItems.find((item) => url === item.route || url.startsWith(item.route + '/'));
    if (activeItem) {
      activeItem.active = true;
    } else if (url === this.settingsItem.route || url.startsWith(this.settingsItem.route + '/')) {
      this.settingsItem.active = true;
    }
  }
}