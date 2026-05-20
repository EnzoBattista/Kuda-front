import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CreatePreferenceRequest {
  tituloPlan: string;
  precio: number;
}

export interface CreatePreferenceResponse {
  id: string;
  init_point: string;
}

@Injectable({
  providedIn: 'root',
})
export class PagoService {
  private readonly apiUrl = `${environment.apiUrl}/pagos/create-preference`;

  constructor(private readonly http: HttpClient) {}

  createPreference(
    data: CreatePreferenceRequest
  ): Observable<CreatePreferenceResponse> {
    return this.http.post<CreatePreferenceResponse>(this.apiUrl, data);
  }
}
