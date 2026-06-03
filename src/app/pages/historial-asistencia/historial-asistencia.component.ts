import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AsistenciasService,
  AsistenciaHistorialItem,
} from '../../services/asistencias.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-historial-asistencia',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './historial-asistencia.component.html',
  styleUrl: './historial-asistencia.component.css',
})
export class HistorialAsistenciaComponent implements OnInit {
  private readonly asistenciasService = inject(AsistenciasService);
  private readonly authService = inject(AuthService);

  loading = false;
  emptyMsg = '';
  errorMsg = '';
  items: AsistenciaHistorialItem[] = [];

  ngOnInit(): void {
    this.cargar();
  }

  get esStaff(): boolean {
    return this.authService.isAdministrativo();
  }

  cargar(): void {
    this.loading = true;
    this.errorMsg = '';
    this.emptyMsg = '';
    this.items = [];

    this.asistenciasService.getHistorial().subscribe({
      next: (res) => {
        this.items = res.items ?? [];
        if (this.items.length === 0) {
          this.emptyMsg =
            res.message ??
            (this.esStaff
              ? 'No hay registros de asistencia.'
              : 'Aún no asistió a ninguna clase.');
        }
        this.loading = false;
      },
      error: (err) => {
        this.errorMsg = this.asistenciasService.mensajeError(err);
        this.loading = false;
      },
    });
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
