import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, CurrentUser } from '../../services/auth.service';
import { ToastService } from '../../shared/toast.service';
import {
  CanalesNotificacion,
  NotificacionesService,
} from '../../services/notificaciones.service';

@Component({
  selector: 'app-mi-informacion',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './mi-informacion.component.html',
  styleUrl: './mi-informacion.component.css',
})
export class MiInformacionComponent implements OnInit {
  usuario: CurrentUser | null = null;
  notifLoading = false;
  notifSaving = false;

  readonly notifForm = new FormGroup({
    notificaciones_activas: new FormControl(true, { nonNullable: true }),
    recordatorios_clases: new FormControl(true, { nonNullable: true }),
    promociones: new FormControl(false, { nonNullable: true }),
    email: new FormControl(true, { nonNullable: true }),
  });

  constructor(
    public readonly auth: AuthService,
    private readonly router: Router,
    private readonly notificaciones: NotificacionesService,
    private readonly toast: ToastService
  ) {}

  ngOnInit(): void {
    if (!this.auth.getCurrentUser()) {
      void this.router.navigateByUrl('/login');
      return;
    }

    this.auth.cargarPerfilCliente().subscribe({
      next: (usuario) => {
        if (!usuario) {
          void this.router.navigateByUrl('/login');
          return;
        }
        this.usuario = usuario;
        if (!this.auth.isAdministrativo()) {
          this.cargarPreferenciasNotificacion();
        }
      },
    });
  }

  private cargarPreferenciasNotificacion(): void {
    this.notifLoading = true;
    this.notificaciones.getMisPreferencias().subscribe({
      next: (prefs) => {
        this.poblarNotifForm(prefs.canales_notificacion, prefs.notificaciones_activas);
        this.notifLoading = false;
      },
      error: (err) => {
        this.toast.showError(this.notificaciones.mensajeError(err));
        this.notifLoading = false;
      },
    });
  }

  private poblarNotifForm(canales: CanalesNotificacion, activas: boolean): void {
    this.notifForm.setValue({
      notificaciones_activas: activas,
      recordatorios_clases: canales.recordatorios_clases ?? true,
      promociones: canales.promociones ?? false,
      email: canales.email ?? true,
    });
  }

  guardarPreferenciasNotificacion(): void {
    this.notifSaving = true;

    const v = this.notifForm.getRawValue();
    this.notificaciones
      .actualizarMisPreferencias({
        notificaciones_activas: v.notificaciones_activas,
        canales_notificacion: {
          email: v.email,
          recordatorios_clases: v.recordatorios_clases,
          promociones: v.promociones,
        },
      })
      .subscribe({
        next: (res) => {
          this.toast.showSuccess(res.message);
          this.notifSaving = false;
        },
        error: (err) => {
          this.toast.showError(this.notificaciones.mensajeError(err));
          this.notifSaving = false;
        },
      });
  }

  get generoLabel(): string {
    const valor = this.usuario?.genero;
    if (!valor) return '—';
    const map: Record<string, string> = {
      femenino: 'Femenino',
      masculino: 'Masculino',
      otro: 'Otro',
    };
    return map[valor.toLowerCase()] ?? valor;
  }

  get fechaNacimientoLabel(): string {
    const iso = this.usuario?.fechaNacimiento;
    if (!iso) return '—';
    const [anio, mes, dia] = iso.split('-');
    if (!anio || !mes || !dia) return iso;
    return `${dia}/${mes}/${anio}`;
  }
}
