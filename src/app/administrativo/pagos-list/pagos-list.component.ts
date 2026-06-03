import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
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
  bannerSuccess = '';

  filtros = this.fb.nonNullable.group({
    cliente_email: [''],
    desde: [''],
    hasta: [''],
  });

  showModalRegistrar = false;
  showModalComprobante = false;
  modalError = '';
  modalSubmitting = false;

  comprobante: ComprobantePago | null = null;
  comprobanteLoading = false;

  formRegistrar = this.fb.nonNullable.group({
    cliente_email: ['', [Validators.required, Validators.email]],
    monto: [0, [Validators.required, Validators.min(0.01)]],
    concepto: ['', Validators.required],
    metodo: ['EFECTIVO' as 'EFECTIVO' | 'TRANSFERENCIA', Validators.required],
  });

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
        error: (err) => {
          this.errorMsg = this.pagoService.mensajeError(err);
          this.pagos = [];
          this.isLoading = false;
        },
      });
  }

  onFiltrar(): void {
    this.cargarPagos();
  }

  abrirRegistrar(): void {
    this.modalError = '';
    this.formRegistrar.reset({
      cliente_email: '',
      monto: 0,
      concepto: '',
      metodo: 'EFECTIVO',
    });
    this.showModalRegistrar = true;
  }

  cerrarRegistrar(): void {
    this.showModalRegistrar = false;
    this.modalError = '';
  }

  onRegistrar(): void {
    if (this.formRegistrar.invalid) {
      this.formRegistrar.markAllAsTouched();
      return;
    }

    this.modalSubmitting = true;
    this.modalError = '';
    const v = this.formRegistrar.getRawValue();

    this.pagoService
      .registrar({
        cliente_email: v.cliente_email.trim(),
        monto: Number(v.monto),
        concepto: v.concepto.trim(),
        metodo: v.metodo,
        origen: 'MANUAL',
      })
      .subscribe({
        next: (res) => {
          this.bannerSuccess = res.message;
          this.cerrarRegistrar();
          this.cargarPagos();
          this.modalSubmitting = false;
        },
        error: (err) => {
          this.modalError = this.pagoService.mensajeError(err);
          this.modalSubmitting = false;
        },
      });
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
