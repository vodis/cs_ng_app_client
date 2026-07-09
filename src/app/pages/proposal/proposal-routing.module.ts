import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ProposalComponent } from '../proposal/proposal.component';
import { AuthGuard } from '@core/auth/auth.guard';

const routes: Routes = [
  {
    path: '',
    component: ProposalComponent,
    canActivate: [AuthGuard],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ProposalRoutingModule {}
