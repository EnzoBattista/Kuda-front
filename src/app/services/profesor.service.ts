import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Profesor {
  id: number;
  nombre: string;
  apellido: string;
  dni: string;
  activo: boolean;
  actividades?: { id: number; nombre: string }[];
}

export interface CreateProfesorDto {
  nombre: string;
  apellido: string;
  dni: string;
  actividades?: number[];
}

@Injectable({ providedIn: 'root' })
export class ProfesorService {
  private readonly apiUrl = `${environment.apiUrl}/profesores`;

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<Profesor[]> {
    return this.http.get<Profesor[]>(this.apiUrl);
  }

  create(data: CreateProfesorDto): Observable<unknown> {
    return this.http.post<unknown>(this.apiUrl, data);
  }
}

