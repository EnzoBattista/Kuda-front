import { Routes } from '@angular/router';
import { CatalogListComponent } from './catalog/catalog-list/catalog-list.component';

export const routes: Routes = [
  { path: '', redirectTo: '/catalogo', pathMatch: 'full' },
  { path: 'catalogo', component: CatalogListComponent },
];