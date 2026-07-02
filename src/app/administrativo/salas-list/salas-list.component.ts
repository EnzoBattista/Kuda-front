import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Sala, estadoSalaLabel } from '../../models/sala.model';
import { SalasService } from '../../services/salas.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-salas-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './salas-list.component.html',
  styleUrl: './salas-list.component.css',
})
export class SalasListComponent implements OnInit {
  private readonly salasService = inject(SalasService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly toastService = inject(ToastService);

  salas: Sala[] = [];
  isLoading = false;
  errorMsg = '';

  showModalAgregar = false;
  showModalModificar = false;
  showModalHabilitar = false;
  showModalDeshabilitar = false;
  showModalEliminar = false;

  selectedSala: Sala | null = null;

  modalError = '';
  modalSubmitting = false;

  readonly estadoSalaLabel = estadoSalaLabel;

  // Solo "required": el botón se bloquea hasta completar los campos, pero la
  // validación del cupo mínimo NO bloquea el botón para poder mostrar el
  // mensaje del Escenario 3 al presionar Agregar.
  formSala = this.fb.group({
    identificador: this.fb.nonNullable.control('', [Validators.required]),
    cupo: this.fb.control<number | null>(null, [Validators.required]),
  });

  ngOnInit(): void {
    this.cargarSalas();
  }

  get isAdministrativo(): boolean {
    return this.authService.isAdministrativo();
  }

  cargarSalas(): void {
    this.isLoading = true;
    this.errorMsg = '';
    this.salasService.getAll().subscribe({
      next: (data) => {
        this.salas = data ?? [];
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMsg = this.salasService.mensajeError(err);
        this.salas = [];
        this.isLoading = false;
      },
    });
  }


  private clearModalState(): void {
    this.modalError = '';
    this.modalSubmitting = false;
  }

  onAgregar(): void {
    this.clearModalState();
    this.selectedSala = null;
    this.formSala.reset({ identificador: '', cupo: null });
    this.showModalAgregar = true;
  }

  onModificar(sala: Sala): void {
    this.clearModalState();
    this.selectedSala = sala;
    this.formSala.reset({
      identificador: sala.identificador,
      cupo: sala.cupo,
    });
    this.showModalModificar = true;
  }

  onHabilitar(sala: Sala): void {
    this.clearModalState();
    this.selectedSala = sala;
    this.showModalHabilitar = true;
  }

  onDeshabilitar(sala: Sala): void {
    this.clearModalState();
    this.selectedSala = sala;
    this.showModalDeshabilitar = true;
  }

  onEliminar(sala: Sala): void {
    this.clearModalState();
    this.selectedSala = sala;
    this.showModalEliminar = true;
  }

  cerrarModales(): void {
    this.showModalAgregar = false;
    this.showModalModificar = false;
    this.showModalHabilitar = false;
    this.showModalDeshabilitar = false;
    this.showModalEliminar = false;
    this.selectedSala = null;
    this.modalError = '';
    this.modalSubmitting = false;
  }

  onSubmitAgregar(): void {
    if (this.formSala.invalid) {
      this.formSala.markAllAsTouched();
      return;
    }

    const { identificador, cupo } = this.formSala.getRawValue();
    const cupoNum = Number(cupo);

    // Escenario 3: cupo inválido. No se llama al backend; se muestra el mensaje.
    if (cupoNum < 10) {
      this.toastService.showError('El cupo debe ser mayor o igual a 10.');
      return;
    }

    this.modalSubmitting = true;
    this.modalError = '';

    this.salasService.create({ identificador: (identificador ?? '').trim(), cupo: cupoNum }).subscribe({
      next: (res) => {
        this.toastService.showSuccess(res.message);
        this.cerrarModales();
        this.cargarSalas();
      },
      error: (err) => {
        this.toastService.showError(this.salasService.mensajeError(err));
        this.modalSubmitting = false;
      },
    });
  }

  onSubmitModificar(): void {
    if (!this.selectedSala || this.modalSubmitting) return;

    const { identificador, cupo } = this.formSala.getRawValue();
    const identificadorTrim = (identificador ?? '').trim();
    const cupoNum = Number(cupo);

    // Sin identificador no hay nada para validar contra la HU; no se informa nada.
    if (!identificadorTrim) return;

    // Escenario 4: cupo inválido. No se llama al backend; se muestra el mensaje.
    if (cupoNum < 10) {
      this.toastService.showError('El cupo debe ser mayor o igual a 10.');
      return;
    }

    this.modalSubmitting = true;
    this.modalError = '';

    this.salasService
      .update(this.selectedSala.id, {
        identificador: identificadorTrim,
        cupo: cupoNum,
      })
      .subscribe({
        next: (res) => {
          this.toastService.showSuccess(res.message);
          this.cerrarModales();
          this.cargarSalas();
        },
        error: (err) => {
          this.toastService.showError(this.salasService.mensajeError(err));
          this.modalSubmitting = false;
        },
      });
  }

  onConfirmarHabilitar(): void {
    if (!this.selectedSala) return;

    this.modalSubmitting = true;
    this.modalError = '';

    this.salasService.habilitar(this.selectedSala.id).subscribe({
      next: (res) => {
        this.toastService.showSuccess(res.message);
        this.cerrarModales();
        this.cargarSalas();
      },
      error: (err) => {
        this.toastService.showError(this.salasService.mensajeError(err));
        this.modalSubmitting = false;
      },
    });
  }

  onConfirmarDeshabilitar(): void {
    if (!this.selectedSala || this.modalSubmitting) return;

    this.modalSubmitting = true;

    this.salasService.deshabilitar(this.selectedSala.id).subscribe({
      next: (res) => {
        this.toastService.showSuccess(res.message);
        this.cerrarModales();
        this.cargarSalas();
      },
      error: (err) => {
        this.toastService.showError(this.salasService.mensajeError(err));
        this.cerrarModales();
      },
    });
  }

  onConfirmarEliminar(): void {
    if (!this.selectedSala || this.modalSubmitting) return;

    this.modalSubmitting = true;

    this.salasService.delete(this.selectedSala.id).subscribe({
      next: (res) => {
        this.toastService.showSuccess(res.message);
        this.cerrarModales();
        this.cargarSalas();
      },
      error: (err) => {
        this.toastService.showError(this.salasService.mensajeError(err));
        this.cerrarModales();
      },
    });
  }
}
