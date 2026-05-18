import { Injectable } from '@angular/core';
import { Observable, of, throwError, delay } from 'rxjs';

export type ModalidadReserva = 'ABONADO' | 'INDIVIDUAL';
export type EstadoReserva = 'VIGENTE' | 'EN_GRACIA';
export type EstadoHistorial = 'ACTIVA' | 'CANCELADA' | 'COMPLETADA' | 'EN_ESPERA';
export type TipoPago = 'PAGO_COMPLETO' | 'SEÑA';
export type TipoListaEspera = 'ABONADO' | 'INDIVIDUAL';

export interface ReservaActual {
  id: number;
  actividad: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
  modalidad: ModalidadReserva;
  proximaFecha?: string;
  estado: EstadoReserva;
}

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
  actividad: string;
  sede: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
  cupoTotal: number;
  cupoDisponible: number;
  proximaFecha: string;
}

export interface ResultadoCancelacion {
  message: string;
  reembolso: boolean;
  bono?: number;
}

export interface ResultadoReserva {
  message: string;
  reservaId: number;
}

@Injectable({ providedIn: 'root' })
export class ReservasService {

  private readonly RESERVAS_MOCK: ReservaHistorial[] = [
    {
      id: 1,
      actividad: 'Yoga',
      sede: 'Sede A',
      diaSemana: 'Lunes',
      horaInicio: '09:00',
      horaFin: '10:00',
      modalidad: 'ABONADO',
      esAbonado: true,
      estado: 'ACTIVA',
      tipoPago: 'PAGO_COMPLETO',
      montoAbonado: 28000,
      fechaReserva: '2026-05-01',
      proximaFecha: '2026-05-19',
    },
    {
      id: 2,
      actividad: 'Funcional',
      sede: 'Sede B',
      diaSemana: 'Miércoles',
      horaInicio: '18:30',
      horaFin: '19:30',
      modalidad: 'ABONADO',
      esAbonado: true,
      estado: 'ACTIVA',
      tipoPago: 'PAGO_COMPLETO',
      montoAbonado: 28000,
      fechaReserva: '2026-05-03',
      proximaFecha: '2026-05-21',
    },
    {
      id: 3,
      actividad: 'Pilates',
      sede: 'Sede A',
      diaSemana: 'Sábado',
      horaInicio: '10:00',
      horaFin: '11:00',
      modalidad: 'INDIVIDUAL',
      esAbonado: false,
      estado: 'ACTIVA',
      tipoPago: 'PAGO_COMPLETO',
      montoAbonado: 9500,
      fechaReserva: '2026-05-10',
      proximaFecha: '2026-05-24',
    },
    {
      id: 4,
      actividad: 'Yoga',
      sede: 'Sede A',
      diaSemana: 'Jueves',
      horaInicio: '17:00',
      horaFin: '18:00',
      modalidad: 'INDIVIDUAL',
      esAbonado: false,
      estado: 'CANCELADA',
      fechaReserva: '2026-04-20',
      proximaFecha: '2026-04-24',
    },
  ];

  private readonly CLASES_MOCK: ClaseDisponible[] = [
    {
      id: 10,
      actividad: 'Yoga',
      sede: 'Sede A',
      diaSemana: 'Lunes',
      horaInicio: '09:00',
      horaFin: '10:00',
      cupoTotal: 20,
      cupoDisponible: 5,
      proximaFecha: '2026-05-19',
    },
    {
      id: 11,
      actividad: 'Pilates',
      sede: 'Sede A',
      diaSemana: 'Martes',
      horaInicio: '10:00',
      horaFin: '11:00',
      cupoTotal: 15,
      cupoDisponible: 8,
      proximaFecha: '2026-05-20',
    },
    {
      id: 12,
      actividad: 'Funcional',
      sede: 'Sede B',
      diaSemana: 'Miércoles',
      horaInicio: '18:30',
      horaFin: '19:30',
      cupoTotal: 20,
      cupoDisponible: 0,
      proximaFecha: '2026-05-21',
    },
    {
      id: 13,
      actividad: 'Yoga',
      sede: 'Sede B',
      diaSemana: 'Jueves',
      horaInicio: '17:00',
      horaFin: '18:00',
      cupoTotal: 15,
      cupoDisponible: 3,
      proximaFecha: '2026-05-16',
    },
    {
      id: 14,
      actividad: 'Pilates',
      sede: 'Sede A',
      diaSemana: 'Sábado',
      horaInicio: '10:00',
      horaFin: '11:00',
      cupoTotal: 15,
      cupoDisponible: 12,
      proximaFecha: '2026-05-17',
    },
  ];

  getMisReservas(): Observable<ReservaHistorial[]> {
    const ordenadas = [...this.RESERVAS_MOCK].sort(
      (a, b) => new Date(b.fechaReserva).getTime() - new Date(a.fechaReserva).getTime()
    );
    return of(ordenadas).pipe(delay(400));
  }

  getClasesDisponibles(): Observable<ClaseDisponible[]> {
    return of(this.CLASES_MOCK).pipe(delay(400));
  }

  /** Calcula horas que faltan hasta la próxima clase */
  horasHastaClase(proximaFecha: string, horaInicio: string): number {
    const fechaClase = new Date(`${proximaFecha}T${horaInicio}:00`);
    const ahora = new Date();
    return (fechaClase.getTime() - ahora.getTime()) / (1000 * 60 * 60);
  }

  /**
   * MOCK: Registra una reserva.
   * Backend esperado: POST /api/reservas
   */
  reservarClase(claseId: number, tipoPago: TipoPago): Observable<ResultadoReserva> {
    const clase = this.CLASES_MOCK.find((c) => c.id === claseId);
    if (!clase || clase.cupoDisponible === 0) {
      return throwError(() => ({
        error: { message: 'No hay cupo disponible para esta clase.' },
      })).pipe(delay(300));
    }
    return of({
      message: tipoPago === 'PAGO_COMPLETO'
        ? 'Reserva confirmada. Tu pago fue registrado exitosamente.'
        : 'Reserva confirmada. Se registró tu seña. El saldo restante se abonará en el centro.',
      reservaId: Math.floor(Math.random() * 1000) + 100,
    }).pipe(delay(500));
  }

  /**
   * MOCK: Cancela una reserva aplicando la lógica de reembolso/bono según tiempo y tipo.
   * Backend esperado: DELETE /api/reservas/:id
   */
  cancelarReserva(reservaId: number): Observable<ResultadoCancelacion> {
    const reserva = this.RESERVAS_MOCK.find((r) => r.id === reservaId);
    if (!reserva) {
      return throwError(() => ({
        error: { message: 'Reserva no encontrada.' },
      })).pipe(delay(300));
    }

    const horas = reserva.proximaFecha
      ? this.horasHastaClase(reserva.proximaFecha, reserva.horaInicio)
      : 0;
    const con24hs = horas > 24;

    let message: string;
    let reembolso = false;
    let bono: number | undefined;

    if (con24hs) {
      if (reserva.esAbonado) {
        bono = Math.round((reserva.montoAbonado ?? 0) * 0.2);
        message = `Tu reserva fue cancelada. Se acreditará un bono del 20% ($${bono}) para el mes siguiente.`;
      } else {
        reembolso = true;
        message = `Tu reserva fue cancelada. Recibirás el reembolso completo de $${reserva.montoAbonado ?? 0}.`;
      }
    } else {
      message = 'Tu reserva fue cancelada. Por haberse cancelado con menos de 24hs de anticipación, no se aplicará reembolso.';
    }

    return of({ message, reembolso, bono }).pipe(delay(500));
  }

  /**
   * MOCK: Inscribe al cliente en la lista de espera.
   * Backend esperado: POST /api/reservas/lista-espera
   */
  anotarseListaEspera(claseId: number, tipo: TipoListaEspera): Observable<{ message: string }> {
    return of({
      message: tipo === 'ABONADO'
        ? 'Te anotaste en la lista de espera como abonado. Te notificaremos si se libera un lugar para el mes completo.'
        : 'Te anotaste en la lista de espera. Te notificaremos si se libera un lugar para esta clase.',
    }).pipe(delay(500));
  }
}
