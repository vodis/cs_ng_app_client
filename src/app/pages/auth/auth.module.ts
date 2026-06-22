import { NgModule } from '@angular/core';
import { SharedModule } from '@shared/shared.module';
import { AuthRoutingModule } from './auth-routing.module';
import { LoginComponent } from './login/login.component';
import { ProfileComponent } from './profile/profile.component';

@NgModule({
  imports: [SharedModule, AuthRoutingModule],
  declarations: [LoginComponent, ProfileComponent],
})
export class AuthModule {}
