import { Routes } from '@angular/router';
import { CatalogListComponent } from './catalog/catalog-list/catalog-list.component';
import { LoginComponent } from './auth/login/login.component';
import { RegisterComponent } from './auth/register/register.component';
import { ConfirmComponent } from './auth/confirm/confirm.component';
import { AdminDashboardComponent } from './admin/admin-dashboard/admin-dashboard.component';
import { EditarUsuarioComponent } from './admin/editar-usuario/editar-usuario.component';
import { WelcomeComponent } from './pages/welcome/welcome.component';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { MiInformacionComponent } from './pages/mi-informacion/mi-informacion.component';
import { EditarPerfilComponent } from './pages/editar-perfil/editar-perfil.component';
import { CambiarPasswordComponent } from './pages/cambiar-password/cambiar-password.component';
import { MisReservasComponent } from './pages/mis-reservas/mis-reservas.component';
import { ClasesDisponiblesComponent } from './pages/clases-disponibles/clases-disponibles.component';
import { RecuperarPasswordComponent } from './auth/recuperar-password/recuperar-password.component';
import { NuevaPasswordComponent } from './auth/nueva-password/nueva-password.component';

export const routes: Routes = [
  { path: '', component: WelcomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'registro', component: RegisterComponent },
  { path: 'confirmar/:token', component: ConfirmComponent },
  { path: 'recuperar-password', component: RecuperarPasswordComponent },
  { path: 'nueva-password/:token', component: NuevaPasswordComponent },
  { path: 'catalogo', component: CatalogListComponent, canActivate: [authGuard] },
  { path: 'mi-informacion', component: MiInformacionComponent, canActivate: [authGuard] },
  { path: 'editar-perfil', component: EditarPerfilComponent, canActivate: [authGuard] },
  { path: 'cambiar-password', component: CambiarPasswordComponent, canActivate: [authGuard] },
  { path: 'clases', component: ClasesDisponiblesComponent, canActivate: [authGuard] },
  { path: 'mis-reservas', component: MisReservasComponent, canActivate: [authGuard] },
  { path: 'admin', component: AdminDashboardComponent, canActivate: [authGuard, adminGuard] },
  {
    path: 'admin/usuarios/:email/editar',
    component: EditarUsuarioComponent,
    canActivate: [authGuard, adminGuard],
  },
];
