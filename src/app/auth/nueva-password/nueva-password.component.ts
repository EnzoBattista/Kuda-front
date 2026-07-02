import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-nueva-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './nueva-password.component.html',
  styleUrl: './nueva-password.component.css',
})
export class NuevaPasswordComponent implements OnInit {
  readonly form = new FormGroup({
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  token = '';
  isSubmitting = false;

  constructor(
    private readonly auth: AuthService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly toast: ToastService
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    if (!this.token) void this.router.navigateByUrl('/login');
  }

  onSubmit(): void {
    if (this.isSubmitting) return;

    const { password, confirmPassword } = this.form.getRawValue();
    this.isSubmitting = true;

    this.auth.nuevaPassword(this.token, password, confirmPassword).subscribe({
      next: (resp) => {
        this.isSubmitting = false;
        this.toast.showSuccess(resp?.message ?? 'Su contraseña ha sido restablecida con éxito');
        this.form.reset();
        void this.router.navigateByUrl('/login');
      },
      error: (err) => {
        this.isSubmitting = false;
        this.toast.showError(err?.error?.message ?? 'El enlace de recuperación es inválido');
      },
    });
  }
}
