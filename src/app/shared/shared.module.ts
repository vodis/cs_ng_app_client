import { NgModule } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonModule } from '@angular/material/button';
import { AnimateLineComponent } from './components/animate-line/animate-line.component';
import { MatIconModule } from '@angular/material/icon';

const AngularMaterial = [MatExpansionModule, MatButtonModule, MatIconModule];

@NgModule({
  imports: [...AngularMaterial],
  declarations: [AnimateLineComponent],
  providers: [],
  exports: [AnimateLineComponent, ...AngularMaterial],
})
export class SharedModule {}
