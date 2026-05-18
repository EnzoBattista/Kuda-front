import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Sala } from '../models/sala.model';

/**
 * No existe GET /api/salas en el backend.
 * Mock alineado con seeders (20260503000000-actividades-salas.js).
 */
const MOCK_SALAS: Sala[] = [
  { id: 1, identificador: 'A-01', cupo: 50, estado_activo: true },
  { id: 2, identificador: 'A-02', cupo: 50, estado_activo: true },
  { id: 3, identificador: 'A-03', cupo: 30, estado_activo: true },
];

@Injectable({ providedIn: 'root' })
export class SalasService {
  getDisponibles(): Observable<Sala[]> {
    return of(MOCK_SALAS.filter((s) => s.estado_activo));
  }
}
