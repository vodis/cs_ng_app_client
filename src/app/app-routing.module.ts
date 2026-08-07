import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {
  localeRouteGuard,
  preferredLocaleRedirect,
} from '@core/routing/localized-routing.service';

const localizedRoutes: Routes = [
  {
    path: '',
    loadChildren: () =>
      import('./pages/home/home.module').then(m => m.HomeModule),
  },
  {
    path: '',
    loadChildren: () =>
      import('./pages/auth/auth.module').then(m => m.AuthModule),
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

const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: preferredLocaleRedirect,
  },
  {
    path: 'farm',
    pathMatch: 'full',
    redirectTo: '/en/farm',
  },
  {
    path: 'proposals',
    pathMatch: 'full',
    redirectTo: '/en/proposals',
  },
  {
    path: 'login',
    pathMatch: 'full',
    redirectTo: '/en/login',
  },
  {
    path: 'register',
    pathMatch: 'full',
    redirectTo: '/en/register',
  },
  {
    path: 'generate-wallet',
    pathMatch: 'full',
    redirectTo: '/en/generate-wallet',
  },
  {
    path: 'profile',
    pathMatch: 'full',
    redirectTo: '/en/profile',
  },
  {
    path: ':locale',
    canActivate: [localeRouteGuard],
    children: localizedRoutes,
  },
  {
    path: '**',
    redirectTo: '/en',
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
