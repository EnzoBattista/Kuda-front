import {
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Html5Qrcode } from 'html5-qrcode';
import {
  AsistenciasService,
  EscanearQrResponse,
} from '../../services/asistencias.service';

@Component({
  selector: 'app-escanear-qr',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './escanear-qr.component.html',
  styleUrl: './escanear-qr.component.css',
})
export class EscanearQrComponent implements OnInit, OnDestroy {
  private readonly asistenciasService = inject(AsistenciasService);

  private scanner: Html5Qrcode | null = null;
  readonly scannerId = 'qr-reader';

  escaneando = false;
  errorMsg = '';
  successMsg = '';

  escaneoData: EscanearQrResponse | null = null;
  showModalValidacion = false;
  motivoDenegado = 'Identidad no coincide';

  modalError = '';
  modalSubmitting = false;

  ngOnInit(): void {
    void this.iniciarCamara();
  }

  ngOnDestroy(): void {
    void this.detenerCamara();
  }

  async iniciarCamara(): Promise<void> {
    this.errorMsg = '';
    try {
      this.scanner = new Html5Qrcode(this.scannerId);
      await this.scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded) => void this.onQrLeido(decoded),
        () => {},
      );
      this.escaneando = true;
    } catch {
      this.errorMsg =
        'No se pudo acceder a la cámara. Verificá permisos del navegador o usá asistencia manual.';
      this.escaneando = false;
    }
  }

  async detenerCamara(): Promise<void> {
    if (this.scanner?.isScanning) {
      await this.scanner.stop();
    }
    this.scanner?.clear();
    this.scanner = null;
    this.escaneando = false;
  }

  private async onQrLeido(token: string): Promise<void> {
    if (this.modalSubmitting || this.showModalValidacion) return;

    await this.detenerCamara();
    this.errorMsg = '';
    this.successMsg = '';

    this.asistenciasService.escanearQr(token.trim()).subscribe({
      next: (data) => {
        this.escaneoData = data;
        this.showModalValidacion = true;
        this.modalError = '';
      },
      error: (err) => {
        this.errorMsg = this.asistenciasService.mensajeError(err);
        void this.iniciarCamara();
      },
    });
  }

  cerrarModal(): void {
    this.showModalValidacion = false;
    this.escaneoData = null;
    this.modalError = '';
    this.motivoDenegado = 'Identidad no coincide';
    void this.iniciarCamara();
  }

  confirmarIngreso(): void {
    if (!this.escaneoData) return;
    this.registrar('PRESENTE');
  }

  denegarAcceso(): void {
    if (!this.escaneoData) return;
    if (!this.motivoDenegado.trim()) {
      this.modalError = 'Ingresá un motivo para denegar el acceso.';
      return;
    }
    this.registrar('DENEGADO', this.motivoDenegado.trim());
  }

  private registrar(estado: 'PRESENTE' | 'DENEGADO', motivo?: string): void {
    if (!this.escaneoData) return;

    this.modalSubmitting = true;
    this.modalError = '';

    this.asistenciasService
      .registrar({
        reserva_id: this.escaneoData.reserva_id,
        email: this.escaneoData.cliente.email,
        clase_id: this.escaneoData.clase.id,
        estado,
        motivo_denegado: motivo,
      })
      .subscribe({
        next: (res) => {
          this.successMsg = res.message;
          this.showModalValidacion = false;
          this.escaneoData = null;
          this.modalSubmitting = false;
          void this.iniciarCamara();
        },
        error: (err) => {
          this.modalError = this.asistenciasService.mensajeError(err);
          this.modalSubmitting = false;
        },
      });
  }
}
