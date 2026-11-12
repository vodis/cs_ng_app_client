import { NgModule } from '@angular/core';
import { SharedModule } from '@shared/shared.module';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CsMenuButtonDirective } from '@vodis/cs-ui/angular';
import { LayoutComponent } from './layout.component';
import { HeaderComponent } from '../header/header.component';

@NgModule({
  imports: [
    SharedModule,
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    CsMenuButtonDirective,
  ],
  providers: [],
  declarations: [LayoutComponent, HeaderComponent],
  exports: [LayoutComponent],
})
export class LayoutModule {}
