import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  CancelarClaseDto,
  CancelarClaseResponse,
  Clase,
  ClaseMutationResponse,
  CreateClaseDto,
  UpdateClaseDto,
} from '../models/clase.model';
import { environment } from '../../environments/environment';

/** Solo clases vigentes (baja lógica del back: activa === true). */
export function isClaseActiva(clase: Pick<Clase, 'activa'>): boolean {
  return clase.activa === true;
}

@Injectable({ providedIn: 'root' })
export class ClasesService {
  private readonly apiUrl = `${environment.apiUrl}/clases`;
  private readonly noCacheHeaders = new HttpHeaders({
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  });

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<Clase[]> {
    return this.http
      .get<Clase[]>(this.apiUrl, { headers: this.noCacheHeaders })
      .pipe(
        map((response: any) => {
          let arr = [];
          if (Array.isArray(response)) {
            arr = response;
          } else if (response && Array.isArray(response.data)) {
            arr = response.data;
          } else if (response && Array.isArray(response.clases)) {
            arr = response.clases;
          }
          return arr.map((c: any) => this.normalizeClase(c)).filter(isClaseActiva);
        }),
        catchError((err) => throwError(() => this.toHuError(err))),
      );
  }

  getById(id: number): Observable<Clase> {
    return this.http
      .get<Clase>(`${this.apiUrl}/${id}`, { headers: this.noCacheHeaders })
      .pipe(
        map((c) => this.normalizeClase(c)),
        catchError((err) => throwError(() => this.toHuError(err))),
      );
  }

  create(data: CreateClaseDto): Observable<{ message: string; clase: Clase }> {
    return this.http
      .post<{ message: string; clase: Clase }>(this.apiUrl, data)
      .pipe(
        map((r) => ({
          message: mapClaseSuccess(r.message, 'crear'),
          clase: this.normalizeClase(r.clase),
        })),
        catchError((err) => throwError(() => this.toHuError(err))),
      );
  }

  update(
    id: number,
    data: UpdateClaseDto,
  ): Observable<{ message: string; clase: Clase }> {
    return this.http
      .put<{ message: string; clase: Clase }>(`${this.apiUrl}/${id}`, data)
      .pipe(
        map((r) => ({
          message: mapClaseSuccess(r.message, 'modificar'),
          clase: this.normalizeClase(r.clase),
        })),
        catchError((err) => throwError(() => this.toHuError(err))),
      );
  }

  delete(id: number, conInscriptos = false): Observable<ClaseMutationResponse> {
    return this.http.delete<ClaseMutationResponse>(`${this.apiUrl}/${id}`).pipe(
      map((r) => ({
        message: mapClaseSuccess(r.message, 'eliminar', conInscriptos),
      })),
      catchError((err) => throwError(() => this.toHuError(err))),
    );
  }

  /**
   * El backend expone POST /api/clases/:id/cancelaciones (no PATCH /cancelar).
   */
  cancelar(
    id: number,
    data: CancelarClaseDto,
    conInscriptos = false,
  ): Observable<CancelarClaseResponse> {
    return this.http
      .post<CancelarClaseResponse>(`${this.apiUrl}/${id}/cancelaciones`, {
        fecha: data.fecha,
        motivo: data.motivo ?? 'Cancelación administrativa',
      })
      .pipe(
        map((r) => ({
          ...r,
          message: mapClaseSuccess(r.message, 'cancelar', conInscriptos),
        })),
        catchError((err) => throwError(() => this.toHuError(err))),
      );
  }

  private normalizeClase(raw: Clase): Clase {
    return {
      ...raw,
      activa: raw.activa === true,
      cupo: Number(raw.cupo ?? 0),
      hora_inicio: formatHora(raw.hora_inicio),
      hora_fin: formatHora(raw.hora_fin),
    };
  }

  private toHuError(err: unknown): { message: string; status?: number } {
    if (err instanceof HttpErrorResponse) {
      return {
        message: mapClaseError(err),
        status: err.status,
      };
    }
    if (err && typeof err === 'object' && 'message' in err) {
      return { message: String((err as { message: string }).message) };
    }
    return { message: 'Ocurrió un error inesperado' };
  }
}

function formatHora(value: string): string {
  if (!value) {
    return value;
  }
  return value.length >= 5 ? value.slice(0, 5) : value;
}

export function mapClaseSuccess(
  backendMessage: string,
  tipo: 'eliminar' | 'cancelar' | 'crear' | 'modificar',
  conInscriptos = false,
): string {
  const msg = (backendMessage ?? '').trim();

  if (tipo === 'eliminar') {
    if (conInscriptos) {
      return 'Clase eliminada con éxito. Se ha notificado a los clientes inscriptos';
    }
    if (
      msg.includes('eliminada') ||
      msg === 'Clase eliminada exitosamente'
    ) {
      return 'Clase eliminada con éxito';
    }
  }

  if (tipo === 'cancelar') {
    if (conInscriptos) {
      return 'Clase cancelada con éxito. Se ha notificado a los clientes inscriptos';
    }
    if (msg.includes('cancelad')) {
      return 'Clase cancelada con éxito';
    }
  }

  if (tipo === 'crear') {
    if (msg.includes('agendada') || msg.includes('creada')) {
      return 'Clase agregada con éxito';
    }
  }

  if (tipo === 'modificar' && msg.includes('modificad')) {
    return 'Clase modificada con éxito';
  }

  return msg;
}

export function mapClaseError(err: HttpErrorResponse): string {
  const raw =
    typeof err.error === 'object' && err.error !== null && 'message' in err.error
      ? String((err.error as { message: string }).message)
      : err.message;

  const errorMap: Record<string, string> = {
    'No se puede eliminar la clase porque tiene inscripciones mensuales activas':
      'No se puede eliminar la clase porque tiene clientes inscriptos',
    'No se puede eliminar la clase porque tiene inscripciones individuales futuras':
      'No se puede eliminar la clase porque tiene clientes inscriptos',
    'Esta fecha ya se encuentra cancelada':
      'Esta fecha ya se encuentra cancelada',
  };

  if (errorMap[raw]) {
    return errorMap[raw];
  }

  if (
    raw.includes('inscripciones mensuales activas') ||
    raw.includes('inscripciones individuales futuras')
  ) {
    return 'No se puede eliminar la clase porque tiene clientes inscriptos';
  }

  return raw || 'Ocurrió un error inesperado';
}
