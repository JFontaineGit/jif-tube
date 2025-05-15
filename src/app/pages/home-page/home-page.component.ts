// src/app/components/home-page/home-page.component.ts
import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { YoutubeService } from '../../services/youtube.service';
import { PlayerService } from '../../services/player.service';
import { Song } from '../../models/song.model';
import { SongCardComponent } from '../../components/song-card/song-card.component';
import { SearchButtonComponent } from '../../components/search-button/search-button.component';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, FormsModule, SongCardComponent, SearchButtonComponent],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.scss'],
})
export class HomePageComponent implements OnInit, AfterViewInit {
  officialVideos: Song[] = [];
  albumTracks: Song[] = [];
  selectedSong: Song | null = null;

  isAtStartVideos: boolean = true;
  isAtEndVideos: boolean = false;
  isAtStartTracks: boolean = true;
  isAtEndTracks: boolean = false;

  @ViewChild('videosRow') videosRow?: ElementRef<HTMLDivElement>;
  @ViewChild('tracksRow') tracksRow?: ElementRef<HTMLDivElement>;

  private hasInitializedVideosScroll = false;
  private hasInitializedTracksScroll = false;

  constructor(
    private youtubeService: YoutubeService,
    private playerService: PlayerService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.searchSongs('popular music');
  }

  ngAfterViewInit(): void {
    // Inicializamos solo si las secciones están visibles
    this.initializeScrollListeners();
  }

  searchSongs(query: string): void {
    if (query.trim()) {
      this.youtubeService.searchVideos(query).subscribe((songs) => {
        this.officialVideos = songs.filter(song => song.type === 'official-video');
        this.albumTracks = songs.filter(song => song.type === 'album-track');

        setTimeout(() => {
          this.initializeScrollListeners();
          this.updateScrollStates();
          this.cdr.detectChanges();
        }, 0);
      });
    }
  }

  onSongSelected(song: Song): void {
    this.selectedSong = song;
    this.playerService.setSelectedSong(song);
  }

  // Método para inicializar los listeners de desplazamiento
  private initializeScrollListeners(): void {
    if (this.videosRow?.nativeElement && !this.hasInitializedVideosScroll) {
      this.updateScrollStateVideos();
      this.videosRow.nativeElement.addEventListener('scroll', () => {
        this.updateScrollStateVideos();
        this.cdr.detectChanges();
      });
      this.hasInitializedVideosScroll = true;
    }

    if (this.tracksRow?.nativeElement && !this.hasInitializedTracksScroll) {
      this.updateScrollStateTracks();
      this.tracksRow.nativeElement.addEventListener('scroll', () => {
        this.updateScrollStateTracks();
        this.cdr.detectChanges();
      });
      this.hasInitializedTracksScroll = true;
    }
  }

  // Método para actualizar los estados de ambas secciones
  private updateScrollStates(): void {
    if (this.videosRow?.nativeElement) {
      this.videosRow.nativeElement.scrollLeft = 0;
      this.updateScrollStateVideos();
    }
    if (this.tracksRow?.nativeElement) {
      this.tracksRow.nativeElement.scrollLeft = 0;
      this.updateScrollStateTracks();
    }
  }

  // Navegación para Videos Oficiales
  scrollLeftVideos(): void {
    if (this.videosRow?.nativeElement) {
      const scrollAmount = this.videosRow.nativeElement.clientWidth * 0.8;
      this.videosRow.nativeElement.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    }
  }

  scrollRightVideos(): void {
    if (this.videosRow?.nativeElement) {
      const scrollAmount = this.videosRow.nativeElement.clientWidth * 0.8;
      this.videosRow.nativeElement.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  }

  updateScrollStateVideos(): void {
    if (!this.videosRow?.nativeElement) return;
    const element = this.videosRow.nativeElement;
    const prevAtStart = this.isAtStartVideos;
    const prevAtEnd = this.isAtEndVideos;
    this.isAtStartVideos = element.scrollLeft === 0;
    this.isAtEndVideos = element.scrollLeft + element.clientWidth >= element.scrollWidth - 1;
    if (prevAtStart !== this.isAtStartVideos || prevAtEnd !== this.isAtEndVideos) {
      this.cdr.detectChanges();
    }
  }

  // Navegación para Álbumes Oficiales
  scrollLeftTracks(): void {
    if (this.tracksRow?.nativeElement) {
      const scrollAmount = this.tracksRow.nativeElement.clientWidth * 0.8;
      this.tracksRow.nativeElement.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    }
  }

  scrollRightTracks(): void {
    if (this.tracksRow?.nativeElement) {
      const scrollAmount = this.tracksRow.nativeElement.clientWidth * 0.8;
      this.tracksRow.nativeElement.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  }

  updateScrollStateTracks(): void {
    if (!this.tracksRow?.nativeElement) return;
    const element = this.tracksRow.nativeElement;
    const prevAtStart = this.isAtStartTracks;
    const prevAtEnd = this.isAtEndTracks;
    this.isAtStartTracks = element.scrollLeft === 0;
    this.isAtEndTracks = element.scrollLeft + element.clientWidth >= element.scrollWidth - 1;
    if (prevAtStart !== this.isAtStartTracks || prevAtEnd !== this.isAtEndTracks) {
      this.cdr.detectChanges();
    }
  }
}