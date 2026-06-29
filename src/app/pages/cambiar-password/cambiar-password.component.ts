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

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-cambiar-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './cambiar-password.component.html',
  styleUrl: './cambiar-password.component.css',
})
export class CambiarPasswordComponent {
  readonly form = new FormGroup(
    {
      passwordActual: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      passwordNueva: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(8)],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: [CambiarPasswordComponent.passwordsMatchValidator] }
  );

  isSubmitting = false;
  submitted = false;
  submitError = '';
  successMessage = '';

  constructor(private readonly auth: AuthService) {}

  onSubmit(): void {
    this.submitted = true;
    this.submitError = '';
    this.successMessage = '';

    if (this.form.invalid) return;

    const { passwordActual, passwordNueva, confirmPassword } = this.form.controls;

    if (passwordActual.value === passwordNueva.value) {
      this.submitError = 'La nueva contraseña debe ser distinta a la actual';
      return;
    }

    this.isSubmitting = true;

    this.auth
      .cambiarPassword(passwordActual.value, passwordNueva.value, confirmPassword.value)
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.successMessage = 'Contraseña modificada con éxito';
          this.form.reset();
        },
        error: (err) => {
          this.isSubmitting = false;
          this.submitError = this.mapErrorMessage(err?.error?.message ?? '');
        },
      });
  }

  /**
   * El back devuelve textos descriptivos. Acá los mapeamos a los strings EXACTOS
   * pedidos por los escenarios de la HU "Cambiar contraseña".
   */
  private mapErrorMessage(msg: string): string {
    const lower = msg.toLowerCase();
    if (lower.includes('actual') && lower.includes('incorrecta')) {
      return 'La contraseña actual es incorrecta';
    }
    if (
      (lower.includes('distinta') || lower.includes('igual') || lower.includes('misma')) &&
      lower.includes('actual')
    ) {
      return 'La nueva contraseña debe ser distinta a la actual';
    }
    if (lower.includes('coinciden')) {
      return 'Las contraseñas no coinciden';
    }
    return msg || 'No se pudo actualizar la contraseña. Intentá nuevamente.';
  }

  private static passwordsMatchValidator(group: AbstractControl) {
    const nueva = group.get('passwordNueva')?.value;
    const confirm = group.get('confirmPassword')?.value;
    if (!nueva || !confirm) return null;
    return nueva === confirm ? null : { passwordsMismatch: true };
  }
}
