import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  ComprobantePago,
  PagoListado,
  PagoService,
} from '../../services/pago.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-pagos-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './pagos-list.component.html',
  styleUrl: './pagos-list.component.css',
})
export class PagosListComponent implements OnInit {
  private readonly pagoService = inject(PagoService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  pagos: PagoListado[] = [];
  isLoading = false;
  errorMsg = '';
  emptyMsg = '';

  filtros = this.fb.nonNullable.group({
    cliente_email: [''],
    desde: [''],
    hasta: [''],
  });

  showModalComprobante = false;
  modalError = '';

  comprobante: ComprobantePago | null = null;
  comprobanteLoading = false;

  ngOnInit(): void {
    this.cargarPagos();
  }

  get isAdministrativo(): boolean {
    return this.authService.isAdministrativo();
  }

  cargarPagos(): void {
    this.isLoading = true;
    this.errorMsg = '';
    this.emptyMsg = '';

    const f = this.filtros.getRawValue();
    this.pagoService
      .getAll({
        cliente_email: f.cliente_email.trim() || undefined,
        desde: f.desde || undefined,
        hasta: f.hasta || undefined,
      })
      .subscribe({
        next: (data) => {
          this.pagos = data ?? [];
          if (this.pagos.length === 0) {
            this.emptyMsg = 'No se han encontrado pagos';
          }
          this.isLoading = false;
        },
        error: () => {
          this.errorMsg = '';
          this.emptyMsg = 'No se han encontrado pagos';
          this.pagos = [];
          this.isLoading = false;
        },
      });
  }

  onFiltrar(): void {
    this.cargarPagos();
  }

  limpiarFiltros(): void {
    this.filtros.reset();
    this.cargarPagos();
  }

  abrirComprobante(pago: PagoListado): void {
    this.comprobante = null;
    this.comprobanteLoading = true;
    this.showModalComprobante = true;
    this.modalError = '';

    this.pagoService.getComprobante(pago.id).subscribe({
      next: (data) => {
        this.comprobante = data;
        this.comprobanteLoading = false;
      },
      error: (err) => {
        this.modalError = this.pagoService.mensajeError(err);
        this.comprobanteLoading = false;
      },
    });
  }

  cerrarComprobante(): void {
    this.showModalComprobante = false;
    this.comprobante = null;
  }

  imprimirComprobante(): void {
    window.print();
  }

  clienteNombre(p: PagoListado): string {
    const u = p.cliente?.usuario;
    if (!u) return p.cliente_email;
    return `${u.nombre} ${u.apellido}`;
  }

  formatMonto(monto: number | string): string {
    return `$${Number(monto).toLocaleString('es-AR')}`;
  }

  formatFecha(fecha: string): string {
    return new Date(fecha).toLocaleString('es-AR');
  }

  metodoLabel = (m: PagoListado['metodo']) => this.pagoService.metodoLabel(m);
  estadoLabel = (e: PagoListado['estado']) => this.pagoService.estadoLabel(e);
}
