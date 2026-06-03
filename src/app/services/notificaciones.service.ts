import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CanalesNotificacion {
  email: boolean;
  sms: boolean;
  push: boolean;
  recordatorios_clases: boolean;
  promociones: boolean;
  recordatorio_pago_dia?: number | null;
}

export interface PreferenciasNotificacion {
  notificaciones_activas: boolean;
  canales_notificacion: CanalesNotificacion;
}

export interface ActualizarNotificacionesRequest {
  notificaciones_activas?: boolean;
  canales_notificacion?: Partial<CanalesNotificacion>;
  recordatorio_pago_dia?: number | null;
}

export interface NotificacionManualRequest {
  cliente_email: string;
  asunto: string;
  mensaje: string;
}

@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private readonly clientesUrl = `${environment.apiUrl}/clientes`;
  private readonly notificacionesUrl = `${environment.apiUrl}/notificaciones`;

  constructor(private readonly http: HttpClient) {}

  getMisPreferencias(): Observable<PreferenciasNotificacion> {
    return this.http.get<PreferenciasNotificacion>(`${this.clientesUrl}/me/notificaciones`);
  }

  actualizarMisPreferencias(
    body: ActualizarNotificacionesRequest,
  ): Observable<PreferenciasNotificacion & { message: string }> {
    return this.http.put<PreferenciasNotificacion & { message: string }>(
      `${this.clientesUrl}/me/notificaciones`,
      body,
    );
  }

  enviarManual(body: NotificacionManualRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.notificacionesUrl}/manual`, body);
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
}
