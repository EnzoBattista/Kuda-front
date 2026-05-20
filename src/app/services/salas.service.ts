import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, forkJoin, of, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { Clase } from '../models/clase.model';
import { Sala } from '../models/sala.model';
import { environment } from '../../environments/environment';

/** Metadatos del seed (sin id): los ids reales se obtienen de la API o por sondeo. */
const SALAS_SEED_META: Omit<Sala, 'id'>[] = [
  { identificador: 'A-01', cupo: 50, estado_activo: true },
  { identificador: 'A-02', cupo: 50, estado_activo: true },
  { identificador: 'A-03', cupo: 30, estado_activo: true },
];

const MAX_SALA_ID_PROBE = 30;

interface InscripcionConClase {
  clase?: Clase & { sala?: Sala & { estado_activo?: boolean } };
}

@Injectable({ providedIn: 'root' })
export class SalasService {
  private readonly apiUrl = `${environment.apiUrl}/salas`;
  private readonly clasesUrl = `${environment.apiUrl}/clases`;
  private readonly actividadesUrl = `${environment.apiUrl}/actividades`;

  constructor(private readonly http: HttpClient) {}

  getDisponibles(): Observable<Sala[]> {
    return this.http.get<Sala[]>(this.apiUrl).pipe(
      map((list) => this.filtrarActivas(list ?? [])),
      switchMap((salas) =>
        salas.length > 0 ? of(this.ordenarSalas(salas)) : this.resolverSinEndpoint(),
      ),
      catchError((err: HttpErrorResponse) => {
        if (err.status === 404 || err.status === 0 || err.status === 502) {
          return this.resolverSinEndpoint();
        }
        return throwError(() => err);
      }),
    );
  }

  /**
   * Sin GET /api/salas: extrae salas de clases/inscripciones o, si hace falta,
   * detecta ids válidos con POST de validación (sin crear clase).
   */
  private resolverSinEndpoint(): Observable<Sala[]> {
    return forkJoin({
      clases: this.http.get<Clase[]>(this.clasesUrl).pipe(catchError(() => of([]))),
      mensuales: this.http
        .get<InscripcionConClase[]>(`${environment.apiUrl}/inscripciones-mensuales`)
        .pipe(catchError(() => of([]))),
    }).pipe(
      map(({ clases, mensuales }) =>
        this.unirSalas(
          this.extraerSalasDeClases(clases ?? []),
          this.extraerSalasDeInscripciones(mensuales ?? []),
        ),
      ),
      switchMap((salas) =>
        salas.length > 0 ? of(this.ordenarSalas(salas)) : this.descubrirSalasPorValidacion(),
      ),
    );
  }

  private extraerSalasDeClases(clases: Clase[]): Sala[] {
    const mapa = new Map<number, Sala>();
    for (const c of clases) {
      const s = c.sala;
      if (!s?.id) continue;
      mapa.set(s.id, this.normalizarSala(s));
    }
    return [...mapa.values()];
  }

  private extraerSalasDeInscripciones(rows: InscripcionConClase[]): Sala[] {
    const salas: Sala[] = [];
    for (const row of rows) {
      const s = row.clase?.sala;
      if (s?.id) {
        salas.push(this.normalizarSala(s as Partial<Sala> & { id: number }));
      }
    }
    return salas;
  }

  private unirSalas(...grupos: Sala[][]): Sala[] {
    const mapa = new Map<number, Sala>();
    for (const grupo of grupos) {
      for (const s of grupo) {
        if (s.estado_activo !== false) mapa.set(s.id, s);
      }
    }
    return [...mapa.values()];
  }

  /**
   * El back valida actividad → sala → profesor. Con actividad real y profesor inexistente,
   * un 400 distinto de "sala no existe" implica que el sala_id es válido.
   */
  private descubrirSalasPorValidacion(): Observable<Sala[]> {
    return this.http
      .get<{ id: number }[]>(`${this.actividadesUrl}?activa=true`)
      .pipe(
        map((list) => list?.[0]?.id),
        switchMap((actividadId) => {
          if (!actividadId) {
            return of(this.construirSalasDesdeIds([]));
          }

          const ids = Array.from({ length: MAX_SALA_ID_PROBE }, (_, i) => i + 1);
          return forkJoin(
            ids.map((salaId) =>
              this.probarSalaId(salaId, actividadId).pipe(
                map((valida) => (valida ? salaId : null)),
              ),
            ),
          ).pipe(
            map((resultados) =>
              this.construirSalasDesdeIds(
                resultados.filter((id): id is number => id !== null).sort((a, b) => a - b),
              ),
            ),
          );
        }),
        catchError(() => of(this.construirSalasDesdeIds([]))),
      );
  }

  private probarSalaId(salaId: number, actividadId: number): Observable<boolean> {
    const horaBase = 7 + (salaId % 5);
    return this.http
      .post<unknown>(this.clasesUrl, {
        nombre: '__probe_sala__',
        actividad_id: actividadId,
        profesor_id: 999999999,
        sala_id: salaId,
        dia_semana: 'Lunes',
        hora_inicio: `${String(horaBase).padStart(2, '0')}:00:00`,
        hora_fin: `${String(horaBase + 1).padStart(2, '0')}:00:00`,
        cupo: 10,
        activa: true,
      })
      .pipe(
        map(() => false),
        catchError((err: HttpErrorResponse) => {
          const msg = this.mensajeError(err).toLowerCase();
          if (
            msg.includes('sala indicada no existe') ||
            msg.includes('sala se encuentra deshabilitada')
          ) {
            return of(false);
          }
          return of(true);
        }),
      );
  }

  private construirSalasDesdeIds(ids: number[]): Sala[] {
    if (ids.length === 0) {
      return [];
    }

    if (ids.length === SALAS_SEED_META.length) {
      return ids.map((id, i) => ({
        id,
        ...SALAS_SEED_META[i],
      }));
    }

    return ids.map((id) => ({
      id,
      identificador: `Sala #${id}`,
      cupo: 50,
      estado_activo: true,
    }));
  }

  private normalizarSala(raw: Partial<Sala> & { id: number }): Sala {
    return {
      id: raw.id,
      identificador: raw.identificador ?? `Sala #${raw.id}`,
      cupo: Number(raw.cupo ?? 50),
      estado_activo: raw.estado_activo !== false,
    };
  }

  private ordenarSalas(salas: Sala[]): Sala[] {
    return [...salas].sort((a, b) =>
      a.identificador.localeCompare(b.identificador, 'es'),
    );
  }

  private filtrarActivas(salas: Sala[]): Sala[] {
    return salas.filter((s) => s.estado_activo !== false);
  }

  private mensajeError(err: HttpErrorResponse): string {
    const body = err.error;
    if (typeof body === 'object' && body !== null && 'message' in body) {
      return String((body as { message: string }).message);
    }
    return err.message ?? '';
  }
}
