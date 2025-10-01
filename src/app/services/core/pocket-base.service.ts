import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import PocketBase from 'pocketbase';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private pb: PocketBase;

  constructor() {
    this.pb = new PocketBase('http://127.0.0.1:8090');
  }

  /**
   * Obtiene una lista paginada de registros
   * @param collection Nombre de la colección
   * @param page Número de página (por defecto 1)
   * @param perPage Registros por página (por defecto 50)
   * @param filter Filtro SQL-like (opcional)
   * @param expand Relaciones a expandir (opcional)
   * @returns Observable con array de registros
   */
  getList<T>(
    collection: string,
    page: number = 1,
    perPage: number = 50,
    filter?: string,
    expand?: string
  ): Observable<T[]> {
    const options: any = {};
    if (filter) options.filter = filter;
    if (expand) options.expand = expand;

    return from(
      this.pb.collection(collection).getList(page, perPage, options)
        .then(result => result.items as T[])
    );
  }

  /**
   * Obtiene todos los registros de una colección
   * @param collection Nombre de la colección
   * @param sort Campo de ordenamiento (ej: '-created' para descendente)
   * @returns Observable con array de todos los registros
   */
  getFullList<T>(collection: string, sort?: string): Observable<T[]> {
    const options: any = {};
    if (sort) options.sort = sort;

    return from(
      this.pb.collection(collection).getFullList(options) as Promise<T[]>
    );
  }

  /**
   * Obtiene el primer registro que coincida con el filtro
   * @param collection Nombre de la colección
   * @param filter Filtro SQL-like (requerido)
   * @param expand Relaciones a expandir (opcional)
   * @returns Observable con el primer registro encontrado
   */
  getFirst<T>(
    collection: string,
    filter: string,
    expand?: string
  ): Observable<T> {
    const options: any = {};
    if (expand) options.expand = expand;

    return from(
      this.pb.collection(collection).getFirstListItem(filter, options) as Promise<T>
    );
  }

  /**
   * Obtiene un registro por su ID
   * @param collection Nombre de la colección
   * @param id ID del registro
   * @param expand Relaciones a expandir (opcional)
   * @returns Observable con el registro
   */
  getById<T>(collection: string, id: string, expand?: string): Observable<T> {
    const options: any = {};
    if (expand) options.expand = expand;

    return from(
      this.pb.collection(collection).getOne(id, options) as Promise<T>
    );
  }

  /**
   * Crea un nuevo registro
   * @param collection Nombre de la colección
   * @param data Datos del registro a crear
   * @returns Observable con el registro creado
   */
  create<T>(collection: string, data: any): Observable<T> {
    return from(
      this.pb.collection(collection).create(data) as Promise<T>
    );
  }

  /**
   * Actualiza un registro existente
   * @param collection Nombre de la colección
   * @param id ID del registro a actualizar
   * @param data Datos a actualizar
   * @returns Observable con el registro actualizado
   */
  update<T>(collection: string, id: string, data: any): Observable<T> {
    return from(
      this.pb.collection(collection).update(id, data) as Promise<T>
    );
  }

  /**
   * Elimina un registro
   * @param collection Nombre de la colección
   * @param id ID del registro a eliminar
   * @returns Observable void
   */
  delete(collection: string, id: string): Observable<void> {
    return from(
      this.pb.collection(collection).delete(id).then(() => undefined)
    );
  }

  /**
   * Inicia sesión con email y contraseña
   * @param email Email del usuario
   * @param password Contraseña del usuario
   * @returns Observable con los datos de autenticación
   */
  login(email: string, password: string): Observable<any> {
    return from(
      this.pb.collection('users').authWithPassword(email, password)
    );
  }

  /**
   * Cierra la sesión actual
   */
  logout(): void {
    this.pb.authStore.clear();
  }

  /**
   * Refresca el token de autenticación
   * @returns Observable con los datos de autenticación actualizados
   */
  refreshAuth(): Observable<any> {
    return from(
      this.pb.collection('users').authRefresh()
    );
  }

  /**
   * Verifica si hay un usuario autenticado
   * @returns true si hay un usuario autenticado
   */
  isAuthenticated(): boolean {
    return this.pb.authStore.isValid;
  }

  /**
   * Obtiene el modelo del usuario autenticado actual
   * @returns Modelo del usuario o null si no está autenticado
   */
  getCurrentUser(): any {
    return this.pb.authStore.model;
  }

  /**
   * Obtiene el token de autenticación actual
   * @returns Token o cadena vacía si no está autenticado
   */
  getToken(): string {
    return this.pb.authStore.token;
  }
}
