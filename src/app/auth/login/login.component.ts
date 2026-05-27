import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)],
    }),
  });

  isSubmitting = false;
  submitError = '';

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router
  ) {}

  onSubmit(): void {
    this.submitError = '';
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const email = this.form.controls.email.value.trim();
    const password = this.form.controls.password.value;

    this.isSubmitting = true;

    this.auth.login({ email, password }).subscribe({
      next: () => {
        this.isSubmitting = false;
        const destino = this.auth.isAdministrativo() ? '/administrativo' : '/clases';
        void this.router.navigateByUrl(destino);
      },
      error: (err) => {
        this.isSubmitting = false;
        const msg = err?.error?.message?.toLowerCase() || '';
        if (msg.includes('confirm')) {
          this.submitError = 'La cuenta aún no fue confirmada. Revisá tu casilla de email para activar el registro.';
        } else {
          this.submitError = 'Datos de inicio de sesión incorrectos';
        }
      },
    });
  }
}

