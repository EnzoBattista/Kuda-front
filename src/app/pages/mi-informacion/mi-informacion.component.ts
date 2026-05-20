import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService, CurrentUser } from '../../services/auth.service';

@Component({
  selector: 'app-mi-informacion',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './mi-informacion.component.html',
  styleUrl: './mi-informacion.component.css',
})
export class MiInformacionComponent implements OnInit {
  usuario: CurrentUser | null = null;

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router
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
