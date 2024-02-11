import { RouterModule, Routes } from '@angular/router';
import { FarmComponent } from './farm.component';
import { NgModule } from '@angular/core';

const routes: Routes = [
  {
    path: '',
    component: FarmComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class FarmRoutingModule {}
