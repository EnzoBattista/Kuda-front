/**
 * @deprecated Usar ClasesService desde ./clases.service
 */
export {
  ClasesService as ClaseService,
  ClasesService,
  mapClaseSuccess,
  mapClaseError,
} from './clases.service';
export type {
  Clase,
  ClaseActividad,
  ClaseSala,
  ClaseProfesor,
  CreateClaseDto,
  CancelarClaseDto,
} from '../models/clase.model';
