import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from '@core/auth/auth.guard';
import { SharedModule } from '@shared/shared.module';
import { PlaceholderPageComponent } from './placeholder-page.component';

const routes: Routes = [
  {
    path: 'home',
    component: PlaceholderPageComponent,
    canActivate: [AuthGuard],
    data: { title: 'Home' },
  },
  {
    path: 'history',
    component: PlaceholderPageComponent,
    canActivate: [AuthGuard],
    data: { title: 'History' },
  },
  {
    path: 'portfolio',
    component: PlaceholderPageComponent,
    canActivate: [AuthGuard],
    data: { title: 'Portfolio' },
  },
];

@NgModule({
  imports: [SharedModule, RouterModule.forChild(routes)],
  declarations: [PlaceholderPageComponent],
})
export class PlaceholderPageModule {}
