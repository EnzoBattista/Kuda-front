import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import {
  MSG_RESERVA_CANCELADA,
  ReservaHistorial,
  ReservasService,
  ResultadoCancelacion,
} from '../../services/reservas.service';
import { FechaArPipe } from '../../shared/pipes/fecha-ar.pipe';

interface AbonadoGrupo {
  mensualId: number;
  actividad: string;
  actividadDescripcion?: string;
  descripcionExpandida?: boolean;
  sede: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
  periodoInicio?: string;
  periodoFin?: string;
  reservas: ReservaHistorial[];
  cantidadActivas: number;
}

interface CardItem {
  kind: 'individual' | 'grupo';
  reserva?: ReservaHistorial;
  grupo?: AbonadoGrupo;
}

@Component({
  selector: 'app-mis-reservas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FechaArPipe],
  templateUrl: './mis-reservas.component.html',
  styleUrl: './mis-reservas.component.css',
})
export class MisReservasComponent implements OnInit {
  readonly filtros = new FormGroup({
    actividad: new FormControl('', { nonNullable: true }),
    sede: new FormControl('', { nonNullable: true }),
  });

  reservas: ReservaHistorial[] = [];
  reservasFiltradas: ReservaHistorial[] = [];
  items: CardItem[] = [];
  actividades: string[] = [];
  sedes: string[] = [];

  isLoading = true;
  errorMsg = '';
  bannerSuccess = '';
  bannerError = '';

  reservaSeleccionada: ReservaHistorial | null = null;
  grupoSeleccionado: AbonadoGrupo | null = null;
  modalPaso:
    | 'detalle'
    | 'detalle-grupo'
    | 'confirmar-cancelacion'
    | 'resultado-cancelacion' = 'detalle';
  resultadoCancelacion: ResultadoCancelacion | null = null;
  isCancelando = false;
  errorCancelacion = '';

  constructor(private readonly reservasService: ReservasService) {}

  ngOnInit(): void {
    this.cargarReservas();
    this.filtros.valueChanges.subscribe(() => this.aplicarFiltros());
  }

  cargarReservas(): void {
    this.isLoading = true;
    this.errorMsg = '';
    this.reservasService.getMisReservas().subscribe({
      next: (data) => {
        this.reservas = data ?? [];
        this.actividades = [...new Set(this.reservas.map((r) => r.actividad))].sort();
        this.sedes = [...new Set(this.reservas.map((r) => r.sede))].sort();
        this.aplicarFiltros();
        this.isLoading = false;
      },
      error: (err: unknown) => {
        this.errorMsg = this.mensajeErrorCarga(err);
        this.isLoading = false;
      },
    });
  }

  private aplicarFiltros(): void {
    const { actividad, sede } = this.filtros.getRawValue();
    this.reservasFiltradas = this.reservas.filter(
      (r) =>
        (!actividad || r.actividad === actividad) &&
        (!sede || r.sede === sede),
    );
    this.items = this.agruparReservas(this.reservasFiltradas);
  }

  private agruparReservas(reservas: ReservaHistorial[]): CardItem[] {
    const grupos = new Map<number, AbonadoGrupo>();
    const items: CardItem[] = [];

    for (const r of reservas) {
      if (r.esAbonado && r.inscripcionMensualId) {
        const key = r.inscripcionMensualId;
        let grupo = grupos.get(key);
        if (!grupo) {
          grupo = {
            mensualId: key,
            actividad: r.actividad,
            actividadDescripcion: r.actividadDescripcion,
            sede: r.sede,
            diaSemana: r.diaSemana,
            horaInicio: r.horaInicio,
            horaFin: r.horaFin,
            periodoInicio: r.periodoInicio,
            periodoFin: r.periodoFin,
            reservas: [],
            cantidadActivas: 0,
          };
          grupos.set(key, grupo);
          items.push({ kind: 'grupo', grupo });
        }
        grupo.reservas.push(r);
        if (r.estado === 'ACTIVA') grupo.cantidadActivas += 1;
      } else {
        items.push({ kind: 'individual', reserva: r });
      }
    }

    for (const grupo of grupos.values()) {
      this.agregarFechasPrecanceladasCef(grupo);
      grupo.reservas.sort((a, b) =>
        (a.proximaFecha ?? a.fechaReserva).localeCompare(
          b.proximaFecha ?? b.fechaReserva,
        ),
      );
    }

    // Oculta abonados que ya no tienen ninguna reserva activa (mensual
    // "muerta" porque el cliente canceló todas o el CEF las canceló).
    return items.filter(
      (i) => i.kind !== 'grupo' || (i.grupo?.cantidadActivas ?? 0) > 0,
    );
  }

  /**
   * Para cada abonado, completa la lista con las fechas del período en que
   * el CEF canceló la clase ANTES de que el cliente se inscribiera. Esas
   * fechas no tienen reserva real (el back las saltea y prorratea el monto),
   * así que se agregan como "ghost" para dar visibilidad.
   */
  private agregarFechasPrecanceladasCef(grupo: AbonadoGrupo): void {
    if (!grupo.periodoInicio || !grupo.periodoFin || grupo.reservas.length === 0) {
      return;
    }
    const primera = grupo.reservas[0];
    const claseId = primera.claseId;
    if (!claseId) return;

    const refFecha = primera.proximaFecha ?? primera.fechaReserva;
    const diaSemana = new Date(`${refFecha}T12:00:00`).getDay();
    const esperadas = this.fechasEnPeriodo(
      grupo.periodoInicio,
      grupo.periodoFin,
      diaSemana,
    );

    const fechasYaPresentes = new Set(
      this.reservas
        .filter((r) => r.claseId === claseId)
        .map((r) => r.proximaFecha ?? r.fechaReserva),
    );

    for (const fecha of esperadas) {
      if (fechasYaPresentes.has(fecha)) continue;
      grupo.reservas.push({
        id: 0,
        claseId,
        actividad: grupo.actividad,
        sede: grupo.sede,
        diaSemana: grupo.diaSemana,
        horaInicio: grupo.horaInicio,
        horaFin: grupo.horaFin,
        modalidad: 'ABONADO',
        esAbonado: true,
        estado: 'CANCELADA',
        fechaReserva: fecha,
        proximaFecha: fecha,
        inscripcionMensualId: grupo.mensualId,
        periodoInicio: grupo.periodoInicio,
        periodoFin: grupo.periodoFin,
        canceladaPor: 'CEF',
      });
    }
  }

  /** Fechas YYYY-MM-DD entre [inicio, fin) que caen en `diaSemana` (JS: 0..6). */
  private fechasEnPeriodo(
    inicio: string,
    fin: string,
    diaSemana: number,
  ): string[] {
    const [yi, mi, di] = inicio.split('-').map(Number);
    const [yf, mf, df] = fin.split('-').map(Number);
    const cursor = new Date(Date.UTC(yi, mi - 1, di));
    const limite = new Date(Date.UTC(yf, mf - 1, df));
    const out: string[] = [];
    while (cursor < limite) {
      if (cursor.getUTCDay() === diaSemana) {
        out.push(cursor.toISOString().slice(0, 10));
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return out;
  }

  limpiarFiltros(): void {
    this.filtros.reset({ actividad: '', sede: '' });
  }

  hayFiltros(): boolean {
    const { actividad, sede } = this.filtros.getRawValue();
    return Boolean(actividad || sede);
  }

  abrirDetalle(reserva: ReservaHistorial): void {
    this.reservaSeleccionada = reserva;
    this.grupoSeleccionado = null;
    this.modalPaso = 'detalle';
    this.resultadoCancelacion = null;
    this.errorCancelacion = '';
    this.isCancelando = false;
  }

  abrirDetalleGrupo(grupo: AbonadoGrupo): void {
    this.grupoSeleccionado = grupo;
    this.reservaSeleccionada = null;
    this.modalPaso = 'detalle-grupo';
    this.resultadoCancelacion = null;
    this.errorCancelacion = '';
    this.isCancelando = false;
  }

  abrirCancelacionDesdeGrupo(reserva: ReservaHistorial): void {
    this.reservaSeleccionada = reserva;
    this.modalPaso = 'confirmar-cancelacion';
    this.resultadoCancelacion = null;
    this.errorCancelacion = '';
    this.isCancelando = false;
  }

  abrirCancelacion(reserva: ReservaHistorial): void {
    this.reservaSeleccionada = reserva;
    this.grupoSeleccionado = null;
    this.modalPaso = 'confirmar-cancelacion';
    this.resultadoCancelacion = null;
    this.errorCancelacion = '';
    this.isCancelando = false;
  }

  cerrarModal(): void {
    this.reservaSeleccionada = null;
    this.grupoSeleccionado = null;
    this.modalPaso = 'detalle';
  }

  volverDesdeCancelacion(): void {
    if (this.grupoSeleccionado) {
      // Abonado: vuelve al detalle de la reserva abonada (Escenario 3 HU abonado).
      this.reservaSeleccionada = null;
      this.modalPaso = 'detalle-grupo';
    } else {
      // Individual: vuelve al listado de clases (Escenario 3 HU no-abonado).
      this.cerrarModal();
    }
  }

  irACancelar(): void {
    this.modalPaso = 'confirmar-cancelacion';
    this.errorCancelacion = '';
  }

  confirmarCancelacion(): void {
    if (!this.reservaSeleccionada) return;
    this.isCancelando = true;
    this.errorCancelacion = '';
    this.bannerError = '';

    const seleccionada = this.reservaSeleccionada;
    const mensualIdGrupo = this.grupoSeleccionado?.mensualId;

    this.reservasService.cancelarReserva(seleccionada.id).subscribe({
      next: (resultado) => {
        this.isCancelando = false;
        this.limpiarCacheReserva(seleccionada);

        if (resultado.yaCancelada) {
          this.cerrarModal();
          this.cargarReservas();
          return;
        }

        this.resultadoCancelacion = resultado;
        this.bannerSuccess = MSG_RESERVA_CANCELADA;

        // Si se acreditó un bono (abonado +24hs), notificar al cliente en el
        // paso de resultado del modal y refrescar la lista en background.
        if (resultado.bono) {
          this.modalPaso = 'resultado-cancelacion';
          this.cargarReservas();
          return;
        }

        if (mensualIdGrupo) {
          this.reservasService.getMisReservas().subscribe({
            next: (data) => {
              this.reservas = data ?? [];
              this.aplicarFiltros();
              const nuevoItem = this.items.find(
                (i) => i.kind === 'grupo' && i.grupo?.mensualId === mensualIdGrupo,
              );
              if (nuevoItem?.grupo) {
                this.grupoSeleccionado = nuevoItem.grupo;
                this.reservaSeleccionada = null;
                this.modalPaso = 'detalle-grupo';
              } else {
                this.cerrarModal();
              }
            },
            error: () => {
              this.cerrarModal();
            },
          });
        } else {
          this.cerrarModal();
          this.cargarReservas();
        }
      },
      error: (err) => {
        this.isCancelando = false;
        const msg =
          err?.error?.message ?? 'No se pudo cancelar la reserva.';
        this.errorCancelacion = msg;
        this.bannerError = msg;
      },
    });
  }

  private limpiarCacheReserva(r: ReservaHistorial): void {
    if (r.claseId && r.proximaFecha) {
      this.reservasService.olvidarReservaLocal(r.claseId, r.proximaFecha);
    }
  }

  modalidadLabel(r: ReservaHistorial): string {
    return r.modalidad === 'ABONADO' ? 'Abonado' : 'Clase Individual';
  }

  estadoLabel(r: ReservaHistorial): string {
    const map: Record<string, string> = {
      ACTIVA: 'Activa',
      CANCELADA: 'Cancelada',
      COMPLETADA: 'Completada',
      EN_ESPERA: 'En lista de espera',
    };
    return map[r.estado] ?? r.estado;
  }

  canceladaPorLabel(r: ReservaHistorial): string {
    if (r.estado !== 'CANCELADA' || !r.canceladaPor) return '';
    return r.canceladaPor === 'CEF' ? 'Administración (CEF)' : 'Cliente';
  }

  tipoPagoLabel(r: ReservaHistorial): string {
    if (!r.tipoPago) return '—';
    return r.tipoPago === 'PAGO_COMPLETO' ? 'Pago completo' : 'Seña';
  }

  esCancelable(r: ReservaHistorial): boolean {
    if (r.estado !== 'ACTIVA') {
      return false;
    }
    return this.horasHasta(r) > 0;
  }

  horasHasta(r: ReservaHistorial): number {
    if (!r.proximaFecha) return -1;
    return this.reservasService.horasHastaClase(r.proximaFecha, r.horaInicio);
  }

  private mensajeErrorCarga(err: unknown): string {
    if (err && typeof err === 'object' && 'error' in err) {
      const nested = (err as { error?: { message?: string } }).error;
      if (nested?.message) {
        return nested.message;
      }
    }
    return 'No se pudieron cargar tus reservas. Intentá nuevamente más tarde.';
  }

  mensajeCancelacionPreview(r: ReservaHistorial): string {
    const horas = this.horasHasta(r);
    if (horas <= 0) return 'La clase ya ocurrió.';
    if (horas > 24) {
      return r.esAbonado
        ? 'Cancelás con más de 24hs de anticipación. Recibirás un bono del 20% para el mes siguiente.'
        : 'Cancelás con más de 24hs de anticipación. Recibirás el reembolso completo del pago.';
    }
    return 'Cancelás con menos de 24hs de anticipación. No se aplicará reembolso.';
  }

  acortarDescripcion(desc: string | undefined): string {
    if (!desc) return '';
    const words = desc.split(' ');
    if (words.length <= 5) return desc;
    return words.slice(0, 5).join(' ') + '...';
  }
}
