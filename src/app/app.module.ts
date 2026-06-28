import { APP_INITIALIZER, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HeaderComponent } from '@components/header/header.component';
import { LayoutComponent } from '@components/layout/layout.component';
import { SidebarComponent } from '@components/sidebar/sidebar.component';
import { SharedModule } from '@shared/shared.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { PrivyBridgeService } from '@core/privy/privy-bridge.service';
import { AuthProviderGateway } from '@core/auth/auth-provider.gateway';

function initializeAuthProvider(authProvider: AuthProviderGateway) {
  return () => {
    void authProvider.initialize();
  };
}

@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    LayoutComponent,
    SidebarComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    SharedModule,
  ],
  providers: [
    provideAnimationsAsync(),
    {
      provide: AuthProviderGateway,
      useExisting: PrivyBridgeService,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAuthProvider,
      deps: [AuthProviderGateway],
      multi: true,
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
