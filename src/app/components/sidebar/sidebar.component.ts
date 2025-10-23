import {
  Component,
  OnInit,
  OnDestroy,
  Input,
  Output,
  EventEmitter,
  inject,
  PLATFORM_ID,
  Inject,
  signal,
  computed
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter, takeUntil, Subject } from 'rxjs';

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
export class SidebarComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private destroy$ = new Subject<void>();
  private isBrowser: boolean;

  @Input() isOpen = false;
  @Input() isCollapsed = false;
  @Output() toggleSidebar = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  currentRoute = signal('');

  navItems = computed(() => [
    {
      label: 'Inicio',
      icon: 'home',
      route: '/',
      active: this.isRouteActive(this.currentRoute(), '/')
    },
    {
      label: 'Biblioteca',
      icon: 'library_music',
      route: '/library',
      active: this.isRouteActive(this.currentRoute(), '/library')
    },
    {
      label: 'Historial',
      icon: 'history',
      route: '/history',
      active: this.isRouteActive(this.currentRoute(), '/history')
    },
    {
      label: 'Me gusta',
      icon: 'favorite',
      route: '/liked',
      active: this.isRouteActive(this.currentRoute(), '/liked')
    },
  ]);

  settingsItem = computed(() => ({
    label: 'Ajustes',
    icon: 'settings',
    route: '/settings',
    active: this.isRouteActive(this.currentRoute(), '/settings')
  }));

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    this.setupRouterSubscription();
    this.updateActiveItem(this.router.url);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupRouterSubscription(): void {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event) => {
        this.updateActiveItem(event.urlAfterRedirects);
        this.currentRoute.set(event.urlAfterRedirects);
      });
  }

  private updateActiveItem(url: string): void {
    this.currentRoute.set(url);
  }

  private isRouteActive(currentUrl: string, itemRoute: string): boolean {
    if (itemRoute === '/') {
      return currentUrl === '/' || currentUrl === '';
    }
    return currentUrl.startsWith(itemRoute);
  }

  onNavItemClick(): void {
    if (this.isBrowser && window.innerWidth <= 768) {
      this.close.emit();
    }
  }

  onToggle(): void {
    this.toggleSidebar.emit();
  }

  onClose(): void {
    this.close.emit();
  }
}