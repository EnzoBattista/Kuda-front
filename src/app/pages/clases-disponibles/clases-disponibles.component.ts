import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Subscription, interval } from 'rxjs';

import {
  ClaseDisponible,
  HORAS_MINIMAS_SEÑA,
  MSG_RESERVA_CONFIRMADA,
  MSG_RESERVA_CONFIRMADA_SEÑA,
  MSG_RESERVA_INCOMPLETA,
  ModalidadInscripcion,
  ReservasService,
  TipoListaEspera,
  TipoPago,
} from '../../services/reservas.service';
import { AuthService } from '../../services/auth.service';
import { Vale, ValesService } from '../../services/vales.service';
import { MedioCobro, PagoService } from '../../services/pago.service';
import { QRCodeComponent } from 'angularx-qrcode';
import { FechaArPipe } from '../../shared/pipes/fecha-ar.pipe';

type PasoModal =
  | 'detalle'
  | 'seleccion-modalidad'
  | 'seleccion-pago'
  | 'confirmacion'
  | 'seleccion-medio-cobro'
  | 'qr-pago'
  | 'resultado'
  | 'espera'
  | 'resultado-espera';

@Component({
  selector: 'app-clases-disponibles',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, FechaArPipe, QRCodeComponent],
  templateUrl: './clases-disponibles.component.html',
  styleUrl: './clases-disponibles.component.css',
})
export class ClasesDisponiblesComponent implements OnInit, OnDestroy {
  private readonly pollingIntervalMs = 3_000;
  private readonly pollingTimeoutMs = 5 * 60_000;
  private pollingSub: Subscription | null = null;
  private pollingTimeout: ReturnType<typeof setTimeout> | null = null;
  private ventanaPago: Window | null = null;

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
  bannerError = '';
  bannerPagoEnCurso = '';
  urlPagoFallback = '';

  readonly horasMinimasSena = HORAS_MINIMAS_SEÑA;

  claseSeleccionada: ClaseDisponible | null = null;
  pasoModal: PasoModal = 'seleccion-modalidad';
  modalidadElegida: ModalidadInscripcion = 'INDIVIDUAL';
  tipoPagoElegido: TipoPago = 'PAGO_COMPLETO';
  isSubmitting = false;
  resultadoMsg = '';
  errorModalMsg = '';
  isReservaIncompleta = false;
  medioCobroElegido: MedioCobro = 'MERCADO_PAGO';
  qrDataPago = '';

  private valesAplicables: Vale[] = [];
  aplicarValesToggle = false;
  private readonly clasesEnListaEspera = new Set<number>();

  constructor(
    private readonly reservasService: ReservasService,
    private readonly authService: AuthService,
    private readonly valesService: ValesService,
    private readonly pagoService: PagoService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.cargarListaEsperaLocal();
    this.recargarClases();
    this.filtros.valueChanges.subscribe(() => this.aplicarFiltros());

    const actividadQuery = this.route.snapshot.queryParamMap.get('actividad');
    if (actividadQuery) {
      this.filtros.patchValue({ actividad: actividadQuery });
    }

    this.procesarRetornoMercadoPago();

    if (
      this.route.snapshot.queryParamMap.get('status') ||
      this.route.snapshot.queryParamMap.get('pago')
    ) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { status: null, pago: null, pago_id: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  ngOnDestroy(): void {
    this.detenerPollingPago();
    this.ventanaPago = null;
  }

  private procesarRetornoMercadoPago(): void {
    const pagoIdRaw = this.route.snapshot.queryParamMap.get('pago_id');
    const pagoId = pagoIdRaw ? Number(pagoIdRaw) : 0;

    if (pagoId > 0) {
      this.bannerPagoEnCurso = 'Consultando el estado de tu pago con Mercado Pago…';
      this.iniciarPollingPago(pagoId);
      return;
    }

    const statusQuery = this.route.snapshot.queryParamMap.get('status');
    const pagoQuery = this.route.snapshot.queryParamMap.get('pago');

    if (statusQuery === 'approved' || pagoQuery === 'ok') {
      this.bannerSuccess = MSG_RESERVA_CONFIRMADA;
    } else if (
      statusQuery === 'failure' ||
      statusQuery === 'rejected' ||
      statusQuery === 'null' ||
      pagoQuery === 'fail'
    ) {
      this.bannerError = 'Tu pago ha sido rechazado o cancelado.';
    } else if (pagoQuery === 'pending') {
      this.bannerPagoEnCurso = 'Tu pago está pendiente de acreditación.';
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
    return this.reservasService.horasHastaClase(clase.proximaFecha, clase.horaInicio);
  }

  puedePagarSena(clase: ClaseDisponible): boolean {
    return this.reservasService.puedePagarSeña(clase.proximaFecha, clase.horaInicio);
  }

  abrirDetalle(clase: ClaseDisponible): void {
    this.detenerPollingPago();
    this.bannerPagoEnCurso = '';
    this.urlPagoFallback = '';
    this.bannerSuccess = '';
    this.bannerError = '';
    this.claseSeleccionada = clase;
    this.pasoModal = 'detalle';
    this.resultadoMsg = '';
    this.errorModalMsg = '';
    this.isSubmitting = false;
    this.isReservaIncompleta = false;
    this.cargarValesParaClase(clase.id);
  }

  abrirReserva(clase?: ClaseDisponible): void {
    if (clase) {
      this.detenerPollingPago();
      this.bannerPagoEnCurso = '';
      this.urlPagoFallback = '';
      this.claseSeleccionada = clase;
      this.bannerSuccess = '';
      this.bannerError = '';
      this.resultadoMsg = '';
      this.errorModalMsg = '';
      this.isSubmitting = false;
      this.isReservaIncompleta = false;
      this.cargarValesParaClase(clase.id);
    }
    this.modalidadElegida = 'INDIVIDUAL';
    this.tipoPagoElegido = 'PAGO_COMPLETO';
    this.pasoModal = 'seleccion-modalidad';
  }

  private cargarValesParaClase(claseId: number): void {
    this.valesAplicables = [];
    this.aplicarValesToggle = false;
    this.valesService.getValesAplicables(claseId).subscribe({
      next: (data) => (this.valesAplicables = data ?? []),
      error: () => (this.valesAplicables = []),
    });
  }

  tieneValesDisponibles(): boolean {
    return this.valesAplicables.length > 0 && this.montoBaseReserva() > 0;
  }

  montoTotalValesDisponibles(): number {
    return this.valesAplicables.reduce((sum, v) => sum + v.monto, 0);
  }

  private mejorValeDisponible(): Vale | null {
    if (this.valesAplicables.length === 0) return null;
    return this.valesAplicables.reduce(
      (best, v) => (v.monto > (best?.monto ?? 0) ? v : best),
      null as Vale | null,
    );
  }

  montoBaseReserva(): number {
    const c = this.claseSeleccionada;
    if (!c) return 0;
    if (this.modalidadElegida === 'ABONADO') {
      return Number(c.precioActividad ?? 0);
    }
    const precioIndividual = Number(c.precioActividad ?? 0) * 0.333;
    return this.tipoPagoElegido === 'SEÑA' ? precioIndividual / 2 : precioIndividual;
  }

  montoFinalReserva(): number {
    const base = this.montoBaseReserva();
    if (!this.aplicarValesToggle) return base;
    const vale = this.mejorValeDisponible();
    if (!vale) return base;
    return Math.max(0, base - vale.monto);
  }

  seleccionarModalidad(modalidad: ModalidadInscripcion): void {
    this.modalidadElegida = modalidad;
    this.errorModalMsg = '';

    if (modalidad === 'ABONADO') {
      this.pasoModal = 'confirmacion';
      return;
    }

    if (this.claseSeleccionada?.abonoClaseVigente) {
      this.errorModalMsg =
        'Ya tenés un abono activo en esta clase, no podés reservar individualmente.';
      return;
    }

    this.pasoModal = 'seleccion-pago';
  }

  seleccionarTipoPago(tipo: TipoPago): void {
    this.tipoPagoElegido = tipo;
    this.pasoModal = 'confirmacion';
  }

  irAMedioCobro(): void {
    if (this.montoFinalReserva() > 0) {
      this.pasoModal = 'seleccion-medio-cobro';
      return;
    }
    this.confirmarReserva();
  }

  seleccionarMedioCobro(medio: MedioCobro): void {
    this.medioCobroElegido = medio;
    this.urlPagoFallback = '';

    if (medio === 'MERCADO_PAGO') {
      this.abrirVentanaPagoPrecargada();
    }

    this.confirmarReserva();
  }

  confirmarReserva(): void {
    if (!this.claseSeleccionada) return;
    this.isSubmitting = true;
    this.errorModalMsg = '';

    const clase = this.claseSeleccionada;
    const valeId = this.aplicarValesToggle ? this.mejorValeDisponible()?.id : undefined;
    const obs =
      this.modalidadElegida === 'ABONADO'
        ? this.reservasService.inscribirMensual(clase, valeId, this.medioCobroElegido)
        : this.reservasService.reservarClase(clase, this.tipoPagoElegido, valeId, this.medioCobroElegido);

    obs.subscribe({
      next: (res) => this.onReservaExitosa(res),
      error: (err) => {
        this.isSubmitting = false;
        if (this.ventanaPago && !this.ventanaPago.closed) {
          this.ventanaPago.close();
        }
        this.ventanaPago = null;
        this.errorModalMsg = err?.error?.message ?? 'No se pudo confirmar la reserva.';
        if (this.modalidadElegida === 'ABONADO' || clase.abonoClaseVigente) {
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
    qrData?: string;
    pagoId?: number;
    medioCobro?: MedioCobro;
  }): void {
    this.isSubmitting = false;

    const mensajeExito =
      res.message === MSG_RESERVA_CONFIRMADA_SEÑA
        ? MSG_RESERVA_CONFIRMADA_SEÑA
        : MSG_RESERVA_CONFIRMADA;

    const esExito =
      res.message === MSG_RESERVA_CONFIRMADA ||
      res.message === MSG_RESERVA_CONFIRMADA_SEÑA;

    if (!esExito) {
      if (this.ventanaPago && !this.ventanaPago.closed) {
        this.ventanaPago.close();
      }
      this.ventanaPago = null;
      this.resultadoMsg = res.message;
      this.isReservaIncompleta = true;
      this.pasoModal = 'resultado';
      this.bannerError = res.message;
      return;
    }

    if (res.redirectUrl) {
      this.registrarReservaSiCorresponde(res.reservaId);
      this.iniciarFlujoPagoExterno(res.redirectUrl, res.pagoId);
      return;
    }

    if (res.qrData && res.medioCobro === 'QR') {
      this.registrarReservaSiCorresponde(res.reservaId);
      this.recargarClases();

      if (this.esUrlPago(res.qrData)) {
        this.iniciarFlujoPagoExterno(res.qrData, res.pagoId);
        return;
      }

      this.qrDataPago = res.qrData;
      this.resultadoMsg = res.message;
      this.pasoModal = 'qr-pago';
      if (res.pagoId) {
        this.bannerPagoEnCurso =
          'Escaneá el QR para pagar. Acá veremos la confirmación cuando Mercado Pago la apruebe.';
        this.iniciarPollingPago(res.pagoId, () => this.cerrarModal());
      }
      return;
    }

    this.resultadoMsg = res.message;
    this.isReservaIncompleta = false;
    this.pasoModal = 'resultado';
    this.registrarReservaSiCorresponde(res.reservaId);
    this.bannerSuccess = mensajeExito;
    this.recargarClases();
  }

  private registrarReservaSiCorresponde(reservaId?: number): void {
    if (this.claseSeleccionada && reservaId) {
      this.reservasService.recordarReservaCreada(
        this.claseSeleccionada.id,
        this.claseSeleccionada.proximaFecha,
        reservaId,
      );
    }
  }

  private esUrlPago(data: string): boolean {
    return /^https?:\/\//i.test(data.trim());
  }

  private iniciarFlujoPagoExterno(url: string, pagoId?: number): void {
    this.recargarClases();
    this.cerrarModal();
    this.bannerSuccess = '';
    this.bannerError = '';
    this.urlPagoFallback = '';

    const ventanaAbierta = this.navegarVentanaPago(url);

    if (!ventanaAbierta) {
      this.urlPagoFallback = url;
      this.bannerError =
        'No se pudo abrir la pestaña de pago. Permití ventanas emergentes o usá el enlace de abajo.';
    } else {
      this.bannerPagoEnCurso =
        'Completá el pago en la otra pestaña. Acá verás el resultado cuando Mercado Pago lo confirme.';
    }

    if (pagoId) {
      this.iniciarPollingPago(pagoId);
    }
  }

  /**
   * Abre la pestaña en el mismo tick del click (antes del HTTP async).
   * Sin `noopener`: Chrome devuelve null con noopener aunque la pestaña se abra,
   * y perdemos la referencia para redirigir después.
   */
  private abrirVentanaPagoPrecargada(): boolean {
    this.ventanaPago = window.open('about:blank', '_blank');
    if (!this.ventanaPago) {
      return false;
    }

    try {
      this.ventanaPago.document.write(`
        <!DOCTYPE html>
        <html lang="es">
          <head>
            <meta charset="utf-8" />
            <title>Redirigiendo a Mercado Pago</title>
            <style>
              body { font-family: system-ui, sans-serif; text-align: center; padding: 3rem; color: #333; }
            </style>
          </head>
          <body>
            <p>Preparando el pago con Mercado Pago…</p>
          </body>
        </html>
      `);
      this.ventanaPago.document.close();
    } catch {
      /* algunos navegadores restringen document.write; la redirección igual funciona */
    }

    return true;
  }

  private navegarVentanaPago(url: string): boolean {
    const ventana = this.ventanaPago;
    if (ventana && !ventana.closed) {
      ventana.location.href = url;
      try {
        ventana.opener = null;
      } catch {
        /* ignore */
      }
      this.ventanaPago = null;
      return true;
    }

    const nueva = window.open(url, '_blank');
    if (nueva) {
      try {
        nueva.opener = null;
      } catch {
        /* ignore */
      }
      return true;
    }

    return false;
  }

  private iniciarPollingPago(pagoId: number, onExito?: () => void): void {
    this.detenerPollingPago();

    const consultar = () => {
      this.pagoService.consultarEstado(pagoId).subscribe({
        next: (estado) => this.procesarEstadoPago(estado, onExito),
        error: () => {
          /* reintenta en el próximo tick */
        },
      });
    };

    consultar();
    this.pollingSub = interval(this.pollingIntervalMs).subscribe(() => consultar());

    this.pollingTimeout = setTimeout(() => {
      if (this.bannerPagoEnCurso) {
        this.bannerPagoEnCurso =
          'Seguimos esperando la confirmación de Mercado Pago. Podés cerrar esta página y volver más tarde.';
      }
      this.detenerPollingPago();
    }, this.pollingTimeoutMs);
  }

  private procesarEstadoPago(
    estado: { estado: string; message: string },
    onExito?: () => void,
  ): void {
    if (estado.estado === 'COMPLETADO') {
      this.detenerPollingPago();
      this.bannerPagoEnCurso = '';
      this.bannerError = '';
      this.urlPagoFallback = '';
      this.bannerSuccess = estado.message || MSG_RESERVA_CONFIRMADA;
      this.recargarClases();
      onExito?.();
      return;
    }

    if (estado.estado === 'RECHAZADO') {
      this.detenerPollingPago();
      this.bannerPagoEnCurso = '';
      this.urlPagoFallback = '';
      this.bannerError = estado.message || MSG_RESERVA_INCOMPLETA;
      return;
    }

    if (!this.bannerPagoEnCurso) {
      this.bannerPagoEnCurso = estado.message || 'Esperando confirmación de Mercado Pago…';
    }
  }

  private detenerPollingPago(): void {
    if (this.pollingSub) {
      this.pollingSub.unsubscribe();
      this.pollingSub = null;
    }
    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout);
      this.pollingTimeout = null;
    }
  }

  cerrarModal(): void {
    this.claseSeleccionada = null;
  }

  yaEnListaEspera(claseId: number): boolean {
    return this.clasesEnListaEspera.has(claseId);
  }

  abrirEspera(clase?: ClaseDisponible): void {
    if (clase) {
      this.claseSeleccionada = clase;
      this.bannerSuccess = '';
      this.bannerError = '';
      this.resultadoMsg = '';
      this.errorModalMsg = '';
      this.isSubmitting = false;
      this.isReservaIncompleta = false;
    }
    if (!this.claseSeleccionada || this.yaEnListaEspera(this.claseSeleccionada.id)) {
      return;
    }
    this.pasoModal = 'espera';
  }

  confirmarEspera(tipo: TipoListaEspera): void {
    if (!this.claseSeleccionada) return;
    if (this.yaEnListaEspera(this.claseSeleccionada.id)) return;

    this.isSubmitting = true;
    this.errorModalMsg = '';

    this.reservasService.anotarseListaEspera(this.claseSeleccionada, tipo).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.marcarListaEspera(this.claseSeleccionada!.id);
        this.resultadoMsg = res.message;
        this.pasoModal = 'resultado-espera';
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorModalMsg =
          err?.error?.message ?? 'No se pudo registrar la lista de espera.';
      },
    });
  }

  confirmacionTitulo(): string {
    if (this.modalidadElegida === 'ABONADO') {
      return 'Confirmá tu inscripción mensual';
    }
    if (this.claseSeleccionada?.abonoClaseVigente) {
      return 'Confirmá tu reserva (abonado)';
    }
    return 'Confirmá tu reserva';
  }

  confirmacionDetallePago(): string {
    if (this.modalidadElegida === 'ABONADO') {
      const precio = this.claseSeleccionada?.precioActividad ?? 0;
      return `Mensualidad — $${precio}`;
    }
    if (this.claseSeleccionada?.abonoClaseVigente) {
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
    localStorage.setItem(key, JSON.stringify([...this.clasesEnListaEspera]));
  }

  private readonly ORDEN_DIA: Record<string, number> = {
    Lunes: 0,
    Martes: 1,
    Miercoles: 2,
    Jueves: 3,
    Viernes: 4,
    Sabado: 5,
    Domingo: 6,
  };

  get clasesPorActividad(): { actividad: string; clases: ClaseDisponible[] }[] {
    const grupos = new Map<string, ClaseDisponible[]>();
    for (const c of this.clasesFiltradas) {
      if (!grupos.has(c.actividad)) grupos.set(c.actividad, []);
      grupos.get(c.actividad)!.push(c);
    }
    return [...grupos.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([actividad, clases]) => ({
        actividad,
        clases: clases.sort(
          (a, b) =>
            (this.ORDEN_DIA[a.diaSemana] ?? 9) - (this.ORDEN_DIA[b.diaSemana] ?? 9) ||
            a.horaInicio.localeCompare(b.horaInicio),
        ),
      }));
  }

  acortarDescripcion(desc: string | undefined): string {
    if (!desc) return '';
    const words = desc.split(' ');
    if (words.length <= 5) return desc;
    return words.slice(0, 5).join(' ') + '...';
  }
}
