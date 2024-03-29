import { NgModule } from '@angular/core';
import { SharedModule } from '@shared/shared.module';
import { HomeComponent } from './home.component';
import { HomeRoutingModule } from './home-routing.module';

@NgModule({
  imports: [SharedModule, HomeRoutingModule],
  providers: [],
  declarations: [HomeComponent],
  exports: [SharedModule],
})
export class HomeModule {}
