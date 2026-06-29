import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { AuthService } from './services/auth.service';
import { ToastComponent } from './components/toast/toast.component';
import { NotificacionesBellComponent } from './components/notificaciones-bell/notificaciones-bell.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, ToastComponent, NotificacionesBellComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'Gimnasio Kuda';

  constructor(
    readonly auth: AuthService,
    readonly router: Router,
    private readonly location: Location
  ) {}

  goBack(): void {
    this.location.back();
  }

  get hideHeader(): boolean {
    const url = this.router.url;
    return (
      url === '/' ||
      url === '/login' ||
      url === '/registro' ||
      url.startsWith('/confirmar')
    );
  }

  get showBackButton(): boolean {
    const url = this.router.url;
    // Redirigir al inicio correspondiente
    if (
      url === '/' ||
      url === '/login' ||
      url === '/clases' ||
      url === '/mis-reservas' ||
      url === '/mi-informacion' ||
      url === '/mi-panel' ||
      url === '/catalogo' ||
      url === '/administrativo' ||
      url.startsWith('/confirmar')
    ) {
      return false;
    }
    return true;
  }

  get logoPath(): string {
    return this.getHomePath();
  }

  private getHomePath(): string {
    if (!this.auth.isLoggedIn()) return '/';
    return this.auth.isAdministrativo() ? '/administrativo' : '/mi-panel';
  }

  logout(): void {
    this.auth.logout().subscribe({
      complete: () => void this.router.navigateByUrl('/login'),
    });
  }
}