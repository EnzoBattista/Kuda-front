import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Actividad } from '../../models/actividad.model';
import { ActividadesService } from '../../services/actividades.service';

@Component({
  selector: 'app-catalog-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './catalog-list.component.html',
  styleUrls: ['./catalog-list.component.css'],
})
export class CatalogListComponent implements OnInit {
  actividades: Actividad[] = [];
  isLoading = false;
  loadError = '';

  constructor(private readonly actividadesService: ActividadesService) {}

  ngOnInit(): void {
    this.isLoading = true;
    this.loadError = '';
    this.actividadesService.getActivas().subscribe({
      next: (data) => {
        this.actividades = data ?? [];
        this.isLoading = false;
      },
      error: () => {
        this.actividades = [];
        this.loadError = 'No se pudieron cargar las actividades. Intentá nuevamente.';
        this.isLoading = false;
      },
    });
  }
}
