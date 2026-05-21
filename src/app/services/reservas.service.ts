import { Injectable, inject } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpParams,
} from '@angular/common/http';
import { Observable, forkJoin, of, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { isClaseActiva } from './clases.service';
import { PagoService } from './pago.service';
import { Clase } from '../models/clase.model';
import { environment } from '../../environments/environment';

export type ModalidadReserva = 'ABONADO' | 'INDIVIDUAL';
export type EstadoHistorial = 'ACTIVA' | 'CANCELADA' | 'COMPLETADA' | 'EN_ESPERA';
export type TipoPago = 'PAGO_COMPLETO' | 'SEÑA';
export type TipoListaEspera = 'ABONADO' | 'INDIVIDUAL';

export const MSG_RESERVA_CONFIRMADA = 'Reserva confirmada. Tu pago fue registrado exitosamente.';
export const MSG_RESERVA_CONFIRMADA_SEÑA = 'Reserva confirmada. Tu seña fue registrada exitosamente';
export const MSG_RESERVA_INCOMPLETA = 'Reserva incompleta. Hubo un problema con el pago.';
export const MSG_RESERVA_CANCELADA = 'Reserva cancelada con éxito';
export const HORAS_MINIMAS_SEÑA = 10;

export type ModalidadInscripcion = 'ABONADO' | 'INDIVIDUAL';

export interface ReservaHistorial {
  id: number;
  /** Id de clase; usado para completar sala cuando el API no la envía. */
  claseId?: number;
  actividad: string;
  sede: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
  modalidad: ModalidadReserva;
  esAbonado: boolean;
  estado: EstadoHistorial;
  tipoPago?: TipoPago;
  montoAbonado?: number;
  fechaReserva: string;
  proximaFecha?: string;
}

export interface ClaseDisponible {
  id: number;
  actividadId: number;
  actividad: string;
  sede: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
  cupoTotal: number;
  cupoDisponible: number;
  proximaFecha: string;
  precioActividad?: number;
  /** Ya tiene mensualidad VIGENTE/EN_GRACIA para esta actividad. */
  abonoActividadVigente?: boolean;
}

export interface ResultadoCancelacion {
  message: string;
  reembolso: boolean;
  bono?: number;
  /** Mensaje técnico del backend (opcional). */
  detalle?: string;
  /** El back respondió 409: la reserva ya estaba cancelada. */
  yaCancelada?: boolean;
}

export interface ResultadoReserva {
  message: string;
  reservaId: number;
  redirectUrl?: string;
}

interface ReservaApiDto {
  id: number;
  fecha_exacta: string;
  estado: string;
  asistio: boolean | null;
  clase: {
    id: number;
    hora_inicio: string;
    hora_fin: string;
    cupo: number;
    actividad: string | null;
    profesor: string | null;
    sala: string | { identificador?: string; nombre?: string } | null;
  } | null;
}

interface HistorialReservasResponse {
  total: number;
  pagina: number;
  paginas: number;
  reservas: ReservaApiDto[];
}

interface InscripcionIndividualApi {
  id: number;
  clase_id: number;
  actividad_id: number;
  fecha: string;
  modalidad: 'COMPLETO' | 'SEÑA';
  monto_pagado: number | string;
  monto_total?: number | string;
  reservas?: { id: number; fecha_exacta?: string; estado?: string }[];
  actividad?: { id: number; nombre: string };
  clase?: {
    id: number;
    hora_inicio: string;
    hora_fin: string;
    cupo?: number;
    dia_semana?: string;
    actividad?: { nombre: string };
    sala?: { identificador: string };
  };
}

interface InscripcionMensualApi {
  id: number;
  actividad_id: number;
  clase_id: number;
  periodo_inicio: string;
  periodo_fin: string;
  estado: string;
  monto: number | string;
  actividad?: { nombre: string };
  clase?: {
    id: number;
    hora_inicio: string;
    hora_fin: string;
    sala?: { identificador: string };
  };
  reservas?: { id: number; fecha_exacta?: string; estado?: string }[];
}

@Injectable({ providedIn: 'root' })
export class ReservasService {
  private readonly apiBase = environment.apiUrl;
  private readonly reservasUrl = `${this.apiBase}/reservas`;
  private readonly clasesUrl = `${this.apiBase}/clases`;
  private readonly inscripcionesIndUrl = `${this.apiBase}/inscripciones-individuales`;
  private readonly inscripcionesMenUrl = `${this.apiBase}/inscripciones-mensuales`;
  private readonly listaEsperaUrl = `${this.apiBase}/lista-espera`;

  private readonly noCacheHeaders = new HttpHeaders({
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  });

  private readonly auth = inject(AuthService);
  private readonly pagoService = inject(PagoService);

  constructor(private readonly http: HttpClient) {}

  getMisReservas(): Observable<ReservaHistorial[]> {
    const email = this.auth.getCurrentUser()?.email;
    if (!email) {
      return throwError(() => ({
        error: { message: 'Sesión no válida' },
      }));
    }

    const params = new HttpParams().set('cliente_email', email);
    const historialParams = params.set('limit', '100').set('page', '1');

    return forkJoin({
      activas: this.http
        .get<unknown>(this.reservasUrl, {
          headers: this.noCacheHeaders,
          params,
        })
        .pipe(map((body) => parseReservasActivasResponse(body))),
      historial: this.http
        .get<unknown>(`${this.reservasUrl}/historial`, {
          headers: this.noCacheHeaders,
          params: historialParams,
        })
        .pipe(map((body) => parseHistorialReservasResponse(body))),
      individuales: this.http
        .get<InscripcionIndividualApi[]>(this.inscripcionesIndUrl, {
          headers: this.noCacheHeaders,
          params,
        })
        .pipe(catchError(() => of([]))),
      mensuales: this.http
        .get<InscripcionMensualApi[]>(this.inscripcionesMenUrl, {
          headers: this.noCacheHeaders,
          params,
        })
        .pipe(catchError(() => of([]))),
    }).pipe(
      switchMap(({ activas, historial, individuales, mensuales }) => {
        const hoy = fechaHoyLocal();
        const extras = this.construirReservasDesdeInscripciones(
          individuales,
          activas,
          historial.reservas,
          hoy,
        );

        const faltanId = extras.filter((e) => e.ins && !e.dto.id);
        const ensamblar = (dtosExtra: ReservaApiDto[]) =>
          this.enrichSedesReservas(
            this.ensamblarMisReservas(
              activas,
              dtosExtra,
              historial,
              individuales,
              mensuales,
              hoy,
            ),
          );

        if (faltanId.length === 0) {
          return ensamblar(extras.map((x) => x.dto));
        }

        return forkJoin(
          faltanId.map((item) =>
            this.buscarReservaIdPorClase(
              email,
              item.ins!.clase_id,
              item.fecha,
            ).pipe(
              map((id) => ({
                ...item,
                dto: { ...item.dto, id: id || item.dto.id },
              })),
            ),
          ),
        ).pipe(
          switchMap((resueltos) => {
            const mapaExtra = new Map(
              resueltos.map((r) => [`${r.ins!.clase_id}-${r.fecha}`, r.dto]),
            );
            const dtosExtra = extras.map((e) => {
              const key = e.ins ? `${e.ins.clase_id}-${e.fecha}` : '';
              return mapaExtra.get(key) ?? e.dto;
            });
            return ensamblar(dtosExtra);
          }),
        );
      }),
      catchError((err) => throwError(() => this.toHttpError(err))),
    );
  }

  /** Guarda el id de reserva tras crear inscripción (útil si GET /reservas aún no la lista). */
  recordarReservaCreada(claseId: number, fecha: string, reservaId: number): void {
    if (!reservaId) return;
    try {
      sessionStorage.setItem(
        `kuda_reserva_${claseId}_${fecha.slice(0, 10)}`,
        String(reservaId),
      );
    } catch {
      /* ignore */
    }
  }

  private ensamblarMisReservas(
    activas: ReservaApiDto[],
    extras: ReservaApiDto[],
    historial: HistorialReservasResponse,
    individuales: InscripcionIndividualApi[],
    mensuales: InscripcionMensualApi[],
    hoy: string,
  ): ReservaHistorial[] {
    const extrasSinDuplicar = extras.filter(
      (e) => !this.existeReservaEnHistorial(historial.reservas, e),
    );
    const activasCompletas = [...activas, ...extrasSinDuplicar];
    const idsActivas = new Set(
      activasCompletas.filter((r) => r.id > 0).map((r) => r.id),
    );
    const pasadas = historial.reservas.filter((r) => {
      if (r.id > 0 && idsActivas.has(r.id)) return false;
      return !activasCompletas.some(
        (a) =>
          a.clase?.id === r.clase?.id &&
          String(a.fecha_exacta).slice(0, 10) ===
            String(r.fecha_exacta).slice(0, 10),
      );
    });
    const todas = [...activasCompletas, ...pasadas];
    const mapped = todas.map((r) =>
      this.mapReservaDto(r, individuales, mensuales, hoy),
    );
    return mapped.sort(
      (a, b) =>
        new Date(b.proximaFecha ?? b.fechaReserva).getTime() -
        new Date(a.proximaFecha ?? a.fechaReserva).getTime(),
    );
  }

  /**
   * El GET /reservas solo devuelve fecha_exacta >= hoy (UTC). Complementamos con
   * inscripciones individuales futuras para no perder reservas recién creadas.
   */
  private existeReservaEnHistorial(
    historial: ReservaApiDto[],
    reserva: ReservaApiDto,
  ): boolean {
    const fecha = String(reserva.fecha_exacta).slice(0, 10);
    const claseId = reserva.clase?.id;
    if (!claseId) return false;
    return historial.some(
      (h) =>
        h.clase?.id === claseId &&
        String(h.fecha_exacta).slice(0, 10) === fecha,
    );
  }

  private construirReservasDesdeInscripciones(
    individuales: InscripcionIndividualApi[],
    activas: ReservaApiDto[],
    historial: ReservaApiDto[],
    hoy: string,
  ): { dto: ReservaApiDto; ins?: InscripcionIndividualApi; fecha: string }[] {
    const extras: {
      dto: ReservaApiDto;
      ins?: InscripcionIndividualApi;
      fecha: string;
    }[] = [];

    for (const ins of individuales) {
      const fecha = String(ins.fecha).slice(0, 10);
      if (fecha < hoy) continue;

      const yaListada = activas.some(
        (a) =>
          a.clase?.id === ins.clase_id &&
          String(a.fecha_exacta).slice(0, 10) === fecha,
      );
      const yaEnHistorial = historial.some(
        (h) =>
          h.clase?.id === ins.clase_id &&
          String(h.fecha_exacta).slice(0, 10) === fecha,
      );
      if (yaListada || yaEnHistorial) continue;

      const reservaId = this.resolverReservaIdLocal(ins, activas, fecha);
      const clase = ins.clase;
      const salaExtra = extraerSalaDto(clase?.sala);

      extras.push({
        ins,
        fecha,
        dto: {
          id: reservaId,
          fecha_exacta: fecha,
          estado: 'ACTIVA',
          asistio: null,
          clase: {
            id: clase?.id ?? ins.clase_id,
            hora_inicio: clase?.hora_inicio ?? '00:00',
            hora_fin: clase?.hora_fin ?? '00:00',
            cupo: Number(clase?.cupo ?? 0),
            actividad:
              ins.actividad?.nombre ?? clase?.actividad?.nombre ?? null,
            profesor: null,
            sala: salaExtra === '—' ? null : salaExtra,
          },
        },
      });
    }

    return extras;
  }

  private resolverReservaIdLocal(
    ins: InscripcionIndividualApi,
    activas: ReservaApiDto[],
    fecha: string,
  ): number {
    const enActivas = activas.find(
      (a) =>
        a.clase?.id === ins.clase_id &&
        String(a.fecha_exacta).slice(0, 10) === fecha,
    );
    if (enActivas) return enActivas.id;

    const enIns = ins.reservas?.find(
      (r) => r.estado === 'ACTIVA' || !r.estado,
    );
    if (enIns?.id) return enIns.id;

    try {
      const stored = sessionStorage.getItem(
        `kuda_reserva_${ins.clase_id}_${fecha}`,
      );
      if (stored) return Number(stored);
    } catch {
      /* ignore */
    }

    return 0;
  }

  /**
   * GET /reservas devuelve sala null (el DTO del back usa sala.nombre inexistente).
   * Completamos con GET /clases/:id, igual que en clases disponibles.
   */
  private enrichSedesReservas(
    reservas: ReservaHistorial[],
  ): Observable<ReservaHistorial[]> {
    const ids = [
      ...new Set(
        reservas
          .filter((r) => r.sede === '—' && r.claseId)
          .map((r) => r.claseId as number),
      ),
    ];
    if (ids.length === 0) {
      return of(reservas);
    }

    return forkJoin(
      ids.map((id) =>
        this.http
          .get<Clase>(`${this.clasesUrl}/${id}`, {
            headers: this.noCacheHeaders,
          })
          .pipe(
            map((c) => ({
              id,
              sede: c.sala?.identificador ?? '—',
            })),
            catchError(() => of({ id, sede: '—' })),
          ),
      ),
    ).pipe(
      map((filas) => {
        const porClase = new Map(filas.map((f) => [f.id, f.sede]));
        return reservas.map((r) =>
          r.sede === '—' && r.claseId && porClase.has(r.claseId)
            ? { ...r, sede: porClase.get(r.claseId)! }
            : r,
        );
      }),
    );
  }

  private buscarReservaIdPorClase(
    email: string,
    claseId: number,
    fecha: string,
  ): Observable<number> {
    const params = new HttpParams()
      .set('cliente_email', email)
      .set('clase_id', String(claseId));

    return this.http
      .get<unknown>(this.reservasUrl, {
        headers: this.noCacheHeaders,
        params,
      })
      .pipe(
        map((body) => {
          const list = parseReservasActivasResponse(body);
          const match = list.find(
            (r) => String(r.fecha_exacta).slice(0, 10) === fecha,
          );
          return match?.id ?? 0;
        }),
        catchError(() => of(0)),
      );
  }

  getMensualesActivas(): Observable<InscripcionMensualApi[]> {
    const email = this.auth.getCurrentUser()?.email;
    if (!email) {
      return of([]);
    }
    const params = new HttpParams().set('cliente_email', email);
    return this.http
      .get<InscripcionMensualApi[]>(this.inscripcionesMenUrl, {
        headers: this.noCacheHeaders,
        params,
      })
      .pipe(
        map((list) =>
          (list ?? []).filter((m) =>
            ['VIGENTE', 'EN_GRACIA'].includes(m.estado),
          ),
        ),
        catchError(() => of([])),
      );
  }

  getClasesDisponibles(): Observable<ClaseDisponible[]> {
    return forkJoin({
      clases: this.http.get<Clase[]>(this.clasesUrl, {
        headers: this.noCacheHeaders,
      }),
      mensuales: this.getMensualesActivas(),
    }).pipe(
      map(({ clases, mensuales }) =>
        (clases ?? []).filter(isClaseActiva).map((c) => ({ c, mensuales })),
      ),
      switchMap((items) => {
        if (items.length === 0) {
          return of([]);
        }
        return forkJoin(
          items.map(({ c, mensuales }) =>
            this.enrichClaseDisponible(c, mensuales),
          ),
        );
      }),
      catchError((err) => throwError(() => this.toHttpError(err))),
    );
  }

  horasHastaClase(proximaFecha: string, horaInicio: string): number {
    const hora = formatHora(horaInicio);
    const fechaClase = new Date(`${proximaFecha}T${hora}:00`);
    const ahora = new Date();
    return (fechaClase.getTime() - ahora.getTime()) / (1000 * 60 * 60);
  }

  puedePagarSeña(proximaFecha: string, horaInicio: string): boolean {
    return this.horasHastaClase(proximaFecha, horaInicio) > HORAS_MINIMAS_SEÑA;
  }

  /**
   * Inscripción mensual (abonado): POST /api/inscripciones-mensuales (+ MP).
   */
  inscribirMensual(clase: ClaseDisponible): Observable<ResultadoReserva> {
    const email = this.auth.getCurrentUser()?.email;
    if (!email) {
      return throwError(() => ({
        error: { message: 'Sesión no válida' },
      }));
    }

    const periodoInicio = new Date().toISOString().slice(0, 10);
    const body = {
      cliente_email: email,
      actividad_id: clase.actividadId,
      clase_id: clase.id,
      periodo_inicio: periodoInicio,
    };

    return this.http
      .post<InscripcionMensualApi>(this.inscripcionesMenUrl, body)
      .pipe(
        switchMap((inscripcion) => {
          const monto = Number(inscripcion.monto ?? clase.precioActividad ?? 0);
          const reservaId = inscripcion.reservas?.[0]?.id ?? inscripcion.id;
          const titulo = `Mensualidad ${clase.actividad}`;

          if (monto <= 0) {
            return of({
              message: MSG_RESERVA_CONFIRMADA,
              reservaId,
            });
          }

          return this.pagoService
            .createPreference({ tituloPlan: titulo, precio: monto })
            .pipe(
              map((pref) => ({
                message: MSG_RESERVA_CONFIRMADA,
                reservaId,
                redirectUrl: pref.init_point,
              })),
              catchError(() =>
                of({
                  message: MSG_RESERVA_CONFIRMADA,
                  reservaId,
                }),
              ),
            );
        }),
        catchError((err) => throwError(() => this.toHttpError(err))),
      );
  }

  /**
   * Clase individual o abonado con actividad ya cubierta (sin doble cobro).
   */
  reservarClase(
    clase: ClaseDisponible,
    tipoPago: TipoPago,
  ): Observable<ResultadoReserva> {
    const email = this.auth.getCurrentUser()?.email;
    if (!email) {
      return throwError(() => ({
        error: { message: 'Sesión no válida' },
      }));
    }

    return forkJoin({
      mensuales: this.getMensualesActivas(),
      activas: this.http
        .get<unknown>(this.reservasUrl, {
          headers: this.noCacheHeaders,
          params: new HttpParams().set('cliente_email', email),
        })
        .pipe(map((body) => parseReservasActivasResponse(body))),
    }).pipe(
      switchMap(({ mensuales, activas }) => {
        const abono = this.buscarAbonoVigente(
          mensuales,
          clase.actividadId,
          clase.proximaFecha,
        );

        if (abono) {
          return this.confirmarReservaConAbono(clase, activas, abono);
        }

        return this.crearInscripcionIndividual(clase, tipoPago, email);
      }),
      catchError((err) => throwError(() => this.toHttpError(err))),
    );
  }

  cancelarReserva(reservaId: number): Observable<ResultadoCancelacion> {
    return this.http
      .patch<{
        mensaje?: string;
        message?: string;
        reembolso?: boolean;
        vale?: { monto?: number };
      }>(`${this.reservasUrl}/${reservaId}/cancelar`, {})
      .pipe(
        map((r) => ({
          message: MSG_RESERVA_CANCELADA,
          reembolso: Boolean(r.reembolso),
          bono: r.vale?.monto ? Number(r.vale.monto) : undefined,
          detalle: r.mensaje ?? r.message,
        })),
        catchError((err) => {
          const normalizado = this.toHttpError(err);
          const msg = normalizado.error.message ?? '';
          if (/ya está cancelada/i.test(msg)) {
            return of({
              message: msg,
              reembolso: false,
              yaCancelada: true,
            } as ResultadoCancelacion);
          }
          return throwError(() => normalizado);
        }),
      );
  }

  olvidarReservaLocal(claseId: number, fecha: string): void {
    try {
      sessionStorage.removeItem(
        `kuda_reserva_${claseId}_${fecha.slice(0, 10)}`,
      );
    } catch {
      /* ignore */
    }
  }

  anotarseListaEspera(
    clase: ClaseDisponible,
    tipo: TipoListaEspera,
  ): Observable<{ message: string }> {
    const tipoApi = tipo === 'ABONADO' ? 'MENSUAL' : 'INDIVIDUAL';
    const body: Record<string, unknown> = {
      clase_id: clase.id,
      tipo: tipoApi,
    };
    if (tipoApi === 'INDIVIDUAL') {
      body['fecha_exacta'] = clase.proximaFecha;
    }

    return this.http
      .post<{ message: string }>(this.listaEsperaUrl, body)
      .pipe(
        map((r) => ({
          message:
            r.message ?? 'Te anotaste en la lista de espera correctamente',
        })),
        catchError((err) => throwError(() => this.toHttpError(err))),
      );
  }

  private buscarAbonoVigente(
    mensuales: InscripcionMensualApi[],
    actividadId: number,
    fecha: string,
  ): InscripcionMensualApi | undefined {
    return mensuales.find(
      (m) =>
        m.actividad_id === actividadId &&
        fecha >= String(m.periodo_inicio).slice(0, 10) &&
        fecha < String(m.periodo_fin).slice(0, 10),
    );
  }

  /**
   * Abonado activo de la actividad: no vuelve a cobrar si ya tiene reserva
   * o si la mensualidad es de esta misma clase (reservas generadas por el back).
   */
  private confirmarReservaConAbono(
    clase: ClaseDisponible,
    reservasActivas: ReservaApiDto[],
    abono: InscripcionMensualApi,
  ): Observable<ResultadoReserva> {
    const fecha = clase.proximaFecha;
    const reservaExistente = reservasActivas.find(
      (r) =>
        r.clase?.id === clase.id &&
        String(r.fecha_exacta).slice(0, 10) === fecha &&
        r.estado === 'ACTIVA',
    );

    if (reservaExistente) {
      return of({
        message: MSG_RESERVA_CONFIRMADA,
        reservaId: reservaExistente.id,
      });
    }

    if (abono.clase_id === clase.id) {
      return of({
        message: MSG_RESERVA_CONFIRMADA,
        reservaId: abono.reservas?.[0]?.id ?? abono.id,
      });
    }

    return throwError(() => ({
      error: {
        message:
          'Tu mensualidad está asociada a otra clase de esta actividad. Revisá tus reservas en Mis reservas.',
      },
    }));
  }

  private crearInscripcionIndividual(
    clase: ClaseDisponible,
    tipoPago: TipoPago,
    email: string,
  ): Observable<ResultadoReserva> {
    if (
      tipoPago === 'SEÑA' &&
      !this.puedePagarSeña(clase.proximaFecha, clase.horaInicio)
    ) {
      return throwError(() => ({
        error: {
          message:
            'Ya no se aceptan señas porque la clase comienza en menos de 10 horas.',
        },
      }));
    }

    const modalidad = tipoPago === 'PAGO_COMPLETO' ? 'COMPLETO' : 'SEÑA';
    const body: Record<string, unknown> = {
      cliente_email: email,
      actividad_id: clase.actividadId,
      clase_id: clase.id,
      fecha: clase.proximaFecha,
      modalidad,
    };

    if (modalidad === 'SEÑA') {
      body['vencimiento_seña'] = this.calcularVencimientoSeña(clase.proximaFecha);
    }

    return this.http
      .post<InscripcionIndividualApi>(this.inscripcionesIndUrl, body)
      .pipe(
        switchMap((inscripcion) => {
          const reservaId = inscripcion.reservas?.[0]?.id ?? 0;
          if (reservaId) {
            this.recordarReservaCreada(clase.id, clase.proximaFecha, reservaId);
          }
          return this.finalizarConPagoOpcional(
            clase,
            Number(inscripcion.monto_pagado ?? 0),
            reservaId || inscripcion.id,
            tipoPago,
          );
        }),
        catchError((err) => throwError(() => this.toHttpError(err))),
      );
  }

  private finalizarConPagoOpcional(
    clase: ClaseDisponible,
    monto: number,
    reservaId: number,
    tipoPago: TipoPago = 'PAGO_COMPLETO',
  ): Observable<ResultadoReserva> {
    const okMessage =
      tipoPago === 'SEÑA' ? MSG_RESERVA_CONFIRMADA_SEÑA : MSG_RESERVA_CONFIRMADA;

    if (monto <= 0) {
      return of({
        message: okMessage,
        reservaId,
      });
    }

    const titulo = `${clase.actividad} — ${clase.proximaFecha}`;
    return this.pagoService.createPreference({ tituloPlan: titulo, precio: monto }).pipe(
      map((pref) => ({
        message: okMessage,
        reservaId,
        redirectUrl: pref.init_point,
      })),
      catchError(() =>
        of({
          message: MSG_RESERVA_INCOMPLETA,
          reservaId,
        }),
      ),
    );
  }

  private enrichClaseDisponible(
    clase: Clase,
    mensuales: InscripcionMensualApi[] = [],
  ): Observable<ClaseDisponible> {
    const params = new HttpParams().set('clase_id', String(clase.id));

    return forkJoin({
      detalle: this.http.get<Clase & { proximas_fechas?: string[] }>(
        `${this.clasesUrl}/${clase.id}`,
        { headers: this.noCacheHeaders },
      ),
      ocupacion: this.http
        .get<unknown>(this.reservasUrl, {
          headers: this.noCacheHeaders,
          params,
        })
        .pipe(map((body) => parseReservasActivasResponse(body))),
    }).pipe(
      map(({ detalle, ocupacion }) => {
        const proximaFecha =
          detalle.proximas_fechas?.[0] ??
          calcularProximaFecha(clase.dia_semana);
        const horaInicio = formatHora(clase.hora_inicio);
        const ocupadas = (ocupacion ?? []).filter(
          (r) =>
            r.estado === 'ACTIVA' &&
            String(r.fecha_exacta).slice(0, 10) === proximaFecha,
        ).length;
        const cupoTotal = Number(clase.cupo ?? 0);

        const prox = proximaFecha;
        return {
          id: clase.id,
          actividadId: clase.actividad_id,
          actividad: clase.actividad?.nombre ?? clase.nombre,
          sede: clase.sala?.identificador ?? '—',
          diaSemana: labelDia(clase.dia_semana),
          horaInicio,
          horaFin: formatHora(clase.hora_fin),
          cupoTotal,
          cupoDisponible: Math.max(0, cupoTotal - ocupadas),
          proximaFecha: prox,
          precioActividad: Number(
            (clase.actividad as { precio?: number })?.precio ?? 0,
          ),
          abonoActividadVigente: Boolean(
            this.buscarAbonoVigente(mensuales, clase.actividad_id, prox),
          ),
        };
      }),
      catchError(() => {
        const prox = calcularProximaFecha(clase.dia_semana);
        return of({
          id: clase.id,
          actividadId: clase.actividad_id,
          actividad: clase.actividad?.nombre ?? clase.nombre,
          sede: clase.sala?.identificador ?? '—',
          diaSemana: labelDia(clase.dia_semana),
          horaInicio: formatHora(clase.hora_inicio),
          horaFin: formatHora(clase.hora_fin),
          cupoTotal: Number(clase.cupo ?? 0),
          cupoDisponible: Number(clase.cupo ?? 0),
          proximaFecha: prox,
          abonoActividadVigente: Boolean(
            this.buscarAbonoVigente(mensuales, clase.actividad_id, prox),
          ),
        });
      }),
    );
  }

  private mapReservaDto(
    dto: ReservaApiDto,
    individuales: InscripcionIndividualApi[],
    mensuales: InscripcionMensualApi[],
    hoy: string,
  ): ReservaHistorial {
    const clase = dto.clase;
    const fecha = String(dto.fecha_exacta).slice(0, 10);
    const horaInicio = formatHora(clase?.hora_inicio ?? '00:00');
    const horaFin = formatHora(clase?.hora_fin ?? '00:00');

    const mensual = mensuales.find(
      (m) =>
        m.estado !== 'CANCELADA' &&
        m.clase_id === clase?.id &&
        fecha >= String(m.periodo_inicio).slice(0, 10) &&
        fecha < String(m.periodo_fin).slice(0, 10),
    );

    const individual = individuales.find(
      (i) =>
        i.clase_id === clase?.id &&
        String(i.fecha).slice(0, 10) === fecha,
    );

    const esAbonado = Boolean(mensual);
    let estado: EstadoHistorial =
      dto.estado === 'CANCELADA' ? 'CANCELADA' : 'ACTIVA';

    if (estado === 'ACTIVA' && fecha < hoy) {
      estado = 'COMPLETADA';
    }

    const claseId =
      clase?.id ?? individual?.clase_id ?? mensual?.clase_id;
    const sede =
      extraerSalaDto(clase?.sala) !== '—'
        ? extraerSalaDto(clase?.sala)
        : extraerSalaDto(individual?.clase?.sala) !== '—'
          ? extraerSalaDto(individual?.clase?.sala)
          : extraerSalaDto(mensual?.clase?.sala);

    return {
      id: dto.id,
      claseId,
      actividad: clase?.actividad ?? '—',
      sede,
      diaSemana: diaDesdeFecha(fecha),
      horaInicio,
      horaFin,
      modalidad: esAbonado ? 'ABONADO' : 'INDIVIDUAL',
      esAbonado,
      estado,
      tipoPago: individual
        ? individual.modalidad === 'SEÑA'
          ? 'SEÑA'
          : 'PAGO_COMPLETO'
        : undefined,
      montoAbonado: individual
        ? Number(individual.monto_pagado)
        : mensual
          ? Number(mensual.monto)
          : undefined,
      fechaReserva: fecha,
      proximaFecha: fecha,
    };
  }

  private calcularVencimientoSeña(fechaClase: string): string {
    const d = new Date(`${fechaClase}T12:00:00`);
    d.setDate(d.getDate() + 10);
    return d.toISOString().slice(0, 10);
  }

  private toHttpError(err: unknown): { error: { message: string } } {
    if (err instanceof HttpErrorResponse) {
      const msg =
        typeof err.error === 'object' &&
        err.error !== null &&
        'message' in err.error
          ? String((err.error as { message: string }).message)
          : err.message;
      return { error: { message: msg || 'Ocurrió un error inesperado' } };
    }
    if (err && typeof err === 'object' && 'error' in err) {
      return err as { error: { message: string } };
    }
    return { error: { message: 'Ocurrió un error inesperado' } };
  }
}

/** El back devuelve `{ message, data: [] }` cuando no hay reservas, no un array vacío. */
function extraerSalaDto(
  sala: string | { identificador?: string; nombre?: string } | null | undefined,
): string {
  if (!sala) return '—';
  if (typeof sala === 'string') return sala || '—';
  return sala.identificador ?? sala.nombre ?? '—';
}

function parseReservasActivasResponse(body: unknown): ReservaApiDto[] {
  if (Array.isArray(body)) {
    return body;
  }
  if (body && typeof body === 'object') {
    const data = (body as { data?: unknown }).data;
    if (Array.isArray(data)) {
      return data as ReservaApiDto[];
    }
  }
  return [];
}

function fechaHoyLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseHistorialReservasResponse(body: unknown): HistorialReservasResponse {
  if (body && typeof body === 'object') {
    const raw = body as HistorialReservasResponse & { data?: ReservaApiDto[] };
    if (Array.isArray(raw.reservas)) {
      return {
        total: raw.total ?? raw.reservas.length,
        pagina: raw.pagina ?? 1,
        paginas: raw.paginas ?? 1,
        reservas: raw.reservas,
      };
    }
    if (Array.isArray(raw.data)) {
      return {
        total: 0,
        pagina: 1,
        paginas: 0,
        reservas: raw.data,
      };
    }
  }
  return { total: 0, pagina: 1, paginas: 0, reservas: [] };
}

function formatHora(value: string): string {
  if (!value) return '00:00';
  return value.length >= 5 ? value.slice(0, 5) : value;
}

function labelDia(dia: string): string {
  const map: Record<string, string> = {
    Miercoles: 'Miércoles',
    Sabado: 'Sábado',
  };
  return map[dia] ?? dia;
}

function calcularProximaFecha(diaSemana: string): string {
  const mapa: Record<string, number> = {
    Domingo: 0,
    Lunes: 1,
    Martes: 2,
    Miercoles: 3,
    Jueves: 4,
    Viernes: 5,
    Sabado: 6,
  };
  const objetivo = mapa[diaSemana];
  if (objetivo === undefined) {
    return new Date().toISOString().slice(0, 10);
  }
  const actual = new Date();
  while (actual.getDay() !== objetivo) {
    actual.setDate(actual.getDate() + 1);
  }
  return actual.toISOString().slice(0, 10);
}

function diaDesdeFecha(iso: string): string {
  const dias = [
    'Domingo',
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
  ];
  const d = new Date(`${iso}T12:00:00`);
  return dias[d.getDay()] ?? iso;
}
