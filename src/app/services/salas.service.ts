import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { Sala } from '../models/sala.model';
import { environment } from '../../environments/environment';

interface SalaMutationResponse {
  message: string;
  sala?: Sala;
}

@Injectable({ providedIn: 'root' })
export class SalasService {
  private readonly apiUrl = `${environment.apiUrl}/salas`;

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<Sala[]> {
    return this.http.get<Sala[]>(this.apiUrl).pipe(map((res) => this.ordenarSalas(res ?? [])));
  }

  /** Salas habilitadas para asignar en clases. */
  getDisponibles(): Observable<Sala[]> {
    return this.getAll().pipe(map((salas) => salas.filter((s) => s.estado_activo !== false)));
  }

  create(payload: Pick<Sala, 'identificador' | 'cupo'>): Observable<SalaMutationResponse> {
    return this.http.post<SalaMutationResponse>(this.apiUrl, payload);
  }

  update(
    id: number,
    payload: Partial<Pick<Sala, 'identificador' | 'cupo'>>,
  ): Observable<SalaMutationResponse> {
    return this.http.put<SalaMutationResponse>(`${this.apiUrl}/${id}`, payload);
  }

  habilitar(id: number): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${this.apiUrl}/${id}/habilitar`, {});
  }

  deshabilitar(id: number): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${this.apiUrl}/${id}/deshabilitar`, {});
  }

  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  mensajeError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error;
      if (typeof body === 'object' && body !== null && 'message' in body) {
        return String((body as { message: string }).message);
      }
      return err.message ?? 'Error de conexión con el servidor.';
    }
    return 'Error inesperado.';
  }

  private ordenarSalas(salas: Sala[]): Sala[] {
    return [...salas].sort((a, b) => a.identificador.localeCompare(b.identificador, 'es'));
  }
}
