import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import { environment } from '../../../environments/environment';

interface OneClickQuoteRequest {
  dry: boolean;
  slippageTolerance: number;
  originAsset: string;
  destinationAsset: string;
  amount: string;
  deadline: string;
  userAddress: string;
  authMethod: 'evm';
  swapType: 'EXACT_INPUT';
  isConfidential: boolean;
  isAuthenticated: boolean;
}

interface QuoteApiResponse {
  data: unknown;
}

@Component({
  selector: 'app-home',
  standalone: false,
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent {
  private readonly usdcAsset =
    'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near';
  private readonly nearAsset = 'nep141:wrap.near';

  public amount = '1';
  public walletAddress = '';
  public readonly fromAssetLabel = 'USDC';
  public readonly toAssetLabel = 'NEAR';
  public readonly fromAssetId = this.usdcAsset;
  public readonly toAssetId = this.nearAsset;
  public isQuoteLoading = false;
  public quoteError = '';
  public quoteResult: unknown;

  constructor(
    private readonly httpClient: HttpClient,
    private readonly walletsService: WalletsService
  ) {
    this.walletsService.account.subscribe(account => {
      if (account?.account) {
        this.walletAddress = account.account;
      }
    });
  }

  public submitQuote(): void {
    this.quoteError = '';
    this.quoteResult = undefined;

    if (!this.walletAddress) {
      this.quoteError = 'Connect wallet first.';
      return;
    }

    const amount = this.toUsdcBaseUnits(this.amount);

    if (!amount || amount === '0') {
      this.quoteError = 'Enter a valid USDC amount.';
      return;
    }

    this.isQuoteLoading = true;

    this.httpClient
      .post<QuoteApiResponse>(`${environment.apiUrl}/api/v1/quotes/one-click`, {
        dry: true,
        slippageTolerance: 50,
        originAsset: this.usdcAsset,
        destinationAsset: this.nearAsset,
        amount,
        deadline: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        userAddress: this.walletAddress,
        authMethod: 'evm',
        swapType: 'EXACT_INPUT',
        isConfidential: false,
        isAuthenticated: true,
      } satisfies OneClickQuoteRequest)
      .subscribe({
        next: response => {
          this.quoteResult = response.data;
          this.isQuoteLoading = false;
        },
        error: error => {
          this.quoteError =
            error?.error?.message || 'Quote request failed. Try again.';
          this.isQuoteLoading = false;
        },
      });
  }

  private toUsdcBaseUnits(value: string): string {
    const normalized = value.trim();

    if (!/^\d+(\.\d{0,6})?$/.test(normalized)) {
      return '';
    }

    const [whole, fraction = ''] = normalized.split('.');
    return `${whole}${fraction.padEnd(6, '0')}`.replace(/^0+(?=\d)/, '');
  }
}
