import {
  Component,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  OnInit,
  OnDestroy,
  Input,
  signal,
  HostListener,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  BehaviorSubject,
  debounceTime,
  distinctUntilChanged,
  Subject,
  takeUntil
} from 'rxjs';
import { AuthService, StorageService, LoggerService } from '@services';
import { UserRead } from '@interfaces';
import { AuthDialogComponent } from '../auth-dialog/auth-dialog.component';

interface SearchEvent {
  query: string;
  tab: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, AuthDialogComponent],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
})
export class NavbarComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly storage = inject(StorageService);
  private readonly logger = inject(LoggerService);
  private readonly router = inject(Router);
  
  private readonly destroy$ = new Subject<void>();
  private readonly searchSubject = new BehaviorSubject<string>('');

  @Input() isScrolled = false;
  @Input() sidebarCollapsed = false;
  @Output() search = new EventEmitter<SearchEvent>();
  @Output() toggleSidebar = new EventEmitter<void>();
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  private readonly _searchQuery = signal<string>('');
  private readonly _isFocused = signal<boolean>(false);
  private readonly _noResults = signal<boolean>(false);
  private readonly _activeTab = signal<string>('all');

  readonly searchQuery = this._searchQuery.asReadonly();
  readonly isFocused = this._isFocused.asReadonly();
  readonly noResults = this._noResults.asReadonly();
  readonly activeTab = this._activeTab.asReadonly();

  private readonly _isAuthDialogOpen = signal(false);
  private readonly _isUserMenuOpen = signal(false);
  private readonly _currentUser = signal<UserRead | null>(null);
  private readonly _isLoadingUser = signal(false);

  readonly isAuthDialogOpen = this._isAuthDialogOpen.asReadonly();
  readonly isUserMenuOpen = this._isUserMenuOpen.asReadonly();
  readonly currentUser = this._currentUser.asReadonly();
  readonly isLoadingUser = this._isLoadingUser.asReadonly();

  constructor() {
    // Debounce search input
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(query => {
        if (query.trim()) {
          this.search.emit({
            query: query.trim(),
            tab: this.activeTab()
          });
        }
      });
  }

  ngOnInit(): void {
    this.loadCurrentUser();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadCurrentUser(): void {
    this.storage.getAccessToken().subscribe({
      next: (token) => {
        if (!token) {
          this._currentUser.set(null);
          return;
        }

        this._isLoadingUser.set(true);
        
        this.authService.loadUserProfile().subscribe({
          next: (user) => {
            this.logger.debug('Usuario cargado en navbar', { username: user.username });
            this._currentUser.set(user);
          },
          error: (error) => {
            this.logger.error('Error cargando usuario en navbar', error);
            this._currentUser.set(null);
            
            // Si token inválido, limpiar
            if (error.status === 401) {
              this.storage.clearTokens().subscribe();
            }
          },
          complete: () => {
            this._isLoadingUser.set(false);
          }
        });
      },
      error: (err) => {
        this.logger.error('Error leyendo token', err);
        this._currentUser.set(null);
      }
    });
  }

  openAuthDialog(): void {
    this._isAuthDialogOpen.set(true);
  }

  closeUserMenu(): void {
    this._isUserMenuOpen.set(false);
  }
  
  closeAuthDialog(): void {
    this._isAuthDialogOpen.set(false);
  }

  onAuthSuccess(): void {
    this.logger.info('Auth exitoso, recargando usuario');
    this.loadCurrentUser();
    this.router.navigate(['/home']);
  }

  toggleUserMenu(): void {
    this._isUserMenuOpen.update(current => !current);
  }

  logout(): void {
    this.logger.info('Iniciando logout desde navbar');
    this._isLoadingUser.set(true);
    
    this.authService.logout().subscribe({
      next: () => {
        this.logger.info('Logout exitoso');
        this._currentUser.set(null);
        this._isUserMenuOpen.set(false);
        this.router.navigate(['/']);
      },
      error: (error) => {
        this.logger.error('Error en logout', error);
        // Limpiar estado local aunque falle el backend
        this._currentUser.set(null);
        this._isUserMenuOpen.set(false);
        this.router.navigate(['/']);
      },
      complete: () => {
        this._isLoadingUser.set(false);
      }
    });
  }

  getUserInitials(): string {
    const user = this.currentUser();
    if (!user) return 'U';
    
    if (user.username) {
      const initials = user.username.substring(0, 2).toUpperCase();
      return initials;
    }
    
    if (user.email) {
      return user.email
        .split('@')[0]
        .substring(0, 2)
        .toUpperCase();
    }
    
    return 'U';
  }

  getUserDisplayName(): string {
    const user = this.currentUser();
    if (!user) return '';
    
    return user.username || user.email?.split('@')[0] || 'Usuario';
  }

  onToggleSidebar(): void {
    this.toggleSidebar.emit();
  }

  onFocus(): void {
    this._isFocused.set(true);
    this._noResults.set(false);
  }

  onBlur(): void {
    setTimeout(() => {
      this._isFocused.set(false);
    }, 150);
  }

  onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = target.value;
    this._searchQuery.set(value);
    this._noResults.set(false);
    
    if (value.trim()) {
      this.searchSubject.next(value);
    }
  }

  searchSongs(): void {
    const query = this.searchQuery().trim();
    if (!query) return;

    this.search.emit({
      query,
      tab: this.activeTab()
    });

    // Blur input after search
    if (this.searchInput?.nativeElement) {
      this.searchInput.nativeElement.blur();
    }
  }

  clearSearch(): void {
    this._searchQuery.set('');
    this._noResults.set(false);
    
    if (this.searchInput?.nativeElement) {
      this.searchInput.nativeElement.focus();
    }
  }

  setActiveTab(tab: string): void {
    this._activeTab.set(tab);
    const query = this.searchQuery().trim();
    
    if (query) {
      this.search.emit({ query, tab });
    }
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.clearSearch();
      event.preventDefault();
    }
  }

  onSearchFormKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault();
        break;
      case 'Enter':
        event.preventDefault();
        this.searchSongs();
        break;
    }
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.isScrolled = window.scrollY > 50;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    
    if (!target.closest('.user-menu-container')) {
      this._isUserMenuOpen.set(false);
    }
  }
}