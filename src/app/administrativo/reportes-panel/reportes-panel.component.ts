import {
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { forkJoin } from 'rxjs';
import {
  HorarioPopular,
  HorariosSeleccionadosReporte,
  IngresosMensualesReporte,
  IngresosReporte,
  ReportesService,
  TotalUsuariosReporte,
  UsuariosNuevosAnualReporte,
  UsuariosNuevosReporte,
} from '../../services/reportes.service';
import { ActividadesService } from '../../services/actividades.service';
import { Actividad } from '../../models/actividad.model';

Chart.register(...registerables);

type TipoReporte = 'usuarios' | 'usuarios-nuevos' | 'ingresos' | 'horarios';

const COLORES = ['#003366', '#16a34a', '#2563eb', '#f59e0b', '#dc2626'];

@Component({
  selector: 'app-reportes-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reportes-panel.component.html',
  styleUrl: './reportes-panel.component.css',
})
export class ReportesPanelComponent implements OnInit, OnDestroy {
  private readonly reportes = inject(ReportesService);
  private readonly actividadesService = inject(ActividadesService);
  private readonly zone = inject(NgZone);

  @ViewChild('chartTotalUsuarios') chartTotalUsuariosRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartUsuariosNuevos') chartUsuariosNuevosRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartIngresosMes') chartIngresosMesRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartHorarios') chartHorariosRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartDetalle') chartDetalleRef!: ElementRef<HTMLCanvasElement>;

  isLoading = true;
  refrescando = false;
  errorMsg = '';

  totalUsuarios: TotalUsuariosReporte | null = null;
  usuariosNuevos: UsuariosNuevosReporte | null = null;
  ingresos: IngresosReporte | null = null;
  horariosPopulares: HorarioPopular[] = [];

  actividades: Actividad[] = [];
  anios: number[] = [];

  // ─── Modal "Visualizar reporte" ─────────────────────────────────────────────
  reporteActivo: TipoReporte | null = null;
  filtroAnio: number = new Date().getFullYear();
  filtroActividadId: number | '' = '';
  detalleLoading = false;
  detalleError = '';
  detalleGenerado = false;

  detalleUsuariosNuevos: UsuariosNuevosAnualReporte | null = null;
  detalleIngresos: IngresosMensualesReporte | null = null;
  detalleHorarios: HorariosSeleccionadosReporte | null = null;

  private charts: Chart[] = [];
  private chartDetalle: Chart | null = null;

  ngOnInit(): void {
    const anioActual = new Date().getFullYear();
    this.anios = Array.from({ length: 6 }, (_, i) => anioActual - i);

    this.cargarReportes();

    this.actividadesService.getActivas().subscribe({
      next: (data) => (this.actividades = data ?? []),
      error: () => (this.actividades = []),
    });

    // Las métricas se cargan una sola vez al montar el panel. Para que reflejen
    // los cambios hechos en otras partes sin recargar la página, las refrescamos
    // automáticamente cuando el usuario vuelve a la ventana o reabre la pestaña.
    window.addEventListener('focus', this.onVolverAlFoco);
    document.addEventListener('visibilitychange', this.onVisibilidad);
  }

  ngOnDestroy(): void {
    window.removeEventListener('focus', this.onVolverAlFoco);
    document.removeEventListener('visibilitychange', this.onVisibilidad);
    this.destruirCharts();
    this.destruirChartDetalle();
  }

  private readonly onVolverAlFoco = (): void => this.cargarReportes(true);

  private readonly onVisibilidad = (): void => {
    if (document.visibilityState === 'visible') this.cargarReportes(true);
  };

  /**
   * Carga (o recarga) las 4 métricas del listado.
   * @param silencioso si es true, no muestra el estado "Cargando reportes…"
   *        ni pisa los datos en pantalla ante un error (refresco en segundo plano).
   */
  private cargarReportes(silencioso = false): void {
    if (this.refrescando) return;
    this.refrescando = true;
    if (!silencioso) {
      this.isLoading = true;
      this.errorMsg = '';
    }

    forkJoin({
      total: this.reportes.getTotalUsuarios(),
      nuevos: this.reportes.getUsuariosNuevos(),
      ingresos: this.reportes.getIngresos(),
      horarios: this.reportes.getHorariosPopulares(),
    }).subscribe({
      next: ({ total, nuevos, ingresos, horarios }) => {
        this.totalUsuarios = total;
        this.usuariosNuevos = nuevos;
        this.ingresos = ingresos;
        this.horariosPopulares = horarios.top ?? [];
        this.errorMsg = '';
        this.isLoading = false;
        this.refrescando = false;
        setTimeout(() => this.renderCharts(), 0);
      },
      error: (err) => {
        // En un refresco silencioso conservamos los datos ya visibles.
        if (!silencioso) {
          this.errorMsg = this.reportes.mensajeError(err);
        }
        this.isLoading = false;
        this.refrescando = false;
      },
    });
  }

  formatearMes(mes: string): string {
    return this.reportes.formatearMes(mes);
  }

  formatearMoneda(valor: number): string {
    return this.reportes.formatearMoneda(valor);
  }

  // ─── Resúmenes de las cards ─────────────────────────────────────────────────

  get topHorario(): HorarioPopular | null {
    return this.horariosPopulares[0] ?? null;
  }

  // ¿Hay datos para graficar en cada card? Si no, mostramos un mensaje.
  get tieneUsuarios(): boolean {
    return (this.totalUsuarios?.total ?? 0) > 0;
  }

  get tieneUsuariosNuevos(): boolean {
    return (this.usuariosNuevos?.serie ?? []).some((s) => s.cantidad > 0);
  }

  get tieneIngresos(): boolean {
    return (this.ingresos?.por_mes ?? []).some((m) => m.total > 0);
  }

  get tieneHorarios(): boolean {
    return this.horariosPopulares.length > 0;
  }

  formatearRol(rol: string): string {
    const map: Record<string, string> = {
      CLIENTE: 'Clientes',
      RECEPCIONISTA: 'Recepcionistas',
      ADMINISTRATIVO: 'Administrativos',
      DUENO: 'Dueño',
      PROFESOR: 'Profesores',
    };
    const key = (rol ?? '').toUpperCase();
    if (map[key]) return map[key];
    return rol ? rol.charAt(0).toUpperCase() + rol.slice(1).toLowerCase() : '—';
  }

  /** Desglose de usuarios por tipo de cuenta (rol). */
  get chipsUsuarios(): { label: string; value: string }[] {
    return (this.totalUsuarios?.por_rol ?? []).map((r) => ({
      label: this.formatearRol(r.rol),
      value: String(r.cantidad),
    }));
  }

  get chipsUsuariosNuevos(): { label: string; value: string }[] {
    const serie = this.usuariosNuevos?.serie ?? [];
    const esteMes = serie.length ? serie[serie.length - 1].cantidad : 0;
    const promedio = serie.length
      ? Math.round((this.usuariosNuevos?.total_periodo ?? 0) / serie.length)
      : 0;
    return [
      { label: 'Este mes', value: String(esteMes) },
      { label: 'Promedio/mes', value: String(promedio) },
    ];
  }

  get chipsIngresos(): { label: string; value: string }[] {
    const chips = [
      {
        label: 'Histórico',
        value: this.formatearMoneda(this.ingresos?.total_historico ?? 0),
      },
    ];
    return chips;
  }

  get chipsHorarios(): { label: string; value: string }[] {
    const t = this.topHorario;
    if (!t) return [];
    const chips = [
      { label: 'Reservas', value: String(t.total_reservas) },
      { label: 'Cupo', value: String(t.cupo) },
    ];
    if (t.ocupacion_pct != null) {
      chips.push({ label: 'Ocupación', value: `${t.ocupacion_pct}%` });
    }
    return chips;
  }

  // ─── Modal "Visualizar reporte" ─────────────────────────────────────────────

  get usaCategoria(): boolean {
    return this.reporteActivo === 'ingresos';
  }

  get usaAnio(): boolean {
    return this.reporteActivo !== 'usuarios';
  }

  tituloReporte(tipo: TipoReporte | null = this.reporteActivo): string {
    switch (tipo) {
      case 'usuarios':
        return 'Total de usuarios';
      case 'usuarios-nuevos':
        return 'Usuarios nuevos';
      case 'ingresos':
        return 'Dinero ingresado';
      case 'horarios':
        return 'Horarios más seleccionados';
      default:
        return 'Reporte';
    }
  }

  abrirReporte(tipo: TipoReporte): void {
    this.reporteActivo = tipo;
    this.detalleError = '';
    this.detalleGenerado = false;
    this.detalleUsuariosNuevos = null;
    this.detalleIngresos = null;
    this.detalleHorarios = null;
    this.filtroAnio = new Date().getFullYear();
    this.filtroActividadId = '';

    // Total de usuarios no necesita filtros: ya tenemos el dato cargado.
    if (tipo === 'usuarios') {
      this.detalleGenerado = true;
    }
  }

  cerrarReporte(): void {
    this.reporteActivo = null;
    this.destruirChartDetalle();
  }

  private actividadIdSeleccionada(): number | null {
    return this.filtroActividadId === '' ? null : Number(this.filtroActividadId);
  }

  generarReporte(): void {
    if (!this.reporteActivo || this.detalleLoading) return;

    this.detalleLoading = true;
    this.detalleError = '';
    this.detalleGenerado = false;
    this.destruirChartDetalle();

    const anio = Number(this.filtroAnio);
    const actId = this.actividadIdSeleccionada();

    if (this.reporteActivo === 'usuarios-nuevos') {
      this.reportes.getUsuariosNuevosAnual(anio).subscribe({
        next: (data) => this.onDetalleOk(() => (this.detalleUsuariosNuevos = data)),
        error: (err) => this.onDetalleError(err),
      });
    } else if (this.reporteActivo === 'ingresos') {
      this.reportes.getIngresosMensuales(anio, actId).subscribe({
        next: (data) => this.onDetalleOk(() => (this.detalleIngresos = data)),
        error: (err) => this.onDetalleError(err),
      });
    } else if (this.reporteActivo === 'horarios') {
      this.reportes.getHorariosSeleccionados(anio).subscribe({
        next: (data) => this.onDetalleOk(() => (this.detalleHorarios = data)),
        error: (err) => this.onDetalleError(err),
      });
    }
  }

  private onDetalleOk(asignar: () => void): void {
    asignar();
    this.detalleLoading = false;
    this.detalleGenerado = true;
    setTimeout(() => this.renderChartDetalle(), 0);
  }

  private onDetalleError(err: unknown): void {
    this.detalleError = this.reportes.mensajeError(err);
    this.detalleLoading = false;
  }

  get hayDatosDetalle(): boolean {
    switch (this.reporteActivo) {
      case 'usuarios':
        return (this.totalUsuarios?.total ?? 0) > 0;
      case 'usuarios-nuevos':
        return this.detalleUsuariosNuevos?.hay_datos ?? false;
      case 'ingresos':
        return this.detalleIngresos?.hay_datos ?? false;
      case 'horarios':
        return this.detalleHorarios?.hay_datos ?? false;
      default:
        return false;
    }
  }

  get mensajeVacio(): string {
    switch (this.reporteActivo) {
      case 'usuarios':
        return 'No existen clientes registrados.';
      case 'usuarios-nuevos':
        return this.detalleUsuariosNuevos?.mensaje ?? 'Sin datos para el período.';
      case 'ingresos':
        return this.detalleIngresos?.mensaje ?? 'Sin datos para el período.';
      case 'horarios':
        return this.detalleHorarios?.mensaje ?? 'Sin datos para el período.';
      default:
        return 'Sin datos.';
    }
  }

  // ─── Charts del listado ─────────────────────────────────────────────────────

  private renderCharts(): void {
    this.destruirCharts();
    // Chart.js usa requestAnimationFrame y ResizeObserver. Si se crean dentro de
    // la zona de Angular, cada frame dispara change detection y puede colgar el
    // hilo principal. Los creamos fuera de la zona.
    this.zone.runOutsideAngular(() => {
      try {
        const created = [
          this.crearChart(this.chartTotalUsuariosRef, this.configTotalUsuarios()),
          this.crearChart(this.chartUsuariosNuevosRef, this.configUsuariosNuevos()),
          this.crearChart(this.chartIngresosMesRef, this.configIngresosMes()),
          this.crearChart(this.chartHorariosRef, this.configHorarios()),
        ];
        this.charts.push(...created.filter((c): c is Chart => c !== null));
      } catch {
        /* canvas aún no montado */
      }
    });
  }

  private crearChart(
    ref: ElementRef<HTMLCanvasElement> | undefined,
    config: ChartConfiguration,
  ): Chart | null {
    const ctx = ref?.nativeElement?.getContext('2d');
    if (!ctx) {
      return null;
    }
    return new Chart(ctx, config);
  }

  private configTotalUsuarios(): ChartConfiguration<'doughnut'> {
    const serie = this.totalUsuarios?.por_rol ?? [];
    return {
      type: 'doughnut',
      data: {
        labels: serie.map((r) => r.rol),
        datasets: [
          {
            data: serie.map((r) => r.cantidad),
            backgroundColor: serie.map((_, i) => COLORES[i % COLORES.length]),
            borderWidth: 2,
            borderColor: '#fff',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
      },
    };
  }

  private configUsuariosNuevos(): ChartConfiguration<'bar'> {
    const serie = this.usuariosNuevos?.serie ?? [];
    return {
      type: 'bar',
      data: {
        labels: serie.map((s) => this.formatearMes(s.mes)),
        datasets: [
          {
            label: 'Usuarios nuevos',
            data: serie.map((s) => s.cantidad),
            backgroundColor: 'rgba(0, 51, 102, 0.75)',
            borderColor: '#003366',
            borderWidth: 1,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
        },
      },
    };
  }

  private configIngresosMes(): ChartConfiguration<'bar'> {
    const serie = this.ingresos?.por_mes ?? [];
    return {
      type: 'bar',
      data: {
        labels: serie.map((s) => this.formatearMes(s.mes)),
        datasets: [
          {
            label: 'Ingresos ($)',
            data: serie.map((s) => s.total),
            backgroundColor: 'rgba(22, 163, 74, 0.7)',
            borderColor: '#15803d',
            borderWidth: 1,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (v: string | number) => this.formatearMoneda(Number(v)),
            },
          },
        },
      },
    };
  }

  private configHorarios(): ChartConfiguration<'bar'> {
    const top = this.horariosPopulares.slice(0, 8);
    return {
      type: 'bar',
      data: {
        labels: top.map((h) => `${h.dia_semana.slice(0, 3)} ${h.hora_inicio}`),
        datasets: [
          {
            label: 'Reservas activas',
            data: top.map((h) => h.total_reservas),
            backgroundColor: 'rgba(37, 99, 235, 0.75)',
            borderColor: '#1d4ed8',
            borderWidth: 1,
            borderRadius: 6,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { precision: 0 } },
        },
      },
    };
  }

  // ─── Chart del detalle (modal) ──────────────────────────────────────────────

  private renderChartDetalle(): void {
    this.destruirChartDetalle();

    this.zone.runOutsideAngular(() => {
      const config = this.configDetalle();
      if (config) {
        const ctx = this.chartDetalleRef?.nativeElement?.getContext('2d');
        if (ctx) this.chartDetalle = new Chart(ctx, config);
      }
    });
  }

  private configDetalle(): ChartConfiguration | null {
    if (this.reporteActivo === 'usuarios-nuevos' && this.detalleUsuariosNuevos?.hay_datos) {
      const meses = this.detalleUsuariosNuevos.meses;
      return {
        type: 'bar',
        data: {
          labels: meses.map((m) => m.nombre_mes),
          datasets: [
            {
              label: 'Usuarios nuevos',
              data: meses.map((m) => m.cantidad),
              backgroundColor: 'rgba(0, 51, 102, 0.75)',
              borderColor: '#003366',
              borderWidth: 1,
              borderRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
        },
      };
    }

    if (this.reporteActivo === 'ingresos' && this.detalleIngresos?.hay_datos) {
      const meses = this.detalleIngresos.meses;
      return {
        type: 'bar',
        data: {
          labels: meses.map((m) => m.nombre_mes),
          datasets: [
            {
              label: 'Ingresos ($)',
              data: meses.map((m) => m.total),
              backgroundColor: 'rgba(22, 163, 74, 0.7)',
              borderColor: '#15803d',
              borderWidth: 1,
              borderRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: (v: string | number) => this.formatearMoneda(Number(v)),
              },
            },
          },
        },
      };
    }

    if (this.reporteActivo === 'horarios' && this.detalleHorarios?.hay_datos) {
      const top = this.detalleHorarios.horarios.slice(0, 12);
      return {
        type: 'bar',
        data: {
          labels: top.map((h) => `${h.dia_semana.slice(0, 3)} ${h.hora_inicio}`),
          datasets: [
            {
              label: 'Reservas',
              data: top.map((h) => h.total_reservas),
              backgroundColor: 'rgba(37, 99, 235, 0.75)',
              borderColor: '#1d4ed8',
              borderWidth: 1,
              borderRadius: 6,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
        },
      };
    }

    return null;
  }

  private destruirCharts(): void {
    for (const chart of this.charts) {
      chart.destroy();
    }
    this.charts = [];
  }

  private destruirChartDetalle(): void {
    this.chartDetalle?.destroy();
    this.chartDetalle = null;
  }
}
