export interface ClaseActividad {
  id: number;
  nombre: string;
  descripcion?: string;
}

export interface ClaseSala {
  id: number;
  identificador: string;
  cupo: number;
}

export interface ClaseProfesor {
  id: number;
  nombre: string;
  apellido: string;
  dni: string;
}

export interface Clase {
  id: number;
  nombre: string;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
  cupo: number;
  activa: boolean;
  actividad_id: number;
  sala_id: number;
  profesor_id: number;
  actividad?: ClaseActividad;
  sala?: ClaseSala;
  profesor?: ClaseProfesor;
  proximas_fechas?: string[];
}

export interface CreateClaseDto {
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
  cupo: number;
  actividad_id: number;
  sala_id: number;
  profesor_id: number;
  nombre?: string;
  activa?: boolean;
}

export interface UpdateClaseDto {
  dia_semana?: string;
  hora_inicio?: string;
  hora_fin?: string;
  cupo?: number;
  actividad_id?: number;
  sala_id?: number;
  profesor_id?: number;
  nombre?: string;
}

export interface CancelarClaseDto {
  fecha: string;
  motivo?: string;
}

export interface ClaseMutationResponse {
  message: string;
}

export interface CancelarClaseResponse {
  message: string;
  cancelacion?: unknown;
}
