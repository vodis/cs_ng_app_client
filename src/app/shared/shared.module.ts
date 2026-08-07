import { NgModule } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonModule } from '@angular/material/button';
import { AnimateLineComponent } from './components/animate-line/animate-line.component';
import { AnimateTitleComponent } from './components/animate-title/animate-title.component';
import { MatIconModule } from '@angular/material/icon';
import { WalletsComponent } from '@shared/mfe/wallets/wallets.component';
import { WalletBarComponent } from '@shared/components/wallet-bar/wallet-bar.component';
import { WalletMenuComponent } from '@shared/components/wallet-menu/wallet-menu.component';
import { WalletAccountComponent } from '@shared/components/wallet-account/wallet-account.component';
import { SideModalComponent } from '@shared/components/side-modal/side-modal.component';
import { TokenSelectPanelComponent } from '@shared/components/token-select-panel/token-select-panel.component';
import { LiveChartComponent } from '@shared/components/live-chart/live-chart.component';
import { MarketOverviewChartComponent } from '@shared/components/market-overview-chart/market-overview-chart.component';
import { CommonModule } from '@angular/common';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { CsTranslationsModule } from '@vodis/cs-foundation/angular';

const AngularMaterial = [MatExpansionModule, MatButtonModule, MatIconModule];

@NgModule({
  imports: [
    ...AngularMaterial,
    CommonModule,
    FormsModule,
    HttpClientModule,
    CsTranslationsModule,
    WalletMenuComponent,
    WalletAccountComponent,
    AvatarComponent,
  ],
  declarations: [
    AnimateLineComponent,
    AnimateTitleComponent,
    WalletsComponent,
    WalletBarComponent,
    SideModalComponent,
    TokenSelectPanelComponent,
    LiveChartComponent,
    MarketOverviewChartComponent,
  ],
  providers: [],
  exports: [
    AnimateLineComponent,
    AnimateTitleComponent,
    WalletsComponent,
    WalletBarComponent,
    WalletMenuComponent,
    WalletAccountComponent,
    SideModalComponent,
    TokenSelectPanelComponent,
    LiveChartComponent,
    MarketOverviewChartComponent,
    AvatarComponent,
    CommonModule,
    FormsModule,
    HttpClientModule,
    CsTranslationsModule,
    ...AngularMaterial,
  ],
})
export class SharedModule {}
