import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
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
    readonly router: Router
  ) {}

  get hideHeader(): boolean {
    const url = this.router.url;
    return (
      url === '/' ||
      url === '/login' ||
      url === '/registro' ||
      url.startsWith('/confirmar')
    );
  }

  get logoPath(): string {
    if (!this.auth.isLoggedIn()) return '/';
    return this.auth.isStaff() ? '/admin' : '/catalogo';
  }

  logout(): void {
    this.auth.logout().subscribe({
      complete: () => void this.router.navigateByUrl('/login'),
    });
  }
}