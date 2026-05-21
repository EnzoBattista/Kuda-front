import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, tap, throwError } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

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

const MSG_RECUPERACION_OK =
  'Se ha enviado un enlace de recuperación a su email. Tiene 48hs para restablecerla.';
const MSG_EMAIL_NO_REGISTRADO =
  'El email ingresado no pertenece a ninguna cuenta registrada';
const MSG_RESET_OK = 'Su contraseña ha sido restablecida con éxito';
const MSG_PASSWORDS_MISMATCH = 'Las contraseñas no coinciden';
const MSG_TOKEN_EXPIRADO = 'El enlace de recuperación ha expirado';
const MSG_TOKEN_INVALIDO = 'El enlace de recuperación es inválido';

interface PerfilFlat {
  email?: string;
  nombre?: string;
  apellido?: string;
  telefono?: string;
  genero?: string;
  fechaNacimiento?: string;
  dni?: string;
  activo?: boolean;
  rol_id?: number;
  rol?: { id: number; nombre: string };
}

/**
 * GET /clientes/:email devuelve `{ ...cliente, usuario: { ...usuario } }`.
 * PUT /clientes/:email devuelve `{ message, cliente: { ...usuario, ...cliente } }`.
 * Login devuelve `{ usuario, token }`.
 */
type ClientePerfilResponse = PerfilFlat & {
  usuario?: PerfilFlat;
  cliente?: PerfilFlat & { usuario?: PerfilFlat };
};

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private readonly clientesUrl = `${environment.apiUrl}/clientes`;
  private readonly tokenKey = 'kuda_token';
  private readonly userKey = 'kuda_user';

  constructor(private readonly http: HttpClient) {}

  register(data: RegisterRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/register`, data);
  }

  confirmarCuenta(token: string): Observable<{ message: string }> {
    return this.http.get<{ message: string }>(
      `${this.apiUrl}/confirmar/${encodeURIComponent(token)}`,
    );
  }

  login(data: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, data).pipe(
      tap((resp) => {
        if (resp?.token) this.setToken(resp.token);
        if (resp?.usuario) this.setUser(resp.usuario);
      }),
    );
  }

  /** POST /api/auth/logout y limpieza de sesión local (siempre, vía finalize). */
  logout(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/logout`, {}).pipe(
      catchError(() => of(undefined)),
      finalize(() => this.clearSession()),
      map(() => undefined),
    );
  }

  private clearSession(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  }

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
   * Carga datos de cliente desde API (género, fecha de nacimiento).
   * Si falla (p. ej. sin permiso), devuelve el usuario en sesión.
   */
  cargarPerfilCliente(): Observable<CurrentUser | null> {
    const actual = this.getCurrentUser();
    if (!actual) {
      return of(null);
    }

    return this.http
      .get<ClientePerfilResponse>(
        `${this.clientesUrl}/${encodeURIComponent(actual.email)}`,
      )
      .pipe(
        map((resp) => this.mergePerfilResponse(actual, resp)),
        catchError(() => of(actual)),
      );
  }

  /** PUT /api/clientes/:email — usuario + campos de cliente en un solo body. */
  actualizarPerfil(data: ActualizarPerfilRequest): Observable<CurrentUser> {
    if (data.fechaNacimiento && this.calcularEdad(data.fechaNacimiento) <= 14) {
      return throwError(() => ({
        error: { message: 'Modificación fallida - Debe ser mayor de 14 años' },
      }));
    }

    const actual = this.getCurrentUser();
    if (!actual) {
      return throwError(() => ({ error: { message: 'Sesión no válida' } }));
    }

    const body: Record<string, string | undefined> = {
      nombre: data.nombre.trim(),
      apellido: data.apellido.trim(),
      genero: data.genero,
      fechaNacimiento: data.fechaNacimiento,
    };
    const tel = data.telefono?.trim();
    if (tel) {
      body['telefono'] = tel;
    }

    return this.http
      .put<ClientePerfilResponse>(
        `${this.clientesUrl}/${encodeURIComponent(actual.email)}`,
        body,
      )
      .pipe(
        map((resp) => this.mergePerfilResponse(actual, resp)),
        tap((u) => this.setUser(u)),
        catchError((err) =>
          throwError(() => ({
            error: {
              message: mapActualizarPerfilError(err),
            },
          })),
        ),
      );
  }

  /** POST /api/auth/olvide-password */
  recuperarPassword(email: string): Observable<{ message: string }> {
    return this.http
      .post<{ message: string }>(`${this.apiUrl}/olvide-password`, {
        email: email.trim(),
      })
      .pipe(
        map(() => ({ message: MSG_RECUPERACION_OK })),
        catchError((err) =>
          throwError(() => ({ error: { message: mapRecuperarPasswordError(err) } })),
        ),
      );
  }

  /** POST /api/auth/reset-password */
  nuevaPassword(
    token: string,
    password: string,
    confirmPassword: string,
  ): Observable<{ message: string }> {
    if (password !== confirmPassword) {
      return throwError(() => ({
        error: { message: MSG_PASSWORDS_MISMATCH },
      }));
    }

    return this.http
      .post<{ message: string }>(`${this.apiUrl}/reset-password`, {
        token,
        passwordNueva: password,
        confirmPassword,
      })
      .pipe(
        map(() => ({ message: MSG_RESET_OK })),
        catchError((err) =>
          throwError(() => ({ error: { message: mapResetPasswordError(err) } })),
        ),
      );
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

  private mergePerfilResponse(
    base: CurrentUser,
    resp: ClientePerfilResponse,
  ): CurrentUser {
    const flat = this.aplanarPerfil(resp);
    return {
      ...base,
      nombre: flat.nombre ?? base.nombre,
      apellido: flat.apellido ?? base.apellido,
      telefono: flat.telefono ?? base.telefono,
      genero: flat.genero ?? base.genero,
      fechaNacimiento: this.normalizarFecha(flat.fechaNacimiento) ?? base.fechaNacimiento,
      dni: flat.dni ?? base.dni,
      activo: flat.activo ?? base.activo,
      rol_id: flat.rol_id ?? base.rol_id,
      rol: flat.rol ?? base.rol,
    };
  }

  /** Aplana las distintas formas de respuesta (GET/PUT/login) a un objeto plano. */
  private aplanarPerfil(resp: ClientePerfilResponse): PerfilFlat {
    if (resp.cliente) {
      return this.aplanarPerfil(resp.cliente);
    }
    if (resp.usuario) {
      return { ...resp, ...resp.usuario };
    }
    return resp;
  }

  private normalizarFecha(valor?: string): string | undefined {
    if (!valor) return undefined;
    return String(valor).slice(0, 10);
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

function extractBackendMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error;
    if (typeof body === 'object' && body !== null && 'message' in body) {
      return String((body as { message: string }).message);
    }
    return err.message;
  }
  return '';
}

function mapActualizarPerfilError(err: unknown): string {
  const raw = extractBackendMessage(err);
  if (raw.toLowerCase().includes('14 años') || raw.toLowerCase().includes('14 anos')) {
    return 'Modificación fallida - Debe ser mayor de 14 años';
  }
  return raw || 'No se pudieron guardar los cambios. Intentá nuevamente.';
}

function mapRecuperarPasswordError(err: unknown): string {
  if (err instanceof HttpErrorResponse && err.status === 404) {
    return MSG_EMAIL_NO_REGISTRADO;
  }
  const raw = extractBackendMessage(err);
  if (
    raw.toLowerCase().includes('no pertenece') ||
    raw.toLowerCase().includes('no existe')
  ) {
    return MSG_EMAIL_NO_REGISTRADO;
  }
  return raw || 'No se pudo procesar la solicitud. Intentá nuevamente.';
}

function mapResetPasswordError(err: unknown): string {
  const raw = extractBackendMessage(err).toLowerCase();

  if (raw.includes('expirado')) {
    return MSG_TOKEN_EXPIRADO;
  }
  if (
    raw.includes('inválido') ||
    raw.includes('invalido') ||
    raw.includes('incorrecto') ||
    raw.includes('utilizado') ||
    raw.includes('no coinciden')
  ) {
    if (raw.includes('no coinciden')) {
      return MSG_PASSWORDS_MISMATCH;
    }
    return MSG_TOKEN_INVALIDO;
  }

  const original = extractBackendMessage(err);
  return original || MSG_TOKEN_INVALIDO;
}
