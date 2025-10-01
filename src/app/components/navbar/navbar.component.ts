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

interface SearchEvent {
  query: string;
  tab: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
})
export class NavbarComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @Input() isScrolled = false;
  @Output() search = new EventEmitter<SearchEvent>();
  @Output() toggleSidebar = new EventEmitter<void>();
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  searchQuery = signal('');
  isFocused = signal(false);
  noResults = signal(false);
  activeTab = signal('all');

  private searchSubject = new BehaviorSubject<string>('');

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
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

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
    this.searchInput.nativeElement.focus();
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
