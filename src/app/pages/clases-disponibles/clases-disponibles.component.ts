import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Subscription, interval } from 'rxjs';

import {
  ClaseDisponible,
  HORAS_MINIMAS_SEÑA,
  MSG_PAGO_PENDIENTE_MP,
  MSG_RESERVA_CONFIRMADA,
  MSG_RESERVA_CONFIRMADA_SEÑA,
  MSG_RESERVA_INCOMPLETA,
  MSG_RESERVA_PAGO_INCOMPLETO,
  MSG_RESERVA_PAGO_RECHAZADO,
  ModalidadInscripcion,
  ReservasService,
  TipoListaEspera,
  TipoPago,
} from '../../services/reservas.service';
import { AuthService } from '../../services/auth.service';
import { Vale, ValesService } from '../../services/vales.service';
import { PagoService } from '../../services/pago.service';
import { FechaArPipe } from '../../shared/pipes/fecha-ar.pipe';
import {
  CupoPendienteLista,
  ListaEsperaService,
  ListaEsperaItem,
} from '../../services/lista-espera.service';

type PasoModal =
  | 'detalle'
  | 'seleccion-modalidad'
  | 'seleccion-pago'
  | 'confirmacion'
  | 'resultado'
  | 'espera'
  | 'resultado-espera';

@Component({
  selector: 'app-clases-disponibles',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, FechaArPipe],
  templateUrl: './clases-disponibles.component.html',
  styleUrl: './clases-disponibles.component.css',
})
export class ClasesDisponiblesComponent implements OnInit, OnDestroy {
  private readonly pollingIntervalMs = 3_000;
  private readonly pollingTimeoutMs = 5 * 60_000;
  /** Un reintento breve solo si MP aún reporta el pago en proceso. */
  private readonly reintentoMpEnProcesoMs = 800;
  private pagoSeguimientoGen = 0;
  private pollingSub: Subscription | null = null;
  private pollingTimeout: ReturnType<typeof setTimeout> | null = null;
  private monitorVentanaInterval: ReturnType<typeof setInterval> | null = null;
  private ventanaPago: Window | null = null;
  private ventanaPagoMonitoreada: Window | null = null;
  private pagoCompletado = false;

  readonly filtros = new FormGroup({
    actividad: new FormControl('', { nonNullable: true }),
    dia: new FormControl('', { nonNullable: true }),
    hora: new FormControl('', { nonNullable: true }),
  });

  clases: ClaseDisponible[] = [];
  clasesFiltradas: ClaseDisponible[] = [];
  actividades: string[] = [];
  dias: string[] = [];
  horas: string[] = [];

  isLoading = true;
  errorMsg = '';
  bannerSuccess = '';
  bannerError = '';
  bannerPagoEnCurso = '';

  readonly horasMinimasSena = HORAS_MINIMAS_SEÑA;

  claseSeleccionada: ClaseDisponible | null = null;
  pasoModal: PasoModal = 'seleccion-modalidad';
  modalidadElegida: ModalidadInscripcion = 'INDIVIDUAL';
  tipoPagoElegido: TipoPago = 'PAGO_COMPLETO';
  isSubmitting = false;
  resultadoMsg = '';
  errorModalMsg = '';
  isReservaIncompleta = false;
  private pagoIdEnCurso: number | null = null;
  private reservaIdPendiente: number | null = null;

  private valesAplicables: Vale[] = [];
  aplicarValesToggle = false;
  private readonly clasesEnListaEspera = new Set<number>();
  misWaitlists: ListaEsperaItem[] = [];

  cuposPendientes: CupoPendienteLista[] = [];
  cuposPendientesLoading = false;
  cupoAccionId: number | null = null;
  cupoParaConfirmar: CupoPendienteLista | null = null;
  isConfirmandoCupo = false;

  private scrollPosition = 0;

  constructor(
    private readonly reservasService: ReservasService,
    private readonly authService: AuthService,
    private readonly valesService: ValesService,
    private readonly pagoService: PagoService,
    private readonly listaEsperaService: ListaEsperaService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.cargarListaEsperaLocal();
    this.sincronizarListaEspera();
    this.cargarCuposPendientes();
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
    this.detenerSeguimientoPago();
    this.ventanaPago = null;
    this.ventanaPagoMonitoreada = null;
    document.removeEventListener('visibilitychange', this.onVisibilidadPago);
  }

  private readonly onVisibilidadPago = (): void => {
    if (document.visibilityState !== 'visible' || this.pagoCompletado || !this.pagoIdEnCurso) {
      return;
    }
    const gen = this.pagoSeguimientoGen;
    const pagoId = this.pagoIdEnCurso;
    this.pagoService.consultarEstado(pagoId).subscribe({
      next: (estado) => {
        if (gen !== this.pagoSeguimientoGen || this.pagoCompletado) return;
        if (estado.estado === 'COMPLETADO' || estado.estado === 'RECHAZADO') {
          this.procesarEstadoPago(estado);
        }
      },
    });
  };

  private procesarRetornoMercadoPago(): void {
    const pagoIdRaw = this.route.snapshot.queryParamMap.get('pago_id');
    const pagoId = pagoIdRaw ? Number(pagoIdRaw) : 0;
    const pagoQuery = this.route.snapshot.queryParamMap.get('pago');

    if (pagoId > 0) {
      const pagoFallido =
        pagoQuery === 'fail' ||
        this.route.snapshot.queryParamMap.get('status') === 'failure' ||
        this.route.snapshot.queryParamMap.get('status') === 'rejected';

      if (pagoFallido) {
        this.mostrarPagoNoCompletado(MSG_RESERVA_PAGO_RECHAZADO);
        this.liberarReservaPorPagoFallido(pagoId);
        return;
      }

      this.pagoIdEnCurso = pagoId;
      this.bannerPagoEnCurso = 'Consultando el estado de tu pago con Mercado Pago…';
      this.iniciarPollingPago(pagoId);
      return;
    }

    if (pagoQuery === 'pending') {
      this.bannerPagoEnCurso = 'Tu pago está pendiente de acreditación.';
    } else if (
      pagoQuery === 'fail' ||
      this.route.snapshot.queryParamMap.get('status') === 'failure' ||
      this.route.snapshot.queryParamMap.get('status') === 'rejected'
    ) {
      this.bannerError = MSG_RESERVA_PAGO_RECHAZADO;
    }
  }

  private aplicarFiltros(): void {
    const { actividad, dia, hora } = this.filtros.getRawValue();
    this.clasesFiltradas = this.clases.filter(
      (c) =>
        (!actividad || c.actividad === actividad) &&
        (!dia || c.diaSemana === dia) &&
        (!hora || c.horaInicio === hora),
    );
  }

  limpiarFiltros(): void {
    this.filtros.reset({ actividad: '', dia: '', hora: '' });
  }

  hayFiltros(): boolean {
    const { actividad, dia, hora } = this.filtros.getRawValue();
    return Boolean(actividad || dia || hora);
  }

  horasHasta(clase: ClaseDisponible): number {
    return this.reservasService.horasHastaClase(clase.proximaFecha, clase.horaInicio);
  }

  puedePagarSena(clase: ClaseDisponible): boolean {
    return this.reservasService.puedePagarSeña(clase.proximaFecha, clase.horaInicio);
  }

  private bloquearScroll(): void {
    this.scrollPosition = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${this.scrollPosition}px`;
    document.body.style.width = '100%';
  }

  private restaurarScroll(): void {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, this.scrollPosition);
  }

  abrirDetalle(clase: ClaseDisponible): void {
    this.bloquearScroll();
    this.detenerSeguimientoPago();
    this.bannerPagoEnCurso = '';
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
      this.bloquearScroll();
      this.detenerSeguimientoPago();
      this.bannerPagoEnCurso = '';
      this.claseSeleccionada = clase;
      this.bannerSuccess = '';
      this.bannerError = '';
      this.resultadoMsg = '';
      this.errorModalMsg = '';
      this.isSubmitting = false;
      this.isReservaIncompleta = false;
      this.cargarValesParaClase(clase.id);
    }

    const c = this.claseSeleccionada;
    if (!c) return;

    // Verificación 1 (sync): abono activo en esta misma clase
    if (c.abonoClaseVigente) {
      this.errorModalMsg =
        'Ya tenés una membresía mensual activa para esta clase.';
      this.pasoModal = 'detalle';
      return;
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

  montoDescuentoUpgrade(): number {
    const c = this.claseSeleccionada;
    if (!c) return 0;
    if (this.modalidadElegida === 'ABONADO' && c.descuentoUpgrade) {
      return c.descuentoUpgrade;
    }
    return 0;
  }

  montoFinalReserva(): number {
    let base = this.montoBaseReserva();
    base -= this.montoDescuentoUpgrade();
    if (base < 0) base = 0;

    if (!this.aplicarValesToggle) return base;
    const vale = this.mejorValeDisponible();
    if (!vale) return base;
    return Math.max(0, base - vale.monto);
  }

  seleccionarModalidad(modalidad: ModalidadInscripcion): void {
    this.modalidadElegida = modalidad;
    this.errorModalMsg = '';

    if (this.claseSeleccionada?.abonoClaseVigente) {
      this.errorModalMsg =
        'Ya tenés una membresía mensual activa para esta clase.';
      return;
    }

    const c = this.claseSeleccionada;
    if (!c) return;

    this.isSubmitting = true;
    if (modalidad === 'ABONADO') {
      this.reservasService.checkConflicto(c.id, undefined, 'MENSUAL').subscribe({
        next: (res) => {
          this.isSubmitting = false;
          if (res.conflicto && res.tipo === 'SIN_CUPO') {
            // Sin cupo mensual: abrir directamente el modal de lista de espera
            this.abrirEspera();
            return;
          }
          if (res.conflicto) {
            this.errorModalMsg = res.mensaje ?? 'No podés reservar esta clase.';
            return;
          }
          this.pasoModal = 'confirmacion';
        },
        error: () => {
          this.isSubmitting = false;
          this.pasoModal = 'confirmacion';
        },
      });
    } else {
      this.reservasService.checkConflicto(c.id, c.proximaFecha).subscribe({
        next: (res) => {
          this.isSubmitting = false;
          if (res.conflicto) {
            this.errorModalMsg = res.mensaje ?? 'No podés reservar esta clase.';
            return;
          }
          // Sin cupo individual: abrir directamente el modal de lista de espera
          if (c.cupoDisponible === 0) {
            this.abrirEspera();
            return;
          }
          this.pasoModal = 'seleccion-pago';
        },
        error: () => {
          this.isSubmitting = false;
          this.pasoModal = 'seleccion-pago';
        },
      });
    }
  }

  seleccionarTipoPago(tipo: TipoPago): void {
    this.tipoPagoElegido = tipo;
    this.pasoModal = 'confirmacion';
  }

  irAMedioCobro(): void {
    if (this.montoFinalReserva() > 0) {
      this.abrirVentanaPagoPrecargada();
    }
    this.confirmarReserva();
  }

  confirmarReserva(): void {
    this.isSubmitting = true;
    this.errorModalMsg = '';

    const valeId = this.aplicarValesToggle ? this.mejorValeDisponible()?.id : undefined;

    // Flujo de confirmación de cupo de lista de espera (con pago)
    if (this.cupoParaConfirmar) {
      const cupo = this.cupoParaConfirmar;
      this.reservasService
        .confirmarCupoListaEspera(cupo, this.tipoPagoElegido, valeId)
        .subscribe({
          next: (res) => {
            this.cupoAccionId = null;
            this.desmarcarListaEsperaLocal(cupo.claseId);
            this.cargarCuposPendientes();
            this.onReservaExitosa(res);
          },
          error: (err) => {
            this.isSubmitting = false;
            if (this.ventanaPago && !this.ventanaPago.closed) {
              this.ventanaPago.close();
            }
            this.ventanaPago = null;
            this.errorModalMsg = err?.error?.message ?? 'No se pudo confirmar el cupo.';
            this.pasoModal = this.cupoParaConfirmar?.tipo === 'MENSUAL' ? 'confirmacion' : 'seleccion-pago';
          },
        });
      return;
    }

    // Flujo normal de reserva directa
    if (!this.claseSeleccionada) return;
    const clase = this.claseSeleccionada;
    const obs =
      this.modalidadElegida === 'ABONADO'
        ? this.reservasService.inscribirMensual(clase, valeId)
        : this.reservasService.reservarClase(clase, this.tipoPagoElegido, valeId);

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
    pagoId?: number;
    pendientePago?: boolean;
  }): void {
    this.isSubmitting = false;

    if (res.pendientePago && res.redirectUrl) {
      this.reservaIdPendiente = res.reservaId ?? null;
      this.pagoIdEnCurso = res.pagoId ?? null;
      this.iniciarFlujoPagoExterno(res.redirectUrl, res.pagoId);
      return;
    }

    const mensajeExito =
      res.message === MSG_RESERVA_CONFIRMADA_SEÑA
        ? MSG_RESERVA_CONFIRMADA_SEÑA
        : MSG_RESERVA_CONFIRMADA;

    const esExito =
      !res.pendientePago &&
      (res.message === MSG_RESERVA_CONFIRMADA ||
        res.message === MSG_RESERVA_CONFIRMADA_SEÑA);

    if (!esExito) {
      if (this.ventanaPago && !this.ventanaPago.closed) {
        this.ventanaPago.close();
      }
      this.ventanaPago = null;
      this.resultadoMsg = res.message;
      this.isReservaIncompleta = true;
      this.pasoModal = 'resultado';
      this.bannerError = res.message;
      if (res.pagoId) {
        this.liberarReservaPorPagoFallido(res.pagoId);
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

  private iniciarFlujoPagoExterno(url: string, pagoId?: number): void {
    this.cerrarModal();
    this.bannerSuccess = '';
    this.bannerError = '';
    this.pagoCompletado = false;
    this.pagoIdEnCurso = pagoId ?? null;

    const ventana = this.navegarVentanaPago(url);

    if (!ventana) {
      this.bannerError =
        'No se pudo abrir la pestaña de pago. Permití ventanas emergentes y volvé a reservar la clase.';
    } else {
      this.bannerPagoEnCurso =
        'Completá el pago en la otra pestaña. Acá verás el resultado cuando Mercado Pago lo confirme.';
    }

    if (pagoId) {
      document.addEventListener('visibilitychange', this.onVisibilidadPago);
      this.iniciarPollingPago(pagoId);
      if (ventana) {
        this.iniciarMonitoreoVentanaPago(ventana, pagoId);
      }
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

  private navegarVentanaPago(url: string): Window | null {
    const ventana = this.ventanaPago;
    if (ventana && !ventana.closed) {
      ventana.location.href = url;
      try {
        ventana.opener = null;
      } catch {
        /* ignore */
      }
      this.ventanaPago = null;
      return ventana;
    }

    const nueva = window.open(url, '_blank');
    if (nueva) {
      try {
        nueva.opener = null;
      } catch {
        /* ignore */
      }
      return nueva;
    }

    return null;
  }

  private iniciarMonitoreoVentanaPago(ventana: Window, pagoId: number): void {
    this.detenerMonitoreoVentana();
    this.ventanaPagoMonitoreada = ventana;

    this.monitorVentanaInterval = setInterval(() => {
      if (this.pagoCompletado) {
        this.detenerMonitoreoVentana();
        return;
      }

      let cerrada = false;
      try {
        cerrada = ventana.closed;
      } catch {
        cerrada = true;
      }

      if (cerrada) {
        this.detenerMonitoreoVentana();
        const gen = this.pagoSeguimientoGen;
        this.detenerPollingPago();
        document.removeEventListener('visibilitychange', this.onVisibilidadPago);
        this.manejarCierreVentanaPago(pagoId, gen);
      }
    }, 800);
  }

  private pagoMpEnProceso(mpStatus?: string | null): boolean {
    return mpStatus === 'pending' || mpStatus === 'in_process';
  }

  /**
   * Tras cerrar MP o volver a la pestaña: consulta al instante (como el éxito)
   * y muestra el resultado sin esperar reintentos ni abandonar en el hilo principal.
   */
  private manejarCierreVentanaPago(pagoId: number, gen = this.pagoSeguimientoGen): void {
    if (this.pagoCompletado) return;

    const evaluarEstado = (estado: {
      estado: string;
      message: string;
      mp_status?: string | null;
    }): void => {
      if (this.pagoCompletado || gen !== this.pagoSeguimientoGen) return;

      if (estado.estado === 'COMPLETADO' || estado.estado === 'RECHAZADO') {
        this.procesarEstadoPago(estado);
        return;
      }

      if (this.pagoMpEnProceso(estado.mp_status)) {
        setTimeout(() => {
          if (this.pagoCompletado || gen !== this.pagoSeguimientoGen) return;
          this.pagoService.consultarEstado(pagoId).subscribe({
            next: (retry) => evaluarEstado(retry),
            error: () => this.abortarPagoPendiente(pagoId, gen),
          });
        }, this.reintentoMpEnProcesoMs);
        return;
      }

      this.abortarPagoPendiente(pagoId, gen, MSG_RESERVA_PAGO_INCOMPLETO);
    };

    this.pagoService.consultarEstado(pagoId).subscribe({
      next: evaluarEstado,
      error: () => this.abortarPagoPendiente(pagoId, gen),
    });
  }

  private abortarPagoPendiente(
    pagoId: number,
    gen: number,
    mensaje = MSG_RESERVA_PAGO_INCOMPLETO,
  ): void {
    if (this.pagoCompletado || gen !== this.pagoSeguimientoGen) return;

    this.detenerPollingPago();
    this.detenerMonitoreoVentana();
    document.removeEventListener('visibilitychange', this.onVisibilidadPago);
    this.mostrarPagoNoCompletado(mensaje);

    this.pagoService.abandonarPago(pagoId).subscribe({
      next: (res) => {
        if (gen !== this.pagoSeguimientoGen) return;
        if (res.estado === 'COMPLETADO') {
          this.pagoCompletado = false;
          this.bannerError = '';
          this.procesarEstadoPago({
            estado: 'COMPLETADO',
            message: res.message || MSG_RESERVA_CONFIRMADA,
          });
          return;
        }
        this.recargarClases();
      },
      error: (err) => {
        if (gen !== this.pagoSeguimientoGen) return;
        if (err?.status === 409) {
          this.pagoService.consultarEstado(pagoId).subscribe({
            next: (estado) => this.procesarEstadoPago(estado),
          });
          return;
        }
        this.pagoService.consultarEstado(pagoId).subscribe({
          next: (estado) => {
            if (gen !== this.pagoSeguimientoGen) return;
            if (estado.estado === 'COMPLETADO') {
              this.pagoCompletado = false;
              this.bannerError = '';
              this.procesarEstadoPago(estado);
            } else {
              this.recargarClases();
            }
          },
          error: () => this.recargarClases(),
        });
      },
    });
  }

  /** Muestra el aviso de fallo al instante, igual que el banner de éxito. */
  private mostrarPagoNoCompletado(mensaje: string): void {
    this.pagoCompletado = true;
    this.pagoIdEnCurso = null;
    this.reservaIdPendiente = null;
    this.bannerPagoEnCurso = '';
    this.bannerSuccess = '';
    this.bannerError = mensaje;
    this.recargarClases();
  }

  private verificarPagoIncompleto(pagoId: number): void {
    this.manejarCierreVentanaPago(pagoId);
  }

  private finalizarPagoNoCompletado(mensaje = MSG_RESERVA_PAGO_INCOMPLETO): void {
    if (this.pagoCompletado || !this.pagoIdEnCurso) return;
    this.abortarPagoPendiente(this.pagoIdEnCurso, this.pagoSeguimientoGen, mensaje);
  }

  private liberarReservaPorPagoFallido(pagoId?: number): void {
    const id = pagoId ?? this.pagoIdEnCurso;
    this.pagoIdEnCurso = null;
    this.reservaIdPendiente = null;

    if (!id) {
      this.recargarClases();
      return;
    }

    this.pagoService.abandonarPago(id).subscribe({
      next: () => this.recargarClases(),
      error: () => this.recargarClases(),
    });
  }

  private iniciarPollingPago(pagoId: number, onExito?: () => void): void {
    this.detenerSeguimientoPago();
    const gen = ++this.pagoSeguimientoGen;
    this.pagoCompletado = false;
    this.pagoIdEnCurso = pagoId;

    const consultar = () => {
      if (this.pagoCompletado || gen !== this.pagoSeguimientoGen) return;
      this.pagoService.consultarEstado(pagoId).subscribe({
        next: (estado) => {
          if (gen !== this.pagoSeguimientoGen) return;
          this.procesarEstadoPago(estado, onExito);
        },
        error: () => {
          /* reintenta en el próximo tick */
        },
      });
    };

    consultar();
    this.pollingSub = interval(this.pollingIntervalMs).subscribe(() => consultar());

    this.pollingTimeout = setTimeout(() => {
      if (!this.pagoCompletado && gen === this.pagoSeguimientoGen) {
        this.detenerPollingPago();
        document.removeEventListener('visibilitychange', this.onVisibilidadPago);
        this.manejarCierreVentanaPago(pagoId, gen);
      }
    }, this.pollingTimeoutMs);
  }

  private procesarEstadoPago(
    estado: { estado: string; message: string; mp_status?: string | null },
    onExito?: () => void,
  ): void {
    if (estado.estado === 'COMPLETADO') {
      if (estado.mp_status && estado.mp_status !== 'approved') {
        return;
      }
      this.pagoCompletado = true;
      this.detenerSeguimientoPago();
      this.bannerPagoEnCurso = '';
      this.bannerError = '';
      this.bannerSuccess = estado.message || MSG_RESERVA_CONFIRMADA;
      this.registrarReservaSiCorresponde(this.reservaIdPendiente ?? undefined);
      this.pagoIdEnCurso = null;
      this.reservaIdPendiente = null;
      this.recargarClases();
      onExito?.();
      return;
    }

    if (estado.estado === 'RECHAZADO') {
      this.pagoCompletado = true;
      this.detenerSeguimientoPago();
      this.bannerPagoEnCurso = '';
      this.bannerSuccess = '';
      this.bannerError = estado.message || MSG_RESERVA_PAGO_RECHAZADO;
      this.pagoIdEnCurso = null;
      this.reservaIdPendiente = null;
      this.recargarClases();
      return;
    }

    if (!this.bannerPagoEnCurso) {
      this.bannerPagoEnCurso = estado.message || 'Esperando confirmación de Mercado Pago…';
    }
  }

  private detenerSeguimientoPago(): void {
    this.pagoSeguimientoGen += 1;
    document.removeEventListener('visibilitychange', this.onVisibilidadPago);
    this.detenerPollingPago();
    this.detenerMonitoreoVentana();
  }

  private detenerMonitoreoVentana(): void {
    if (this.monitorVentanaInterval) {
      clearInterval(this.monitorVentanaInterval);
      this.monitorVentanaInterval = null;
    }
    this.ventanaPagoMonitoreada = null;
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
    this.cupoParaConfirmar = null;
    this.isConfirmandoCupo = false;
    this.restaurarScroll();
  }

  yaEnListaEspera(claseId: number): boolean {
    return this.clasesEnListaEspera.has(claseId);
  }

  estaEnListaMensual(claseId: number): boolean {
    return this.misWaitlists.some(
      (e) => Number(e.clase_id || e.clase?.id) === claseId && e.tipo === 'MENSUAL'
    );
  }

  estaEnListaIndividual(claseId: number): boolean {
    return this.misWaitlists.some(
      (e) => Number(e.clase_id || e.clase?.id) === claseId && e.tipo === 'INDIVIDUAL'
    );
  }

  obtenerPosicionListaEspera(claseId: number, tipo: 'MENSUAL' | 'INDIVIDUAL'): number | null {
    const entry = this.misWaitlists.find(
      (e) => Number(e.clase_id || e.clase?.id) === claseId && e.tipo === tipo
    );
    return entry ? entry.posicion : null;
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
    if (!this.claseSeleccionada) return;
    // Bloquear solo si ya está en ambas listas (no quedan opciones)
    const id = this.claseSeleccionada.id;
    if (this.estaEnListaIndividual(id) && this.estaEnListaMensual(id)) return;
    this.pasoModal = 'espera';
  }

  confirmarCupoLista(cupo: CupoPendienteLista): void {
    this.bloquearScroll();
    this.bannerError = '';
    this.cupoParaConfirmar = cupo;
    this.isConfirmandoCupo = true;
    this.resultadoMsg = '';
    this.errorModalMsg = '';
    this.isSubmitting = false;
    this.isReservaIncompleta = false;

    const clase = this.clases.find((c) => c.id === cupo.claseId);
    if (clase) {
      this.claseSeleccionada = clase;
      this.cargarValesParaClase(clase.id);
    } else {
      this.claseSeleccionada = {
        id: cupo.claseId,
        actividadId: 0,
        actividad: cupo.actividad,
        sede: cupo.sede,
        diaSemana: cupo.diaSemana,
        horaInicio: cupo.horaInicio,
        horaFin: cupo.horaFin,
        cupoTotal: 0,
        cupoDisponible: 0,
        proximaFecha: cupo.fechaClase || '',
      };
    }

    if (cupo.tipo === 'INDIVIDUAL') {
      this.tipoPagoElegido = 'PAGO_COMPLETO';
      this.modalidadElegida = 'INDIVIDUAL';
      if (this.claseSeleccionada && this.puedePagarSena(this.claseSeleccionada)) {
        this.pasoModal = 'seleccion-pago';
      } else {
        this.pasoModal = 'confirmacion';
      }
    } else {
      this.modalidadElegida = 'ABONADO';
      this.pasoModal = 'confirmacion';
    }
  }

  rechazarCupoLista(cupo: CupoPendienteLista): void {
    this.cupoAccionId = cupo.id;
    this.bannerError = '';
    this.listaEsperaService.rechazarCupo(cupo.id).subscribe({
      next: (res) => {
        this.cupoAccionId = null;
        this.bannerSuccess = res.message;
        this.desmarcarListaEsperaLocal(cupo.claseId);
        this.cargarCuposPendientes();
      },
      error: (err) => {
        this.cupoAccionId = null;
        this.bannerError = this.listaEsperaService.mensajeError(err);
        this.cargarCuposPendientes();
      },
    });
  }

  confirmarEspera(tipo: any): void {
    if (!this.claseSeleccionada) return;
    
    const isMensual = tipo === 'MENSUAL' || tipo === 'ABONADO';
    if (isMensual && this.estaEnListaMensual(this.claseSeleccionada.id)) return;
    if (!isMensual && this.estaEnListaIndividual(this.claseSeleccionada.id)) return;

    this.isSubmitting = true;
    this.errorModalMsg = '';

    this.reservasService.anotarseListaEspera(this.claseSeleccionada, tipo).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.marcarListaEspera(this.claseSeleccionada!.id);
        this.sincronizarListaEspera();
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

  volverDesdeConfirmacion(): void {
    const c = this.claseSeleccionada;
    if (!c) {
      this.cerrarModal();
      return;
    }
    if (this.modalidadElegida === 'ABONADO' || c.abonoClaseVigente || !this.puedePagarSena(c)) {
      this.pasoModal = 'seleccion-modalidad';
    } else {
      this.pasoModal = 'seleccion-pago';
    }
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
        this.dias = [...new Set(this.clases.map((c) => c.diaSemana))].sort(
          (a, b) => (this.ORDEN_DIA[a] ?? 9) - (this.ORDEN_DIA[b] ?? 9),
        );
        this.horas = [...new Set(this.clases.map((c) => c.horaInicio))].sort();
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

  private sincronizarListaEspera(): void {
    if (!this.authService.getCurrentUser()) return;
    this.listaEsperaService.getMisInscripciones().subscribe({
      next: (entries) => {
        this.misWaitlists = entries ?? [];
        this.clasesEnListaEspera.clear();
        this.misWaitlists.forEach((entry) => {
          if (entry.clase_id) {
            this.clasesEnListaEspera.add(Number(entry.clase_id));
          } else if (entry.clase?.id) {
            this.clasesEnListaEspera.add(Number(entry.clase.id));
          }
        });
        const key = this.listaEsperaStorageKey();
        if (key) {
          localStorage.setItem(key, JSON.stringify([...this.clasesEnListaEspera]));
        }
      },
      error: () => {
        /* ignore y mantener local */
      },
    });
  }


  private marcarListaEspera(claseId: number): void {
    this.clasesEnListaEspera.add(claseId);
    const key = this.listaEsperaStorageKey();
    if (!key) return;
    localStorage.setItem(key, JSON.stringify([...this.clasesEnListaEspera]));
  }

  private desmarcarListaEsperaLocal(claseId: number): void {
    this.clasesEnListaEspera.delete(claseId);
    const key = this.listaEsperaStorageKey();
    if (!key) return;
    localStorage.setItem(key, JSON.stringify([...this.clasesEnListaEspera]));
  }

  private cargarCuposPendientes(): void {
    this.cuposPendientesLoading = true;
    this.listaEsperaService.getMisPendientes().subscribe({
      next: (items) => {
        this.cuposPendientes = items;
        this.cuposPendientesLoading = false;
      },
      error: () => {
        this.cuposPendientes = [];
        this.cuposPendientesLoading = false;
      },
    });
  }

  obtenerWaitlistIdParaClase(claseId: number, tipo?: string): number {
    const entry = this.misWaitlists.find(
      (e) => Number(e.clase_id || e.clase?.id) === claseId && (!tipo || e.tipo === tipo)
    );
    return entry ? entry.id : 0;
  }

  salirListaEspera(claseId: number, tipo: 'MENSUAL' | 'INDIVIDUAL'): void {
    const id = this.obtenerWaitlistIdParaClase(claseId, tipo);
    if (!id) return;

    this.isSubmitting = true;
    this.errorModalMsg = '';

    this.listaEsperaService.cancelarMiListaEspera(id).subscribe({
      next: () => {
        this.isSubmitting = false;
        // Rely purely on synchronizing with backend to get the exact state
        this.sincronizarListaEspera();
        this.errorModalMsg = '';
        this.resultadoMsg = 'Saliste de la lista de espera correctamente.';
        this.pasoModal = 'resultado-espera';
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorModalMsg = this.listaEsperaService.mensajeError(err);
      },
    });
  }

  resultadoEsperaTitulo(): string {
    return this.resultadoMsg.includes('Saliste') ? 'Lista de espera' : '¡Te anotaste en la lista!';
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
