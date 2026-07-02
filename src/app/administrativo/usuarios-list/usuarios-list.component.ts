import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap, startWith, of, catchError } from 'rxjs';

import {
  EstadoFiltro,
  GestionUsuariosService,
  RolFiltro,
  TipoInscripcionFiltro,
  UsuarioListado,
  UsuariosFiltro,
} from '../../services/gestion-usuarios.service';
import { NotificacionesService } from '../../services/notificaciones.service';
import { ConfiguracionService } from '../../services/configuracion.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-usuarios-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './usuarios-list.component.html',
  styleUrl: './usuarios-list.component.css',
})
export class UsuariosListComponent implements OnInit {
  readonly filtros = new FormGroup({
    q: new FormControl<string>('', { nonNullable: true }),
    estado: new FormControl<EstadoFiltro>('', { nonNullable: true }),
    tipoInscripcion: new FormControl<TipoInscripcionFiltro>('', { nonNullable: true }),
  });

  usuarios: UsuarioListado[] = [];
  isLoading = false;
  errorMsg = '';
  diasGraciaGlobal = 1;
  recordatorioGlobal: number | null = 1;

  // Orden de la lista: primero Activos, luego Pendientes, al final Eliminados.
  private readonly ordenEstado: Record<string, number> = {
    ACTIVO: 0,
    PENDIENTE: 1,
    DESACTIVADO: 2,
    ELIMINADO: 3,
  };

  showModalNotificar = false;
  selectedUsuario: UsuarioListado | null = null;
  notificarSubmitting = false;
  notificarError = '';

  readonly notificarForm = new FormGroup({
    asunto: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    mensaje: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  showModalRecordatorio = false;
  recordatorioSubmitting = false;
  readonly recordatorioForm = new FormGroup({
    dia: new FormControl<number | null>(null, { validators: [Validators.required] }),
  });

  private readonly mensajeRecordatorioFueraDeGracia = (dias: number) =>
    `El recordatorio debe estar dentro de los ${dias} días de gracia para pagar`;

  constructor(
    private readonly gestion: GestionUsuariosService,
    private readonly notificaciones: NotificacionesService,
    private readonly configuracion: ConfiguracionService,
    private readonly auth: AuthService,
    private readonly toast: ToastService
  ) {}

  get puedeConfigurarSistema(): boolean {
    return this.auth.isDueno();
  }

  ngOnInit(): void {
    this.cargarConfiguracion();

    this.filtros.valueChanges
      .pipe(
        startWith(this.filtros.getRawValue()),
        debounceTime(300),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        switchMap(() => {
          this.isLoading = true;
          this.errorMsg = '';
          const valores: UsuariosFiltro = this.filtros.getRawValue();
          valores.rol = 'CLIENTE';
          return this.gestion.getAll(valores).pipe(
            catchError(() => {
              this.errorMsg = 'No se pudieron cargar los usuarios. Intentá nuevamente.';
              return of<UsuarioListado[]>([]);
            }),
          );
        }),
      )
      .subscribe((data) => {
        this.usuarios = this.ordenarPorEstado(data ?? []);
        this.isLoading = false;
      });
  }

  private cargarConfiguracion(): void {
    this.configuracion.obtener().subscribe({
      next: (cfg) => {
        this.diasGraciaGlobal = cfg.dias_gracia_mensual;
        this.recordatorioGlobal = cfg.recordatorio_pago_dia;
      },
      error: () => {
        this.diasGraciaGlobal = 1;
        this.recordatorioGlobal = 1;
      },
    });
  }

  limpiarFiltros(): void {
    this.filtros.reset({ q: '', estado: '', tipoInscripcion: '' });
  }

  private ordenarPorEstado(data: UsuarioListado[]): UsuarioListado[] {
    const peso = (u: UsuarioListado): number => this.ordenEstado[u.estado ?? ''] ?? 99;
    return [...data].sort((a, b) => peso(a) - peso(b));
  }

  toggleExpand(ev: Event): void {
    (ev.currentTarget as HTMLElement | null)?.classList.toggle('expandido');
  }

  hayFiltrosAplicados(): boolean {
    const v = this.filtros.getRawValue();
    return Boolean(v.q?.trim() || v.estado || v.tipoInscripcion);
  }

  rolLabel(usuario: UsuarioListado): string {
    return usuario.rol?.nombre ?? '—';
  }

  estadoLabel(usuario: UsuarioListado): string {
    if (usuario.estado === 'ACTIVO') return 'Activo';
    if (usuario.estado === 'PENDIENTE') return 'Pendiente confirmación';
    if (usuario.estado === 'DESACTIVADO') return 'Desactivado';
    if (usuario.estado === 'ELIMINADO') return 'Eliminado';
    return usuario.activo ? 'Activo' : 'Inactivo';
  }

  tipoInscripcionLabel(usuario: UsuarioListado): string {
    if (usuario.rol?.nombre !== 'CLIENTE') return '—';
    return this.gestion.tipoInscripcion(usuario.email) === 'ABONADO'
      ? 'Abonado'
      : 'No abonado';
  }

  abrirModalNotificar(usuario: UsuarioListado): void {
    this.selectedUsuario = usuario;
    this.notificarError = '';
    this.notificarForm.reset({ asunto: '', mensaje: '' });
    this.showModalNotificar = true;
  }

  cerrarModalNotificar(): void {
    this.showModalNotificar = false;
    this.selectedUsuario = null;
    this.notificarError = '';
    this.notificarSubmitting = false;
  }

  enviarNotificacion(): void {
    this.notificarForm.markAllAsTouched();
    if (this.notificarForm.invalid || !this.selectedUsuario) {
      return;
    }

    this.notificarSubmitting = true;
    this.notificarError = '';

    const { asunto, mensaje } = this.notificarForm.getRawValue();
    this.notificaciones
      .enviarManual({
        cliente_email: this.selectedUsuario.email,
        asunto,
        mensaje,
      })
      .subscribe({
        next: (res) => {
          this.toast.showSuccess(res.message);
          this.notificarSubmitting = false;
          this.cerrarModalNotificar();
        },
        error: (err) => {
          this.notificarError = this.notificaciones.mensajeError(err);
          this.toast.showError(this.notificarError);
          this.notificarSubmitting = false;
        },
      });
  }

  abrirModalRecordatorio(): void {
    this.recordatorioForm.reset({ dia: this.recordatorioGlobal });
    this.showModalRecordatorio = true;
  }

  cerrarModalRecordatorio(): void {
    this.showModalRecordatorio = false;
    this.recordatorioSubmitting = false;
  }

  guardarRecordatorio(): void {
    if (this.recordatorioSubmitting) return;

    const dia = Number(this.recordatorioForm.value.dia);
    if (!Number.isInteger(dia) || dia < 1 || dia > this.diasGraciaGlobal) {
      const diasMsg =
        Number.isInteger(dia) && dia > this.diasGraciaGlobal
          ? dia
          : this.diasGraciaGlobal;
      this.toast.showError(this.mensajeRecordatorioFueraDeGracia(diasMsg));
      return;
    }

    this.recordatorioSubmitting = true;

    this.configuracion.actualizar({ recordatorio_pago_dia: dia }).subscribe({
      next: (cfg) => {
        this.recordatorioGlobal = cfg.recordatorio_pago_dia;
        this.diasGraciaGlobal = cfg.dias_gracia_mensual;
        this.toast.showSuccess('Recordatorio modificado');
        this.cerrarModalRecordatorio();
      },
      error: (err) => {
        this.toast.showError(
          err?.error?.message ?? 'No se pudo modificar el recordatorio',
        );
        this.recordatorioSubmitting = false;
      },
    });
  }

  showModalEliminar = false;
  selectedUsuarioEliminar: UsuarioListado | null = null;
  eliminarSubmitting = false;

  abrirModalEliminar(usuario: UsuarioListado): void {
    this.selectedUsuarioEliminar = usuario;
    this.showModalEliminar = true;
  }

  cerrarModalEliminar(): void {
    this.showModalEliminar = false;
    this.selectedUsuarioEliminar = null;
    this.eliminarSubmitting = false;
  }

  confirmarEliminacion(): void {
    if (!this.selectedUsuarioEliminar) return;

    this.eliminarSubmitting = true;
    this.isLoading = true;
    this.gestion.eliminarCliente(this.selectedUsuarioEliminar.email).subscribe({
      next: (res) => {
        this.toast.showSuccess(res.message || 'Cliente eliminado con éxito');
        this.cerrarModalEliminar();
        const valores: UsuariosFiltro = this.filtros.getRawValue();
        valores.rol = 'CLIENTE';
        this.gestion.getAll(valores).subscribe((data) => {
          this.usuarios = this.ordenarPorEstado(data ?? []);
          this.isLoading = false;
        });
      },
      error: () => {
        this.toast.showError('Error al eliminar el cliente');
        this.isLoading = false;
        this.eliminarSubmitting = false;
        this.cerrarModalEliminar();
      }
    });
  }

  toggleEstado(usuario: UsuarioListado): void {
    if (!usuario || usuario.estado === 'ELIMINADO') return;

    this.isLoading = true;
    this.gestion.toggleEstado(usuario.email).subscribe({
      next: (res) => {
        this.toast.showSuccess(res.message);
        const valores: UsuariosFiltro = this.filtros.getRawValue();
        valores.rol = 'CLIENTE';
        this.gestion.getAll(valores).subscribe((data) => {
          this.usuarios = this.ordenarPorEstado(data ?? []);
          this.isLoading = false;
        });
      },
      error: () => {
        this.toast.showError('Error al cambiar el estado del cliente');
        this.isLoading = false;
      }
    });
  }
}
