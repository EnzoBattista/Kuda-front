import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Socio } from '../models/socio.model';

export interface CreateSocioDto {
  nombre: string;
  email: string;
  telefono: string;
}

@Injectable({
  providedIn: 'root',
})
export class SocioService {
  private readonly apiUrl = 'http://localhost:3001/api/socios';

  constructor(private readonly http: HttpClient) {}

  getSocios(): Observable<Socio[]> {
    return this.http.get<Socio[]>(this.apiUrl);
  }

  createSocio(socio: CreateSocioDto): Observable<Socio> {
    return this.http.post<Socio>(this.apiUrl, socio);
  }
}
