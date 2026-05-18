import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import {
  ClaseDisponible,
  ReservasService,
  TipoListaEspera,
  TipoPago,
} from '../../services/reservas.service';

type PasoModal = 'seleccion' | 'confirmacion' | 'resultado' | 'espera' | 'resultado-espera';

@Component({
  selector: 'app-clases-disponibles',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './clases-disponibles.component.html',
  styleUrl: './clases-disponibles.component.css',
})
export class ClasesDisponiblesComponent implements OnInit {
  readonly filtros = new FormGroup({
    actividad: new FormControl('', { nonNullable: true }),
    sede: new FormControl('', { nonNullable: true }),
  });

  clases: ClaseDisponible[] = [];
  clasesFiltradas: ClaseDisponible[] = [];
  actividades: string[] = [];
  sedes: string[] = [];

  isLoading = true;
  errorMsg = '';

  // Estado del modal de reserva
  claseSeleccionada: ClaseDisponible | null = null;
  pasoModal: PasoModal = 'seleccion';
  tipoPagoElegido: TipoPago = 'PAGO_COMPLETO';
  isSubmitting = false;
  resultadoMsg = '';
  errorModalMsg = '';

  constructor(private readonly reservasService: ReservasService) {}

  ngOnInit(): void {
    this.reservasService.getClasesDisponibles().subscribe({
      next: (data) => {
        this.clases = data ?? [];
        this.actividades = [...new Set(this.clases.map((c) => c.actividad))].sort();
        this.sedes = [...new Set(this.clases.map((c) => c.sede))].sort();
        this.aplicarFiltros();
        this.isLoading = false;
      },
      error: () => {
        this.errorMsg = 'No pudimos cargar las clases. Intentá nuevamente.';
        this.isLoading = false;
      },
    });

    this.filtros.valueChanges.subscribe(() => this.aplicarFiltros());
  }

  private aplicarFiltros(): void {
    const { actividad, sede } = this.filtros.getRawValue();
    this.clasesFiltradas = this.clases.filter(
      (c) =>
        (!actividad || c.actividad === actividad) &&
        (!sede || c.sede === sede)
    );
  }

  limpiarFiltros(): void {
    this.filtros.reset({ actividad: '', sede: '' });
  }

  hayFiltros(): boolean {
    const { actividad, sede } = this.filtros.getRawValue();
    return Boolean(actividad || sede);
  }

  horasHasta(clase: ClaseDisponible): number {
    return this.reservasService.horasHastaClase(clase.proximaFecha, clase.horaInicio);
  }

  puedeSenar(clase: ClaseDisponible): boolean {
    return this.horasHasta(clase) > 24;
  }

  // === Flujo de reserva ===

  abrirReserva(clase: ClaseDisponible): void {
    this.claseSeleccionada = clase;
    this.tipoPagoElegido = 'PAGO_COMPLETO';
    this.pasoModal = 'seleccion';
    this.resultadoMsg = '';
    this.errorModalMsg = '';
    this.isSubmitting = false;
  }

  seleccionarTipoPago(tipo: TipoPago): void {
    this.tipoPagoElegido = tipo;
    this.pasoModal = 'confirmacion';
  }

  confirmarReserva(): void {
    if (!this.claseSeleccionada) return;
    this.isSubmitting = true;
    this.errorModalMsg = '';

    this.reservasService
      .reservarClase(this.claseSeleccionada.id, this.tipoPagoElegido)
      .subscribe({
        next: (res) => {
          this.isSubmitting = false;
          this.resultadoMsg = res.message;
          this.pasoModal = 'resultado';
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorModalMsg = err?.error?.message ?? 'No se pudo confirmar la reserva.';
          this.pasoModal = 'seleccion';
        },
      });
  }

  cerrarModal(): void {
    this.claseSeleccionada = null;
  }

  // === Flujo de lista de espera ===

  abrirEspera(clase: ClaseDisponible): void {
    this.claseSeleccionada = clase;
    this.pasoModal = 'espera';
    this.resultadoMsg = '';
    this.errorModalMsg = '';
    this.isSubmitting = false;
  }

  confirmarEspera(tipo: TipoListaEspera): void {
    if (!this.claseSeleccionada) return;
    this.isSubmitting = true;
    this.errorModalMsg = '';

    this.reservasService
      .anotarseListaEspera(this.claseSeleccionada.id, tipo)
      .subscribe({
        next: (res) => {
          this.isSubmitting = false;
          this.resultadoMsg = res.message;
          this.pasoModal = 'resultado-espera';
        },
        error: () => {
          this.isSubmitting = false;
          this.errorModalMsg = 'No se pudo registrar la lista de espera.';
        },
      });
  }

  tipoPagoLabel(tipo: TipoPago): string {
    return tipo === 'PAGO_COMPLETO' ? 'Pago completo' : 'Señar';
  }
}
