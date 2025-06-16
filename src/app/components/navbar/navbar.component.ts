import { Component, Output, EventEmitter, ViewChild, ElementRef, OnInit, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { YoutubeService } from '../../services/youtube.service';
import { ThemeService } from '../../services/theme.service';
import { Song } from '../../models/song.model';
import { BehaviorSubject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

interface SearchTab {
  label: string;
  value: string;
  enabled: boolean;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
})
export class NavbarComponent implements OnInit, AfterViewInit {
  private youtubeService = inject(YoutubeService);
  private themeService = inject(ThemeService);

  @Output() search = new EventEmitter<{ query: string; tab: string }>();
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  searchQuery = '';
  isFocused = false;
  activeTab = 'all';
  noResults = false;
  gradientStart = 'rgb(240, 248, 255)';
  gradientEnd = 'rgb(200, 230, 255)';
  dominantColor = 'rgb(240, 248, 255)';

  private searchSubject = new BehaviorSubject<string>('');

  constructor() {
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(query => {
          if (!query.trim()) {
            this.noResults = false;
            return [];
          }
          return this.youtubeService.searchVideos(query);
        })
      )
      .subscribe({
        next: (results: Song[]) => {
          this.noResults = results.length === 0;
          this.search.emit({ query: this.searchQuery, tab: this.activeTab });
        },
        error: err => console.error('Search error:', err),
      });
  }

  ngOnInit(): void {
    this.themeService.gradient$.subscribe(gradient => {
      this.gradientStart = gradient.start;
      this.gradientEnd = gradient.end;
    });
    this.themeService.dominantColor$.subscribe(color => {
      this.dominantColor = color;
    });
  }

  ngAfterViewInit(): void {
    this.searchInput.nativeElement.focus();
  }

  onFocus(): void {
    this.isFocused = true;
    this.noResults = false;
  }

  onBlur(): void {
    setTimeout(() => (this.isFocused = false), 200);
  }

  searchSongs(): void {
    if (this.searchQuery.trim()) {
      this.searchSubject.next(this.searchQuery);
    }
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.noResults = false;
    this.searchInput.nativeElement.focus();
  }

  get gradientStyle(): string {
    return `linear-gradient(to right, ${this.gradientStart}, ${this.gradientEnd})`;
  }
}