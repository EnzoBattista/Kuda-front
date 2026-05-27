import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Actividad, ProfesorActividad } from '../../models/actividad.model';
import { ActividadesService } from '../../services/actividades.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-actividades-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './actividades-list.component.html',
  styleUrl: './actividades-list.component.css',
})
export class ActividadesListComponent implements OnInit {
  private readonly actividadesService = inject(ActividadesService);
  private readonly authService = inject(AuthService);

  actividades: Actividad[] = [];
  isLoading = false;
  errorMsg = '';

  bannerSuccess = '';
  bannerError = '';

  showModalAgregar = false;
  showModalModificar = false;
  showModalPrecio = false;
  showModalEliminar = false;
  showModalProfesores = false;

  selectedActividad: Actividad | null = null;
  modalError = '';
  modalSubmitting = false;

  formNombre = '';
  formDescripcion = '';
  formPrecio: number | null = null;

  profesores: ProfesorActividad[] = [];
  profesoresLoading = false;
  profesoresEmptyHu = false;

  readonly precioHuError = 'El precio debe ser mayor a cero';

  ngOnInit(): void {
    this.cargarActividades();
  }

  get isAdministrativo(): boolean {
    return this.authService.isAdministrativo();
  }

  cargarActividades(): void {
    this.isLoading = true;
    this.errorMsg = '';
    /** Solo vigentes: el back da de baja con activa=false y sin ?activa=true devuelve también inactivas. */
    this.actividadesService.getActivas().subscribe({
      next: (data) => {
        this.actividades = data ?? [];
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMsg = err?.message ?? 'No se pudieron cargar las actividades.';
        this.actividades = [];
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
    this.selectedActividad = null;
    this.formNombre = '';
    this.formDescripcion = '';
    this.formPrecio = null;
    this.profesores = [];
    this.profesoresLoading = false;
    this.profesoresEmptyHu = false;
  }

  cerrarTodosModales(): void {
    this.showModalAgregar = false;
    this.showModalModificar = false;
    this.showModalPrecio = false;
    this.showModalEliminar = false;
    this.showModalProfesores = false;
    this.clearModalState();
  }

  onAgregar(): void {
    this.clearBanners();
    this.clearModalState();
    this.showModalAgregar = true;
  }

  cerrarModalAgregar(): void {
    this.showModalAgregar = false;
    this.modalError = '';
    this.modalSubmitting = false;
    this.formNombre = '';
    this.formDescripcion = '';
  }

  submitAgregar(): void {
    const nombre = this.formNombre.trim();
    if (!nombre) {
      this.modalError = 'El nombre de la actividad no puede estar vacío';
      return;
    }

    this.modalSubmitting = true;
    this.modalError = '';
    this.actividadesService
      .create({
        nombre,
        descripcion: this.formDescripcion.trim() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.bannerSuccess = res.message;
          this.cerrarModalAgregar();
          this.cargarActividades();
        },
        error: (err) => {
          this.modalError = err?.message ?? 'Ocurrió un error inesperado';
          this.modalSubmitting = false;
        },
      });
  }

  onModificar(actividad: Actividad): void {
    this.clearBanners();
    this.clearModalState();
    this.selectedActividad = actividad;
    this.formNombre = actividad.nombre;
    this.formDescripcion = actividad.descripcion ?? '';
    this.showModalModificar = true;
  }

  cerrarModalModificar(): void {
    this.showModalModificar = false;
    this.selectedActividad = null;
    this.modalError = '';
    this.modalSubmitting = false;
  }

  submitModificar(): void {
    if (!this.selectedActividad) {
      return;
    }

    const nombre = this.formNombre.trim();
    if (!nombre) {
      this.modalError = 'El nombre de la actividad no puede estar vacío';
      return;
    }

    this.modalSubmitting = true;
    this.modalError = '';
    this.actividadesService
      .update(this.selectedActividad.id, {
        nombre,
        descripcion: this.formDescripcion.trim() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.bannerSuccess = res.message;
          this.cerrarModalModificar();
          this.cargarActividades();
        },
        error: (err) => {
          this.modalError = err?.message ?? 'Ocurrió un error inesperado';
          this.modalSubmitting = false;
        },
      });
  }

  onModificarPrecio(actividad: Actividad): void {
    this.clearBanners();
    this.clearModalState();
    this.selectedActividad = actividad;
    this.formPrecio = actividad.precio;
    this.showModalPrecio = true;
  }

  cerrarModalPrecio(): void {
    this.showModalPrecio = false;
    this.selectedActividad = null;
    this.modalError = '';
    this.modalSubmitting = false;
    this.formPrecio = null;
  }

  submitPrecio(): void {
    if (!this.selectedActividad) {
      return;
    }

    const precio = this.formPrecio;

    if (precio === null || isNaN(precio) || precio <= 0) {
      this.modalError = this.precioHuError;
      return;
    }

    this.modalSubmitting = true;
    this.modalError = '';
    this.actividadesService
      .updatePrecio(this.selectedActividad.id, Number(this.formPrecio))
      .subscribe({
        next: (res) => {
          this.bannerSuccess = res.message;
          this.cerrarModalPrecio();
          this.cargarActividades();
        },
        error: (err) => {
          this.modalError = err?.message ?? 'Ocurrió un error inesperado';
          this.modalSubmitting = false;
        },
      });
  }

  onEliminar(actividad: Actividad): void {
    this.clearBanners();
    this.clearModalState();
    this.selectedActividad = actividad;
    this.showModalEliminar = true;
  }

  cerrarModalEliminar(): void {
    this.showModalEliminar = false;
    this.selectedActividad = null;
    this.modalError = '';
    this.modalSubmitting = false;
  }

  submitEliminar(): void {
    if (!this.selectedActividad) {
      return;
    }

    this.modalSubmitting = true;
    this.modalError = '';
    const idEliminado = this.selectedActividad.id;
    this.actividadesService.delete(idEliminado).subscribe({
      next: (res) => {
        this.actividades = this.actividades.filter((a) => a.id !== idEliminado);
        this.bannerSuccess = res.message;
        this.cerrarModalEliminar();
        this.cargarActividades();
      },
      error: (err) => {
        this.bannerError = err?.message ?? 'Ocurrió un error inesperado';
        this.cerrarModalEliminar();
        this.cargarActividades();
      },
    });
  }

  onVerProfesores(actividad: Actividad): void {
    this.clearBanners();
    this.clearModalState();
    this.selectedActividad = actividad;
    this.showModalProfesores = true;
    this.profesoresLoading = true;
    this.modalError = '';

    this.actividadesService.getProfesores(actividad.id).subscribe({
      next: (data) => {
        this.profesores = data ?? [];
        this.profesoresEmptyHu = this.profesores.length === 0;
        this.profesoresLoading = false;
      },
      error: (err) => {
        this.modalError = err?.message ?? 'Ocurrió un error inesperado';
        this.profesoresLoading = false;
      },
    });
  }

  cerrarModalProfesores(): void {
    this.showModalProfesores = false;
    this.clearModalState();
  }

  formatPrecio(precio: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(precio);
  }

  nombreProfesor(p: ProfesorActividad): string {
    return `${p.nombre} ${p.apellido}`.trim();
  }
}
