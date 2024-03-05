import { NgModule } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonModule } from '@angular/material/button';
import { AnimateLineComponent } from './components/animate-line/animate-line.component';
import { MatIconModule } from '@angular/material/icon';
import { WalletsComponent } from '@shared/mfe/wallets/wallets.component';
import { WalletBarComponent } from '@shared/components/wallet-bar/wallet-bar.component';
import { SideModalComponent } from '@shared/components/side-modal/side-modal.component';
import { CommonModule } from '@angular/common';

const AngularMaterial = [MatExpansionModule, MatButtonModule, MatIconModule];

@NgModule({
  imports: [...AngularMaterial, CommonModule],
  declarations: [
    AnimateLineComponent,
    WalletsComponent,
    WalletBarComponent,
    SideModalComponent,
  ],
  providers: [],
  exports: [
    AnimateLineComponent,
    WalletsComponent,
    WalletBarComponent,
    SideModalComponent,
    ...AngularMaterial,
  ],
})
export class SharedModule {}
