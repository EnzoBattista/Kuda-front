import { Component, HostListener, ElementRef, OnInit, AfterViewInit, OnDestroy, ViewChild, NgZone } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.css',
})
export class WelcomeComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('particleCanvas')
  private canvasRef!: ElementRef<HTMLCanvasElement>;

  private animFrameId = 0;
  private particles: Array<{
    ox: number; oy: number;
    x: number;  y: number;
    vx: number; vy: number;
    len: number; angle: number; va: number;
    color: string; alpha: number; lw: number;
  }> = [];
  private mouseX = -9999;
  private mouseY = -9999;

  constructor(
    private readonly el: ElementRef,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly ngZone: NgZone
  ) {}

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) {
      const destino = this.auth.isAdministrativo() ? '/administrativo' : '/clases';
      void this.router.navigateByUrl(destino);
    }
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    const x = (event.clientX / window.innerWidth) * 100;
    const y = (event.clientY / window.innerHeight) * 100;
    const page = this.el.nativeElement.querySelector('.welcome-page');
    if (page) {
      page.style.setProperty('--mx', `${x}%`);
      page.style.setProperty('--my', `${y}%`);
    }
    this.mouseX = event.clientX;
    this.mouseY = event.clientY;
  }

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => this.initCanvas());
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animFrameId);
  }

  private initCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    const COLORS = ['#cc2200', '#aa1100', '#0044bb', '#0066dd', '#992211', '#ffffff'];
    const COUNT = 220;
    const REPEL_R = 100;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const W = () => canvas.width;
    const H = () => canvas.height;

    this.particles = Array.from({ length: COUNT }, () => ({
      ox: Math.random() * W(),
      oy: Math.random() * H(),
      x:  Math.random() * W(),
      y:  Math.random() * H(),
      vx: 0, vy: 0,
      len:   7 + Math.random() * 10,
      angle: Math.random() * Math.PI,
      va:    (Math.random() - 0.5) * 0.006,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: 0.3 + Math.random() * 0.55,
      lw:    1.5 + Math.random() * 1.5,
    }));

    const loop = () => {
      ctx.clearRect(0, 0, W(), H());

      for (const p of this.particles) {
        const dx   = p.x - this.mouseX;
        const dy   = p.y - this.mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < REPEL_R && dist > 0) {
          const f  = (REPEL_R - dist) / REPEL_R;
          p.vx += (dx / dist) * f * 4;
          p.vy += (dy / dist) * f * 4;
        }

        p.vx += (p.ox - p.x) * 0.03;
        p.vy += (p.oy - p.y) * 0.03;
        p.vx *= 0.87;
        p.vy *= 0.87;
        p.x  += p.vx;
        p.y  += p.vy;
        p.angle += p.va;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.globalAlpha = p.alpha;
        ctx.strokeStyle = p.color;
        ctx.lineWidth   = p.lw;
        ctx.lineCap     = 'round';
        ctx.beginPath();
        ctx.moveTo(-p.len / 2, 0);
        ctx.lineTo( p.len / 2, 0);
        ctx.stroke();
        ctx.restore();
      }

      this.animFrameId = requestAnimationFrame(loop);
    };

    loop();
  }
}
