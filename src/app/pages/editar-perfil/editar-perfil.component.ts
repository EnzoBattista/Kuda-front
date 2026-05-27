import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-editar-perfil',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './editar-perfil.component.html',
  styleUrl: './editar-perfil.component.css',
})
export class EditarPerfilComponent implements OnInit {
  readonly form = new FormGroup({
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    apellido: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    genero: new FormControl<'femenino' | 'masculino' | 'otro'>('otro', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    fechaNacimiento: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, EditarPerfilComponent.edadMinimaValidator],
    }),
    telefono: new FormControl('', { nonNullable: true }),
  });

  isSubmitting = false;
  submitted = false;
  isLoading = true;
  loadError = '';
  submitError = '';
  successMessage = '';

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
        this.poblarFormulario(usuario);
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.loadError = 'No se pudo cargar tu perfil. Intentá nuevamente.';
      },
    });
  }

  private poblarFormulario(usuario: {
    nombre: string;
    apellido: string;
    genero?: string;
    fechaNacimiento?: string;
    telefono?: string;
  }): void {
    const genero = (usuario.genero ?? 'otro') as 'femenino' | 'masculino' | 'otro';
    this.form.setValue({
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      genero,
      fechaNacimiento: usuario.fechaNacimiento ?? '',
      telefono: usuario.telefono ?? '',
    });
  }

  onSubmit(): void {
    this.submitted = true;
    this.submitError = '';
    this.successMessage = '';
    if (this.form.invalid) return;

    this.isSubmitting = true;
    const { nombre, apellido, genero, fechaNacimiento, telefono } = this.form.controls;

    this.auth
      .actualizarPerfil({
        nombre: nombre.value.trim(),
        apellido: apellido.value.trim(),
        telefono: telefono.value.trim() || undefined,
        genero: genero.value,
        fechaNacimiento: fechaNacimiento.value,
      })
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.successMessage = 'Se ha modificado su información personal';
        },
        error: (err) => {
          this.isSubmitting = false;
          this.submitError =
            err?.error?.message ?? 'No se pudieron guardar los cambios. Intentá nuevamente.';
        },
      });
  }

  /** Máximo permitido por el input date: hoy menos 14 años y 1 día (para que edad > 14 estricto). */
  get maxFechaNacimiento(): string {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 14);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }

  private static edadMinimaValidator(control: AbstractControl): ValidationErrors | null {
    const fecha = control.value as string | null;
    if (!fecha) return null;
    const hoy = new Date();
    const nacimiento = new Date(fecha);
    if (Number.isNaN(nacimiento.getTime())) return null;
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
    return edad > 14 ? null : { menorDeEdad: true };
  }
}
