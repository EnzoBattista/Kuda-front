import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, startWith } from 'rxjs';
import {
  AsistenciasService,
  AsistenciaHistorialItem,
} from '../../services/asistencias.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-historial-asistencia',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './historial-asistencia.component.html',
  styleUrl: './historial-asistencia.component.css',
})
export class HistorialAsistenciaComponent implements OnInit {
  private readonly asistenciasService = inject(AsistenciasService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  loading = false;
  emptyMsg = '';
  errorMsg = '';
  sinResultadosFiltro = false;
  allItems: AsistenciaHistorialItem[] = [];
  itemsFiltrados: AsistenciaHistorialItem[] = [];
  actividadesOpciones: string[] = [];

  readonly horasInicio = Array.from({ length: 15 }, (_, i) => {
    const h = 7 + i;
    return `${String(h).padStart(2, '0')}:00`;
  });

  filtros = this.fb.nonNullable.group({
    dni: [''],
    actividad: [''],
    desde: [''],
    hasta: [''],
    hora_inicio: [''],
  });

  ngOnInit(): void {
    this.cargar();

    this.filtros.valueChanges
      .pipe(startWith(this.filtros.getRawValue()), debounceTime(150))
      .subscribe(() => {
        if (this.esStaff) {
          this.aplicarFiltros();
        }
      });
  }

  get esStaff(): boolean {
    return this.authService.isAdministrativo();
  }

  cargar(): void {
    this.loading = true;
    this.errorMsg = '';
    this.emptyMsg = '';
    this.sinResultadosFiltro = false;
    this.allItems = [];
    this.itemsFiltrados = [];

    this.asistenciasService.getHistorial().subscribe({
      next: (res) => {
        this.allItems = res.items ?? [];
        this.actividadesOpciones = [
          ...new Set(
            this.allItems
              .map((item) => item.clase?.actividad)
              .filter((actividad): actividad is string => Boolean(actividad)),
          ),
        ].sort((a, b) => a.localeCompare(b, 'es'));

        if (this.esStaff) {
          this.aplicarFiltros();
        } else {
          this.itemsFiltrados = [...this.allItems];
        }

        if (this.allItems.length === 0) {
          this.emptyMsg = res.message ?? this.mensajeHistorialVacio();
          this.sinResultadosFiltro = false;
        }

        this.loading = false;
      },
      error: (err) => {
        this.errorMsg = this.asistenciasService.mensajeError(err);
        this.loading = false;
      },
    });
  }

  aplicarFiltros(): void {
    if (this.allItems.length === 0) {
      this.itemsFiltrados = [];
      this.sinResultadosFiltro = false;
      return;
    }

    const f = this.filtros.getRawValue();
    const dni = f.dni.trim();

    this.itemsFiltrados = this.allItems.filter((item) => {
      if (dni && !String(item.cliente?.dni ?? '').includes(dni)) {
        return false;
      }
      if (f.actividad && item.clase?.actividad !== f.actividad) {
        return false;
      }
      if (f.desde && item.fecha < f.desde) {
        return false;
      }
      if (f.hasta && item.fecha > f.hasta) {
        return false;
      }
      if (f.hora_inicio) {
        const hora = (item.clase?.hora_inicio ?? '').slice(0, 5);
        if (hora !== f.hora_inicio) {
          return false;
        }
      }
      return true;
    });

    this.sinResultadosFiltro =
      this.itemsFiltrados.length === 0 && this.hayFiltrosAplicados();
    this.emptyMsg = '';
  }

  private mensajeHistorialVacio(): string {
    return this.esStaff
      ? 'Aún no se registró asistencia a ninguna clase.'
      : 'Aún no asistió a ninguna clase.';
  }

  hayFiltrosAplicados(): boolean {
    const f = this.filtros.getRawValue();
    return Boolean(
      f.dni.trim() ||
        f.actividad ||
        f.desde ||
        f.hasta ||
        f.hora_inicio,
    );
  }

  limpiarFiltros(): void {
    this.filtros.reset();
  }

  clienteNombre(item: AsistenciaHistorialItem): string {
    const { nombre, apellido } = item.cliente ?? {};
    return [nombre, apellido].filter(Boolean).join(' ') || item.cliente?.email || '—';
  }

  horarioClase(item: AsistenciaHistorialItem): string {
    if (!item.clase) return '—';
    const inicio = (item.clase.hora_inicio ?? '').slice(0, 5);
    const fin = (item.clase.hora_fin ?? '').slice(0, 5);
    return `${item.clase.dia_semana} · ${inicio} – ${fin}`;
  }

  estadoLabel(estado: string): string {
    switch (estado) {
      case 'PRESENTE':
        return 'Presente';
      case 'DENEGADO':
        return 'Denegado';
      case 'AUSENTE':
        return 'Ausente';
      default:
        return estado;
    }
  }
}
