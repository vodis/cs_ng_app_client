import { NgModule } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonModule } from '@angular/material/button';
import { AnimateLineComponent } from './components/animate-line/animate-line.component';
import { MatIconModule } from '@angular/material/icon';
import { WalletsComponent } from '@shared/mfe/wallets/wallets.component';
import { WalletBarComponent } from '@shared/components/wallet-bar/wallet-bar.component';
import { WalletMenuComponent } from '@shared/components/wallet-menu/wallet-menu.component';
import { WalletAccountComponent } from '@shared/components/wallet-account/wallet-account.component';
import { SideModalComponent } from '@shared/components/side-modal/side-modal.component';
import { LiveChartComponent } from '@shared/components/live-chart/live-chart.component';
import { CommonModule } from '@angular/common';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

const AngularMaterial = [MatExpansionModule, MatButtonModule, MatIconModule];

@NgModule({
  imports: [
    ...AngularMaterial,
    CommonModule,
    FormsModule,
    HttpClientModule,
    WalletMenuComponent,
    WalletAccountComponent,
    AvatarComponent,
  ],
  declarations: [
    AnimateLineComponent,
    WalletsComponent,
    WalletBarComponent,
    SideModalComponent,
    LiveChartComponent,
  ],
  providers: [],
  exports: [
    AnimateLineComponent,
    WalletsComponent,
    WalletBarComponent,
    WalletMenuComponent,
    WalletAccountComponent,
    SideModalComponent,
    LiveChartComponent,
    AvatarComponent,
    CommonModule,
    FormsModule,
    HttpClientModule,
    ...AngularMaterial,
  ],
})
export class SharedModule {}
