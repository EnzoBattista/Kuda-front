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
      grupo.reservas.sort((a, b) =>
        (a.proximaFecha ?? a.fechaReserva).localeCompare(
          b.proximaFecha ?? b.fechaReserva,
        ),
      );
    }

    return items;
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
      this.reservaSeleccionada = null;
      this.modalPaso = 'detalle-grupo';
    } else {
      this.modalPaso = 'detalle';
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
