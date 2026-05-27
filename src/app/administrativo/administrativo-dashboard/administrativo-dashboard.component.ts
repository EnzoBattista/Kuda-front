import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { Profesor, ProfesorService } from '../../services/profesor.service';
import { AuthService, CurrentUser } from '../../services/auth.service';
import { UsuariosListComponent } from '../usuarios-list/usuarios-list.component';
import { ActividadesListComponent } from '../actividades-list/actividades-list.component';
import { ClasesListComponent } from '../clases-list/clases-list.component';
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
  ],
  templateUrl: './administrativo-dashboard.component.html',
  styleUrl: './administrativo-dashboard.component.css',
})
export class AdministrativoDashboardComponent {
  tab: 'actividades' | 'usuarios' | 'clases' | 'profesores' | 'empleados' = 'usuarios';

  // ─── Profesores ───────────────────────────────────────────────────────────
  profesores: Profesor[] = [];
  actividades: Actividad[] = [];
  loadingActividades = false;

  createProfesor = {
    nombre: '',
    apellido: '',
    dni: '',
    actividadesSeleccionadas: [] as number[],
  };

  filtroProfesorQ = '';

  // ─── Modales de alta ──────────────────────────────────────────────────────
  showModalCrearProfesor = false;
  showModalCrearEmpleado = false;

  // ─── Detalle ──────────────────────────────────────────────────────────────
  profesorDetalle: Profesor | null = null;
  empleadoDetalle: UsuarioListado | null = null;

  // ─── Eliminar profesor ────────────────────────────────────────────────────
  profesorAEliminar: Profesor | null = null;
  eliminandoProfesor = false;
  eliminarProfesorError = '';

  // ─── Empleados ────────────────────────────────────────────────────────────
  empleados: UsuarioListado[] = [];

  filtroEmpleadosQ = '';
  filtroEmpleadosEstado: '' | 'ACTIVO' | 'INACTIVO' = '';

  createEmpleadoForm = { nombre: '', apellido: '', dni: '', email: '', telefono: '', password: '' };
  createEmpleadoError = '';
  createEmpleadoSuccess = '';

  createProfesorError = '';
  createProfesorSuccess = '';

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
    const sel = this.createProfesor.actividadesSeleccionadas;
    const idx = sel.indexOf(id);
    this.createProfesor.actividadesSeleccionadas =
      idx === -1 ? [...sel, id] : sel.filter((a) => a !== id);
  }

  isActividadSeleccionada(id: number): boolean {
    return this.createProfesor.actividadesSeleccionadas.includes(id);
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

  abrirModalCrearProfesor(): void {
    this.createProfesor = { nombre: '', apellido: '', dni: '', actividadesSeleccionadas: [] };
    this.createProfesorError = '';
    this.createProfesorSuccess = '';
    if (this.actividades.length === 0) this.loadActividades();
    this.showModalCrearProfesor = true;
  }

  cerrarModalCrearProfesor(): void {
    this.showModalCrearProfesor = false;
    this.createProfesorError = '';
  }

  onCreateProfesor(): void {
    this.error.profesores = '';
    this.createProfesorError = '';
    this.createProfesorSuccess = '';
    const p = this.createProfesor;
    if (!p.nombre || !p.apellido || !p.dni) {
      this.createProfesorError = 'Completá nombre, apellido y DNI.';
      return;
    }
    if (p.actividadesSeleccionadas.length === 0) {
      this.createProfesorError = 'El profesor debe dictar al menos una actividad';
      return;
    }

    this.profesorService
      .create({
        nombre: p.nombre,
        apellido: p.apellido,
        dni: p.dni,
        actividades: p.actividadesSeleccionadas.length ? p.actividadesSeleccionadas : undefined,
      })
      .subscribe({
        next: () => {
          this.createProfesor = { nombre: '', apellido: '', dni: '', actividadesSeleccionadas: [] };
          this.createProfesorSuccess = 'Profesor registrado con éxito';
          this.showModalCrearProfesor = false;
          this.refreshProfesores();
        },
        error: (err) => {
          this.createProfesorError = this.mapProfesorError(err?.error?.message ?? '');
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
        this.createProfesorSuccess = 'Profesor eliminado con éxito';
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
}
