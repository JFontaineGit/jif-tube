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
import { ApiService } from '../../services/core/pocket-base.service';
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
  currentUser = signal<any>(null);

  constructor(private apiService: ApiService) {
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
    this.checkAuthPeriodically();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============ AUTH METHODS ============
  
  private loadCurrentUser(): void {
    const user = this.apiService.getCurrentUser();
    this.currentUser.set(user);
  }

  private checkAuthPeriodically(): void {
    setInterval(() => {
      this.loadCurrentUser();
    }, 5000);
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
    this.loadCurrentUser();
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen.set(!this.isUserMenuOpen());
  }

  logout(): void {
    this.apiService.logout();
    this.currentUser.set(null);
    this.isUserMenuOpen.set(false);
  }

  getUserInitials(): string {
    const user = this.currentUser();
    if (!user?.email) return 'U';
    
    return user.email
      .split('@')[0]
      .split('.')
      .map((part: string) => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  getUserAvatar(): string {
    const user = this.currentUser();
    if (!user?.email) return '';
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.email)}`;
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