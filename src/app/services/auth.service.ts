import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap, throwError, delay } from 'rxjs';

export interface RegisterRequest {
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  genero: string;
  fechaNacimiento: string; // YYYY-MM-DD
  telefono: string;
  fichaMedica?: string;
  password: string;
  confirmPassword: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CurrentUser {
  email: string;
  dni: string;
  nombre: string;
  apellido: string;
  telefono?: string;
  genero?: string;
  fechaNacimiento?: string;
  activo: boolean;
  rol_id: number;
  rol: { id: number; nombre: string };
}

export interface LoginResponse {
  usuario: CurrentUser;
  token: string;
}

export interface ActualizarPerfilRequest {
  nombre: string;
  apellido: string;
  telefono?: string;
  genero?: string;
  fechaNacimiento?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly apiUrl = 'http://localhost:3001/api/auth';
  private readonly tokenKey = 'kuda_token';
  private readonly userKey = 'kuda_user';



  constructor(private readonly http: HttpClient) {}

  register(data: RegisterRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/register`, data);
  }

  confirmarCuenta(token: string): Observable<{ message: string }> {
    return this.http.get<{ message: string }>(
      `${this.apiUrl}/confirmar/${encodeURIComponent(token)}`
    );
  }

  login(data: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, data).pipe(
      tap((resp) => {
        if (resp?.token) this.setToken(resp.token);
        if (resp?.usuario) this.setUser(resp.usuario);
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  }

  /**
   * Cambia la contraseña del usuario logueado.
   * REAL: usa `POST /api/auth/cambiar-password` (el back ya valida actual/nueva).
   */
  cambiarPassword(
    passwordActual: string,
    passwordNueva: string,
    confirmPassword: string,
  ): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/cambiar-password`, {
      passwordActual,
      passwordNueva,
      confirmPassword,
    });
  }

  /**
   * MOCK (Regla de Oro 1): el back no expone `PUT /api/auth/me` para que un cliente
   * edite su propio perfil. Persistimos en localStorage para mantener la UX coherente.
   * Aplica la validación de edad > 14 años pedida por la HU "Modificar cliente".
   */
  actualizarPerfil(data: ActualizarPerfilRequest): Observable<CurrentUser> {
    if (data.fechaNacimiento && this.calcularEdad(data.fechaNacimiento) <= 14) {
      return throwError(() => ({
        error: { message: 'Modificación fallida - Debe ser mayor de 14 años' },
      })).pipe(delay(300));
    }

    const actual = this.getCurrentUser();
    if (!actual) {
      return throwError(() => ({ error: { message: 'Sesión no válida' } })).pipe(delay(300));
    }

    const actualizado: CurrentUser = {
      ...actual,
      nombre: data.nombre.trim(),
      apellido: data.apellido.trim(),
      telefono: data.telefono?.trim() || actual.telefono,
      genero: data.genero ?? actual.genero,
      fechaNacimiento: data.fechaNacimiento ?? actual.fechaNacimiento,
    };

    return of(actualizado).pipe(
      delay(500),
      tap((u) => this.setUser(u)),
    );
  }

  /** Solicita al backend que envíe el email de recuperación. */
  recuperarPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/olvide-password`, { email });
  }

  /** Restablece la contraseña usando el token recibido por email. */
  nuevaPassword(
    token: string,
    passwordNueva: string,
    confirmPassword: string,
  ): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/reset-password`, {
      token,
      passwordNueva,
      confirmPassword,
    });
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getCurrentUser(): CurrentUser | null {
    const raw = localStorage.getItem(this.userKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CurrentUser;
    } catch {
      return null;
    }
  }

  isLoggedIn(): boolean {
    return Boolean(this.getToken());
  }

  getRol(): string | null {
    return this.getCurrentUser()?.rol?.nombre ?? null;
  }

  isAdmin(): boolean {
    return this.getRol() === 'ADMIN';
  }

  isRecepcionista(): boolean {
    return this.getRol() === 'RECEPCIONISTA';
  }

  isStaff(): boolean {
    return this.isAdmin() || this.isRecepcionista();
  }

  private setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  private setUser(user: CurrentUser): void {
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  private calcularEdad(fechaIso: string): number {
    const hoy = new Date();
    const nacimiento = new Date(fechaIso);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
    return edad;
  }
}
