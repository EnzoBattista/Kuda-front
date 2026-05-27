import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const CUPO_CLASE_MIN = 10;
export const CUPO_CLASE_MAX_DEFAULT = 50;

export function cupoClaseRangoMsg(errorObj?: any, max: number = CUPO_CLASE_MAX_DEFAULT): string {
  if (errorObj && errorObj.maxError) {
    return `El cupo no puede superar la capacidad máxima de la sala (${max})`;
  }
  return `El cupo máximo debe ser mayor o igual al cupo mínimo (${CUPO_CLASE_MIN})`;
}

/** @deprecated Usá `cupoClaseRangoMsg(max)` para mensaje dinámico. */
export const CUPO_CLASE_RANGO_MSG = cupoClaseRangoMsg();

export function cupoClaseRangoValidator(
  maxFn: () => number = () => CUPO_CLASE_MAX_DEFAULT,
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const n = Number(value);
    const max = maxFn();
    if (!Number.isFinite(n) || n < CUPO_CLASE_MIN) {
      return { cupoRango: { minError: true, min: CUPO_CLASE_MIN, max } };
    }
    if (n > max) {
      return { cupoRango: { maxError: true, min: CUPO_CLASE_MIN, max } };
    }
    return null;
  };
}
