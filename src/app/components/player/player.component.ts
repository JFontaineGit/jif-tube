// src/app/components/player/player.component.ts
import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { Song } from '../../models/song.model';
import { PlayerService } from '../../services/player.service';

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.scss'],
})
export class PlayerComponent implements OnChanges {
  @Input() song: Song | null = null;
  @Output() close = new EventEmitter<void>();

  safeVideoUrl: SafeResourceUrl | null = null;
  autoplay = true;

  constructor(private sanitizer: DomSanitizer, private playerService: PlayerService) {
    this.playerService.autoplay$.subscribe((autoplay) => {
      this.autoplay = autoplay;
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['song'] && this.song) {
      const autoplayParam = this.autoplay ? '1' : '0';
      this.safeVideoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
        `https://www.youtube.com/embed/${this.song.videoId}?autoplay=${autoplayParam}`
      );
    } else {
      this.safeVideoUrl = null;
    }
  }

  closePlayer(): void {
    this.close.emit();
    this.playerService.setSelectedSong(null);
  }
}