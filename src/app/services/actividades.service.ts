import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  Actividad,
  ActividadMutationResponse,
  CreateActividadDto,
  ProfesorActividad,
  UpdateActividadDto,
} from '../models/actividad.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ActividadesService {
  private readonly apiUrl = `${environment.apiUrl}/actividades`;

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<Actividad[]> {
    return this.http.get<Actividad[]>(this.apiUrl).pipe(
      map((list) => (list ?? []).map((a) => this.normalizeActividad(a))),
      catchError((err) => throwError(() => this.toHuError(err))),
    );
  }

  getActivas(): Observable<Actividad[]> {
    return this.http
      .get<Actividad[]>(`${this.apiUrl}?activa=true`)
      .pipe(
        map((list) =>
          (list ?? [])
            .map((a) => this.normalizeActividad(a))
            .filter((a) => a.activa),
        ),
        catchError((err) => throwError(() => this.toHuError(err))),
      );
  }

  create(data: CreateActividadDto): Observable<ActividadMutationResponse> {
    return this.http
      .post<ActividadMutationResponse>(this.apiUrl, data)
      .pipe(
        map((r) => ({
          message: mapActividadSuccess(r.message),
          actividad: this.normalizeActividad(r.actividad),
        })),
        catchError((err) => throwError(() => this.toHuError(err))),
      );
  }

  update(id: number, data: UpdateActividadDto): Observable<ActividadMutationResponse> {
    return this.http
      .put<ActividadMutationResponse>(`${this.apiUrl}/${id}`, data)
      .pipe(
        map((r) => ({
          message: mapActividadSuccess(r.message),
          actividad: this.normalizeActividad(r.actividad),
        })),
        catchError((err) => throwError(() => this.toHuError(err))),
      );
  }

  updatePrecio(id: number, precio: number): Observable<ActividadMutationResponse> {
    return this.http
      .patch<ActividadMutationResponse>(`${this.apiUrl}/${id}/precio`, { precio })
      .pipe(
        map((r) => ({
          message: mapActividadSuccess(r.message),
          actividad: this.normalizeActividad(r.actividad),
        })),
        catchError((err) => throwError(() => this.toHuError(err))),
      );
  }

  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`).pipe(
      map((r) => ({ message: mapActividadSuccess(r.message) })),
      catchError((err) => throwError(() => this.toHuError(err))),
    );
  }

  getProfesores(actividadId: number): Observable<ProfesorActividad[]> {
    return this.http
      .get<ProfesorActividad[]>(`${this.apiUrl}/${actividadId}/profesores`)
      .pipe(catchError((err) => throwError(() => this.toHuError(err))));
  }

  private normalizeActividad(raw: Actividad & { precio?: number | string }): Actividad {
    return {
      ...raw,
      activa: raw.activa === true,
      precio: Number(raw.precio ?? 0),
      descripcion: raw.descripcion ?? null,
    };
  }

  private toHuError(err: unknown): { message: string; status?: number } {
    if (err instanceof HttpErrorResponse) {
      return {
        message: mapActividadError(err),
        status: err.status,
      };
    }
    if (err && typeof err === 'object' && 'message' in err) {
      return { message: String((err as { message: string }).message) };
    }
    return { message: 'Ocurrió un error inesperado' };
  }
}

export function mapActividadSuccess(backendMessage: string): string {
  const msg = (backendMessage ?? '').trim();
  const successMap: Record<string, string> = {
    'Actividad creada con éxito': 'Actividad agregada con éxito',
    'Actividad actualizada con éxito': 'Actividad modificada con éxito',
    'Actividad dada de baja exitosamente': 'Actividad eliminada con éxito',
    'Precio de actividad actualizado con éxito':
      'El precio fue actualizado correctamente',
  };
  return successMap[msg] ?? msg;
}

export function mapActividadError(err: HttpErrorResponse): string {
  const raw =
    typeof err.error === 'object' && err.error !== null && 'message' in err.error
      ? String((err.error as { message: string }).message)
      : err.message;

  const errorMap: Record<string, string> = {
    'Ya existe otra actividad con ese nombre': 'Ya existe una actividad con ese nombre',
    'No se puede eliminar la actividad porque tiene clases con inscripciones mensuales activas':
      'No se puede eliminar una actividad con clientes inscriptos',
    'No se puede eliminar la actividad porque tiene clases con inscripciones individuales futuras':
      'No se puede eliminar una actividad con clientes inscriptos',
    'El precio es inválido o negativo': 'El precio debe ser mayor a cero',
  };

  if (errorMap[raw]) {
    return errorMap[raw];
  }

  if (
    raw.includes('inscripciones mensuales activas') ||
    raw.includes('inscripciones individuales futuras')
  ) {
    return 'No se puede eliminar una actividad con clientes inscriptos';
  }

  return raw || 'Ocurrió un error inesperado';
}
