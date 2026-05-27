import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'fechaAr', standalone: true })
export class FechaArPipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    if (value === null || value === undefined || value === '') return '';

    if (value instanceof Date) {
      const d = String(value.getDate()).padStart(2, '0');
      const m = String(value.getMonth() + 1).padStart(2, '0');
      const y = value.getFullYear();
      return `${d}/${m}/${y}`;
    }

    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, y, m, d] = match;
      return `${d}/${m}/${y}`;
    }

    return String(value);
  }
}
