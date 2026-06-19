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

function initializePrivyBridge(privyBridgeService: PrivyBridgeService) {
  return () => privyBridgeService.initialize();
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
      provide: APP_INITIALIZER,
      useFactory: initializePrivyBridge,
      deps: [PrivyBridgeService],
      multi: true,
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
