import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { Profesor, ProfesorService } from '../../services/profesor.service';
import { AuthService, CurrentUser } from '../../services/auth.service';
import { UsuariosListComponent } from '../usuarios-list/usuarios-list.component';
import { ActividadesListComponent } from '../actividades-list/actividades-list.component';
import { ClasesListComponent } from '../clases-list/clases-list.component';

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
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css',
})
export class AdminDashboardComponent {
  tab: 'actividades' | 'usuarios' | 'clases' | 'profesores' = 'usuarios';

  profesores: Profesor[] = [];

  loading = {
    profesores: false,
  };

  error = {
    profesores: '',
  };

  createProfesor = {
    nombre: '',
    apellido: '',
    dni: '',
    actividadesCsv: '',
  };

  currentUser: CurrentUser | null = null;

  constructor(
    private readonly profesorService: ProfesorService,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {
    this.currentUser = this.authService.getCurrentUser();
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigateByUrl('/');
  }

  setTab(tab: typeof this.tab): void {
    this.tab = tab;

    if (tab === 'profesores' && this.profesores.length === 0) {
      this.refreshProfesores();
    }
  }

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

  onCreateProfesor(): void {
    this.error.profesores = '';
    const p = this.createProfesor;
    if (!p.nombre || !p.apellido || !p.dni) {
      this.error.profesores = 'Completá nombre, apellido y DNI.';
      return;
    }

    const actividades = p.actividadesCsv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n) && n > 0);

    this.profesorService
      .create({
        nombre: p.nombre,
        apellido: p.apellido,
        dni: p.dni,
        actividades: actividades.length ? actividades : undefined,
      })
      .subscribe({
        next: () => {
          this.createProfesor = {
            nombre: '',
            apellido: '',
            dni: '',
            actividadesCsv: '',
          };
          this.refreshProfesores();
        },
        error: (err) => {
          this.error.profesores =
            err?.error?.message ?? 'No se pudo registrar el profesor.';
        },
      });
  }
}
