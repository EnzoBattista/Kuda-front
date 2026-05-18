import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import {
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

  // Modal de detalle
  reservaSeleccionada: ReservaHistorial | null = null;
  modalPaso: 'detalle' | 'confirmar-cancelacion' | 'resultado-cancelacion' = 'detalle';
  resultadoCancelacion: ResultadoCancelacion | null = null;
  isCancelando = false;
  errorCancelacion = '';

  constructor(private readonly reservasService: ReservasService) {}

  ngOnInit(): void {
    this.reservasService.getMisReservas().subscribe({
      next: (data) => {
        this.reservas = data ?? [];
        this.actividades = [...new Set(this.reservas.map((r) => r.actividad))].sort();
        this.sedes = [...new Set(this.reservas.map((r) => r.sede))].sort();
        this.aplicarFiltros();
        this.isLoading = false;
      },
      error: () => {
        this.errorMsg = 'No pudimos cargar tus reservas. Intentá nuevamente más tarde.';
        this.isLoading = false;
      },
    });

    this.filtros.valueChanges.subscribe(() => this.aplicarFiltros());
  }

  private aplicarFiltros(): void {
    const { actividad, sede } = this.filtros.getRawValue();
    this.reservasFiltradas = this.reservas.filter(
      (r) =>
        (!actividad || r.actividad === actividad) &&
        (!sede || r.sede === sede)
    );
  }

  limpiarFiltros(): void {
    this.filtros.reset({ actividad: '', sede: '' });
  }

  hayFiltros(): boolean {
    const { actividad, sede } = this.filtros.getRawValue();
    return Boolean(actividad || sede);
  }

  // === Modal ===

  abrirDetalle(reserva: ReservaHistorial): void {
    this.reservaSeleccionada = reserva;
    this.modalPaso = 'detalle';
    this.resultadoCancelacion = null;
    this.errorCancelacion = '';
    this.isCancelando = false;
  }

  cerrarModal(): void {
    this.reservaSeleccionada = null;
  }

  irACancelar(): void {
    this.modalPaso = 'confirmar-cancelacion';
    this.errorCancelacion = '';
  }

  confirmarCancelacion(): void {
    if (!this.reservaSeleccionada) return;
    this.isCancelando = true;
    this.errorCancelacion = '';

    this.reservasService.cancelarReserva(this.reservaSeleccionada.id).subscribe({
      next: (resultado) => {
        this.isCancelando = false;
        this.resultadoCancelacion = resultado;
        this.modalPaso = 'resultado-cancelacion';
        // Actualizar estado en la lista local
        const idx = this.reservas.findIndex((r) => r.id === this.reservaSeleccionada?.id);
        if (idx !== -1) this.reservas[idx].estado = 'CANCELADA';
        this.aplicarFiltros();
      },
      error: (err) => {
        this.isCancelando = false;
        this.errorCancelacion = err?.error?.message ?? 'No se pudo cancelar la reserva.';
      },
    });
  }

  // === Helpers de display ===

  modalidadLabel(r: ReservaHistorial): string {
    return r.modalidad === 'ABONADO' ? 'Abonado' : 'Clase individual';
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
    return r.estado === 'ACTIVA';
  }

  horasHasta(r: ReservaHistorial): number {
    if (!r.proximaFecha) return -1;
    return this.reservasService.horasHastaClase(r.proximaFecha, r.horaInicio);
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
