import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export type MetodoPago = 'MERCADO_PAGO';
export type EstadoPago = 'PENDIENTE' | 'COMPLETADO' | 'RECHAZADO';

export interface PagoListado {
  id: number;
  cliente_email: string;
  recepcionista_email?: string | null;
  concepto?: string | null;
  monto: number | string;
  fecha: string;
  metodo: MetodoPago;
  estado: EstadoPago;
  origen?: string | null;
  cliente?: {
    usuario?: {
      nombre: string;
      apellido: string;
      dni: string;
      email: string;
    };
  };
  recepcionista?: {
    nombre: string;
    apellido: string;
    email: string;
  } | null;
}


export interface ComprobantePago {
  gimnasio: {
    nombre: string;
    subtitulo: string;
    direccion: string;
    cuit: string;
    email: string;
    logo_url: string;
  };
  pago: {
    id: number;
    monto: number;
    fecha: string;
    metodo: MetodoPago;
    estado: EstadoPago;
    concepto?: string;
    origen?: string;
    referencia: string;
  };
  cliente: {
    email: string;
    nombre?: string;
    apellido?: string;
    dni?: string;
  };
  recepcionista?: {
    nombre: string;
    apellido: string;
    email: string;
  } | null;
}

export interface CreatePreferenceRequest {
  tituloPlan: string;
  precio: number;
  cliente_email?: string;
  reserva_id?: number;
  inscripcion_mensual_id?: number;
  origen?: string;
  origen_id?: number;
}

export interface CreatePreferenceResponse {
  pago_id: number;
  estado: EstadoPago;
  id: string;
  init_point: string;
  sandbox_init_point?: string;
  external_reference?: string;
}

export interface EstadoPagoResponse {
  id: number;
  estado: EstadoPago;
  metodo: MetodoPago;
  monto: number;
  concepto?: string;
  mp_status?: string | null;
  mp_status_detail?: string | null;
  message: string;
}

export interface FiltrosPagos {
  cliente_email?: string;
  metodo?: MetodoPago;
  estado?: EstadoPago;
  desde?: string;
  hasta?: string;
}

@Injectable({ providedIn: 'root' })
export class PagoService {
  private readonly apiUrl = `${environment.apiUrl}/pagos`;

  constructor(private readonly http: HttpClient) {}

  getAll(filtros: FiltrosPagos = {}): Observable<PagoListado[]> {
    let params = new HttpParams();
    Object.entries(filtros).forEach(([key, value]) => {
      if (value) params = params.set(key, value);
    });

    return this.http
      .get<PagoListado[] | { message: string; data: PagoListado[] }>(this.apiUrl, { params })
      .pipe(
        map((res) => {
          if (Array.isArray(res)) return res;
          return res.data ?? [];
        }),
      );
  }

  getComprobante(id: number): Observable<ComprobantePago> {
    return this.http.get<ComprobantePago>(`${this.apiUrl}/${id}/comprobante`);
  }

  createPreference(data: CreatePreferenceRequest): Observable<CreatePreferenceResponse> {
    return this.http.post<CreatePreferenceResponse>(`${this.apiUrl}/create-preference`, data);
  }

  consultarEstado(pagoId: number): Observable<EstadoPagoResponse> {
    return this.http.get<EstadoPagoResponse>(`${this.apiUrl}/${pagoId}/estado`);
  }

  abandonarPago(pagoId: number): Observable<{ id: number; estado: EstadoPago; message: string }> {
    return this.http.post<{ id: number; estado: EstadoPago; message: string }>(
      `${this.apiUrl}/${pagoId}/abandonar`,
      {},
    );
  }

  liberarReservaPendiente(payload: {
    reserva_id?: number;
    inscripcion_mensual_id?: number;
    inscripcion_individual_id?: number;
  }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/liberar-pendiente`, payload);
  }

  mensajeError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error;
      if (typeof body === 'object' && body !== null) {
        if ('message' in body) return String((body as { message: string }).message);
        if ('error' in body) return String((body as { error: string }).error);
      }
      return err.message ?? 'Error de conexión con el servidor.';
    }
    return 'Error inesperado.';
  }

  metodoLabel(metodo: MetodoPago): string {
    const labels: Record<MetodoPago, string> = {
      MERCADO_PAGO: 'Mercado Pago',
    };
    return labels[metodo] ?? metodo;
  }

  estadoLabel(estado: EstadoPago): string {
    const labels: Record<EstadoPago, string> = {
      PENDIENTE: 'Pendiente',
      COMPLETADO: 'Completado',
      RECHAZADO: 'Rechazado',
    };
    return labels[estado] ?? estado;
  }
}
