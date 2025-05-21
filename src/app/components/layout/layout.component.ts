import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { SearchButtonComponent } from '../search-button/search-button.component';
import { PlayerComponent } from '../player/player/player.component';
import { PlayerService } from '../../services/player.service';
import { Song } from '../../models/song.model';

/**
 * Componente de diseño principal que organiza la estructura de la aplicación.
 * Incluye la barra lateral, el botón de búsqueda, el enrutador y el reproductor.
 */
@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, SearchButtonComponent, PlayerComponent],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
})
export class LayoutComponent implements OnInit {
  isPlayerVisible = false;
  currentSong: Song | null = null;

  constructor(private playerService: PlayerService) {}

  /**
   * Inicializa el componente, suscribiéndose a la canción seleccionada.
   */
  ngOnInit() {
    this.playerService.selectedSong$.subscribe((song: Song | null) => {
      this.currentSong = song;
      this.isPlayerVisible = !!song;
    });
  }

  /**
   * Cierra el reproductor estableciendo la canción seleccionada a null.
   */
  closePlayer(): void {
    this.playerService.setSelectedSong(null);
  }
}