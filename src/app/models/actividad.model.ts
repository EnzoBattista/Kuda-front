export interface Actividad {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  activa: boolean;
}

export interface ProfesorActividad {
  id: number;
  nombre: string;
  apellido: string;
  dni: string;
}

export interface CreateActividadDto {
  nombre: string;
  descripcion?: string;
  precio?: number;
}

export interface UpdateActividadDto {
  nombre?: string;
  descripcion?: string;
  activa?: boolean;
}

export interface ActividadMutationResponse {
  message: string;
  actividad: Actividad;
}
