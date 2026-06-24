import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface ListaEsperaCliente {
  email: string;
  nombre: string;
  apellido: string;
  dni?: string;
}

export interface ListaEsperaItem {
  id: number;
  clase_id: number;
  cliente_email: string;
  tipo: 'MENSUAL' | 'INDIVIDUAL';
  fecha_exacta?: string | null;
  estado: string;
  posicion: number;
  notificado_en?: string;
  cliente?: ListaEsperaCliente;
  clase?: {
    id: number;
    nombre: string;
    dia_semana?: string;
    hora_inicio?: string;
    hora_fin?: string;
    actividad?: { nombre?: string };
    sala?: { identificador?: string };
  };
}

export interface CupoPendienteLista {
  id: number;
  claseId: number;
  actividad: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
  sede: string;
  fechaClase: string | null;
  tipo: 'MENSUAL' | 'INDIVIDUAL';
}

export const MSG_CUPO_LISTA_CONFIRMADA = 'Reserva confirmada con éxito';
export const MSG_CUPO_LISTA_RECHAZADA = 'Has rechazado el cupo correctamente';

@Injectable({ providedIn: 'root' })
export class ListaEsperaService {
  private readonly apiUrl = `${environment.apiUrl}/lista-espera`;

  constructor(private readonly http: HttpClient) {}

  getByClase(claseId: number): Observable<ListaEsperaItem[]> {
    const params = new HttpParams().set('clase_id', String(claseId));
    return this.http
      .get<ListaEsperaItem[] | { message: string; data: ListaEsperaItem[] }>(this.apiUrl, { params })
      .pipe(map((res) => this.normalizarLista(res)));
  }

  remover(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  cancelarMiListaEspera(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/me/${id}`);
  }

  getMisPendientes(): Observable<CupoPendienteLista[]> {
    return this.http
      .get<ListaEsperaItem[] | { message: string; data: ListaEsperaItem[] }>(
        `${this.apiUrl}/me/pendientes`,
      )
      .pipe(map((res) => this.normalizarLista(res).map((item) => this.mapCupoPendiente(item))));
  }

  getMisInscripciones(): Observable<ListaEsperaItem[]> {
    return this.http
      .get<ListaEsperaItem[] | { message: string; data: ListaEsperaItem[] }>(
        `${this.apiUrl}/me`,
      )
      .pipe(map((res) => this.normalizarLista(res)));
  }

  confirmarCupo(id: number): Observable<{ message: string; reservaId?: number }> {
    return this.http.post<{ message: string; reservaId?: number }>(
      `${this.apiUrl}/${id}/confirmar`,
      {},
    );
  }

  rechazarCupo(id: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/${id}/rechazar`, {});
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

  private normalizarLista(
    res: ListaEsperaItem[] | { message: string; data: ListaEsperaItem[] },
  ): ListaEsperaItem[] {
    if (Array.isArray(res)) {
      return res;
    }
    return res?.data ?? [];
  }

  private mapCupoPendiente(item: ListaEsperaItem): CupoPendienteLista {
    const clase = item.clase;
    const formatHora = (hora?: string) => (hora ? hora.slice(0, 5) : '—');
    return {
      id: item.id,
      claseId: item.clase_id,
      actividad: clase?.actividad?.nombre ?? clase?.nombre ?? 'Clase',
      diaSemana: clase?.dia_semana ?? '—',
      horaInicio: formatHora(clase?.hora_inicio),
      horaFin: formatHora(clase?.hora_fin),
      sede: clase?.sala?.identificador ?? '—',
      fechaClase: item.fecha_exacta ? String(item.fecha_exacta).slice(0, 10) : null,
      tipo: item.tipo,
    };
  }
}
