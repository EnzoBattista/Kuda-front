import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QRCodeComponent } from 'angularx-qrcode';
import {
  AsistenciasService,
  QrGeneradoResponse,
} from '../../services/asistencias.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-mi-qr',
  standalone: true,
  imports: [CommonModule, QRCodeComponent],
  templateUrl: './mi-qr.component.html',
  styleUrl: './mi-qr.component.css',
})
export class MiQrComponent {
  private readonly asistenciasService = inject(AsistenciasService);
  private readonly toastService = inject(ToastService);

  loading = false;
  qrData: QrGeneradoResponse | null = null;

  generarQr(): void {
    this.loading = true;
    this.qrData = null;

    this.asistenciasService.generarMiQr().subscribe({
      next: (data) => {
        this.qrData = data;
        this.loading = false;
      },
      error: (err) => {
        this.toastService.showError(this.asistenciasService.mensajeError(err));
        this.loading = false;
      },
    });
  }
}
