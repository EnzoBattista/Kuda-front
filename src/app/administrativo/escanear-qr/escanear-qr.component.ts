import {
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Html5Qrcode } from 'html5-qrcode';
import { AsistenciasService } from '../../services/asistencias.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-escanear-qr',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './escanear-qr.component.html',
  styleUrl: './escanear-qr.component.css',
})
export class EscanearQrComponent implements OnInit, OnDestroy {
  private readonly asistenciasService = inject(AsistenciasService);
  private readonly toastService = inject(ToastService);

  private scanner: Html5Qrcode | null = null;
  private ultimoToken = '';
  private ultimoEscaneoMs = 0;

  readonly scannerId = 'qr-reader';
  readonly cooldownMs = 4000;

  escaneando = false;
  iniciandoCamara = false;
  procesando = false;
  errorCamara = '';
  scanFallido = false;

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
      this.errorCamara =
        'Estás en HTTP. En iPhone Safari la cámara solo funciona con HTTPS (puerto 4201).';
    }
  }

  abrirVersionHttps(): void {
    if (typeof window !== 'undefined') {
      window.location.href = this.urlEscaneoHttps;
    }
  }

  activarCamara(): void {
    if (this.requiereHttpsEnCelu) {
      this.abrirVersionHttps();
      return;
    }
    this.errorCamara = '';
    this.scanFallido = false;
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
      fps: 8,
      qrbox: (w: number, h: number) => {
        const edge = Math.min(w, h);
        const size = Math.max(180, Math.floor(edge * 0.65));
        return { width: size, height: size };
      },
      aspectRatio: 1.0,
    };
  }

  async iniciarCamara(): Promise<void> {
    if (this.iniciandoCamara || this.escaneando || this.procesando) return;

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
      this.errorCamara = this.mensajeErrorCamara();
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

  private esEscaneoDuplicado(token: string): boolean {
    const ahora = Date.now();
    if (token === this.ultimoToken && ahora - this.ultimoEscaneoMs < this.cooldownMs) {
      return true;
    }
    this.ultimoToken = token;
    this.ultimoEscaneoMs = ahora;
    return false;
  }

  private async onQrLeido(token: string): Promise<void> {
    const normalizado = token.trim();
    if (!normalizado || this.procesando) return;
    if (this.esEscaneoDuplicado(normalizado)) return;

    this.procesando = true;
    this.scanFallido = false;
    await this.detenerCamara();

    this.asistenciasService.escanearQr(normalizado).subscribe({
      next: (data) => {
        this.toastService.showSuccess(
          data.message ?? 'Asistencia registrada con éxito',
        );
        this.procesando = false;
        setTimeout(() => void this.iniciarCamara(), this.cooldownMs);
      },
      error: (err) => {
        this.toastService.showError(this.asistenciasService.mensajeError(err));
        this.scanFallido = true;
        this.procesando = false;
      },
    });
  }
}
