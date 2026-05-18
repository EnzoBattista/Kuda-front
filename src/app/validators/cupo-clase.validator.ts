import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const CUPO_CLASE_MIN = 10;
export const CUPO_CLASE_MAX = 50;
export const CUPO_CLASE_RANGO_MSG =
  'El cupo debe estar entre 10 y 50 personas';

export function cupoClaseRangoValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const n = Number(value);
    if (!Number.isFinite(n) || n < CUPO_CLASE_MIN || n > CUPO_CLASE_MAX) {
      return { cupoRango: true };
    }
    return null;
  };
}
