import {
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Html5Qrcode } from 'html5-qrcode';
import {
  AsistenciasService,
  EscanearQrResponse,
} from '../../services/asistencias.service';

@Component({
  selector: 'app-escanear-qr',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './escanear-qr.component.html',
  styleUrl: './escanear-qr.component.css',
})
export class EscanearQrComponent implements OnInit, OnDestroy {
  private readonly asistenciasService = inject(AsistenciasService);

  private scanner: Html5Qrcode | null = null;
  readonly scannerId = 'qr-reader';

  escaneando = false;
  iniciandoCamara = false;
  errorMsg = '';
  successMsg = '';

  escaneoData: EscanearQrResponse | null = null;
  showModalValidacion = false;
  motivoDenegado = 'Identidad no coincide';

  modalError = '';
  modalSubmitting = false;

  readonly httpsCeluPort = 4201;

  get requiereHttpsEnCelu(): boolean {
    return typeof window !== 'undefined' && !window.isSecureContext;
  }

  get urlEscaneoHttps(): string {
    if (typeof window === 'undefined') return '';
    const host = window.location.hostname;
    return `https://${host}:${this.httpsCeluPort}/administrativo/escanear-qr`;
  }

  get esDispositivoMovil(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  ngOnInit(): void {
    if (this.requiereHttpsEnCelu) {
      this.errorMsg =
        'Estás en HTTP. En iPhone Safari la cámara solo funciona con HTTPS (puerto 4201).';
    }
  }

  abrirVersionHttps(): void {
    if (typeof window !== 'undefined') {
      window.location.href = this.urlEscaneoHttps;
    }
  }

  /** iOS exige un toque del usuario antes de abrir la cámara. */
  activarCamara(): void {
    if (this.requiereHttpsEnCelu) {
      this.abrirVersionHttps();
      return;
    }
    void this.iniciarCamara();
  }

  reintentarCamara(): void {
    this.activarCamara();
  }

  ngOnDestroy(): void {
    void this.detenerCamara();
  }

  private configEscaneo() {
    return {
      fps: 10,
      qrbox: (w: number, h: number) => {
        const edge = Math.min(w, h);
        const size = Math.max(180, Math.floor(edge * 0.65));
        return { width: size, height: size };
      },
      aspectRatio: 1.0,
    };
  }

  async iniciarCamara(): Promise<void> {
    if (this.iniciandoCamara || this.escaneando) return;

    this.errorMsg = '';
    this.iniciandoCamara = true;
    await this.detenerCamara();

    await new Promise((r) => setTimeout(r, 150));

    try {
      const host = document.getElementById(this.scannerId);
      if (!host) {
        throw new Error('Contenedor de cámara no disponible');
      }

      this.scanner = new Html5Qrcode(this.scannerId);
      const config = this.configEscaneo();
      const onScan = (decoded: string) => void this.onQrLeido(decoded);

      const intentarFacing = () =>
        this.scanner!.start({ facingMode: 'environment' }, config, onScan, () => {});

      const intentarUser = () =>
        this.scanner!.start({ facingMode: 'user' }, config, onScan, () => {});

      const intentarPorId = async () => {
        const cameras = await Html5Qrcode.getCameras();
        if (!cameras.length) throw new Error('Sin cámaras');
        const trasera =
          cameras.find((c) => /back|rear|trás|trasera|environment/i.test(c.label)) ??
          cameras[cameras.length - 1];
        await this.scanner!.start(trasera.id, config, onScan, () => {});
      };

      try {
        await intentarFacing();
      } catch {
        try {
          await intentarUser();
        } catch {
          await intentarPorId();
        }
      }

      this.escaneando = true;
    } catch (err) {
      console.error('[escanear-qr] cámara:', err);
      this.errorMsg = this.mensajeErrorCamara();
      this.escaneando = false;
    } finally {
      this.iniciandoCamara = false;
    }
  }

  private mensajeErrorCamara(): string {
    if (this.requiereHttpsEnCelu) {
      return 'Estás en HTTP. Usá https en el puerto 4201.';
    }
    if (this.esDispositivoMovil) {
      return (
        'Safari no abrió la cámara. Tocá otra vez «Activar cámara», cerrá otras pestañas que la usen, ' +
        'recargá la página y verificá Ajustes → Safari → Cámara → Preguntar. ' +
        'Si persiste, usá Asistencia manual.'
      );
    }
    return 'No se pudo acceder a la cámara. Revisá permisos del navegador o usá Asistencia manual.';
  }

  async detenerCamara(): Promise<void> {
    if (this.scanner?.isScanning) {
      try {
        await this.scanner.stop();
      } catch {
        /* ignore */
      }
    }
    try {
      this.scanner?.clear();
    } catch {
      /* ignore */
    }
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
      },
    });
  }

  cerrarModal(): void {
    this.showModalValidacion = false;
    this.escaneoData = null;
    this.modalError = '';
    this.motivoDenegado = 'Identidad no coincide';
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
        },
        error: (err) => {
          this.modalError = this.asistenciasService.mensajeError(err);
          this.modalSubmitting = false;
        },
      });
  }
}
