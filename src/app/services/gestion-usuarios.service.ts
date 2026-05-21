import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UsuarioListado {
  email: string;
  dni: string;
  nombre: string;
  apellido: string;
  telefono?: string;
  activo: boolean;
  rol_id: number;
  rol?: { id: number; nombre: string };
}

export type RolFiltro = '' | 'ADMIN' | 'RECEPCIONISTA' | 'CLIENTE';
export type EstadoFiltro = '' | 'ACTIVO' | 'INACTIVO';
export type TipoInscripcionFiltro = '' | 'ABONADO' | 'NO_ABONADO';
export type TipoInscripcion = 'ABONADO' | 'NO_ABONADO';

export interface UsuariosFiltro {
  q?: string;
  rol?: RolFiltro;
  estado?: EstadoFiltro;
  tipoInscripcion?: TipoInscripcionFiltro;
}

export interface ActualizarUsuarioDto {
  nombre: string;
  apellido: string;
  dni: string;
  telefono?: string;
  genero?: string;
  fechaNacimiento?: string;
}

export interface ClienteExtraInfo {
  genero?: string;
  fechaNacimiento?: string;
}

interface InscripcionMensualListado {
  cliente_email: string;
  estado: string;
}

const ESTADOS_ABONO_ACTIVO = new Set(['VIGENTE', 'EN_GRACIA']);

@Injectable({ providedIn: 'root' })
export class GestionUsuariosService {
  private readonly apiUrl = `${environment.apiUrl}/usuarios`;
  private readonly clientesUrl = `${environment.apiUrl}/clientes`;
  private readonly inscripcionesMensualesUrl = `${environment.apiUrl}/inscripciones-mensuales`;

  /** Emails con al menos una mensualidad vigente o en gracia (última carga). */
  private abonadosEmails = new Set<string>();

  constructor(private readonly http: HttpClient) {}

  getAll(filtros: UsuariosFiltro = {}): Observable<UsuarioListado[]> {
    let params = new HttpParams();
    if (filtros.q?.trim()) params = params.set('q', filtros.q.trim());
    if (filtros.rol) params = params.set('rol', filtros.rol);
    if (filtros.estado === 'ACTIVO') params = params.set('activo', 'true');
    if (filtros.estado === 'INACTIVO') params = params.set('activo', 'false');

    const usuarios$ = this.http.get<UsuarioListado[]>(this.apiUrl, { params });
    const abonados$ = this.cargarEmailsAbonados();

    return forkJoin({ usuarios: usuarios$, abonados: abonados$ }).pipe(
      tap(({ abonados }) => {
        this.abonadosEmails = abonados;
      }),
      map(({ usuarios }) =>
        this.aplicarFiltroTipoInscripcion(usuarios ?? [], filtros.tipoInscripcion),
      ),
    );
  }

  getByEmail(email: string): Observable<UsuarioListado> {
    return this.http.get<UsuarioListado>(`${this.apiUrl}/${encodeURIComponent(email)}`);
  }

  update(email: string, data: ActualizarUsuarioDto): Observable<UsuarioListado> {
    const usuarioBody = {
      nombre: data.nombre,
      apellido: data.apellido,
      dni: data.dni,
      telefono: data.telefono,
    };

    const putUsuario = this.http.put<UsuarioListado>(
      `${this.apiUrl}/${encodeURIComponent(email)}`,
      usuarioBody,
    );

    const tieneCamposCliente =
      data.genero !== undefined || data.fechaNacimiento !== undefined;

    if (!tieneCamposCliente) {
      return putUsuario;
    }

    const clienteBody: Record<string, string> = {};
    if (data.genero !== undefined) clienteBody['genero'] = data.genero;
    if (data.fechaNacimiento !== undefined) {
      clienteBody['fechaNacimiento'] = data.fechaNacimiento;
    }

    const putCliente = this.http
      .put<unknown>(`${this.clientesUrl}/${encodeURIComponent(email)}`, clienteBody)
      .pipe(catchError(() => of(null)));

    return forkJoin({ usuario: putUsuario, cliente: putCliente }).pipe(
      map(({ usuario }) => usuario),
    );
  }

  createEmpleado(data: {
    nombre: string;
    apellido: string;
    dni: string;
    email: string;
  }): Observable<unknown> {
    return this.http.post<unknown>(this.apiUrl, { ...data, rol: 'RECEPCIONISTA' });
  }

  getClienteExtraInfo(email: string): Observable<ClienteExtraInfo | null> {
    return this.http
      .get<ClienteExtraInfo>(`${this.clientesUrl}/${encodeURIComponent(email)}`)
      .pipe(
        map((c) => ({
          genero: c?.genero,
          fechaNacimiento: c?.fechaNacimiento,
        })),
        catchError(() => of(null)),
      );
  }

  tipoInscripcion(email: string): TipoInscripcion {
    return this.esAbonado(email) ? 'ABONADO' : 'NO_ABONADO';
  }

  esAbonado(email: string): boolean {
    return this.abonadosEmails.has(email.trim().toLowerCase());
  }

  dniEstaTomadoPorOtro(dni: string, emailEditado: string, lista: UsuarioListado[]): boolean {
    const target = dni.trim();
    if (!target) return false;
    return lista.some((u) => u.dni === target && u.email !== emailEditado);
  }

  private cargarEmailsAbonados(): Observable<Set<string>> {
    return this.http
      .get<InscripcionMensualListado[]>(this.inscripcionesMensualesUrl)
      .pipe(
        map((list) => this.buildAbonadosSet(list ?? [])),
        catchError(() => of(new Set<string>())),
      );
  }

  private buildAbonadosSet(inscripciones: InscripcionMensualListado[]): Set<string> {
    const emails = new Set<string>();

    for (const ins of inscripciones) {
      if (!ESTADOS_ABONO_ACTIVO.has(ins.estado)) continue;
      const email = ins.cliente_email?.trim().toLowerCase();
      if (email) emails.add(email);
    }

    return emails;
  }

  private aplicarFiltroTipoInscripcion(
    lista: UsuarioListado[],
    tipo?: TipoInscripcionFiltro,
  ): UsuarioListado[] {
    if (!tipo) return lista;
    return lista.filter((u) => {
      if (u.rol?.nombre !== 'CLIENTE') return false;
      return this.tipoInscripcion(u.email) === tipo;
    });
  }
}
