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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import {
  ActualizarUsuarioDto,
  GestionUsuariosService,
  UsuarioListado,
} from '../../services/gestion-usuarios.service';

/**
 * MOCK (Regla de Oro 1): el back no valida unicidad de DNI en `PUT /api/usuarios/:email`.
 * Este DNI dispara el escenario "DNI ya pertenece a otro usuario" pedido por la HU
 * incluso si nunca se llega a llamar al back. Tambien validamos contra la lista cargada.
 */
const DNI_DUPLICADO_MOCK = '11111111';

@Component({
  selector: 'app-editar-usuario',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './editar-usuario.component.html',
  styleUrl: './editar-usuario.component.css',
})
export class EditarUsuarioComponent implements OnInit {
  readonly form = new FormGroup({
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    apellido: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    dni: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    genero: new FormControl<'femenino' | 'masculino' | 'otro'>('otro', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    fechaNacimiento: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    telefono: new FormControl('', { nonNullable: true }),
  });

  emailEditado = '';
  usuario: UsuarioListado | null = null;
  listaCompleta: UsuarioListado[] = [];

  isLoading = true;
  loadError = '';

  isSubmitting = false;
  submitError = '';
  successMessage = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly gestion: GestionUsuariosService,
  ) {}

  ngOnInit(): void {
    this.emailEditado = this.route.snapshot.paramMap.get('email') ?? '';
    if (!this.emailEditado) {
      void this.router.navigateByUrl('/administrativo');
      return;
    }

    forkJoin({
      todos: this.gestion.getAll(),
      usuario: this.gestion.getByEmail(this.emailEditado),
      extra: this.gestion.getClienteExtraInfo(this.emailEditado),
    }).subscribe({
      next: ({ todos, usuario, extra }) => {
        this.listaCompleta = todos ?? [];
        this.usuario = usuario;

        const genero = (extra?.genero ?? 'otro') as 'femenino' | 'masculino' | 'otro';
        this.form.setValue({
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          dni: usuario.dni,
          genero,
          fechaNacimiento: extra?.fechaNacimiento ?? '',
          telefono: usuario.telefono ?? '',
        });

        this.isLoading = false;
      },
      error: () => {
        this.loadError = 'No se pudo cargar el usuario seleccionado.';
        this.isLoading = false;
      },
    });
  }

  onSubmit(): void {
    this.submitError = '';
    this.successMessage = '';
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const err = EditarUsuarioComponent.edadMinimaValidator(this.form.controls.fechaNacimiento);
    if (err) {
      this.form.controls.fechaNacimiento.setErrors(err);
      return;
    }

    const dni = this.form.controls.dni.value.trim();

    // MOCK 1: DNI fijo de prueba (escenario "DNI ya registrado" de la HU).
    if (dni === DNI_DUPLICADO_MOCK) {
      this.submitError = 'El DNI ingresado ya pertenece a otro usuario registrado';
      return;
    }

    // MOCK 2: contra la lista cargada (el back no la valida en PUT).
    if (this.gestion.dniEstaTomadoPorOtro(dni, this.emailEditado, this.listaCompleta)) {
      this.submitError = 'El DNI ingresado ya pertenece a otro usuario registrado';
      return;
    }

    const dto: ActualizarUsuarioDto = {
      nombre: this.form.controls.nombre.value.trim(),
      apellido: this.form.controls.apellido.value.trim(),
      dni,
      telefono: this.form.controls.telefono.value.trim() || undefined,
      genero: this.form.controls.genero.value,
      fechaNacimiento: this.form.controls.fechaNacimiento.value,
    };

    this.isSubmitting = true;

    this.gestion.update(this.emailEditado, dto).subscribe({
      next: () => {
        this.successMessage = 'Usuario editado con éxito';
        // Se mantiene deshabilitado el botón mientras dura el mensaje, y luego
        // volvemos a la lista para que el admin vea los cambios aplicados.
        setTimeout(() => {
          this.isSubmitting = false;
          void this.router.navigateByUrl('/administrativo');
        }, 1500);
      },
      error: (err) => {
        this.isSubmitting = false;
        const msg: string = err?.error?.message ?? '';
        if (msg.toLowerCase().includes('dni')) {
          this.submitError = 'El DNI ingresado ya pertenece a otro usuario registrado';
        } else if (msg.toLowerCase().includes('14 años')) {
          this.submitError = 'El usuario debe ser mayor de 14 años';
        } else {
          this.submitError = msg || 'No se pudo guardar el usuario. Intentá nuevamente.';
        }
      },
    });
  }

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
