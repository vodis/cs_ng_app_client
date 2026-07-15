import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthSessionService } from '@core/auth/auth-session.service';
import { WalletGatewayBridgeService } from '@shared/mfe/wallets/wallet-gateway.bridge.service';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import { authPageTransition } from '../shared/auth-page.animations';
import {
  hasLinkedWallets,
  readReturnUrl,
} from '../shared/auth-navigation.helper';

@Component({
  selector: 'app-generate-wallet',
  standalone: false,
  templateUrl: './generate-wallet.component.html',
  styleUrls: ['./generate-wallet.component.scss'],
  animations: [authPageTransition],
})
export class GenerateWalletComponent implements OnInit {
  public walletLoading = false;
  public isOpenWalletConnectMenu = false;
  public error = '';
  public info = '';

  constructor(
    public readonly authSession: AuthSessionService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly walletsService: WalletsService,
    private readonly walletGatewayBridge: WalletGatewayBridgeService
  ) {}

  public async ngOnInit(): Promise<void> {
    const session = this.authSession.session;
    if (!session) {
      return;
    }

    if (await hasLinkedWallets(this.authSession, session.wallets.length)) {
      await this.router.navigateByUrl(
        readReturnUrl(this.route.snapshot.queryParamMap)
      );
    }
  }

  public connectExistingWallet(): void {
    this.error = '';
    this.info = '';
    this.isOpenWalletConnectMenu = true;
    this.walletsService.requestOpen();
  }

  public closeWalletConnectMenu(): void {
    this.isOpenWalletConnectMenu = false;
  }

  public async generateWallet(): Promise<void> {
    this.error = '';
    this.info = '';
    this.walletLoading = true;

    try {
      await this.walletGatewayBridge.createEmbeddedWallet();
      const wallets = await this.authSession.reloadWallets();
      if (wallets.length === 0) {
        throw new Error(
          'Wallet was created but profile refresh returned no wallets.'
        );
      }
      await this.router.navigateByUrl(
        readReturnUrl(this.route.snapshot.queryParamMap)
      );
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Wallet setup failed';
    } finally {
      this.walletLoading = false;
    }
  }

  public async finishAfterWalletLinked(): Promise<void> {
    this.error = '';
    this.info = '';
    this.walletLoading = true;

    try {
      const wallets = await this.authSession.reloadWallets();
      if (wallets.length === 0) {
        this.error = 'Connect or generate a wallet to continue.';
        return;
      }
      await this.router.navigateByUrl(
        readReturnUrl(this.route.snapshot.queryParamMap)
      );
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Wallet refresh failed';
    } finally {
      this.walletLoading = false;
    }
  }
}
