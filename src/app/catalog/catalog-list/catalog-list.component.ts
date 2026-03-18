import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { Socio } from '../../models/socio.model';
import { Plan } from '../../models/plan.model';
import { CreateSocioDto, SocioService } from '../../services/socio.service';
import { PlanService } from '../../services/plan.service';
import { PagoService } from '../../services/pago.service';

@Component({
  selector: 'app-catalog-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './catalog-list.component.html',
  styleUrls: ['./catalog-list.component.css'],
})
export class CatalogListComponent implements OnInit {
  socios$: Observable<Socio[]>;
  planes: Plan[] = [];
  showCreateSocioForm = false;
  isSavingSocio = false;
  createSocioError = '';
  newSocio: CreateSocioDto = {
    nombre: '',
    email: '',
    telefono: '',
  };

  constructor(
    private readonly socioService: SocioService,
    private readonly planService: PlanService,
    private readonly pagoService: PagoService
  ) {
    this.socios$ = this.socioService.getSocios();
  }

  ngOnInit(): void {
    this.socios$ = this.socioService.getSocios();
    this.planService.getPlanes().subscribe({
      next: (data) => {
        this.planes = data;
      },
      error: () => {
        this.planes = [];
      },
    });
  }

  toggleCreateSocioForm(): void {
    this.showCreateSocioForm = !this.showCreateSocioForm;
    this.createSocioError = '';
  }

  onCreateSocio(): void {
    if (!this.newSocio.nombre || !this.newSocio.email || !this.newSocio.telefono) {
      this.createSocioError = 'Completá nombre, email y teléfono.';
      return;
    }

    this.isSavingSocio = true;
    this.createSocioError = '';

    this.socioService.createSocio(this.newSocio).subscribe({
      next: () => {
        this.socios$ = this.socioService.getSocios();
        this.newSocio = { nombre: '', email: '', telefono: '' };
        this.showCreateSocioForm = false;
        this.isSavingSocio = false;
      },
      error: () => {
        this.createSocioError = 'No se pudo guardar el socio. Verificá los datos.';
        this.isSavingSocio = false;
      },
    });
  }

  pagarPlan(plan: Plan): void {
    this.pagoService
      .createPreference({
        tituloPlan: plan.nombre,
        precio: Number(plan.precio),
      })
      .subscribe({
        next: (response) => {
          if (response?.init_point) {
            window.location.href = response.init_point;
          }
        },
        error: () => {
          this.createSocioError =
            'No se pudo iniciar el pago en este momento.';
        },
      });
  }
}
