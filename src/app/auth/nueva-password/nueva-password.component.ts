import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-nueva-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './nueva-password.component.html',
  styleUrl: './nueva-password.component.css',
})
export class NuevaPasswordComponent implements OnInit {
  readonly form = new FormGroup(
    {
      password: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(8)],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: [NuevaPasswordComponent.passwordsMatchValidator] }
  );

  token = '';
  isSubmitting = false;
  submitError = '';
  successMessage = '';

  constructor(
    private readonly auth: AuthService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    if (!this.token) void this.router.navigateByUrl('/login');
  }

  onSubmit(): void {
    this.submitError = '';
    this.successMessage = '';
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.isSubmitting = true;
    const { password, confirmPassword } = this.form.controls;

    this.auth.nuevaPassword(this.token, password.value, confirmPassword.value).subscribe({
      next: (resp) => {
        this.isSubmitting = false;
        this.successMessage =
          resp?.message ?? 'Su contraseña ha sido restablecida con éxito';
        this.form.reset();
      },
      error: (err) => {
        this.isSubmitting = false;
        this.submitError = err?.error?.message ?? 'El enlace es inválido o expiró. Solicitá uno nuevo.';
      },
    });
  }

  private static passwordsMatchValidator(group: AbstractControl) {
    const password = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    if (!password || !confirm) return null;
    return password === confirm ? null : { passwordsMismatch: true };
  }
}
