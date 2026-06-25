import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subscription, interval } from 'rxjs';

import {
  MSG_RESERVA_CANCELADA,
  ReservaHistorial,
  ReservasService,
  ResultadoCancelacion,
} from '../../services/reservas.service';
import { FechaArPipe } from '../../shared/pipes/fecha-ar.pipe';
import { AuthService } from '../../services/auth.service';
import { MedioCobro, PagoService } from '../../services/pago.service';
import { QRCodeComponent } from 'angularx-qrcode';

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
  totalClases?: number;
}

interface CardItem {
  kind: 'individual' | 'grupo';
  reserva?: ReservaHistorial;
  grupo?: AbonadoGrupo;
}

@Component({
  selector: 'app-mis-reservas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FechaArPipe, QRCodeComponent],
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
    | 'resultado-cancelacion'
    | 'seleccion-medio-cobro'
    | 'qr-pago' = 'detalle';
  resultadoCancelacion: ResultadoCancelacion | null = null;
  isCancelando = false;
  errorCancelacion = '';
  isCompletandoSena = false;
  errorCompletarSena = '';

  medioCobroElegido: MedioCobro = 'MERCADO_PAGO';
  qrDataPago = '';
  bannerPagoEnCurso = '';
  pagoCompletado = false;
  private pollingSub: Subscription | null = null;
  private pollingTimeout: ReturnType<typeof setTimeout> | null = null;
  private monitorVentanaInterval: ReturnType<typeof setInterval> | null = null;
  private ventanaPago: Window | null = null;
  private ventanaPagoMonitoreada: Window | null = null;
  private readonly reintentosTrasCierre = 2;
  private readonly pollingTrasCierreMs = 3000;
  private readonly pollingIntervalMs = 3000;
  private readonly pollingTimeoutMs = 300000;

  constructor(
    private readonly reservasService: ReservasService,
    private readonly authService: AuthService,
    private readonly pagoService: PagoService,
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

  cargarReservas(): void {
    this.isLoading = true;
    this.errorMsg = '';
    this.reservasService.getMisReservas().subscribe({
      next: (data) => {
        this.reservas = (data ?? []).filter((r) => r.estado !== 'CANCELADA' || r.esAbonado);
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
            totalClases: r.totalReservas,
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

    // Oculta abonados que ya no tienen ninguna reserva activa (mensual
    // "muerta" porque el cliente canceló todas o el CEF las canceló).
    return items.filter(
      (i) => i.kind !== 'grupo' || (i.grupo?.cantidadActivas ?? 0) > 0,
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

  abrirCancelacionMensual(grupo: AbonadoGrupo): void {
    this.grupoSeleccionado = grupo;
    this.reservaSeleccionada = null;
    this.modalPaso = 'confirmar-cancelacion';
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
    this.isCancelando = true;
    this.errorCancelacion = '';
    this.bannerError = '';

    if (this.grupoSeleccionado && !this.reservaSeleccionada) {
      // Cancelar pase mensual completo
      const mensualId = this.grupoSeleccionado.mensualId;
      this.reservasService.cancelarMensualidad(mensualId).subscribe({
        next: () => {
          this.isCancelando = false;
          this.bannerSuccess = 'Tu membresía mensual ha sido cancelada correctamente.';
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
    this.reservaSeleccionada = r;
    this.modalPaso = 'seleccion-medio-cobro';
    this.errorCompletarSena = '';
    this.isCompletandoSena = false;
    this.qrDataPago = '';
    this.detenerSeguimientoPago();
  }

  seleccionarMedioCobroSena(medio: MedioCobro): void {
    this.medioCobroElegido = medio;
    if (medio === 'MERCADO_PAGO') {
      this.abrirVentanaPagoPrecargada();
    }
    this.iniciarPagoSena();
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

    if (this.medioCobroElegido === 'QR') {
      this.pagoService
        .generarPagoQr({
          monto,
          concepto: titulo,
          cliente_email: email,
          reserva_id: r.id,
          origen: 'SALDO_SEÑA',
          origen_id: r.inscripcionIndividualId,
        })
        .subscribe({
          next: (res) => {
            this.isCompletandoSena = false;
            this.cargarReservas();
            if (this.esUrlPago(res.qr_data)) {
              this.iniciarFlujoPagoExterno(res.qr_data, res.pago_id);
              return;
            }
            this.qrDataPago = res.qr_data;
            this.modalPaso = 'qr-pago';
            if (res.pago_id) {
              this.bannerPagoEnCurso =
                'Escaneá el QR para pagar. Acá veremos la confirmación cuando Mercado Pago la apruebe.';
              this.iniciarPollingPago(res.pago_id, () => {
                this.bannerSuccess = 'Seña completada correctamente. Tu reserva está confirmada con pago completo.';
                this.cerrarModal();
                this.cargarReservas();
              });
            }
          },
          error: (err) => {
            this.isCompletandoSena = false;
            this.errorCompletarSena = this.pagoService.mensajeError(err);
            this.modalPaso = 'seleccion-medio-cobro';
          },
        });
    } else {
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
              this.modalPaso = 'seleccion-medio-cobro';
              if (this.ventanaPago) this.ventanaPago.close();
              return;
            }
            this.iniciarFlujoPagoExterno(redirectUrl, res.pago_id);
          },
          error: (err) => {
            this.isCompletandoSena = false;
            this.errorCompletarSena = this.pagoService.mensajeError(err);
            this.modalPaso = 'seleccion-medio-cobro';
            if (this.ventanaPago) this.ventanaPago.close();
          },
        });
    }
  }

  private esUrlPago(data: string): boolean {
    return /^https?:\/\//i.test(data.trim());
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
    this.cargarReservas();
    this.cerrarModal();
    this.bannerSuccess = '';
    this.bannerError = '';
    this.pagoCompletado = false;

    const ventana = this.navegarVentanaPago(url);

    if (!ventana) {
      this.bannerError =
        'No se pudo abrir la pestaña de pago. Permití ventanas emergentes y volvé a intentar.';
    } else {
      this.bannerPagoEnCurso =
        'Completá el pago en la otra pestaña. Acá verás el resultado cuando Mercado Pago lo confirme.';
    }

    if (pagoId) {
      this.iniciarPollingPago(pagoId, () => {
        this.bannerSuccess = 'Seña completada correctamente. Tu reserva está confirmada con pago completo.';
        this.cargarReservas();
      });
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
        this.detenerSeguimientoPago();
        this.verificarPagoIncompleto(pagoId);
      }
    }, 800);
  }

  private verificarPagoIncompleto(pagoId: number, intento = 0): void {
    if (this.pagoCompletado) return;

    if (intento === 0) {
      this.bannerPagoEnCurso = 'Verificando si el pago se completó…';
    }

    this.pagoService.consultarEstado(pagoId).subscribe({
      next: (estado) => {
        if (estado.estado === 'COMPLETADO' || estado.estado === 'RECHAZADO') {
          this.procesarEstadoPago(estado, () => {
            this.bannerSuccess = 'Seña completada correctamente. Tu reserva está confirmada con pago completo.';
            this.cargarReservas();
          });
          return;
        }
        if (intento < this.reintentosTrasCierre) {
          setTimeout(
            () => this.verificarPagoIncompleto(pagoId, intento + 1),
            this.pollingTrasCierreMs,
          );
          return;
        }
        this.finalizarPagoNoCompletado();
      },
      error: () => {
        if (intento < this.reintentosTrasCierre) {
          setTimeout(
            () => this.verificarPagoIncompleto(pagoId, intento + 1),
            this.pollingTrasCierreMs,
          );
          return;
        }
        this.finalizarPagoNoCompletado();
      },
    });
  }

  private finalizarPagoNoCompletado(mensaje = 'El pago no se completó. La seña sigue pendiente.'): void {
    if (this.pagoCompletado) return;

    this.detenerSeguimientoPago();
    this.bannerPagoEnCurso = '';
    this.bannerSuccess = '';
    this.bannerError = mensaje;
    this.cargarReservas();
  }

  private iniciarPollingPago(pagoId: number, onExito?: () => void): void {
    this.detenerSeguimientoPago();
    this.pagoCompletado = false;

    const consultar = () => {
      if (this.pagoCompletado) return;
      this.pagoService.consultarEstado(pagoId).subscribe({
        next: (estado) => this.procesarEstadoPago(estado, onExito),
        error: () => {
          /* reintenta */
        },
      });
    };

    consultar();
    this.pollingSub = interval(this.pollingIntervalMs).subscribe(() => consultar());

    this.pollingTimeout = setTimeout(() => {
      if (!this.pagoCompletado) {
        this.detenerSeguimientoPago();
        this.verificarPagoIncompleto(pagoId);
      }
    }, this.pollingTimeoutMs);
  }

  private procesarEstadoPago(
    estado: { estado: string; message: string },
    onExito?: () => void,
  ): void {
    if (estado.estado === 'COMPLETADO') {
      this.pagoCompletado = true;
      this.detenerSeguimientoPago();
      this.bannerPagoEnCurso = '';
      this.bannerError = '';
      this.bannerSuccess = 'Seña completada correctamente. Tu reserva está confirmada con pago completo.';
      this.cargarReservas();
      onExito?.();
      return;
    }

    if (estado.estado === 'RECHAZADO') {
      this.pagoCompletado = true;
      this.detenerSeguimientoPago();
      this.bannerPagoEnCurso = '';
      this.bannerError = estado.message || 'Hubo un problema con el pago.';
      return;
    }

    if (!this.bannerPagoEnCurso) {
      this.bannerPagoEnCurso = estado.message || 'Esperando confirmación de Mercado Pago…';
    }
  }

  private detenerSeguimientoPago(): void {
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
