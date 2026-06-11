import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { Profesor, ProfesorService } from '../../services/profesor.service';
import { AuthService, CurrentUser } from '../../services/auth.service';
import { UsuariosListComponent } from '../usuarios-list/usuarios-list.component';
import { ActividadesListComponent } from '../actividades-list/actividades-list.component';
import { ClasesListComponent } from '../clases-list/clases-list.component';
import { SalasListComponent } from '../salas-list/salas-list.component';
import { EscanearQrComponent } from '../escanear-qr/escanear-qr.component';
import { AsistenciaManualComponent } from '../asistencia-manual/asistencia-manual.component';
import { PagosListComponent } from '../pagos-list/pagos-list.component';
import { ReportesPanelComponent } from '../reportes-panel/reportes-panel.component';
import { ActividadesService } from '../../services/actividades.service';
import { GestionUsuariosService, UsuarioListado } from '../../services/gestion-usuarios.service';
import { Actividad } from '../../models/actividad.model';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    UsuariosListComponent,
    ActividadesListComponent,
    ClasesListComponent,
    SalasListComponent,
    EscanearQrComponent,
    AsistenciaManualComponent,
    PagosListComponent,
    ReportesPanelComponent,
  ],
  templateUrl: './administrativo-dashboard.component.html',
  styleUrl: './administrativo-dashboard.component.css',
})
export class AdministrativoDashboardComponent {
  tab: 'actividades' | 'usuarios' | 'clases' | 'salas' | 'pagos' | 'profesores' | 'empleados' | 'escanear' | 'asistencia-manual' | 'reportes' = 'usuarios';

  // ─── Profesores ───────────────────────────────────────────────────────────
  profesores: Profesor[] = [];
  actividades: Actividad[] = [];
  loadingActividades = false;

  formProfesor = {
    nombre: '',
    apellido: '',
    dni: '',
    telefono: '',
    email: '',
    actividadesSeleccionadas: [] as number[],
  };
  profesorAEditarId: number | null = null;

  filtroProfesorQ = '';

  // ─── Modales de alta ──────────────────────────────────────────────────────
  showModalFormProfesor = false;
  showModalCrearEmpleado = false;

  // ─── Detalle ──────────────────────────────────────────────────────────────
  profesorDetalle: Profesor | null = null;
  empleadoDetalle: UsuarioListado | null = null;

  // ─── Eliminar profesor ────────────────────────────────────────────────────
  profesorAEliminar: Profesor | null = null;
  eliminandoProfesor = false;
  eliminarProfesorError = '';

  // ─── Eliminar empleado ────────────────────────────────────────────────────
  empleadoAEliminar: UsuarioListado | null = null;
  eliminandoEmpleado = false;
  eliminarEmpleadoError = '';

  // ─── Empleados ────────────────────────────────────────────────────────────
  empleados: UsuarioListado[] = [];

  filtroEmpleadosQ = '';
  filtroEmpleadosEstado: '' | 'ACTIVO' | 'INACTIVO' = '';

  createEmpleadoForm = { nombre: '', apellido: '', dni: '', email: '', telefono: '', password: '' };
  createEmpleadoError = '';
  createEmpleadoSuccess = '';

  formProfesorError = '';
  formProfesorSuccess = '';

  // ─── Shared ───────────────────────────────────────────────────────────────
  loading = { profesores: false, empleados: false };
  error = { profesores: '', empleados: '' };

  currentUser: CurrentUser | null = null;

  constructor(
    private readonly profesorService: ProfesorService,
    private readonly actividadesService: ActividadesService,
    private readonly gestionUsuariosService: GestionUsuariosService,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {
    this.currentUser = this.authService.getCurrentUser();
  }

  get isDueno(): boolean {
    return this.authService.isDueno();
  }

  get isAdministrativo(): boolean {
    return this.authService.isAdministrativo();
  }

  logout(): void {
    this.authService.logout().subscribe({
      complete: () => void this.router.navigateByUrl('/login'),
    });
  }

  setTab(tab: typeof this.tab): void {
    this.tab = tab;

    if (tab === 'profesores') {
      if (this.profesores.length === 0) this.refreshProfesores();
      if (this.actividades.length === 0) this.loadActividades();
    }
    if (tab === 'empleados' && this.empleados.length === 0) {
      this.refreshEmpleados();
    }
  }

  // ─── Profesores ───────────────────────────────────────────────────────────

  refreshProfesores(): void {
    this.loading.profesores = true;
    this.error.profesores = '';
    this.profesorService.getAll().subscribe({
      next: (data) => {
        this.profesores = data ?? [];
        this.loading.profesores = false;
      },
      error: (err) => {
        if (err?.status === 404) {
          this.profesores = [];
          this.loading.profesores = false;
          return;
        }
        this.error.profesores = 'No se pudieron cargar los profesores.';
        this.loading.profesores = false;
      },
    });
  }

  private loadActividades(): void {
    this.loadingActividades = true;
    this.actividadesService.getActivas().subscribe({
      next: (data) => {
        this.actividades = data ?? [];
        this.loadingActividades = false;
      },
      error: () => {
        this.loadingActividades = false;
      },
    });
  }

  toggleActividad(id: number): void {
    const sel = this.formProfesor.actividadesSeleccionadas;
    const idx = sel.indexOf(id);
    this.formProfesor.actividadesSeleccionadas =
      idx === -1 ? [...sel, id] : sel.filter((a) => a !== id);
  }

  isActividadSeleccionada(id: number): boolean {
    return this.formProfesor.actividadesSeleccionadas.includes(id);
  }

  actividadesProfesorLabel(p: Profesor): string {
    return p.actividades?.map((a) => a.nombre).join(', ') || '—';
  }

  get profesoresFiltrados(): Profesor[] {
    const q = this.filtroProfesorQ.trim().toLowerCase();
    if (!q) return this.profesores;
    return this.profesores.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.apellido.toLowerCase().includes(q) ||
        p.dni.toLowerCase().includes(q),
    );
  }

  abrirModalProfesor(p?: Profesor): void {
    if (p) {
      this.profesorAEditarId = p.id;
      this.formProfesor = {
        nombre: p.nombre,
        apellido: p.apellido,
        dni: p.dni,
        telefono: p.telefono || '',
        email: p.email || '',
        actividadesSeleccionadas: p.actividades?.map(a => a.id) ?? [],
      };
    } else {
      this.profesorAEditarId = null;
      this.formProfesor = { nombre: '', apellido: '', dni: '', telefono: '', email: '', actividadesSeleccionadas: [] };
    }
    this.formProfesorError = '';
    this.formProfesorSuccess = '';
    if (this.actividades.length === 0) this.loadActividades();
    this.showModalFormProfesor = true;
  }

  cerrarModalProfesor(): void {
    this.showModalFormProfesor = false;
    this.formProfesorError = '';
  }

  onGuardarProfesor(): void {
    this.error.profesores = '';
    this.formProfesorError = '';
    this.formProfesorSuccess = '';
    const p = this.formProfesor;
    if (!p.nombre || !p.apellido || !p.dni) {
      this.formProfesorError = 'Completá nombre, apellido y DNI.';
      return;
    }
    if (p.actividadesSeleccionadas.length === 0) {
      this.formProfesorError = 'El profesor debe dictar al menos una actividad';
      return;
    }

    const request = {
      nombre: p.nombre,
      apellido: p.apellido,
      dni: p.dni,
      telefono: p.telefono || undefined,
      email: p.email || undefined,
      actividades: p.actividadesSeleccionadas.length ? p.actividadesSeleccionadas : undefined,
    };

    const operacion = this.profesorAEditarId
      ? this.profesorService.update(this.profesorAEditarId, request)
      : this.profesorService.create(request);

    operacion.subscribe({
        next: () => {
          this.formProfesor = { nombre: '', apellido: '', dni: '', telefono: '', email: '', actividadesSeleccionadas: [] };
          this.formProfesorSuccess = this.profesorAEditarId
            ? 'Profesor modificado con éxito'
            : 'Profesor registrado con éxito';
          this.showModalFormProfesor = false;
          this.refreshProfesores();
        },
        error: (err) => {
          this.formProfesorError = this.mapProfesorError(err?.error?.message ?? '');
        },
      });
  }

  onConfirmarEliminarProfesor(): void {
    if (!this.profesorAEliminar) return;
    this.eliminandoProfesor = true;
    this.eliminarProfesorError = '';
    this.profesorService.delete(this.profesorAEliminar.id).subscribe({
      next: () => {
        this.profesorAEliminar = null;
        this.eliminandoProfesor = false;
        this.formProfesorSuccess = 'Profesor eliminado con éxito';
        this.refreshProfesores();
      },
      error: (err) => {
        this.eliminandoProfesor = false;
        this.eliminarProfesorError =
          err?.error?.message || 'No se pudo eliminar al profesor. Aun tiene clases pendientes';
      },
    });
  }

  private mapProfesorError(msg: string): string {
    const lower = (msg ?? '').toLowerCase();
    if (
      (lower.includes('dni') || lower.includes('documento')) &&
      (lower.includes('ya') || lower.includes('existe') || lower.includes('registrado'))
    ) {
      return 'El profesor con este número de documento ya se encuentra registrado';
    }
    return msg || 'No se pudo registrar el profesor.';
  }

  // ─── Empleados ────────────────────────────────────────────────────────────

  refreshEmpleados(): void {
    this.loading.empleados = true;
    this.error.empleados = '';
    this.gestionUsuariosService.getAll({ rol: 'RECEPCIONISTA' }).subscribe({
      next: (data) => {
        this.empleados = data ?? [];
        this.loading.empleados = false;
      },
      error: () => {
        this.error.empleados = 'No se pudieron cargar los empleados.';
        this.loading.empleados = false;
      },
    });
  }

  get empleadosFiltrados(): UsuarioListado[] {
    let list = this.empleados;
    const q = this.filtroEmpleadosQ.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (u) =>
          u.nombre.toLowerCase().includes(q) ||
          u.apellido.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.dni.toLowerCase().includes(q),
      );
    }
    if (this.filtroEmpleadosEstado === 'ACTIVO') list = list.filter((u) => u.activo);
    if (this.filtroEmpleadosEstado === 'INACTIVO') list = list.filter((u) => !u.activo);
    return list;
  }

  abrirModalCrearEmpleado(): void {
    this.createEmpleadoForm = { nombre: '', apellido: '', dni: '', email: '', telefono: '', password: '' };
    this.createEmpleadoError = '';
    this.createEmpleadoSuccess = '';
    this.showModalCrearEmpleado = true;
  }

  cerrarModalCrearEmpleado(): void {
    this.showModalCrearEmpleado = false;
    this.createEmpleadoError = '';
  }

  onCreateEmpleado(): void {
    this.createEmpleadoError = '';
    this.createEmpleadoSuccess = '';
    const f = this.createEmpleadoForm;
    
    const nombre = (f.nombre || '').trim();
    const apellido = (f.apellido || '').trim();
    const dni = (f.dni || '').trim();
    const email = (f.email || '').trim();
    const telefono = (f.telefono || '').trim();
    const password = f.password || '';

    if (!nombre || !apellido || !dni || !email || !telefono || !password) {
      this.createEmpleadoError = 'Completá todos los campos.';
      return;
    }
    if (password.length < 8) {
      this.createEmpleadoError = 'La contraseña debe tener al menos 8 caracteres.';
      return;
    }
    
    const request = { nombre, apellido, dni, email, telefono, password };
    this.gestionUsuariosService.createAdministrativo(request).subscribe({
      next: () => {
        this.createEmpleadoForm = { nombre: '', apellido: '', dni: '', email: '', telefono: '', password: '' };
        this.createEmpleadoSuccess = 'Recepcionista registrado con éxito';
        this.showModalCrearEmpleado = false;
        this.refreshEmpleados();
      },
      error: (err) => {
        this.createEmpleadoError = this.mapEmpleadoError(err?.error?.message ?? '');
      },
    });
  }

  private mapEmpleadoError(msg: string): string {
    const lower = (msg ?? '').toLowerCase();
    if (
      (lower.includes('email') || lower.includes('correo')) &&
      (lower.includes('uso') || lower.includes('registrado') || lower.includes('existe'))
    ) {
      return 'El correo electrónico ya está en uso por otro usuario';
    }
    return msg || 'No se pudo registrar el recepcionista.';
  }

  onConfirmarEliminarEmpleado(): void {
    if (!this.empleadoAEliminar) return;
    this.eliminandoEmpleado = true;
    this.eliminarEmpleadoError = '';

    const email = this.empleadoAEliminar.email;
    this.gestionUsuariosService.eliminarRecepcionista(email).subscribe({
      next: () => {
        this.empleadoAEliminar = null;
        this.eliminandoEmpleado = false;
        this.createEmpleadoSuccess = 'Recepcionista eliminado con éxito';
        this.refreshEmpleados();
      },
      error: (err) => {
        this.eliminandoEmpleado = false;
        this.eliminarEmpleadoError =
          err?.error?.message || 'No se pudo eliminar al recepcionista';
      },
    });
  }
}
