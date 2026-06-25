import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificacionesService } from '../../services/notificaciones.service';
import { ToastService } from '../../services/toast.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notificaciones-bell',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button class="nav-link bell-btn" (click)="toggleNotificaciones()" [attr.aria-label]="notificacionesActivas ? 'Desactivar notificaciones' : 'Activar notificaciones'">
      <svg *ngIf="!isLoading && notificacionesActivas" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
      </svg>
      <svg *ngIf="!isLoading && !notificacionesActivas" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/>
        <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2" />
      </svg>
      <div *ngIf="isLoading" class="spinner" style="width: 20px; height: 20px; border-width: 2px;"></div>
    </button>
  `,
  styles: [`
    .bell-btn {
      background: none;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 1rem;
      height: 100%;
    }
    .bell-btn:hover {
      opacity: 0.8;
    }
  `]
})
export class NotificacionesBellComponent implements OnInit, OnDestroy {
  notificacionesActivas = false;
  isLoading = true;
  private sub?: Subscription;

  constructor(
    private readonly notificaciones: NotificacionesService,
    private readonly toast: ToastService
  ) {}

  ngOnInit(): void {
    this.cargarPreferencias();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  cargarPreferencias(): void {
    this.isLoading = true;
    this.sub = this.notificaciones.getMisPreferencias().subscribe({
      next: (prefs) => {
        this.notificacionesActivas = prefs.notificaciones_activas;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        // Ignore error silently to not annoy on every page load
      }
    });
  }

  toggleNotificaciones(): void {
    if (this.isLoading) return;

    this.isLoading = true;
    const nuevoEstado = !this.notificacionesActivas;

    this.notificaciones.actualizarMisPreferencias({ notificaciones_activas: nuevoEstado }).subscribe({
      next: (res) => {
        this.notificacionesActivas = res.notificaciones_activas;
        this.isLoading = false;
        this.toast.showSuccess(res.message);
      },
      error: (err) => {
        this.isLoading = false;
        this.toast.showError(this.notificaciones.mensajeError(err));
      }
    });
  }
}
