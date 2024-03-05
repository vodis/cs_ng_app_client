import { NgModule } from '@angular/core';
import { SharedModule } from '@shared/shared.module';
import { ProposalRoutingModule } from './proposal-routing.module';
import { ProposalComponent } from './proposal.component';

@NgModule({
  imports: [SharedModule, ProposalRoutingModule],
  providers: [],
  declarations: [ProposalComponent],
  exports: [SharedModule],
})
export class ProposalModule {}
