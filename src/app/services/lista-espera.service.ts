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
  cliente?: ListaEsperaCliente;
  clase?: { id: number; nombre: string; dia_semana?: string; hora_inicio?: string };
}

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
}
