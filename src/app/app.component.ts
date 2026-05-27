import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
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
    if (url === '/' || url === '/login' || url === '/clases' || url === '/catalogo' || url === '/administrativo' || url.startsWith('/confirmar')) {
      return false;
    }
    return true;
  }

  get logoPath(): string {
    return this.getHomePath();
  }

  private getHomePath(): string {
    if (!this.auth.isLoggedIn()) return '/';
    return this.auth.isAdministrativo() ? '/administrativo' : '/clases';
  }

  logout(): void {
    this.auth.logout().subscribe({
      complete: () => void this.router.navigateByUrl('/login'),
    });
  }
}