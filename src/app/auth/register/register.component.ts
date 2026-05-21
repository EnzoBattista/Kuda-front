import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthService, RegisterRequest } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
})
export class RegisterComponent {
  isSubmitting = false;
  submitted = false;
  submitError = '';
  successMessage = '';

  readonly form = new FormGroup(
    {
      nombre: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      apellido: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      dni: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(7), Validators.maxLength(10)],
      }),
      email: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email],
      }),
      genero: new FormControl<'femenino' | 'masculino' | 'otro'>('otro', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      fechaNacimiento: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      telefono: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(6)],
      }),
      fichaMedicaFile: new FormControl<File | null>(null, {
        validators: [Validators.required],
      }),
      password: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(8)],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(8)],
      }),
    },
    { validators: [RegisterComponent.passwordsMatchValidator] }
  );

  fichaMedicaFileName = '';
  fichaMedicaEncoded: string | null = null;

  constructor(private readonly auth: AuthService) {}

  onSubmit(): void {
    this.submitted = true;
    this.submitError = '';
    this.successMessage = '';

    if (this.isUnder14()) {
      this.submitError = 'Registro fallido - Se debe ser mayor de 14 años.';
      return;
    }
    if (this.form.hasError('passwordsMismatch')) {
      this.submitError = 'Registro fallido - Las contraseñas no coinciden.';
      return;
    }
    if (this.form.invalid) return;

    this.isSubmitting = true;

    const req: RegisterRequest = {
      nombre: this.form.controls.nombre.value.trim(),
      apellido: this.form.controls.apellido.value.trim(),
      dni: this.form.controls.dni.value.trim(),
      email: this.form.controls.email.value.trim(),
      genero: this.form.controls.genero.value,
      fechaNacimiento: this.form.controls.fechaNacimiento.value,
      telefono: this.form.controls.telefono.value.trim(),
      fichaMedica: this.fichaMedicaEncoded ?? undefined,
      password: this.form.controls.password.value,
      confirmPassword: this.form.controls.confirmPassword.value,
    };

    this.auth.register(req).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.successMessage =
          'Se ha enviado un enlace de confirmación a su casilla de email. Tiene 48hs para confirmar su registro.';
      },
      error: (err) => {
        this.isSubmitting = false;
        this.submitError = this.mapRegisterError(err?.error?.message ?? '');
      },
    });
  }

  private mapRegisterError(msg: string): string {
    const lower = (msg ?? '').toLowerCase();
    if (lower.includes('email') && (lower.includes('registrado') || lower.includes('uso'))) {
      return 'Registro fallido - El email ya se encuentra registrado.';
    }
    if (lower.includes('contraseña') && lower.includes('8')) {
      return 'Registro fallido - La contraseña debe tener al menos 8 caracteres.';
    }
    if (lower.includes('14') || lower.includes('mayor de edad') || lower.includes('menor')) {
      return 'Registro fallido - Se debe ser mayor de 14 años.';
    }
    if (lower.includes('coinciden')) {
      return 'Registro fallido - Las contraseñas no coinciden.';
    }
    return msg || 'No se pudo registrar. Verificá los datos.';
  }

  onFichaMedicaSelected(event: Event): void {
    this.submitError = '';
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.form.controls.fichaMedicaFile.setValue(file);
    this.form.controls.fichaMedicaFile.markAsTouched();

    this.fichaMedicaFileName = file?.name ?? '';
    this.fichaMedicaEncoded = null;

    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      // Guardamos como DataURL para no tocar el back (string).
      this.fichaMedicaEncoded = result || null;
    };
    reader.readAsDataURL(file);
  }

  isUnder14(): boolean {
    const fecha = this.form.controls.fechaNacimiento.value;
    if (!fecha) return false;
    const hoy = new Date();
    const nacimiento = new Date(fecha);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
    return edad <= 14;
  }

  get maxFechaNacimiento(): string {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 14);
    return d.toISOString().split('T')[0];
  }

  private static passwordsMatchValidator(group: AbstractControl) {
    const password = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    if (!password || !confirm) return null;
    return password === confirm ? null : { passwordsMismatch: true };
  }
}

