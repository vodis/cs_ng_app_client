import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from '@core/auth/auth.guard';
import { SharedModule } from '@shared/shared.module';
import { AgentAuthorizationComponent } from './agent-authorization.component';
import { AccountSessionsComponent } from './account-sessions.component';
import { PortfolioContextComponent } from './portfolio-context.component';
import { PortfolioComponent } from './portfolio.component';
import { PortfolioHoldingsComponent } from './portfolio-holdings.component';

const routes: Routes = [
  { path: '', component: PortfolioComponent, canActivate: [AuthGuard] },
  {
    path: 'agent/authorize',
    component: AgentAuthorizationComponent,
    canActivate: [AuthGuard],
  },
];

@NgModule({
  imports: [SharedModule, RouterModule.forChild(routes)],
  declarations: [
    PortfolioComponent,
    PortfolioHoldingsComponent,
    PortfolioContextComponent,
    AgentAuthorizationComponent,
    AccountSessionsComponent,
  ],
})
export class PortfolioModule {}
