import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { Clase } from '../../models/clase.model';
import { Actividad } from '../../models/actividad.model';
import { Sala } from '../../models/sala.model';
import { Profesor, ProfesorService } from '../../services/profesor.service';
import { ClasesService, isClaseActiva } from '../../services/clases.service';
import { ActividadesService } from '../../services/actividades.service';
import { SalasService } from '../../services/salas.service';
import { AuthService } from '../../services/auth.service';
import { ListaEsperaItem, ListaEsperaService } from '../../services/lista-espera.service';
import {
  CUPO_CLASE_MAX_DEFAULT,
  cupoClaseRangoMsg,
  cupoClaseRangoValidator,
} from '../../validators/cupo-clase.validator';
import { ToastService } from '../../services/toast.service';

export interface ClaseListItem extends Clase {
  proximaFecha: string | null;
  fechaCanceladaProxima: boolean;
  cupoMaximo: number;
  cupoOcupado: number | null;
}

const DIAS_CLASE = [
  { value: 'Lunes', label: 'Lunes' },
  { value: 'Martes', label: 'Martes' },
  { value: 'Miercoles', label: 'Miércoles' },
  { value: 'Jueves', label: 'Jueves' },
  { value: 'Viernes', label: 'Viernes' },
  { value: 'Sabado', label: 'Sábado' },
] as const;

@Component({
  selector: 'app-clases-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './clases-list.component.html',
  styleUrl: './clases-list.component.css',
})
export class ClasesListComponent implements OnInit {
  private readonly clasesService = inject(ClasesService);
  private readonly actividadesService = inject(ActividadesService);
  private readonly salasService = inject(SalasService);
  private readonly profesorService = inject(ProfesorService);
  private readonly authService = inject(AuthService);
  private readonly listaEsperaService = inject(ListaEsperaService);
  private readonly fb = inject(FormBuilder);
  private readonly toastService = inject(ToastService);

  readonly diasClase = DIAS_CLASE;

  get cupoRangoMsg(): string {
    const errorObj = this.claseForm.get('cupo_maximo')?.errors?.['cupoRango'];
    return cupoClaseRangoMsg(errorObj, this.maxCupoSalaSeleccionada);
  }

  /** Máximo permitido para el cupo de la clase: el cupo de la sala seleccionada. */
  get maxCupoSalaSeleccionada(): number {
    const salaId = Number(this.claseForm?.get('salaId')?.value ?? 0);
    if (!salaId) return CUPO_CLASE_MAX_DEFAULT;
    const sala = this.salas.find((s) => s.id === salaId);
    return Number(sala?.cupo ?? CUPO_CLASE_MAX_DEFAULT);
  }

  filtros = this.fb.group({
    actividad: [''],
    dia: [''],
    horaInicio: [''],
  });

  clases: ClaseListItem[] = [];
  actividadesFiltro: string[] = [];
  diasFiltro: string[] = [];
  horasFiltro: string[] = [];
  isLoading = false;
  errorMsg = '';

  showModalCancelar = false;
  showModalEliminar = false;
  showModalFormulario = false;
  showModalListaEspera = false;
  formMode: 'agregar' | 'modificar' = 'agregar';

  listaEsperaItems: ListaEsperaItem[] = [];
  listaEsperaLoading = false;
  listaEsperaError = '';

  selectedClase: ClaseListItem | null = null;
  modalError = '';
  modalSubmitting = false;
  catalogosLoading = false;
  catalogosError = '';

  actividades: Actividad[] = [];
  salas: Sala[] = [];
  profesores: Profesor[] = [];

  cancelarFecha = '';

  claseForm = this.fb.group({
    actividadId: [null as number | null, Validators.required],
    profesorId: [null as number | null, Validators.required],
    salaId: [null as number | null, Validators.required],
    dia_semana: ['Lunes', Validators.required],
    horario_inicio: ['09:00', Validators.required],
    horario_fin: ['10:00', Validators.required],
    cupo_maximo: [
      10,
      [Validators.required, cupoClaseRangoValidator(() => this.maxCupoSalaSeleccionada)],
    ],
  });

  private readonly fechasCanceladasLocales = new Map<number, Set<string>>();
  /** Evita que respuestas tardías de cargarClases() pisen datos más recientes. */
  private clasesLoadId = 0;

  ngOnInit(): void {
    this.cargarClases();
    this.claseForm.get('salaId')?.valueChanges.subscribe(() => {
      this.claseForm.get('cupo_maximo')?.updateValueAndValidity({ emitEvent: false });
    });
    this.claseForm.get('actividadId')?.valueChanges.subscribe(() => {
      this.claseForm.get('profesorId')?.setValue(null);
    });
  }

  get profesoresPorActividad(): Profesor[] {
    const actId = this.claseForm.get('actividadId')?.value;
    if (!actId) return [];
    return this.profesores.filter((p) =>
      p.actividades?.some((a) => a.id === Number(actId))
    );
  }

  get isDueno(): boolean {
    return this.authService.isDueno();
  }

  get isAdministrativo(): boolean {
    return this.authService.isAdministrativo();
  }

  get formularioTitulo(): string {
    return this.formMode === 'agregar' ? 'Agregar clase' : 'Modificar clase';
  }

  get cupoRangoInvalido(): boolean {
    const control = this.claseForm.get('cupo_maximo');
    if (!control) {
      return false;
    }
    return (
      control.hasError('cupoRango') ||
      (control.hasError('required') && (control.dirty || control.touched))
    );
  }

  get formularioInvalido(): boolean {
    return this.claseForm.invalid || this.cupoRangoInvalido;
  }

  cargarClases(): void {
    const loadId = ++this.clasesLoadId;
    this.isLoading = true;
    this.errorMsg = '';
    // TODO-TEST: quitar este bloque después de verificar el escenario de listado vacío
    if (new URLSearchParams(window.location.search).get('vacio') === '1') {
      this.clases = [];
      this.actividadesFiltro = [];
      this.diasFiltro = [];
      this.horasFiltro = [];
      this.isLoading = false;
      return;
    }
    this.clasesService.getAll().subscribe({
      next: (data) => {
        if (loadId !== this.clasesLoadId) {
          return;
        }
        const base = (data ?? []).filter(isClaseActiva);
        if (base.length === 0) {
          this.clases = [];
          this.isLoading = false;
          return;
        }

        forkJoin(
          base.map((c) =>
            this.clasesService.getById(c.id).pipe(catchError(() => of(c))),
          ),
        )
          .pipe(
            switchMap((detalles) => {
              const activas = detalles.filter(isClaseActiva);
              if (activas.length === 0) {
                return of<ClaseListItem[]>([]);
              }
              return forkJoin(
                activas.map((d) => this.enriquecerCupoOcupacion(d)),
              );
            }),
          )
          .subscribe({
          next: (items) => {
            if (loadId !== this.clasesLoadId) {
              return;
            }
            this.clases = items;
            this.actualizarOpcionesFiltro();
            this.isLoading = false;
          },
          error: () => {
            if (loadId !== this.clasesLoadId) {
              return;
            }
            this.clases = base.filter(isClaseActiva).map((c) => this.toListItem(c));
            this.isLoading = false;
          },
        });
      },
      error: (err) => {
        if (loadId !== this.clasesLoadId) {
          return;
        }
        this.errorMsg = err?.message ?? 'No se pudieron cargar las clases.';
        this.clases = [];
        this.isLoading = false;
      },
    });
  }

  private actualizarOpcionesFiltro(): void {
    this.actividadesFiltro = [...new Set(this.clases.map((c) => c.actividad?.nombre ?? c.nombre))].sort();
    this.diasFiltro = [...new Set(this.clases.map((c) => c.dia_semana).filter(Boolean))].sort(
      (a, b) => (this.ORDEN_DIA[a] ?? 9) - (this.ORDEN_DIA[b] ?? 9),
    );
    this.horasFiltro = [...new Set(this.clases.map((c) => c.hora_inicio).filter(Boolean))].sort();
  }

  private toListItem(clase: Clase): ClaseListItem {
    const proximaFecha =
      clase.proximas_fechas?.[0] ?? this.calcularProximaFecha(clase.dia_semana);
    const locales = this.fechasCanceladasLocales.get(clase.id);
    const fechaCanceladaProxima = Boolean(
      proximaFecha && locales?.has(proximaFecha),
    );
    /** Cupo de la clase (ej. 10), no el máximo de la sala (ej. 50). */
    const cupoMaximo = Number(clase.cupo ?? 0);

    return {
      ...clase,
      proximaFecha,
      fechaCanceladaProxima,
      cupoMaximo,
      cupoOcupado: null,
    };
  }

  private enriquecerCupoOcupacion(clase: Clase) {
    const item = this.toListItem(clase);
    const fecha = item.proximaFecha;
    if (!fecha) {
      return of(item);
    }
    return this.clasesService.getCupoOcupado(clase.id, fecha).pipe(
      map((ocupado) => ({ ...item, cupoOcupado: ocupado })),
      catchError(() => of(item)),
    );
  }

  private getLocalIsoDate(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private calcularProximaFecha(diaSemana: string): string | null {
    const mapa: Record<string, number> = {
      Domingo: 0,
      Lunes: 1,
      Martes: 2,
      Miercoles: 3,
      Miércoles: 3,
      Jueves: 4,
      Viernes: 5,
      Sabado: 6,
      Sábado: 6,
    };
    const objetivo = mapa[diaSemana];
    if (objetivo === undefined) {
      return null;
    }
    const actual = new Date();
    while (actual.getDay() !== objetivo) {
      actual.setDate(actual.getDate() + 1);
    }
    return this.getLocalIsoDate(actual);
  }

  onAgregar(): void {
    this.formMode = 'agregar';
    this.selectedClase = null;
    this.modalError = '';
    this.resetClaseForm();
    this.showModalFormulario = true;
    this.cargarCatalogosFormulario();
  }

  onModificar(clase: ClaseListItem): void {
    this.formMode = 'modificar';
    this.selectedClase = clase;
    this.modalError = '';
    this.showModalFormulario = true;
    this.cargarCatalogosFormulario(() => {
      this.claseForm.patchValue({
        actividadId: clase.actividad_id,
        profesorId: clase.profesor_id,
        salaId: clase.sala_id,
        dia_semana: this.normalizarDiaFormulario(clase.dia_semana),
        horario_inicio: clase.hora_inicio,
        horario_fin: clase.hora_fin,
        cupo_maximo: clase.cupo,
      });
    });
  }

  cerrarModalFormulario(): void {
    this.showModalFormulario = false;
    this.selectedClase = null;
    this.modalError = '';
    this.catalogosError = '';
    this.modalSubmitting = false;
    this.catalogosLoading = false;
    this.resetClaseForm();
  }

  private resetClaseForm(): void {
    this.claseForm.reset({
      actividadId: null,
      profesorId: null,
      salaId: null,
      dia_semana: 'Lunes',
      horario_inicio: '09:00',
      horario_fin: '10:00',
      cupo_maximo: 10,
    });
    this.claseForm.markAsPristine();
    this.claseForm.markAsUntouched();
  }

  private cargarCatalogosFormulario(afterLoad?: () => void): void {
    this.catalogosLoading = true;
    this.catalogosError = '';

    forkJoin({
      actividades: this.actividadesService.getActivas(),
      salas: this.salasService.getDisponibles(),
      profesores: this.profesorService.getAll().pipe(
        map((list) => (list ?? []).filter((p) => p.activo !== false)),
      ),
    }).subscribe({
      next: ({ actividades, salas, profesores }) => {
        this.actividades = actividades;
        this.salas = salas;
        this.profesores = profesores;
        if (salas.length === 0) {
          this.catalogosError =
            'No se pudieron obtener las salas. Verificá que existan actividades cargadas e intentá de nuevo.';
        }
        this.catalogosLoading = false;
        afterLoad?.();
      },
      error: (err) => {
        this.catalogosError =
          err?.message ?? 'No se pudieron cargar los datos del formulario.';
        this.catalogosLoading = false;
      },
    });
  }

  submitFormulario(): void {
    this.claseForm.markAllAsTouched();
    if (this.claseForm.invalid) {
      const cupoCtrl = this.claseForm.get('cupo_maximo');
      if (cupoCtrl?.hasError('cupoRango')) {
        const err = cupoCtrl.errors?.['cupoRango'];
        if (err?.minError && this.formMode === 'modificar') {
          this.modalError = 'No se pudo modificar la clase. El cupo debe ser mayor o igual a 10';
        } else {
          this.modalError = this.cupoRangoMsg;
        }
      }
      return;
    }

    const payload = this.buildPayload();
    this.modalSubmitting = true;
    this.modalError = '';

    if (this.formMode === 'agregar') {
      this.clasesService.create(payload).subscribe({
        next: (res) => {
          this.toastService.showSuccess(res.message);
          this.cerrarModalFormulario();
          this.cargarClases();
        },
        error: (err) => {
          this.toastService.showError(err?.message ?? 'Ocurrió un error inesperado');
          this.modalSubmitting = false;
        },
      });
      return;
    }

    if (!this.selectedClase) {
      return;
    }

    this.clasesService.update(this.selectedClase.id, payload).subscribe({
      next: (res) => {
        this.toastService.showSuccess(res.message);
        this.cerrarModalFormulario();
        this.cargarClases();
      },
      error: (err) => {
        this.toastService.showError(err?.message ?? 'Ocurrió un error inesperado');
        this.modalSubmitting = false;
      },
    });
  }

  private buildPayload() {
    const v = this.claseForm.getRawValue();
    const actividad = this.actividades.find((a) => a.id === Number(v.actividadId));
    const nombre = actividad
      ? `${actividad.nombre} - ${v.dia_semana} ${v.horario_inicio}`
      : `Clase - ${v.dia_semana}`;

    return {
      nombre,
      dia_semana: v.dia_semana!,
      hora_inicio: this.horaToBackend(v.horario_inicio!),
      hora_fin: this.horaToBackend(v.horario_fin!),
      cupo: Number(v.cupo_maximo),
      actividad_id: Number(v.actividadId),
      sala_id: Number(v.salaId),
      profesor_id: Number(v.profesorId),
      activa: true,
    };
  }

  private horaToBackend(hora: string): string {
    if (!hora) {
      return hora;
    }
    return hora.length === 5 ? `${hora}:00` : hora;
  }

  private normalizarDiaFormulario(dia: string): string {
    if (dia === 'Miércoles') {
      return 'Miercoles';
    }
    if (dia === 'Sábado') {
      return 'Sabado';
    }
    return dia;
  }

  private readonly ORDEN_DIA: Record<string, number> = {
    Lunes: 0, Martes: 1, Miercoles: 2, 'Miércoles': 2, Jueves: 3,
    Viernes: 4, Sabado: 5, 'Sábado': 5, Domingo: 6,
  };

  get clasesFiltradas(): ClaseListItem[] {
    const { actividad, dia, horaInicio } = this.filtros.getRawValue();
    return this.clases.filter(
      (c) =>
        (!actividad || (c.actividad?.nombre ?? c.nombre) === actividad) &&
        (!dia || c.dia_semana === dia) &&
        (!horaInicio || c.hora_inicio === horaInicio),
    );
  }

  limpiarFiltros(): void {
    this.filtros.reset({ actividad: '', dia: '', horaInicio: '' });
  }

  hayFiltros(): boolean {
    const { actividad, dia, horaInicio } = this.filtros.getRawValue();
    return Boolean(actividad || dia || horaInicio);
  }

  /** "09:00:00" → "09:00" para mostrar en el filtro de hora. */
  formatHoraFiltro(hora: string): string {
    return (hora ?? '').slice(0, 5);
  }

  get clasesPorActividad(): { actividad: string; clases: ClaseListItem[] }[] {
    const grupos = new Map<string, ClaseListItem[]>();
    for (const c of this.clasesFiltradas) {
      const nombre = c.actividad?.nombre ?? c.nombre;
      if (!grupos.has(nombre)) grupos.set(nombre, []);
      grupos.get(nombre)!.push(c);
    }
    return [...grupos.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([actividad, clases]) => ({
        actividad,
        clases: clases.sort(
          (a, b) =>
            (this.ORDEN_DIA[a.dia_semana] ?? 9) - (this.ORDEN_DIA[b.dia_semana] ?? 9) ||
            a.hora_inicio.localeCompare(b.hora_inicio),
        ),
      }));
  }

  labelProfesor(p: Profesor): string {
    return `${p.nombre} ${p.apellido} — DNI ${p.dni}`;
  }

  labelSala(s: Sala): string {
    return `${s.identificador} (máx. ${s.cupo})`;
  }

  fechasCancelacion: string[] = [];
  fechaCancelacionIndex = 0;
  slidingLeft = false;
  slidingRight = false;

  private getProximasFechas(clase: ClaseListItem, max: number = 8): string[] {
    if (clase.proximas_fechas && clase.proximas_fechas.length > 0) {
      return clase.proximas_fechas.slice(0, max);
    }
    const mapa: Record<string, number> = {
      Domingo: 0, Lunes: 1, Martes: 2, Miercoles: 3, Miércoles: 3,
      Jueves: 4, Viernes: 5, Sabado: 6, Sábado: 6,
    };
    const objetivo = mapa[clase.dia_semana];
    if (objetivo === undefined) return [];
    
    const fechas: string[] = [];
    const actual = new Date();
    while (actual.getDay() !== objetivo) {
      actual.setDate(actual.getDate() + 1);
    }
    for (let i = 0; i < max; i++) {
      fechas.push(this.getLocalIsoDate(actual));
      actual.setDate(actual.getDate() + 7);
    }
    return fechas;
  }

  onCancelar(clase: ClaseListItem): void {
    this.selectedClase = clase;
    this.fechasCancelacion = this.getProximasFechas(clase);
    this.fechaCancelacionIndex = 0;
    this.cancelarFecha = this.fechasCancelacion[0] ?? (clase.proximaFecha ?? '');
    this.modalError = '';
    this.showModalCancelar = true;
  }

  prevFechaCancelacion(): void {
    if (this.fechaCancelacionIndex > 0) {
      this.fechaCancelacionIndex--;
      this.cancelarFecha = this.fechasCancelacion[this.fechaCancelacionIndex];
      this.triggerDateAnimation('right');
    }
  }

  nextFechaCancelacion(): void {
    if (this.fechaCancelacionIndex < this.fechasCancelacion.length - 1) {
      this.fechaCancelacionIndex++;
      this.cancelarFecha = this.fechasCancelacion[this.fechaCancelacionIndex];
      this.triggerDateAnimation('left');
    }
  }

  private triggerDateAnimation(direction: 'left' | 'right'): void {
    this.slidingLeft = false;
    this.slidingRight = false;
    setTimeout(() => {
      if (direction === 'left') {
        this.slidingLeft = true;
      } else {
        this.slidingRight = true;
      }
    }, 10);
  }

  cerrarModalCancelar(): void {
    this.showModalCancelar = false;
    this.selectedClase = null;
    this.modalError = '';
    this.modalSubmitting = false;
    this.cancelarFecha = '';
  }

  submitCancelar(): void {
    if (!this.selectedClase || !this.cancelarFecha) {
      this.modalError = 'Debe proveer una fecha a cancelar';
      return;
    }

    this.modalSubmitting = true;
    this.modalError = '';
    this.clasesService
      .cancelar(this.selectedClase.id, { fecha: this.cancelarFecha })
      .subscribe({
        next: (res) => {
          const set =
            this.fechasCanceladasLocales.get(this.selectedClase!.id) ??
            new Set<string>();
          set.add(this.cancelarFecha);
          this.fechasCanceladasLocales.set(this.selectedClase!.id, set);
          this.toastService.showSuccess(res.message);
          this.cerrarModalCancelar();
          this.cargarClases();
        },
        error: (err) => {
          this.toastService.showError(err?.message ?? 'Ocurrió un error inesperado');
          this.modalSubmitting = false;
        },
      });
  }

  onEliminar(clase: ClaseListItem): void {
    this.selectedClase = clase;
    this.modalError = '';
    this.showModalEliminar = true;
  }

  cerrarModalEliminar(): void {
    this.showModalEliminar = false;
    this.selectedClase = null;
    this.modalError = '';
    this.modalSubmitting = false;
  }

  submitEliminar(): void {
    if (!this.selectedClase) {
      return;
    }

    this.modalSubmitting = true;
    this.modalError = '';
    const deletedId = this.selectedClase.id;
    this.clasesService.delete(deletedId).subscribe({
      next: (res) => {
        this.clases = this.clases.filter(
          (c) => c.id !== deletedId && isClaseActiva(c),
        );
        this.toastService.showSuccess(res.message);
        this.modalSubmitting = false;
        this.cerrarModalEliminar();
        this.cargarClases();
      },
      error: (err) => {
        this.toastService.showError(err?.message ?? 'Ocurrió un error inesperado');
        this.modalSubmitting = false;
        this.cerrarModalEliminar();
        this.cargarClases();
      },
    });
  }


  estadoLabel(clase: ClaseListItem): string {
    return clase.fechaCanceladaProxima ? 'Cancelada' : 'Activa';
  }

  estadoEsCancelada(clase: ClaseListItem): boolean {
    return clase.fechaCanceladaProxima;
  }

  formatFechaHora(clase: ClaseListItem): string {
    const dia = clase.dia_semana;
    const horario = `${clase.hora_inicio} – ${clase.hora_fin}`;
    if (clase.proximaFecha) {
      return `${this.formatFechaDisplay(clase.proximaFecha)} · ${dia} · ${horario}`;
    }
    return `${dia} · ${horario}`;
  }

  formatFechaDisplay(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  nombreActividad(clase: ClaseListItem): string {
    return clase.actividad?.nombre ?? clase.nombre;
  }

  nombreProfesor(clase: ClaseListItem): string {
    if (!clase.profesor) {
      return '—';
    }
    return `${clase.profesor.nombre} ${clase.profesor.apellido}`.trim();
  }

  nombreSala(clase: ClaseListItem): string {
    return clase.sala?.identificador ?? '—';
  }

  cupoLabel(clase: ClaseListItem): string {
    const max = clase.cupoMaximo ?? Number(clase.cupo ?? 0);
    const ocupado =
      clase.cupoOcupado === null || clase.cupoOcupado === undefined
        ? '—'
        : clase.cupoOcupado;
    return `${ocupado} / ${max}`;
  }

  /** % de ocupación (0–100) para la barra de cupo. */
  cupoPorcentaje(clase: ClaseListItem): number {
    const max = clase.cupoMaximo ?? Number(clase.cupo ?? 0);
    if (!max || max <= 0) return 0;
    const ocupado = clase.cupoOcupado ?? 0;
    return Math.max(0, Math.min(100, Math.round((ocupado / max) * 100)));
  }

  /** ¿La clase está completa (sin cupo disponible)? */
  cupoLleno(clase: ClaseListItem): boolean {
    const max = clase.cupoMaximo ?? Number(clase.cupo ?? 0);
    return max > 0 && (clase.cupoOcupado ?? 0) >= max;
  }

  onVerListaEspera(clase: ClaseListItem): void {
    this.selectedClase = clase;
    this.listaEsperaItems = [];
    this.listaEsperaError = '';
    this.showModalListaEspera = true;
    this.cargarListaEspera(clase.id);
  }

  cerrarModalListaEspera(): void {
    this.showModalListaEspera = false;
    this.selectedClase = null;
    this.listaEsperaItems = [];
    this.listaEsperaError = '';
    this.modalSubmitting = false;
  }

  private cargarListaEspera(claseId: number): void {
    this.listaEsperaLoading = true;
    this.listaEsperaError = '';
    this.listaEsperaService.getByClase(claseId).subscribe({
      next: (items) => {
        this.listaEsperaItems = items;
        this.listaEsperaLoading = false;
      },
      error: (err) => {
        this.listaEsperaError = this.listaEsperaService.mensajeError(err);
        this.listaEsperaLoading = false;
      },
    });
  }

  removerDeListaEspera(item: ListaEsperaItem): void {
    this.modalSubmitting = true;
    this.listaEsperaError = '';
    this.listaEsperaService.remover(item.id).subscribe({
      next: (res) => {
        this.toastService.showSuccess(res.message);
        this.modalSubmitting = false;
        if (this.selectedClase) {
          this.cargarListaEspera(this.selectedClase.id);
        }
      },
      error: (err) => {
        this.toastService.showError(this.listaEsperaService.mensajeError(err));
        this.modalSubmitting = false;
      },
    });
  }

  nombreClienteLista(item: ListaEsperaItem): string {
    if (item.cliente) {
      return `${item.cliente.nombre} ${item.cliente.apellido}`.trim();
    }
    return item.cliente_email;
  }

  tipoListaLabel(item: ListaEsperaItem): string {
    return item.tipo === 'MENSUAL' ? 'Abonado' : 'No abonado';
  }
}
