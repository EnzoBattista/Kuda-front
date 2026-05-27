import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import {
  ClaseDisponible,
  HORAS_MINIMAS_SEÑA,
  MSG_RESERVA_CONFIRMADA,
  ModalidadInscripcion,
  ReservasService,
  TipoListaEspera,
  TipoPago,
} from '../../services/reservas.service';
import { AuthService } from '../../services/auth.service';
import { FechaArPipe } from '../../shared/pipes/fecha-ar.pipe';

type PasoModal =
  | 'seleccion-modalidad'
  | 'seleccion-pago'
  | 'confirmacion'
  | 'resultado'
  | 'espera'
  | 'resultado-espera';

@Component({
  selector: 'app-clases-disponibles',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FechaArPipe],
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
  bannerSuccess = '';

  readonly horasMinimasSena = HORAS_MINIMAS_SEÑA;

  claseSeleccionada: ClaseDisponible | null = null;
  pasoModal: PasoModal = 'seleccion-modalidad';
  modalidadElegida: ModalidadInscripcion = 'INDIVIDUAL';
  tipoPagoElegido: TipoPago = 'PAGO_COMPLETO';
  isSubmitting = false;
  resultadoMsg = '';
  errorModalMsg = '';

  private readonly clasesEnListaEspera = new Set<number>();

  constructor(
    private readonly reservasService: ReservasService,
    private readonly authService: AuthService,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.cargarListaEsperaLocal();
    this.recargarClases();
    this.filtros.valueChanges.subscribe(() => this.aplicarFiltros());

    const actividadQuery = this.route.snapshot.queryParamMap.get('actividad');
    if (actividadQuery) {
      this.filtros.patchValue({ actividad: actividadQuery });
    }
  }

  private aplicarFiltros(): void {
    const { actividad, sede } = this.filtros.getRawValue();
    this.clasesFiltradas = this.clases.filter(
      (c) =>
        (!actividad || c.actividad === actividad) &&
        (!sede || c.sede === sede),
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
    return this.reservasService.horasHastaClase(
      clase.proximaFecha,
      clase.horaInicio,
    );
  }

  puedePagarSena(clase: ClaseDisponible): boolean {
    return this.reservasService.puedePagarSeña(
      clase.proximaFecha,
      clase.horaInicio,
    );
  }

  abrirReserva(clase: ClaseDisponible): void {
    this.bannerSuccess = '';
    this.claseSeleccionada = clase;
    this.modalidadElegida = 'INDIVIDUAL';
    this.tipoPagoElegido = 'PAGO_COMPLETO';
    this.pasoModal = 'seleccion-modalidad';
    this.resultadoMsg = '';
    this.errorModalMsg = '';
    this.isSubmitting = false;
  }

  seleccionarModalidad(modalidad: ModalidadInscripcion): void {
    this.modalidadElegida = modalidad;
    this.errorModalMsg = '';

    if (modalidad === 'ABONADO') {
      this.pasoModal = 'confirmacion';
      return;
    }

    if (this.claseSeleccionada?.abonoActividadVigente) {
      this.errorModalMsg =
        'Ya tenés un abono activo en esta actividad, no podés reservar individualmente esta clase.';
      return;
    }

    this.pasoModal = 'seleccion-pago';
  }

  seleccionarTipoPago(tipo: TipoPago): void {
    this.tipoPagoElegido = tipo;
    this.pasoModal = 'confirmacion';
  }

  confirmarReserva(): void {
    if (!this.claseSeleccionada) return;
    this.isSubmitting = true;
    this.errorModalMsg = '';

    const clase = this.claseSeleccionada;
    const obs =
      this.modalidadElegida === 'ABONADO'
        ? this.reservasService.inscribirMensual(clase)
        : this.reservasService.reservarClase(clase, this.tipoPagoElegido);

    obs.subscribe({
      next: (res) => this.onReservaExitosa(res),
      error: (err) => {
        this.isSubmitting = false;
        this.errorModalMsg =
          err?.error?.message ?? 'No se pudo confirmar la reserva.';
        if (this.modalidadElegida === 'ABONADO') {
          this.pasoModal = 'confirmacion';
        } else if (clase.abonoActividadVigente) {
          this.pasoModal = 'confirmacion';
        } else {
          this.pasoModal = 'seleccion-pago';
        }
      },
    });
  }

  private onReservaExitosa(res: {
    message: string;
    reservaId?: number;
    redirectUrl?: string;
  }): void {
    this.isSubmitting = false;
    this.resultadoMsg = res.message;
    this.pasoModal = 'resultado';

    if (this.claseSeleccionada && res.reservaId) {
      this.reservasService.recordarReservaCreada(
        this.claseSeleccionada.id,
        this.claseSeleccionada.proximaFecha,
        res.reservaId,
      );
    }

    if (res.redirectUrl) {
      window.location.href = res.redirectUrl;
      return;
    }

    this.bannerSuccess = MSG_RESERVA_CONFIRMADA;
    this.recargarClases();
  }

  cerrarModal(): void {
    this.claseSeleccionada = null;
  }

  yaEnListaEspera(claseId: number): boolean {
    return this.clasesEnListaEspera.has(claseId);
  }

  abrirEspera(clase: ClaseDisponible): void {
    if (this.yaEnListaEspera(clase.id)) {
      return;
    }
    this.claseSeleccionada = clase;
    this.pasoModal = 'espera';
    this.resultadoMsg = '';
    this.errorModalMsg = '';
    this.isSubmitting = false;
  }

  confirmarEspera(tipo: TipoListaEspera): void {
    if (!this.claseSeleccionada) return;
    if (this.yaEnListaEspera(this.claseSeleccionada.id)) {
      return;
    }
    this.isSubmitting = true;
    this.errorModalMsg = '';

    this.reservasService
      .anotarseListaEspera(this.claseSeleccionada, tipo)
      .subscribe({
        next: (res) => {
          this.isSubmitting = false;
          this.marcarListaEspera(this.claseSeleccionada!.id);
          this.resultadoMsg = res.message;
          this.pasoModal = 'resultado-espera';
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorModalMsg =
            err?.error?.message ??
            'No se pudo registrar la lista de espera.';
        },
      });
  }

  confirmacionTitulo(): string {
    if (this.modalidadElegida === 'ABONADO') {
      return 'Confirmá tu inscripción mensual';
    }
    if (this.claseSeleccionada?.abonoActividadVigente) {
      return 'Confirmá tu reserva (abonado)';
    }
    return 'Confirmá tu reserva';
  }

  confirmacionDetallePago(): string {
    if (this.modalidadElegida === 'ABONADO') {
      const precio = this.claseSeleccionada?.precioActividad ?? 0;
      return `Mensualidad — $${precio}`;
    }
    if (this.claseSeleccionada?.abonoActividadVigente) {
      return 'Sin cargo adicional (ya sos abonado de esta actividad)';
    }
    return this.tipoPagoLabel(this.tipoPagoElegido);
  }

  tipoPagoLabel(tipo: TipoPago): string {
    return tipo === 'PAGO_COMPLETO' ? 'Pago Completo' : 'Pagar Seña (50%)';
  }

  private recargarClases(): void {
    this.isLoading = true;
    this.errorMsg = '';
    this.reservasService.getClasesDisponibles().subscribe({
      next: (data) => {
        this.clases = data ?? [];
        this.actividades = [...new Set(this.clases.map((c) => c.actividad))].sort();
        this.sedes = [...new Set(this.clases.map((c) => c.sede))].sort();
        const actividadQuery = this.route.snapshot.queryParamMap.get('actividad');
        if (actividadQuery && this.actividades.includes(actividadQuery)) {
          this.filtros.patchValue({ actividad: actividadQuery }, { emitEvent: false });
        }
        this.aplicarFiltros();
        this.isLoading = false;
      },
      error: () => {
        this.errorMsg = 'No existen clases para mostrar';
        this.isLoading = false;
      },
    });
  }

  private listaEsperaStorageKey(): string | null {
    const email = this.authService.getCurrentUser()?.email?.trim().toLowerCase();
    return email ? `kuda_lista_espera_${email}` : null;
  }

  private cargarListaEsperaLocal(): void {
    const key = this.listaEsperaStorageKey();
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      const ids: number[] = raw ? JSON.parse(raw) : [];
      ids.forEach((id) => this.clasesEnListaEspera.add(Number(id)));
    } catch {
      /* ignore */
    }
  }

  private marcarListaEspera(claseId: number): void {
    this.clasesEnListaEspera.add(claseId);
    const key = this.listaEsperaStorageKey();
    if (!key) return;
    localStorage.setItem(
      key,
      JSON.stringify([...this.clasesEnListaEspera]),
    );
  }

  acortarDescripcion(desc: string | undefined): string {
    if (!desc) return '';
    const words = desc.split(' ');
    if (words.length <= 5) return desc;
    return words.slice(0, 5).join(' ') + '...';
  }
}
