import { Component, Output, EventEmitter, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-search-button',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search-button.component.html',
  styleUrls: ['./search-button.component.scss'],
})
export class SearchButtonComponent implements AfterViewInit {
  @Output() search = new EventEmitter<{ query: string; tab: string }>();
  @ViewChild('searchInput') searchInput!: ElementRef;

  searchQuery = '';
  isFocused = false;
  activeTab = 'all';
  searchTabs = [
    { label: 'Todo', value: 'all' },
    { label: 'Canciones', value: 'songs' },
    { label: 'Videos', value: 'videos' },
    { label: 'Álbumes', value: 'albums' },
    { label: 'Biblioteca', value: 'library' },
  ];

  ngAfterViewInit(): void {
    this.searchInput.nativeElement.focus();
  }

  onFocus(): void {
    this.isFocused = true;
  }

  onBlur(): void {
    setTimeout(() => this.isFocused = false, 200); // Evita cerrar al hacer click en tabs
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  searchSongs(): void {
    if (this.searchQuery.trim()) {
      this.search.emit({ query: this.searchQuery, tab: this.activeTab });
      this.searchQuery = '';
    }
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchInput.nativeElement.focus();
  }
}