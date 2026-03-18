import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
  private readonly apiUrl = 'http://localhost:3001/api/pagos/create-preference';

  constructor(private readonly http: HttpClient) {}

  createPreference(
    data: CreatePreferenceRequest
  ): Observable<CreatePreferenceResponse> {
    return this.http.post<CreatePreferenceResponse>(this.apiUrl, data);
  }
}
