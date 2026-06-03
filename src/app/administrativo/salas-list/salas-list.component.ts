import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Sala, SalaDetalle, estadoSalaLabel } from '../../models/sala.model';
import { SalasService } from '../../services/salas.service';
import { AuthService } from '../../services/auth.service';

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

  salas: Sala[] = [];
  isLoading = false;
  errorMsg = '';

  bannerSuccess = '';
  bannerError = '';

  showModalAgregar = false;
  showModalModificar = false;
  showModalVer = false;
  showModalDeshabilitar = false;
  showModalEliminar = false;

  selectedSala: Sala | null = null;
  salaDetalle: SalaDetalle | null = null;
  detalleLoading = false;

  modalError = '';
  modalSubmitting = false;

  readonly estadoSalaLabel = estadoSalaLabel;

  formSala = this.fb.nonNullable.group({
    identificador: ['', [Validators.required, Validators.maxLength(50)]],
    cupo: [10, [Validators.required, Validators.min(10)]],
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

  private clearBanners(): void {
    this.bannerSuccess = '';
    this.bannerError = '';
  }

  private clearModalState(): void {
    this.modalError = '';
    this.modalSubmitting = false;
  }

  onAgregar(): void {
    this.clearBanners();
    this.clearModalState();
    this.selectedSala = null;
    this.formSala.reset({ identificador: '', cupo: 10 });
    this.showModalAgregar = true;
  }

  onModificar(sala: Sala): void {
    this.clearBanners();
    this.clearModalState();
    this.selectedSala = sala;
    this.formSala.reset({
      identificador: sala.identificador,
      cupo: sala.cupo,
    });
    this.showModalModificar = true;
  }

  onVerSala(sala: Sala): void {
    this.clearBanners();
    this.clearModalState();
    this.selectedSala = sala;
    this.salaDetalle = null;
    this.detalleLoading = true;
    this.showModalVer = true;

    this.salasService.getById(sala.id).subscribe({
      next: (detalle) => {
        this.salaDetalle = detalle;
        this.detalleLoading = false;
      },
      error: (err) => {
        this.modalError = this.salasService.mensajeError(err);
        this.detalleLoading = false;
      },
    });
  }

  onDeshabilitar(sala: Sala): void {
    this.clearBanners();
    this.clearModalState();
    this.selectedSala = sala;
    this.showModalDeshabilitar = true;
  }

  onEliminar(sala: Sala): void {
    this.clearBanners();
    this.clearModalState();
    this.selectedSala = sala;
    this.showModalEliminar = true;
  }

  cerrarModales(): void {
    this.showModalAgregar = false;
    this.showModalModificar = false;
    this.showModalVer = false;
    this.showModalDeshabilitar = false;
    this.showModalEliminar = false;
    this.selectedSala = null;
    this.salaDetalle = null;
    this.modalError = '';
  }

  onSubmitAgregar(): void {
    if (this.formSala.invalid) {
      this.formSala.markAllAsTouched();
      return;
    }

    this.modalSubmitting = true;
    this.modalError = '';
    const { identificador, cupo } = this.formSala.getRawValue();

    this.salasService.create({ identificador: identificador.trim(), cupo }).subscribe({
      next: (res) => {
        this.bannerSuccess = res.message;
        this.cerrarModales();
        this.cargarSalas();
      },
      error: (err) => {
        this.modalError = this.salasService.mensajeError(err);
        this.modalSubmitting = false;
      },
    });
  }

  onSubmitModificar(): void {
    if (!this.selectedSala || this.formSala.invalid) {
      this.formSala.markAllAsTouched();
      return;
    }

    this.modalSubmitting = true;
    this.modalError = '';
    const { identificador, cupo } = this.formSala.getRawValue();

    this.salasService
      .update(this.selectedSala.id, { identificador: identificador.trim(), cupo })
      .subscribe({
        next: (res) => {
          this.bannerSuccess = res.message;
          this.cerrarModales();
          this.cargarSalas();
        },
        error: (err) => {
          this.modalError = this.salasService.mensajeError(err);
          this.modalSubmitting = false;
        },
      });
  }

  onConfirmarDeshabilitar(): void {
    if (!this.selectedSala) return;

    this.modalSubmitting = true;
    this.modalError = '';

    this.salasService.deshabilitar(this.selectedSala.id).subscribe({
      next: (res) => {
        this.bannerSuccess = res.message;
        this.cerrarModales();
        this.cargarSalas();
      },
      error: (err) => {
        this.modalError = this.salasService.mensajeError(err);
        this.modalSubmitting = false;
      },
    });
  }

  onConfirmarEliminar(): void {
    if (!this.selectedSala) return;

    this.modalSubmitting = true;
    this.modalError = '';

    this.salasService.delete(this.selectedSala.id).subscribe({
      next: (res) => {
        this.bannerSuccess = res.message;
        this.cerrarModales();
        this.cargarSalas();
      },
      error: (err) => {
        this.modalError = this.salasService.mensajeError(err);
        this.modalSubmitting = false;
      },
    });
  }

  formatHora(hora: string): string {
    return hora?.slice(0, 5) ?? '';
  }
}
