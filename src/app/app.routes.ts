import { Routes } from '@angular/router';
import { CatalogListComponent } from './catalog/catalog-list/catalog-list.component';
import { LoginComponent } from './auth/login/login.component';
import { RegisterComponent } from './auth/register/register.component';
import { ConfirmComponent } from './auth/confirm/confirm.component';
import { AdministrativoDashboardComponent } from './administrativo/administrativo-dashboard/administrativo-dashboard.component';
import { EditarUsuarioComponent } from './administrativo/editar-usuario/editar-usuario.component';
import { WelcomeComponent } from './pages/welcome/welcome.component';
import { authGuard } from './guards/auth.guard';
import { administrativoGuard } from './guards/administrativo.guard';
import { MiInformacionComponent } from './pages/mi-informacion/mi-informacion.component';
import { EditarPerfilComponent } from './pages/editar-perfil/editar-perfil.component';
import { CambiarPasswordComponent } from './pages/cambiar-password/cambiar-password.component';
import { MisReservasComponent } from './pages/mis-reservas/mis-reservas.component';
import { ClasesDisponiblesComponent } from './pages/clases-disponibles/clases-disponibles.component';
import { MiQrComponent } from './pages/mi-qr/mi-qr.component';
import { HistorialAsistenciaComponent } from './pages/historial-asistencia/historial-asistencia.component';
import { EscanearQrComponent } from './administrativo/escanear-qr/escanear-qr.component';
import { AsistenciaManualComponent } from './administrativo/asistencia-manual/asistencia-manual.component';
import { RecuperarPasswordComponent } from './auth/recuperar-password/recuperar-password.component';
import { NuevaPasswordComponent } from './auth/nueva-password/nueva-password.component';

export const routes: Routes = [
  { path: '', component: WelcomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'registro', component: RegisterComponent },
  { path: 'confirmar/:token', component: ConfirmComponent },
  { path: 'recuperar-password', component: RecuperarPasswordComponent },
  /** Alias del enlace del email del backend: /recuperar-password/{token} */
  { path: 'recuperar-password/:token', component: NuevaPasswordComponent },
  { path: 'nueva-password/:token', component: NuevaPasswordComponent },

  { path: 'mi-informacion', component: MiInformacionComponent, canActivate: [authGuard] },
  { path: 'editar-perfil', component: EditarPerfilComponent, canActivate: [authGuard] },
  { path: 'cambiar-password', component: CambiarPasswordComponent, canActivate: [authGuard] },
  { path: 'clases', component: ClasesDisponiblesComponent, canActivate: [authGuard] },
  { path: 'mis-reservas', component: MisReservasComponent, canActivate: [authGuard] },
  { path: 'mi-qr', component: MiQrComponent, canActivate: [authGuard] },
  { path: 'historial-asistencia', component: HistorialAsistenciaComponent, canActivate: [authGuard] },
  // Administrativo / Recepcionista
  { path: 'administrativo', component: AdministrativoDashboardComponent, canActivate: [authGuard, administrativoGuard] },
  { path: 'administrativo/escanear-qr', component: EscanearQrComponent, canActivate: [authGuard, administrativoGuard] },
  { path: 'administrativo/asistencia-manual', component: AsistenciaManualComponent, canActivate: [authGuard, administrativoGuard] },
  {
    path: 'administrativo/usuarios/:email/editar',
    component: EditarUsuarioComponent,
    canActivate: [authGuard, administrativoGuard],
  },
];
