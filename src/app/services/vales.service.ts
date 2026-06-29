import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface ValeApi {
  id: number;
  cliente_email: string;
  clase_id: number | null;
  monto: number | string;
  valido_desde: string;
  valido_hasta: string;
  usado_en_pago_id: number | null;
  clase?: {
    id: number;
    dia_semana?: string;
    hora_inicio?: string;
    hora_fin?: string;
    actividad?: { nombre?: string } | null;
  } | null;
}

export interface Vale {
  id: number;
  claseId: number | null;
  monto: number;
  validoDesde: string;
  validoHasta: string;
  actividad?: string;
  diaSemana?: string;
  horaInicio?: string;
  horaFin?: string;
}

@Injectable({ providedIn: 'root' })
export class ValesService {
  private readonly url = `${environment.apiUrl}/reservas/mis-vales`;
  private readonly noCacheHeaders = new HttpHeaders({
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  });

  private readonly http = inject(HttpClient);

  /** Vales vigentes y no usados del cliente. */
  getMisVales(email?: string): Observable<Vale[]> {
    let params = new HttpParams();
    if (email) {
      params = params.set('cliente_email', email);
    }
    return this.http
      .get<ValeApi[]>(this.url, { headers: this.noCacheHeaders, params })
      .pipe(
        map((list) => (list ?? []).map(toVale)),
        catchError(() => of([])),
      );
  }

  /** Vales aplicables a una clase puntual (vigentes hoy y atados a la clase). */
  getValesAplicables(claseId: number): Observable<Vale[]> {
    const params = new HttpParams().set('clase_id', String(claseId));
    return this.http
      .get<ValeApi[]>(this.url, { headers: this.noCacheHeaders, params })
      .pipe(
        map((list) => (list ?? []).map(toVale)),
        catchError(() => of([])),
      );
  }
}

function toVale(v: ValeApi): Vale {
  return {
    id: v.id,
    claseId: v.clase_id,
    monto: Number(v.monto),
    validoDesde: String(v.valido_desde).slice(0, 10),
    validoHasta: String(v.valido_hasta).slice(0, 10),
    actividad: v.clase?.actividad?.nombre,
    diaSemana: v.clase?.dia_semana,
    horaInicio: v.clase?.hora_inicio?.slice(0, 5),
    horaFin: v.clase?.hora_fin?.slice(0, 5),
  };
}
