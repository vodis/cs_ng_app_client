import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    loadChildren: () =>
      import('./pages/home/home.module').then(m => m.HomeModule),
  },
  {
    path: 'farm',
    loadChildren: () =>
      import('./pages/farm/farm.module').then(m => m.FarmModule),
  },
  {
    path: 'proposals',
    loadChildren: () =>
      import('./pages/proposal/proposal.module').then(m => m.ProposalModule),
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      onSameUrlNavigation: 'reload',
    }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
