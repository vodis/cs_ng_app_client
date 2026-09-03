import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '@shared/shared.module';
import { PlaceholderPageComponent } from './placeholder-page.component';

const routes: Routes = [
  {
    path: 'home',
    component: PlaceholderPageComponent,
    data: { title: 'Home' },
  },
  {
    path: 'history',
    component: PlaceholderPageComponent,
    data: { title: 'History' },
  },
];

@NgModule({
  imports: [SharedModule, RouterModule.forChild(routes)],
  declarations: [PlaceholderPageComponent],
})
export class PlaceholderPageModule {}
