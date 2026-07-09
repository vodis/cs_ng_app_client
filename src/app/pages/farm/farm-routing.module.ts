import { RouterModule, Routes } from '@angular/router';
import { FarmComponent } from './farm.component';
import { NgModule } from '@angular/core';
import { AuthGuard } from '@core/auth/auth.guard';

const routes: Routes = [
  {
    path: '',
    component: FarmComponent,
    canActivate: [AuthGuard],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class FarmRoutingModule {}
