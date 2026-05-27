import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
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

  constructor(private readonly gestion: GestionUsuariosService) {}

  ngOnInit(): void {
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
        this.usuarios = data ?? [];
        this.isLoading = false;
      });
  }

  limpiarFiltros(): void {
    this.filtros.reset({ q: '', estado: '', tipoInscripcion: '' });
  }

  hayFiltrosAplicados(): boolean {
    const v = this.filtros.getRawValue();
    return Boolean(v.q?.trim() || v.estado || v.tipoInscripcion);
  }

  rolLabel(usuario: UsuarioListado): string {
    return usuario.rol?.nombre ?? '—';
  }

  estadoLabel(usuario: UsuarioListado): string {
    return usuario.activo ? 'Activo' : 'Inactivo';
  }

  tipoInscripcionLabel(usuario: UsuarioListado): string {
    if (usuario.rol?.nombre !== 'CLIENTE') return '—';
    return this.gestion.tipoInscripcion(usuario.email) === 'ABONADO'
      ? 'Abonado'
      : 'No abonado';
  }
}
