import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import {
  MSG_RESERVA_CANCELADA,
  ReservaHistorial,
  ReservasService,
  ResultadoCancelacion,
} from '../../services/reservas.service';

@Component({
  selector: 'app-mis-reservas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
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
  actividades: string[] = [];
  sedes: string[] = [];

  isLoading = true;
  errorMsg = '';
  bannerSuccess = '';
  bannerError = '';

  reservaSeleccionada: ReservaHistorial | null = null;
  modalPaso: 'detalle' | 'confirmar-cancelacion' | 'resultado-cancelacion' =
    'detalle';
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
    this.modalPaso = 'detalle';
    this.resultadoCancelacion = null;
    this.errorCancelacion = '';
    this.isCancelando = false;
  }

  abrirCancelacion(reserva: ReservaHistorial): void {
    this.reservaSeleccionada = reserva;
    this.modalPaso = 'confirmar-cancelacion';
    this.resultadoCancelacion = null;
    this.errorCancelacion = '';
    this.isCancelando = false;
  }

  cerrarModal(): void {
    this.reservaSeleccionada = null;
    this.modalPaso = 'detalle';
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

    this.reservasService
      .cancelarReserva(this.reservaSeleccionada.id)
      .subscribe({
        next: (resultado) => {
          this.isCancelando = false;
          this.resultadoCancelacion = resultado;
          this.modalPaso = 'resultado-cancelacion';
          this.bannerSuccess = MSG_RESERVA_CANCELADA;
          this.cerrarModal();
          this.cargarReservas();
        },
        error: (err) => {
          this.isCancelando = false;
          const msg =
            err?.error?.message ??
            'No se pudo cancelar la reserva.';
          this.errorCancelacion = msg;
          this.bannerError = msg;
        },
      });
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
}
