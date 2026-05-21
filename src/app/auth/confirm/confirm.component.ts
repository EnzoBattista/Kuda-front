import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-confirm',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './confirm.component.html',
  styleUrl: './confirm.component.css',
})
export class ConfirmComponent implements OnInit {
  token: string | null = null;
  tokenAusente = false;

  isSubmitting = false;
  confirmado = false;
  successMessage = '';
  errorMessage = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token');
    if (!this.token) {
      this.tokenAusente = true;
      this.errorMessage = 'El enlace de confirmación es inválido';
    }
  }

  onConfirmar(): void {
    if (!this.token || this.isSubmitting || this.confirmado) return;

    this.isSubmitting = true;
    this.errorMessage = '';

    this.auth.confirmarCuenta(this.token).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.confirmado = true;
        this.successMessage = 'Usted ha sido registrado correctamente';
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = this.mapConfirmError(err?.error?.message ?? '');
      },
    });
  }

  private mapConfirmError(msg: string): string {
    const lower = (msg ?? '').toLowerCase();
    if (lower.includes('expir')) {
      return 'El enlace de confirmación ha expirado';
    }
    if (lower.includes('inválido') || lower.includes('invalido') || lower.includes('no existe')) {
      return 'El enlace de confirmación es inválido';
    }
    return msg || 'El enlace de confirmación es inválido';
  }
}
