import { NgModule } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { A11yModule } from '@angular/cdk/a11y';
import { OverlayModule } from '@angular/cdk/overlay';
import { AnimateLineComponent } from './components/animate-line/animate-line.component';
import { AnimateTitleComponent } from './components/animate-title/animate-title.component';
import { MatIconModule } from '@angular/material/icon';
import { WalletsComponent } from '@shared/mfe/wallets/wallets.component';
import { WalletBarComponent } from '@shared/components/wallet-bar/wallet-bar.component';
import { WalletMenuComponent } from '@shared/components/wallet-menu/wallet-menu.component';
import { WalletAccountComponent } from '@shared/components/wallet-account/wallet-account.component';
import { ConnectedWalletBoardComponent } from '@shared/components/connected-wallet-board/connected-wallet-board.component';
import { SparklineComponent } from '@shared/components/sparkline/sparkline.component';
import { SideModalComponent } from '@shared/components/side-modal/side-modal.component';
import { TokenSelectPanelComponent } from '@shared/components/token-select-panel/token-select-panel.component';
import { LiveChartComponent } from './components/live-chart/live-chart.component';
import { MarketOverviewChartComponent } from './components/market-overview-chart/market-overview-chart.component';
import { CommonModule } from '@angular/common';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { CsTranslationsModule } from '@vodis/cs-foundation/angular';
import { RecipientAddressPanelComponent } from '@shared/components/recipient-address-panel/recipient-address-panel.component';
import { SlippageSettingsPanelComponent } from './components/slippage-settings-panel/slippage-settings-panel.component';
import { AddFundsPanelComponent } from './components/add-funds-panel/add-funds-panel.component';

const AngularMaterial = [
  MatExpansionModule,
  MatButtonModule,
  MatIconModule,
  MatMenuModule,
];

@NgModule({
  imports: [
    ...AngularMaterial,
    A11yModule,
    OverlayModule,
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
    ConnectedWalletBoardComponent,
    SparklineComponent,
    SideModalComponent,
    TokenSelectPanelComponent,
    RecipientAddressPanelComponent,
    SlippageSettingsPanelComponent,
    AddFundsPanelComponent,
    LiveChartComponent,
    MarketOverviewChartComponent,
  ],
  providers: [],
  exports: [
    AnimateLineComponent,
    AnimateTitleComponent,
    WalletsComponent,
    WalletBarComponent,
    ConnectedWalletBoardComponent,
    SparklineComponent,
    WalletMenuComponent,
    WalletAccountComponent,
    SideModalComponent,
    TokenSelectPanelComponent,
    RecipientAddressPanelComponent,
    SlippageSettingsPanelComponent,
    AddFundsPanelComponent,
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
