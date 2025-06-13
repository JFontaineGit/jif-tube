import { Component, Output, EventEmitter, ViewChild, ElementRef, AfterViewInit, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-search-button',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search-button.component.html',
  styleUrls: ['./search-button.component.scss'],
})
export class SearchButtonComponent implements OnInit, AfterViewInit {
  @Output() search = new EventEmitter<{ query: string; tab: string }>();
  @ViewChild('searchInput') searchInput!: ElementRef;

  searchQuery = '';
  isFocused = false;
  activeTab = 'all';
  noResults = false; 
  searchTabs = [
    { label: 'Todo', value: 'all', enabled: true },
    { label: 'Canciones', value: 'songs', enabled: true },
    { label: 'Videos', value: 'videos', enabled: true },
    { label: 'Álbumes', value: 'albums', enabled: true },
    { label: 'Biblioteca', value: 'library', enabled: false },
  ];

  gradientStart: string = 'rgb(240, 248, 255)';
  gradientEnd: string = 'rgb(200, 230, 255)';
  dominantColor: string = 'rgb(240, 248, 255)';

  constructor(private themeService: ThemeService) {}

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
    setTimeout(() => this.isFocused = false, 200);
  }

  setActiveTab(tab: string): void {
    const selectedTab = this.searchTabs.find(t => t.value === tab);
    if (selectedTab?.enabled) {
      this.activeTab = tab;
    }
  }

  searchSongs(): void {
    if (this.searchQuery.trim()) {
      this.search.emit({ query: this.searchQuery, tab: this.activeTab });
      this.noResults = false; 
    }
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.noResults = false;
    this.searchInput.nativeElement.focus();
  }
  
  setNoResults(): void {
    this.noResults = true;
  }

  get gradientStyle(): string {
    return `linear-gradient(to right, ${this.gradientStart}, ${this.gradientEnd})`;
  }
}