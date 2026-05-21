import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const CUPO_CLASE_MIN = 10;
export const CUPO_CLASE_MAX_DEFAULT = 50;

export function cupoClaseRangoMsg(max: number = CUPO_CLASE_MAX_DEFAULT): string {
  return `El cupo debe estar entre ${CUPO_CLASE_MIN} y ${max} personas`;
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
    if (!Number.isFinite(n) || n < CUPO_CLASE_MIN || n > max) {
      return { cupoRango: { min: CUPO_CLASE_MIN, max } };
    }
    return null;
  };
}
