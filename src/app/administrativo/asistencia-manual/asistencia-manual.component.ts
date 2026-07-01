import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AsistenciasService,
  ClaseHoy,
} from '../../services/asistencias.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-asistencia-manual',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './asistencia-manual.component.html',
  styleUrl: './asistencia-manual.component.css',
})
export class AsistenciaManualComponent implements OnInit {
  private readonly asistenciasService = inject(AsistenciasService);
  private readonly toastService = inject(ToastService);

  loading = false;
  errorMsg = '';
  fecha = '';
  clases: ClaseHoy[] = [];
  claseSeleccionadaId: number | null = null;
  procesandoReservaId: number | null = null;
  itemError = '';

  ngOnInit(): void {
    this.cargar();
  }

  get claseSeleccionada(): ClaseHoy | null {
    if (this.claseSeleccionadaId == null) return null;
    return this.clases.find((c) => c.id === this.claseSeleccionadaId) ?? null;
  }

  cargar(): void {
    this.loading = true;
    this.errorMsg = '';

    this.asistenciasService.getClasesHoy().subscribe({
      next: (res) => {
        this.fecha = res.fecha;
        this.clases = res.clases ?? [];
        if (this.clases.length > 0 && this.claseSeleccionadaId == null) {
          this.claseSeleccionadaId = this.clases[0].id;
        }
        this.loading = false;
      },
      error: (err) => {
        this.errorMsg = this.asistenciasService.mensajeError(err);
        this.loading = false;
      },
    });
  }

  marcar(
    inscripto: ClaseHoy['inscriptos'][number],
    estado: 'PRESENTE' | 'AUSENTE',
  ): void {
    const clase = this.claseSeleccionada;
    if (!clase) return;

    this.procesandoReservaId = inscripto.reserva_id;
    this.itemError = '';

    this.asistenciasService
      .registrar({
        reserva_id: inscripto.reserva_id,
        email: inscripto.email,
        clase_id: clase.id,
        estado,
        manual: true,
      })
      .subscribe({
        next: (res) => {
          this.toastService.showSuccess(res.message);
          this.procesandoReservaId = null;
          this.cargar();
        },
        error: (err) => {
          this.itemError = this.asistenciasService.mensajeError(err);
          this.procesandoReservaId = null;
        },
      });
  }

  presenteRegistrado(inscripto: ClaseHoy['inscriptos'][number]): boolean {
    return inscripto.asistencia?.estado === 'PRESENTE';
  }

  ausenteRegistrado(inscripto: ClaseHoy['inscriptos'][number]): boolean {
    return inscripto.asistencia?.estado === 'AUSENTE';
  }

  etiquetaClase(clase: ClaseHoy): string {
    const actividad =
      clase.actividad ?? clase.nombre.split('—')[0]?.trim() ?? clase.nombre;
    let dia = clase.dia_semana ?? '';
    if (!dia && clase.nombre.includes('—')) {
      const resto = clase.nombre.split('—')[1]?.trim() ?? '';
      dia = resto.replace(/\d{1,2}:\d{2}.*$/, '').trim();
    }
    return `${actividad} - ${dia} - ${clase.hora_inicio} - ${clase.hora_fin}`;
  }
}
