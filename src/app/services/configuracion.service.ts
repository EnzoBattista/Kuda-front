import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ConfiguracionSistema {
  dias_gracia_mensual: number;
  recordatorio_pago_dia: number | null;
}

export interface ActualizarConfiguracionRequest {
  dias_gracia_mensual?: number;
  recordatorio_pago_dia?: number;
}

@Injectable({ providedIn: 'root' })
export class ConfiguracionService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/configuracion`;

  obtener(): Observable<ConfiguracionSistema> {
    return this.http.get<ConfiguracionSistema>(this.url);
  }

  actualizar(body: ActualizarConfiguracionRequest): Observable<ConfiguracionSistema> {
    return this.http.patch<ConfiguracionSistema>(this.url, body);
  }
}
