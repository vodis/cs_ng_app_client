import { NgModule } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { AnimateLineComponent } from './components/animate-line/animate-line.component';

const AngularMaterial = [MatExpansionModule];

@NgModule({
  imports: [...AngularMaterial],
  declarations: [AnimateLineComponent],
  providers: [],
  exports: [AnimateLineComponent, ...AngularMaterial],
})
export class SharedModule {}
