import { NgModule } from '@angular/core';
import { SharedModule } from '@shared/shared.module';
import { FarmComponent } from './farm.component';
import { FarmRoutingModule } from './farm-routing.module';

@NgModule({
  imports: [SharedModule, FarmRoutingModule],
  providers: [],
  declarations: [FarmComponent],
  exports: [SharedModule],
})
export class FarmModule {}
