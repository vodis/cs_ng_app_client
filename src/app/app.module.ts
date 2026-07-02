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
import { AuthProviderService } from '@core/auth/auth-provider.service';
import {
  NgxGoogleAnalyticsModule,
  provideGoogleAnalytics,
} from '@hakimio/ngx-google-analytics';

function initializeAuthProvider(authProvider: AuthProviderService) {
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
    NgxGoogleAnalyticsModule,
  ],
  providers: [
    provideAnimationsAsync(),
    provideGoogleAnalytics('G-XL80CN2QPP'),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAuthProvider,
      deps: [AuthProviderService],
      multi: true,
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
