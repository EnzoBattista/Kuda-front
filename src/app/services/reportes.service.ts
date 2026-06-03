import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface TotalUsuariosReporte {
  total: number;
  por_rol: { rol: string; cantidad: number }[];
}

export interface UsuariosNuevosReporte {
  meses: number;
  serie: { mes: string; cantidad: number }[];
  total_periodo: number;
}

export interface IngresosReporte {
  mes_actual: { mes: string; total: number };
  por_mes: { mes: string; total: number }[];
  por_metodo: { metodo: string; total: number }[];
  total_historico: number;
}

export interface HorarioPopular {
  clase_id: number;
  nombre: string;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
  horario: string;
  total_reservas: number;
  cupo: number;
  ocupacion_pct: number | null;
}

export interface HorariosPopularesReporte {
  top: HorarioPopular[];
}

@Injectable({ providedIn: 'root' })
export class ReportesService {
  private readonly apiUrl = `${environment.apiUrl}/reportes`;

  constructor(private readonly http: HttpClient) {}

  getTotalUsuarios(): Observable<TotalUsuariosReporte> {
    return this.http.get<TotalUsuariosReporte>(`${this.apiUrl}/total-usuarios`);
  }

  getUsuariosNuevos(): Observable<UsuariosNuevosReporte> {
    return this.http.get<UsuariosNuevosReporte>(`${this.apiUrl}/usuarios-nuevos`);
  }

  getIngresos(): Observable<IngresosReporte> {
    return this.http.get<IngresosReporte>(`${this.apiUrl}/ingresos`);
  }

  getHorariosPopulares(): Observable<HorariosPopularesReporte> {
    return this.http.get<HorariosPopularesReporte>(`${this.apiUrl}/horarios-populares`);
  }

  mensajeError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error;
      if (typeof body === 'object' && body !== null && 'message' in body) {
        return String((body as { message: string }).message);
      }
      if (err.status === 403) {
        return 'No tenés permiso para ver los reportes.';
      }
      return err.message ?? 'Error de conexión con el servidor.';
    }
    return 'Error inesperado.';
  }

  formatearMes(mesIso: string): string {
    const [anio, mes] = mesIso.split('-');
    const nombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const idx = Number(mes) - 1;
    return `${nombres[idx] ?? mes} ${anio?.slice(2) ?? ''}`.trim();
  }

  formatearMetodo(metodo: string): string {
    const map: Record<string, string> = {
      EFECTIVO: 'Efectivo',
      TRANSFERENCIA: 'Transferencia',
      MERCADO_PAGO: 'Mercado Pago',
      QR: 'QR',
    };
    return map[metodo] ?? metodo;
  }

  formatearMoneda(valor: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(valor);
  }
}
