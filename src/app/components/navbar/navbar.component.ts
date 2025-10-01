// navbar.component.ts
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
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  BehaviorSubject,
  debounceTime,
  distinctUntilChanged,
  Subject,
  takeUntil
} from 'rxjs';
import { AuthService } from '../../services/auth/auth.service';
import { StorageService } from '../../services/core/storage.service';
import { LoggerService } from '../../services/core/logger.service';
import { AuthDialogComponent } from '../auth-dialog/auth-dialog.component';
import { MeUser } from '../../services/interfaces/auth.interfaces';

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
  
  private destroy$ = new Subject<void>();
  private searchSubject = new BehaviorSubject<string>('');

  @Input() isScrolled = false;
  @Output() search = new EventEmitter<SearchEvent>();
  @Output() toggleSidebar = new EventEmitter<void>();
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  // Search signals
  searchQuery = signal('');
  isFocused = signal(false);
  noResults = signal(false);
  activeTab = signal('all');

  // Auth signals
  isAuthDialogOpen = signal(false);
  isUserMenuOpen = signal(false);
  currentUser = signal<MeUser | null>(null);
  isLoadingUser = signal(false);

  constructor() {
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

  // ============ AUTH METHODS ============
  
  private loadCurrentUser(): void {
    const accessToken = this.storage.getAccessToken();
    
    if (!accessToken) {
      this.currentUser.set(null);
      return;
    }

    this.isLoadingUser.set(true);
    
    this.authService.me().subscribe({
      next: (user) => {
        this.logger.debug('Usuario cargado:', user);
        this.currentUser.set(user);
        this.isLoadingUser.set(false);
      },
      error: (error) => {
        this.logger.error('Error al cargar usuario:', error);
        this.currentUser.set(null);
        this.isLoadingUser.set(false);
        
        // If token is invalid, clear it
        if (error.status === 401) {
          this.storage.removeTokens();
        }
      }
    });
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.isScrolled = window.scrollY > 50;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu-container')) {
      this.isUserMenuOpen.set(false);
    }
  }

  openAuthDialog(): void {
    this.isAuthDialogOpen.set(true);
  }

  closeAuthDialog(): void {
    this.isAuthDialogOpen.set(false);
  }

  onAuthSuccess(): void {
    this.loadCurrentUser();
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen.set(!this.isUserMenuOpen());
  }

  logout(): void {
    this.isLoadingUser.set(true);
    
    this.authService.logout().subscribe({
      next: () => {
        this.logger.debug('Logout exitoso');
        this.storage.removeTokens();
        this.currentUser.set(null);
        this.isUserMenuOpen.set(false);
        this.isLoadingUser.set(false);
      },
      error: (error) => {
        this.logger.error('Error en logout:', error);
        // Even if logout fails, clear local tokens
        this.storage.removeTokens();
        this.currentUser.set(null);
        this.isUserMenuOpen.set(false);
        this.isLoadingUser.set(false);
      }
    });
  }

  getUserInitials(): string {
    const user = this.currentUser();
    if (!user) return 'U';
    
    if (user.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    
    if (user.email) {
      return user.email
        .split('@')[0]
        .split('.')
        .map((part: string) => part[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    }
    
    return 'U';
  }

  getUserDisplayName(): string {
    const user = this.currentUser();
    if (!user) return '';
    
    return user.username || user.email?.split('@')[0] || '';
  }

  // ============ SEARCH METHODS ============

  onToggleSidebar(): void {
    this.toggleSidebar.emit();
  }

  onFocus(): void {
    this.isFocused.set(true);
    this.noResults.set(false);
  }

  onBlur(): void {
    setTimeout(() => {
      this.isFocused.set(false);
    }, 150);
  }

  onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery.set(target.value);
    const query = this.searchQuery();
    this.noResults.set(false);
    
    if (query.trim()) {
      this.searchSubject.next(query);
    }
  }

  searchSongs(): void {
    const query = this.searchQuery().trim();
    if (query) {
      this.search.emit({
        query,
        tab: this.activeTab()
      });
      this.searchInput.nativeElement.blur();
    }
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.noResults.set(false);
    if (this.searchInput) {
      this.searchInput.nativeElement.focus();
    }
  }

  setActiveTab(tab: string): void {
    this.activeTab.set(tab);
    const query = this.searchQuery();
    if (query.trim()) {
      this.search.emit({
        query: query.trim(),
        tab
      });
    }
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.clearSearch();
    }
  }

  onSearchFormKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        break;
      case 'ArrowUp':
        event.preventDefault();
        break;
      case 'Enter':
        event.preventDefault();
        this.searchSongs();
        break;
    }
  }
}