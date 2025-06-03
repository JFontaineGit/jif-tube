import { Injectable } from '@angular/core';
import { Observable, of, switchMap, tap } from 'rxjs';
import { StorageService } from './core/storage.service';
import { Song } from '../models/song.model';

@Injectable({
  providedIn: 'root',
})
export class LibraryService {
  private readonly LIBRARY_KEY = 'savedSongs';

  constructor(private storageService: StorageService) {}

  /**
   * Obtiene todas las canciones guardadas en la biblioteca.
   * @returns Observable con la lista de canciones.
   */
  getSavedSongs(): Observable<Song[]> {
    return this.storageService.get<Song[]>(this.LIBRARY_KEY).pipe(
      switchMap(savedSongs => of(savedSongs || []))
    );
  }

  /**
   * Guarda una canción en la biblioteca.
   * @param song - La canción a guardar.
   * @returns Observable que resuelve cuando la canción se guarda.
   */
  saveSong(song: Song): Observable<void> {
    return this.getSavedSongs().pipe(
      switchMap(savedSongs => {
        if (!savedSongs.find(s => s.id === song.id)) {
          savedSongs.push(song);
          return this.storageService.save(this.LIBRARY_KEY, savedSongs);
        }
        return of(void 0);
      })
    );
  }

  /**
   * Elimina una canción de la biblioteca.
   * @param songId - El ID de la canción a eliminar.
   * @returns Observable que resuelve cuando la canción se elimina.
   */
  removeSong(songId: string): Observable<void> {
    return this.getSavedSongs().pipe(
      switchMap(savedSongs => {
        const updatedSongs = savedSongs.filter(s => s.id !== songId);
        return this.storageService.save(this.LIBRARY_KEY, updatedSongs);
      })
    );
  }

  /**
   * Busca canciones en la biblioteca que coincidan con una query.
   * @param query - La query de búsqueda.
   * @returns Observable con las canciones que coinciden.
   */
  searchInLibrary(query: string): Observable<Song[]> {
    return this.getSavedSongs().pipe(
      switchMap(savedSongs => {
        if (!query.trim()) {
          return of(savedSongs);
        }
        const lowerQuery = query.toLowerCase();
        return of(savedSongs.filter(song =>
          song.title.toLowerCase().includes(lowerQuery) ||
          song.artist.toLowerCase().includes(lowerQuery)
        ));
      })
    );
  }
}