import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthService, RegisterRequest } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
})
export class RegisterComponent {
  isSubmitting = false;

  readonly form = new FormGroup({
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    apellido: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    dni: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    genero: new FormControl<'femenino' | 'masculino' | 'otro'>('otro', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    fechaNacimiento: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    telefono: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    fichaMedicaFile: new FormControl<File | null>(null, { validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  fichaMedicaFileName = '';
  fichaMedicaEncoded: string | null = null;

  constructor(
    private readonly auth: AuthService,
    private readonly toast: ToastService
  ) {}

  onSubmit(): void {
    if (this.isSubmitting) return;

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
        this.toast.showSuccess(
          'Se ha enviado un enlace de confirmación a su casilla de email. Tiene 48hs para confirmar su registro.'
        );
      },
      error: (err) => {
        this.isSubmitting = false;
        this.toast.showError(err?.error?.message ?? 'No se pudo registrar. Verificá los datos.');
      },
    });
  }

  onFichaMedicaSelected(event: Event): void {
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
}
