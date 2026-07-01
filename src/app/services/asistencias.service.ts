import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface QrClaseInfo {
  id: number;
  nombre: string;
  actividad?: string;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
  fecha: string;
}

export interface QrGeneradoResponse {
  message: string;
  token: string;
  expira_en: string;
  reserva_id: number;
  clase: QrClaseInfo;
}

export interface EscanearQrResponse {
  reserva_id: number;
  message?: string;
  cliente: {
    email: string;
    nombre: string;
    apellido: string;
    dni: string;
    foto_perfil: string;
  };
  clase: QrClaseInfo;
}

export interface RegistrarAsistenciaPayload {
  reserva_id: number;
  email: string;
  clase_id: number;
  estado: 'PRESENTE' | 'DENEGADO' | 'AUSENTE';
  motivo_denegado?: string;
  manual?: boolean;
}

export interface AsistenciaHistorialItem {
  id: number;
  fecha: string;
  estado: 'PRESENTE' | 'DENEGADO' | 'AUSENTE';
  motivo_denegado?: string | null;
  cliente: {
    email: string;
    nombre?: string;
    apellido?: string;
    dni?: string;
  };
  clase: {
    id: number;
    nombre: string;
    actividad?: string;
    dia_semana: string;
    hora_inicio: string;
    hora_fin: string;
  } | null;
  registrado_en: string;
}

export interface HistorialResponse {
  message?: string;
  items: AsistenciaHistorialItem[];
}

export interface InscriptoClaseHoy {
  reserva_id: number;
  email: string;
  nombre?: string;
  apellido?: string;
  dni?: string;
  asistio: boolean | null;
  asistencia: { id: number; estado: string } | null;
}

export interface ClaseHoy {
  id: number;
  nombre: string;
  actividad?: string;
  dia_semana?: string;
  hora_inicio: string;
  hora_fin: string;
  inscriptos: InscriptoClaseHoy[];
}

export interface ClasesHoyResponse {
  fecha: string;
  clases: ClaseHoy[];
}

@Injectable({ providedIn: 'root' })
export class AsistenciasService {
  private readonly apiUrl = `${environment.apiUrl}/asistencias`;
  private readonly qrUrl = `${environment.apiUrl}/usuarios/me/qr`;

  constructor(private readonly http: HttpClient) {}

  generarMiQr(): Observable<QrGeneradoResponse> {
    return this.http.get<QrGeneradoResponse>(this.qrUrl);
  }

  escanearQr(token: string): Observable<EscanearQrResponse> {
    return this.http.post<EscanearQrResponse>(`${this.apiUrl}/escanear`, { token });
  }

  registrar(payload: RegistrarAsistenciaPayload): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/registrar`, payload);
  }

  getHistorial(): Observable<HistorialResponse> {
    return this.http.get<HistorialResponse>(`${this.apiUrl}/historial`);
  }

  getClasesHoy(): Observable<ClasesHoyResponse> {
    return this.http.get<ClasesHoyResponse>(`${this.apiUrl}/clases-hoy`);
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
