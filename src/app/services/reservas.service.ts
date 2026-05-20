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

export const MSG_RESERVA_CONFIRMADA = 'Reserva confirmada';
export const MSG_RESERVA_CANCELADA = 'Reserva cancelada con éxito';
export const HORAS_MINIMAS_SEÑA = 10;

export type ModalidadInscripcion = 'ABONADO' | 'INDIVIDUAL';

export interface ReservaHistorial {
  id: number;
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
    sala: string | null;
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
  reservas?: { id: number }[];
}

interface InscripcionMensualApi {
  id: number;
  actividad_id: number;
  clase_id: number;
  periodo_inicio: string;
  periodo_fin: string;
  estado: string;
  monto: number | string;
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
      activas: this.http.get<ReservaApiDto[]>(this.reservasUrl, {
        headers: this.noCacheHeaders,
        params,
      }),
      historial: this.http.get<HistorialReservasResponse>(
        `${this.reservasUrl}/historial`,
        { headers: this.noCacheHeaders, params: historialParams },
      ),
      individuales: this.http.get<InscripcionIndividualApi[]>(
        this.inscripcionesIndUrl,
        { headers: this.noCacheHeaders, params },
      ),
      mensuales: this.http.get<InscripcionMensualApi[]>(
        this.inscripcionesMenUrl,
        { headers: this.noCacheHeaders, params },
      ),
    }).pipe(
      map(({ activas, historial, individuales, mensuales }) => {
        const hoy = new Date().toISOString().slice(0, 10);
        const idsActivas = new Set((activas ?? []).map((r) => r.id));
        const pasadas = (historial?.reservas ?? []).filter(
          (r) => !idsActivas.has(r.id),
        );
        const todas = [...(activas ?? []), ...pasadas];
        const mapped = todas.map((r) =>
          this.mapReservaDto(r, individuales ?? [], mensuales ?? [], hoy),
        );
        return mapped.sort(
          (a, b) =>
            new Date(b.proximaFecha ?? b.fechaReserva).getTime() -
            new Date(a.proximaFecha ?? a.fechaReserva).getTime(),
        );
      }),
      catchError((err) => throwError(() => this.toHttpError(err))),
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
      activas: this.http.get<ReservaApiDto[]>(this.reservasUrl, {
        headers: this.noCacheHeaders,
        params: new HttpParams().set('cliente_email', email),
      }),
    }).pipe(
      switchMap(({ mensuales, activas }) => {
        const abono = this.buscarAbonoVigente(
          mensuales,
          clase.actividadId,
          clase.proximaFecha,
        );

        if (abono) {
          return this.confirmarReservaConAbono(clase, activas ?? [], abono);
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
        catchError((err) => throwError(() => this.toHttpError(err))),
      );
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
        switchMap((inscripcion) =>
          this.finalizarConPagoOpcional(
            clase,
            Number(inscripcion.monto_pagado ?? 0),
            inscripcion.reservas?.[0]?.id ?? inscripcion.id,
          ),
        ),
        catchError((err) => throwError(() => this.toHttpError(err))),
      );
  }

  private finalizarConPagoOpcional(
    clase: ClaseDisponible,
    monto: number,
    reservaId: number,
  ): Observable<ResultadoReserva> {
    if (monto <= 0) {
      return of({
        message: MSG_RESERVA_CONFIRMADA,
        reservaId,
      });
    }

    const titulo = `${clase.actividad} — ${clase.proximaFecha}`;
    return this.pagoService.createPreference({ tituloPlan: titulo, precio: monto }).pipe(
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
      ocupacion: this.http.get<ReservaApiDto[]>(this.reservasUrl, {
        headers: this.noCacheHeaders,
        params,
      }),
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

    return {
      id: dto.id,
      actividad: clase?.actividad ?? '—',
      sede: typeof clase?.sala === 'string' ? clase.sala : '—',
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
