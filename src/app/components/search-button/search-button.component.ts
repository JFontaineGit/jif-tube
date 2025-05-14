import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-search-button',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search-button.component.html',
  styleUrls: ['./search-button.component.scss'],
})
export class SearchButtonComponent {
  isSearchOpen = false;
  searchQuery = '';
  
  @Output() search = new EventEmitter<string>(); // Evento para emitir el término de búsqueda

  toggleSearch(): void {
    this.isSearchOpen = !this.isSearchOpen;
    if (!this.isSearchOpen) {
      this.searchQuery = '';
    }
  }

  searchSongs(): void { // Renombrado para claridad
    if (this.searchQuery.trim()) {
      this.search.emit(this.searchQuery); // Emite el término de búsqueda
      this.toggleSearch(); // Cierra la búsqueda
    }
  }
}