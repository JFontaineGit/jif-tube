import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef, Renderer2, RendererFactory2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { YoutubeService } from '../../services/youtube.service';
import { PlayerService } from '../../services/player.service';
import { Song } from '../../models/song.model';
import { SongCardComponent } from '../../components/song-card/song-card.component';

import { Router } from '@angular/router';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, FormsModule, SongCardComponent],
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
  private renderer: Renderer2;

  constructor(
    private youtubeService: YoutubeService,
    private playerService: PlayerService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private themeService: ThemeService,
    rendererFactory: RendererFactory2
  ) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  ngOnInit(): void {
    this.searchSongs({ query: 'popular music', tab: 'all' });
  }

  ngAfterViewInit(): void {
    this.initializeScrollListeners();
  }

  onSearch(event: { query: string; tab: string }): void {
    const { query, tab } = event;
    if (query.trim()) {
      if (tab === 'library') {
        this.router.navigate(['/search'], { state: { query, tab } });
      } else {
        this.searchSongs(event);
      }
    }
  }

  searchSongs({ query }: { query: string; tab: string }): void {
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

    if (song.thumbnailUrl) {
      this.themeService.updateThemeFromImage(song.thumbnailUrl, { artist: song.artist, type: song.type });
    }
  }

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