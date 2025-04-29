import { Component } from "@angular/core"
import { CommonModule } from "@angular/common"
import { FormsModule } from '@angular/forms';

@Component({
  selector: "app-search-button",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./search-button.component.html",
  styleUrls: ["./search-button.component.scss"],
})
export class SearchButtonComponent {
  isSearchOpen = false
  searchQuery = ""

  toggleSearch(): void {
    this.isSearchOpen = !this.isSearchOpen
    if (!this.isSearchOpen) {
      this.searchQuery = ""
    }
  }

  search(): void {
    if (this.searchQuery.trim()) {
      console.log("Searching for:", this.searchQuery)
      // Aquí implementarías la lógica de búsqueda
      this.toggleSearch()
    }
  }
}
