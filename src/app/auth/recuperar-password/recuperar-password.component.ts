import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-recuperar-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './recuperar-password.component.html',
  styleUrl: './recuperar-password.component.css',
})
export class RecuperarPasswordComponent {
  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });

  isSubmitting = false;
  submitError = '';
  successMessage = '';

  constructor(private readonly auth: AuthService) {}

  onSubmit(): void {
    this.submitError = '';
    this.successMessage = '';
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.isSubmitting = true;
    this.auth.recuperarPassword(this.form.controls.email.value.trim()).subscribe({
      next: (resp) => {
        this.isSubmitting = false;
        this.successMessage =
          resp?.message ?? 'Se ha enviado un enlace de recuperación a su email';
        this.form.reset();
      },
      error: (err) => {
        this.isSubmitting = false;
        this.submitError = err?.error?.message ?? 'No se pudo procesar la solicitud. Intentá nuevamente.';
      },
    });
  }
}
