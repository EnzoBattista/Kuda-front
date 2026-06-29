import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ClasesDisponiblesComponent } from '../clases-disponibles/clases-disponibles.component';
import { MisReservasComponent } from '../mis-reservas/mis-reservas.component';
import { MiQrComponent } from '../mi-qr/mi-qr.component';
import { HistorialAsistenciaComponent } from '../historial-asistencia/historial-asistencia.component';
import { ValesService, Vale } from '../../services/vales.service';

@Component({
  selector: 'app-cliente-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ClasesDisponiblesComponent,
    MisReservasComponent,
    MiQrComponent,
    HistorialAsistenciaComponent
  ],
  templateUrl: './cliente-dashboard.component.html',
  styleUrl: './cliente-dashboard.component.css'
})
export class ClienteDashboardComponent implements OnInit {
  tab: 'clases' | 'reservas' | 'asistencia' | 'vales' = 'clases';
  asistenciaModo: 'qr' | 'historial' = 'qr';

  currentUser: any = null;
  valesActivos: Vale[] = [];
  valesLoading = false;
  valesError = '';

  constructor(
    public readonly auth: AuthService,
    private readonly valesService: ValesService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.auth.getCurrentUser();
  }

  setTab(newTab: 'clases' | 'reservas' | 'asistencia' | 'vales') {
    this.tab = newTab;
    if (newTab === 'vales') {
      this.loadVales();
    }
  }

  loadVales(): void {
    if (!this.currentUser) return;
    this.valesLoading = true;
    this.valesError = '';
    this.valesService.getMisVales().subscribe({
      next: (vales) => {
        this.valesActivos = vales;
        this.valesLoading = false;
      },
      error: () => {
        this.valesError = 'No se pudieron cargar los vales.';
        this.valesLoading = false;
      }
    });
  }
}
