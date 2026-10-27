import { NgModule } from '@angular/core';
import { SharedModule } from '@shared/shared.module';
import { AuthRoutingModule } from './auth-routing.module';
import { LoginComponent } from './login/login.component';
import { ProfileComponent } from './profile/profile.component';
import { RegisterComponent } from './register/register.component';
import { AuthSocialButtonsComponent } from './shared/auth-social-buttons.component';
import { TermsComponent } from './terms/terms.component';

@NgModule({
  imports: [SharedModule, AuthRoutingModule],
  declarations: [
    LoginComponent,
    ProfileComponent,
    RegisterComponent,
    TermsComponent,
    AuthSocialButtonsComponent,
  ],
})
export class AuthModule {}
