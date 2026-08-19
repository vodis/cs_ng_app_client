import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from '@core/auth/auth.guard';
import { SharedModule } from '@shared/shared.module';
import { AgentAuthorizationComponent } from './agent-authorization.component';
import { PortfolioApiService } from './portfolio-api.service';
import { PortfolioComponent } from './portfolio.component';

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
  declarations: [PortfolioComponent, AgentAuthorizationComponent],
  providers: [PortfolioApiService],
})
export class PortfolioModule {}
