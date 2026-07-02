import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-cambiar-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './cambiar-password.component.html',
  styleUrl: './cambiar-password.component.css',
})
export class CambiarPasswordComponent {
  readonly form = new FormGroup({
    passwordActual: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    passwordNueva: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  isSubmitting = false;

  constructor(
    private readonly auth: AuthService,
    private readonly toast: ToastService
  ) {}

  onSubmit(): void {
    if (this.isSubmitting) return;

    const { passwordActual, passwordNueva, confirmPassword } = this.form.getRawValue();

    this.isSubmitting = true;

    this.auth.cambiarPassword(passwordActual, passwordNueva, confirmPassword).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.toast.showSuccess(res.message ?? 'Contraseña modificada con éxito');
        this.form.reset();
      },
      error: (err) => {
        this.isSubmitting = false;
        this.toast.showError(
          err?.error?.message ?? 'No se pudo actualizar la contraseña. Intentá nuevamente.'
        );
      },
    });
  }
}
