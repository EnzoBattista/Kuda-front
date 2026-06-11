import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { forkJoin } from 'rxjs';
import {
  HorarioPopular,
  IngresosReporte,
  ReportesService,
  TotalUsuariosReporte,
  UsuariosNuevosReporte,
} from '../../services/reportes.service';

Chart.register(...registerables);

@Component({
  selector: 'app-reportes-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reportes-panel.component.html',
  styleUrl: './reportes-panel.component.css',
})
export class ReportesPanelComponent implements OnInit, OnDestroy {
  private readonly reportes = inject(ReportesService);

  @ViewChild('chartUsuariosNuevos') chartUsuariosNuevosRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartIngresosMes') chartIngresosMesRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartIngresosMetodo') chartIngresosMetodoRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartHorarios') chartHorariosRef!: ElementRef<HTMLCanvasElement>;

  isLoading = true;
  errorMsg = '';

  totalUsuarios: TotalUsuariosReporte | null = null;
  usuariosNuevos: UsuariosNuevosReporte | null = null;
  ingresos: IngresosReporte | null = null;
  horariosPopulares: HorarioPopular[] = [];

  private charts: Chart[] = [];

  ngOnInit(): void {
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
        this.isLoading = false;
        setTimeout(() => this.renderCharts(), 0);
      },
      error: (err) => {
        this.errorMsg = this.reportes.mensajeError(err);
        this.isLoading = false;
      },
    });
  }

  ngOnDestroy(): void {
    this.destruirCharts();
  }

  formatearMes(mes: string): string {
    return this.reportes.formatearMes(mes);
  }

  formatearMoneda(valor: number): string {
    return this.reportes.formatearMoneda(valor);
  }

  formatearMetodo(metodo: string): string {
    return this.reportes.formatearMetodo(metodo);
  }

  labelHorario(item: HorarioPopular): string {
    return `${item.nombre} · ${item.dia_semana} ${item.hora_inicio}`;
  }

  private renderCharts(): void {
    this.destruirCharts();
    if (!this.usuariosNuevos || !this.ingresos) {
      return;
    }

    try {
      const created = [
        this.crearChart(this.chartUsuariosNuevosRef, this.configUsuariosNuevos()),
        this.crearChart(this.chartIngresosMesRef, this.configIngresosMes()),
        this.crearChart(this.chartIngresosMetodoRef, this.configIngresosMetodo()),
        this.crearChart(this.chartHorariosRef, this.configHorarios()),
      ];
      this.charts.push(...created.filter((c): c is Chart => c !== null));
    } catch {
      /* canvas aún no montado */
    }
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

  private configIngresosMetodo(): ChartConfiguration<'doughnut'> {
    const serie = this.ingresos?.por_metodo ?? [];
    const colores = ['#003366', '#16a34a', '#2563eb', '#f59e0b', '#dc2626'];
    return {
      type: 'doughnut',
      data: {
        labels: serie.map((s) => this.formatearMetodo(s.metodo)),
        datasets: [
          {
            data: serie.map((s) => s.total),
            backgroundColor: serie.map((_, i) => colores[i % colores.length]),
            borderWidth: 2,
            borderColor: '#fff',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
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

  private destruirCharts(): void {
    for (const chart of this.charts) {
      chart.destroy();
    }
    this.charts = [];
  }
}
