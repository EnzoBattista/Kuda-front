export interface Sala {
  id: number;
  identificador: string;
  cupo: number;
  estado_activo: boolean;
}

export type EstadoSalaLabel = 'Habilitada' | 'Deshabilitada';

export function estadoSalaLabel(activa: boolean): EstadoSalaLabel {
  return activa !== false ? 'Habilitada' : 'Deshabilitada';
}
