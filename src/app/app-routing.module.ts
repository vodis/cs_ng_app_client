import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {
  localeRouteGuard,
  preferredLocalePath,
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
    path: 'portfolio',
    loadChildren: () =>
      import('./pages/portfolio/portfolio.module').then(m => m.PortfolioModule),
  },
  {
    path: '',
    loadChildren: () =>
      import('./pages/placeholder/placeholder-page.module').then(
        m => m.PlaceholderPageModule
      ),
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
    redirectTo: () => preferredLocalePath('/farm'),
  },
  {
    path: 'home',
    pathMatch: 'full',
    redirectTo: () => preferredLocalePath('/home'),
  },
  {
    path: 'history',
    pathMatch: 'full',
    redirectTo: () => preferredLocalePath('/history'),
  },
  {
    path: 'portfolio',
    pathMatch: 'full',
    redirectTo: () => preferredLocalePath('/portfolio'),
  },
  {
    path: 'proposals',
    pathMatch: 'full',
    redirectTo: () => preferredLocalePath('/proposals'),
  },
  {
    path: 'login',
    pathMatch: 'full',
    redirectTo: () => preferredLocalePath('/login'),
  },
  {
    path: 'register',
    pathMatch: 'full',
    redirectTo: () => preferredLocalePath('/register'),
  },
  {
    path: 'generate-wallet',
    pathMatch: 'full',
    redirectTo: () => preferredLocalePath('/profile'),
  },
  {
    path: 'profile',
    pathMatch: 'full',
    redirectTo: () => preferredLocalePath('/profile'),
  },
  {
    path: ':locale',
    canActivate: [localeRouteGuard],
    children: localizedRoutes,
  },
  {
    path: '**',
    redirectTo: preferredLocaleRedirect,
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
