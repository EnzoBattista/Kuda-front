import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subscription, interval, forkJoin } from 'rxjs';

import {
  MSG_RESERVA_CANCELADA,
  MSG_RESERVA_PAGO_RECHAZADO,
  MSG_SENA_PAGO_INCOMPLETO,
  MSG_RESERVA_CONFIRMADA,
  AbonadoGrupoMensual,
  ReservaHistorial,
  ReservasService,
  ResultadoCancelacion,
} from '../../services/reservas.service';
import { FechaArPipe } from '../../shared/pipes/fecha-ar.pipe';
import { AuthService } from '../../services/auth.service';
import { PagoService, MSG_MP_SIN_CONEXION, esErrorConexionMercadoPago } from '../../services/pago.service';
import { ToastService } from '../../services/toast.service';

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
  estadoMensualidad?: string;
  reservas: ReservaHistorial[];
  cantidadActivas: number;
  cantidadPendientes?: number;
  totalClases?: number;
  mostrarPagarMes?: boolean;
  requierePago?: boolean;
  diasGraciaRestantes?: number | null;
  monto?: number;
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
export class MisReservasComponent implements OnInit, OnDestroy {
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
  isCompletandoSena = false;
  errorCompletarSena = '';
  isPagandoMes = false;
  errorPagarMes = '';
  mensualidadesExtra: AbonadoGrupo[] = [];
  private mensualidadesMap = new Map<number, AbonadoGrupoMensual>();

  bannerPagoEnCurso = '';
  pagoCompletado = false;
  private pagoIdEnCurso: number | null = null;
  private pagoSeguimientoGen = 0;
  private pollingSub: Subscription | null = null;
  private pollingTimeout: ReturnType<typeof setTimeout> | null = null;
  private monitorVentanaInterval: ReturnType<typeof setInterval> | null = null;
  private ventanaPago: Window | null = null;
  private ventanaPagoMonitoreada: Window | null = null;
  private readonly reintentoMpEnProcesoMs = 800;
  private readonly pollingIntervalMs = 3000;
  private readonly pollingTimeoutMs = 300000;

  private scrollPosition = 0;

  constructor(
    private readonly reservasService: ReservasService,
    private readonly authService: AuthService,
    private readonly pagoService: PagoService,
    private readonly toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.cargarReservas();
    this.filtros.valueChanges.subscribe(() => this.aplicarFiltros());
  }

  ngOnDestroy(): void {
    this.detenerSeguimientoPago();
    this.ventanaPago = null;
    this.ventanaPagoMonitoreada = null;
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

  cargarReservas(): void {
    this.isLoading = true;
    this.errorMsg = '';
    forkJoin({
      reservas: this.reservasService.getMisReservas(),
      mensualidades: this.reservasService.getMensualidadesCliente(),
    }).subscribe({
      next: ({ reservas, mensualidades }) => {
        this.reservas = (reservas ?? []).filter((r) => r.estado !== 'CANCELADA' || r.esAbonado);
        const hoy = new Date().toISOString().slice(0, 10);
        this.mensualidadesMap = new Map(
          (mensualidades ?? []).map((m) => [
            m.id,
            this.reservasService.construirGrupoDesdeMensual(m, hoy),
          ]),
        );
        const idsEnReservas = new Set(
          this.reservas
            .filter((r) => r.inscripcionMensualId)
            .map((r) => r.inscripcionMensualId as number),
        );
        this.mensualidadesExtra = (mensualidades ?? [])
          .filter(
            (m) =>
              (m.estado === 'EN_GRACIA' ||
                (m.estado === 'PENDIENTE_PAGO' && m.mostrar_pagar_mes)) &&
              !idsEnReservas.has(m.id),
          )
          .map((m) => this.reservasService.construirGrupoDesdeMensual(m, hoy));
        const todasActividades = [
          ...this.reservas.map((r) => r.actividad),
          ...this.mensualidadesExtra.map((g) => g.actividad),
        ];
        const todasSedes = [
          ...this.reservas.map((r) => r.sede),
          ...this.mensualidadesExtra.map((g) => g.sede),
        ];
        this.actividades = [...new Set(todasActividades)].sort();
        this.sedes = [...new Set(todasSedes)].sort();
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
    for (const item of this.items) {
      if (item.kind === 'grupo' && item.grupo) {
        const meta = this.mensualidadesMap.get(item.grupo.mensualId);
        if (meta) {
          item.grupo.mostrarPagarMes = meta.mostrarPagarMes;
          item.grupo.requierePago = meta.requierePago;
          item.grupo.diasGraciaRestantes = meta.diasGraciaRestantes;
          item.grupo.monto = meta.monto;
          if (!item.grupo.estadoMensualidad) {
            item.grupo.estadoMensualidad = meta.estadoMensualidad;
          }
        }
      }
    }
    const extrasFiltrados = this.mensualidadesExtra.filter(
      (g) =>
        (!actividad || g.actividad === actividad) &&
        (!sede || g.sede === sede),
    );
    for (const g of extrasFiltrados) {
      if (!this.items.some((i) => i.kind === 'grupo' && i.grupo?.mensualId === g.mensualId)) {
        this.items.push({ kind: 'grupo', grupo: g });
      }
    }
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
            estadoMensualidad: r.estadoMensualidad,
            reservas: [],
            cantidadActivas: 0,
            cantidadPendientes: 0,
            totalClases: r.totalReservas,
          };
          grupos.set(key, grupo);
          items.push({ kind: 'grupo', grupo });
        }
        grupo.reservas.push(r);
        if (r.estado === 'ACTIVA') grupo.cantidadActivas += 1;
        if (r.estado === 'PENDIENTE_PAGO') {
          grupo.cantidadPendientes = (grupo.cantidadPendientes ?? 0) + 1;
        }
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

    return items.filter((i) => {
      if (i.kind !== 'grupo') return true;
      const g = i.grupo;
      if (!g) return false;
      return (
        g.cantidadActivas > 0 ||
        (g.cantidadPendientes ?? 0) > 0 ||
        g.mostrarPagarMes ||
        ['PENDIENTE_PAGO', 'EN_GRACIA'].includes(g.estadoMensualidad ?? '')
      );
    });
  }

  estadoMensualidadLabel(estado?: string): string {
    const map: Record<string, string> = {
      VIGENTE: 'Vigente',
      PENDIENTE_PAGO: 'Pendiente de pago',
      EN_GRACIA: 'En gracia',
      SUSPENDIDA: 'Suspendido',
      CANCELADA: 'Cancelado',
      FINALIZADA: 'Finalizado',
    };
    return map[estado ?? ''] ?? estado ?? '—';
  }

  // Un mes en gracia / precargado no fue abonado: al cancelarlo no se reintegra
  // nada, así que no aplica el aviso de cupones de crédito.
  esMensualidadImpaga(grupo?: AbonadoGrupo | null): boolean {
    return ['PENDIENTE_PAGO', 'EN_GRACIA'].includes(grupo?.estadoMensualidad ?? '');
  }

  colorEstadoMensualidad(estado?: string): string {
    if (estado === 'CANCELADA' || estado === 'SUSPENDIDA') return 'var(--brand-red, #dc2626)';
    if (estado === 'PENDIENTE_PAGO' || estado === 'EN_GRACIA') return '#d97706';
    return 'var(--success-color, #2ecc71)';
  }

  pagarMes(grupo: AbonadoGrupo): void {
    if (!grupo.mostrarPagarMes || this.isPagandoMes) return;
    this.isPagandoMes = true;
    this.errorPagarMes = '';
    this.reservasService.pagarMensualidad(grupo.mensualId).subscribe({
      next: (result) => {
        this.isPagandoMes = false;
        if (result.pendientePago && result.redirectUrl && result.pagoId) {
          this.iniciarPagoMercadoPago(result.redirectUrl, result.pagoId);
        } else {
          this.toastService.show(result.message, 'success');
          this.cargarReservas();
        }
      },
      error: (err: unknown) => {
        this.isPagandoMes = false;
        this.errorPagarMes = this.mensajeErrorCarga(err);
        this.toastService.show(this.errorPagarMes, 'error');
      },
    });
  }

  private iniciarPagoMercadoPago(redirectUrl: string, pagoId: number): void {
    this.bannerPagoEnCurso = 'Completá el pago en Mercado Pago para confirmar tu mensualidad.';
    this.bannerError = '';
    this.bannerSuccess = '';
    this.ventanaPago = window.open(redirectUrl, '_blank');
    this.ventanaPagoMonitoreada = this.ventanaPago;
    document.addEventListener('visibilitychange', this.onVisibilidadPago);
    this.iniciarPollingPago(pagoId);
  }


  limpiarFiltros(): void {
    this.filtros.reset({ actividad: '', sede: '' });
  }

  hayFiltros(): boolean {
    const { actividad, sede } = this.filtros.getRawValue();
    return Boolean(actividad || sede);
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

  abrirDetalle(reserva: ReservaHistorial): void {
    this.bloquearScroll();
    this.reservaSeleccionada = reserva;
    this.grupoSeleccionado = null;
    this.modalPaso = 'detalle';
    this.resultadoCancelacion = null;
    this.errorCancelacion = '';
    this.isCancelando = false;
  }

  abrirDetalleGrupo(grupo: AbonadoGrupo): void {
    this.bloquearScroll();
    this.grupoSeleccionado = grupo;
    this.reservaSeleccionada = null;
    this.modalPaso = 'detalle-grupo';
    this.resultadoCancelacion = null;
    this.errorCancelacion = '';
    this.isCancelando = false;
  }

  abrirCancelacionMensual(grupo: AbonadoGrupo): void {
    this.bloquearScroll();
    this.grupoSeleccionado = grupo;
    this.reservaSeleccionada = null;
    this.modalPaso = 'confirmar-cancelacion';
    this.resultadoCancelacion = null;
    this.errorCancelacion = '';
    this.isCancelando = false;
  }

  abrirCancelacionDesdeGrupo(reserva: ReservaHistorial): void {
    // Ya está bloqueado el scroll porque estamos en el modal de detalle grupo,
    // pero si lo llamamos directo, lo bloqueamos por las dudas si no lo estaba.
    if (!this.grupoSeleccionado) this.bloquearScroll();
    this.reservaSeleccionada = reserva;
    this.modalPaso = 'confirmar-cancelacion';
    this.resultadoCancelacion = null;
    this.errorCancelacion = '';
    this.isCancelando = false;
  }

  abrirCancelacion(reserva: ReservaHistorial): void {
    this.bloquearScroll();
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
    this.restaurarScroll();
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
    this.isCancelando = true;
    this.errorCancelacion = '';
    this.bannerError = '';

    if (this.grupoSeleccionado && !this.reservaSeleccionada) {
      // Cancelar pase mensual completo
      const mensualId = this.grupoSeleccionado.mensualId;
      this.reservasService.cancelarMensualidad(mensualId).subscribe({
        next: () => {
          this.isCancelando = false;
          this.bannerSuccess = 'La cancelación se realizó con éxito.';
          this.cerrarModal();
          this.cargarReservas();
        },
        error: (err: any) => {
          this.isCancelando = false;
          const msg = err?.error?.message ?? 'No se pudo cancelar la membresía mensual.';
          this.errorCancelacion = msg;
          this.bannerError = msg;
        },
      });
      return;
    }

    if (!this.reservaSeleccionada) return;

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
              this.reservas = (data ?? []).filter((r) => r.estado !== 'CANCELADA' || r.esAbonado);
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

  completarSenaReserva(r: ReservaHistorial): void {
    if (!r.inscripcionIndividualId) return;
    this.scrollPosition = window.scrollY;
    this.reservaSeleccionada = r;
    this.errorCompletarSena = '';
    this.isCompletandoSena = false;
    this.detenerSeguimientoPago();
    this.abrirVentanaPagoPrecargada();
    this.iniciarPagoSena();
    setTimeout(() => window.scrollTo(0, this.scrollPosition), 0);
  }

  iniciarPagoSena(): void {
    const r = this.reservaSeleccionada;
    if (!r || !r.inscripcionIndividualId) return;

    this.isCompletandoSena = true;
    this.errorCompletarSena = '';
    this.bannerError = '';

    const monto = (r.montoTotal ?? 0) - (r.montoAbonado ?? 0);
    const titulo = `Saldo Seña: ${r.actividad} — ${r.proximaFecha ?? r.fechaReserva}`;
    const email = this.authService.getCurrentUser()?.email;

    this.pagoService
      .createPreference({
        tituloPlan: titulo,
        precio: monto,
        cliente_email: email,
        reserva_id: r.id,
        origen: 'SALDO_SEÑA',
        origen_id: r.inscripcionIndividualId,
      })
      .subscribe({
        next: (res) => {
          this.isCompletandoSena = false;
          const redirectUrl = res.init_point || res.sandbox_init_point;
          if (!redirectUrl) {
            this.errorCompletarSena = 'Mercado Pago no devolvió URL de checkout';
            this.modalPaso = 'detalle';
            if (this.ventanaPago) this.ventanaPago.close();
            return;
          }
          this.iniciarFlujoPagoExterno(redirectUrl, res.pago_id);
        },
        error: (err) => {
          this.isCompletandoSena = false;
          if (this.ventanaPago && !this.ventanaPago.closed) {
            this.ventanaPago.close();
          }
          this.ventanaPago = null;
          const msg = this.pagoService.mensajeError(err);
          if (esErrorConexionMercadoPago(err)) {
            this.toastService.showError(MSG_MP_SIN_CONEXION);
            this.modalPaso = 'detalle';
            return;
          }
          this.errorCompletarSena = msg;
          this.modalPaso = 'detalle';
        },
      });
  }

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
      /* ignore */
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

  private iniciarFlujoPagoExterno(url: string, pagoId?: number): void {
    this.cerrarModal();
    this.bannerSuccess = '';
    this.bannerError = '';
    this.pagoCompletado = false;
    this.pagoIdEnCurso = pagoId ?? null;

    const ventana = this.navegarVentanaPago(url);

    if (!ventana) {
      this.bannerError =
        'No se pudo abrir la pestaña de pago. Permití ventanas emergentes y volvé a intentar.';
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
        this.bannerPagoEnCurso = 'Verificando si el pago se completó…';
        setTimeout(() => {
          if (this.pagoCompletado || gen !== this.pagoSeguimientoGen) return;
          this.pagoService.consultarEstado(pagoId).subscribe({
            next: (retry) => evaluarEstado(retry),
            error: () => this.abortarPagoPendiente(pagoId, gen),
          });
        }, this.reintentoMpEnProcesoMs);
        return;
      }

      this.abortarPagoPendiente(pagoId, gen, MSG_SENA_PAGO_INCOMPLETO);
    };

    this.bannerPagoEnCurso = 'Verificando si el pago se completó…';
    this.pagoService.consultarEstado(pagoId).subscribe({
      next: evaluarEstado,
      error: () => this.abortarPagoPendiente(pagoId, gen),
    });
  }

  private abortarPagoPendiente(
    pagoId: number,
    gen: number,
    mensaje = MSG_SENA_PAGO_INCOMPLETO,
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
            message: res.message || 'Seña completada correctamente.',
          });
          return;
        }
        this.cargarReservas();
        this.bannerError = MSG_SENA_PAGO_INCOMPLETO;
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
              this.cargarReservas();
              this.bannerError = MSG_SENA_PAGO_INCOMPLETO;
            }
          },
          error: () => {
            this.cargarReservas();
            this.bannerError = MSG_SENA_PAGO_INCOMPLETO;
          },
        });
      },
    });
  }

  private mostrarPagoNoCompletado(mensaje: string): void {
    this.pagoCompletado = true;
    this.pagoIdEnCurso = null;
    this.bannerPagoEnCurso = '';
    this.bannerSuccess = '';
    this.bannerError = mensaje;
    this.cargarReservas();
  }

  private iniciarPollingPago(pagoId: number): void {
    this.detenerSeguimientoPago();
    const gen = ++this.pagoSeguimientoGen;
    this.pagoCompletado = false;
    this.pagoIdEnCurso = pagoId;

    const consultar = () => {
      if (this.pagoCompletado || gen !== this.pagoSeguimientoGen) return;
      this.pagoService.consultarEstado(pagoId).subscribe({
        next: (estado) => {
          if (gen !== this.pagoSeguimientoGen) return;
          this.procesarEstadoPago(estado);
        },
        error: () => {
          /* reintenta */
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

  private procesarEstadoPago(estado: {
    estado: string;
    message: string;
    mp_status?: string | null;
  }): void {
    if (estado.estado === 'COMPLETADO') {
      if (estado.mp_status && estado.mp_status !== 'approved') {
        return;
      }
      this.pagoCompletado = true;
      this.detenerSeguimientoPago();
      this.pagoIdEnCurso = null;
      this.bannerPagoEnCurso = '';
      this.bannerError = '';
      this.bannerSuccess = MSG_RESERVA_CONFIRMADA;
      this.cargarReservas();
      return;
    }

    if (estado.estado === 'RECHAZADO') {
      this.pagoCompletado = true;
      this.detenerSeguimientoPago();
      this.pagoIdEnCurso = null;
      this.bannerPagoEnCurso = '';
      this.bannerSuccess = '';
      this.bannerError = MSG_SENA_PAGO_INCOMPLETO;
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
      PENDIENTE_PAGO: 'Pendiente de pago',
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

  estadoSenaLabel(r: ReservaHistorial): string {
    if (r.estadoSena === 'COMPLETADA') return 'Completada';
    if (r.estadoSena === 'VENCIDA') return 'Vencida';
    const abonado = r.montoAbonado ?? 0;
    const total = r.montoTotal ?? 0;
    if (total > 0 && abonado > 0 && abonado < total - 0.01) {
      return 'Saldo pendiente';
    }
    return 'Pendiente';
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
      if (r.esAbonado) {
        return 'Cancelás con más de 24hs de anticipación. Recibirás un bono del 20% para el mes siguiente.';
      } else {
        const montoAbonado = r.montoAbonado ?? 0;
        return `Cancelás con más de 24hs de anticipación. Se generará un cupón de crédito a tu favor por el monto que abonaste ($${montoAbonado}). Recordá que los descuentos o cupones aplicados anteriormente no son reembolsables.`;
      }
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
