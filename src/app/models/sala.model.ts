export interface Sala {
  id: number;
  identificador: string;
  cupo: number;
  estado_activo: boolean;
}

export interface SalaClaseProxima {
  id: number;
  nombre: string;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
  cupo: number;
  proximas_fechas: string[];
  actividad?: { id: number; nombre: string };
  profesor?: { id: number; nombre: string; apellido: string };
}

export interface SalaDetalle extends Sala {
  clases_proximas: SalaClaseProxima[];
}

export type EstadoSalaLabel = 'Habilitada' | 'Deshabilitada';

export function estadoSalaLabel(activa: boolean): EstadoSalaLabel {
  return activa !== false ? 'Habilitada' : 'Deshabilitada';
}
