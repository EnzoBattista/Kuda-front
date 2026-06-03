import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QRCodeComponent } from 'angularx-qrcode';
import {
  AsistenciasService,
  QrGeneradoResponse,
} from '../../services/asistencias.service';

@Component({
  selector: 'app-mi-qr',
  standalone: true,
  imports: [CommonModule, QRCodeComponent],
  templateUrl: './mi-qr.component.html',
  styleUrl: './mi-qr.component.css',
})
export class MiQrComponent implements OnInit {
  private readonly asistenciasService = inject(AsistenciasService);

  loading = false;
  errorMsg = '';
  qrData: QrGeneradoResponse | null = null;

  ngOnInit(): void {
    this.generarQr();
  }

  generarQr(): void {
    this.loading = true;
    this.errorMsg = '';
    this.qrData = null;

    this.asistenciasService.generarMiQr().subscribe({
      next: (data) => {
        this.qrData = data;
        this.loading = false;
      },
      error: (err) => {
        this.errorMsg = this.asistenciasService.mensajeError(err);
        this.loading = false;
      },
    });
  }
}
