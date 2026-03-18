// src/app/services/filter.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FilterService {
  // BehaviorSubject es ideal para almacenar el estado actual y emitir cambios.
  // Lo inicializamos con un término de búsqueda vacío.
  private _searchTerm = new BehaviorSubject<string>('');
  private _activeFilters = new BehaviorSubject<{type: string[], location: string[]}>({type: [], location: []});

  // Observable público para que otros componentes puedan suscribirse a los cambios
  searchTerm$: Observable<string> = this._searchTerm.asObservable();
  activeFilters$: Observable<{type: string[], location: string[]}> = this._activeFilters.asObservable();


  constructor() { }

  setSearchTerm(term: string) {
    this._searchTerm.next(term);
  }

  getSearchTerm(): string {
    return this._searchTerm.getValue();
  }

  setActiveFilters(filters: {type: string[], location: string[]}) {
    this._activeFilters.next(filters);
  }

  getActiveFilters(): {type: string[], location: string[]} {
    return this._activeFilters.getValue();
  }

  // Opcional: un método para limpiar todos los filtros si el nav lo necesita
  clearAllSharedFilters() {
    this._searchTerm.next('');
    this._activeFilters.next({type: [], location: []});
  }
}