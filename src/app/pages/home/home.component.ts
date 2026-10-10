import {
  tokenBalance,
  hasPositiveBalance,
} from '@shared/utils/balance-asset.utils';
import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import { ExchangeAssetsService } from '@shared/services/exchange-assets.service';
import { MarketSnapshotsService } from '@shared/services/market-snapshots.service';
import {
  WalletBalance,
  WalletBalancesService,
} from '@shared/services/wallet-balances.service';
import { SwapExecutableQuoteCoordinator } from '@domains/exchange/application/swap-executable-quote.coordinator';
import {
  formatCompactUsd,
  hostnameLabel,
  type WalletMarketSnapshot,
  type WalletMarketSocialLink,
} from '@shared/utils/market-display.util';
import { explorerUrlForToken } from '@shared/utils/token-explorer.utils';
import {
  TOKEN_PROJECT_MOCKS,
  type TokenProjectMock,
} from './token-project.mock';
import { catchError, map, of, Subscription, timer } from 'rxjs';
import { ExchangeToken } from '@shared/models/exchange-token.model';
import {
  SwapFlowFacade,
  type SwapFormInput,
} from '@domains/exchange/application/swap-flow.facade';
import type {
  SwapFlowState,
  SwapQuotePreview,
} from '@domains/exchange/models/swap.models';
import { environment } from '../../../environments/environment';
import {
  changeClass as changePriceClass,
  formatPercent as formatPricePercent,
  formatPrice as formatCurrencyPrice,
  formatSwapFiatEstimate,
  isFreshAssetPrice,
} from './home-price.utils';
import {
  AMOUNT_DECIMAL_SEPARATOR,
  atomicToDecimal,
  decimalToAtomic,
  displayHasDecimalSeparator,
  formatSwapAmountDisplay,
  isCanonicalDecimalAmount,
  normalizeAmountInputChars,
  normalizeAmountStorage as normalizeSwapAmountStorage,
  resolveAmountKeydownAction,
} from '@shared/utils/amount-format.utils';
import { formatTokenEquivalentLabel } from '@shared/utils/token-equivalent-format.utils';
import {
  EXCHANGE_TOKEN_ICON_URLS,
  enrichExchangeToken,
  resolveExchangeTokenIconUrl,
  tokenAvatarFallback,
  tokenAvatarLabel,
} from '@shared/utils/token-avatar.utils';
import type { MarketOverviewChartSeries } from '@shared/components/market-overview-chart/market-overview-chart.component';
import type { WalletTokenOption } from '@shared/components/token-select-panel/token-select-panel.models';
import {
  DEFAULT_SLIPPAGE_TOLERANCE_BPS,
  formatSlippagePercentLabel,
  minimumReceivedAtomic,
} from '@shared/components/slippage-settings-panel/slippage-settings.utils';
import {
  networkLabel,
  recipientAddressError,
  walletBlockchain,
} from '@shared/utils/network.utils';
import {
  ActiveWalletFacade,
  type ActiveWalletState,
} from '@domains/wallet/application/active-wallet.facade';
import { WalletGatewayBridgeService } from '@shared/mfe/wallets/wallet-gateway.bridge.service';
import type { WalletSwapReview } from '@mfe-contracts/swap-review.types';
import { createTraceId } from '@core/trace/create-trace-id';

type TokenSelectorSide = 'from' | 'to';

type ComparisonTimeframe = '1H' | '1D' | '1W';
type MarketChartMode = 'price' | 'relative';

interface MarketComparisonToken {
  symbol: string;
  name?: string;
  icon?: string;
  currentPrice?: number;
  changePercent?: number;
  historyAvailable: boolean;
}

interface MarketComparisonPoint {
  time: number;
  value: number;
}

interface MarketComparisonSeries {
  symbol: string;
  points: MarketComparisonPoint[];
}

interface MarketComparisonResponse {
  base: string;
  quote: string;
  timeframe: ComparisonTimeframe;
  status: 'ready' | 'partial' | 'unavailable';
  baseToken: MarketComparisonToken;
  quoteToken: MarketComparisonToken;
  relativeStrength?: number;
  series: MarketComparisonSeries[];
}

interface ComparisonChartSeries {
  symbol: string;
  points: MarketComparisonPoint[];
}

@Component({
  selector: 'app-home',
  standalone: false,
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly maxAmountFractionDigits = 18;

  public exchangeTokens: ExchangeToken[] = [
    {
      symbol: 'USDC',
      name: 'USD Coin',
      assetId:
        'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near',
      color: '#2f8cff',
      blockchain: 'eth',
      decimals: 6,
      icon: 'https://s2.coinmarketcap.com/static/img/coins/128x128/3408.png',
    },
    {
      symbol: 'NEAR',
      name: 'NEAR Protocol',
      assetId: 'near:native',
      executionAssetId: 'nep141:wrap.near',
      color: '#2fd17c',
      blockchain: 'near',
      decimals: 24,
      icon: 'https://s2.coinmarketcap.com/static/img/coins/128x128/6535.png',
    },
  ];

  public amount = '';
  /** When set by clicking To balance, shown in the To field instead of the quote. */
  public toAmountManual = '';
  public walletAddress = '';
  public walletChainId: number | null = null;
  public walletChainType: 'ethereum' | 'near' | 'ton' | undefined;
  public fromToken = this.exchangeTokens[0];
  public toToken = this.exchangeTokens[1];
  public isTokenSelectorOpen = false;
  public tokenSelectorSide: TokenSelectorSide | null = null;
  public isRecipientPanelOpen = false;
  public isSlippageSettingsOpen = false;
  public slippageToleranceBps = DEFAULT_SLIPPAGE_TOLERANCE_BPS;
  public confidentialSwap = false;
  public slippageDraftBps = DEFAULT_SLIPPAGE_TOLERANCE_BPS;
  public recipientAddress = '';
  public crossNetworkRecipientIntentSignEnabled =
    environment.crossNetworkRecipientIntentSignEnabled;
  public swapFlowState: SwapFlowState = 'idle';
  public quoteError = '';
  public quotePreview: SwapQuotePreview | undefined;
  public quoteResult: Record<string, unknown> | undefined;
  public intentHash = '';
  public comparison?: MarketComparisonResponse;
  public comparisonChartSeries: MarketOverviewChartSeries[] = [];
  public comparisonLoading = true;
  public comparisonError = '';
  public selectedComparisonTimeframe: ComparisonTimeframe = '1H';
  public selectedMarketChartMode: MarketChartMode = 'price';
  public readonly comparisonTimeframes: ComparisonTimeframe[] = [
    '1H',
    '1D',
    '1W',
  ];
  /** Temporary display labels until market/product metadata comes from the BFF. */
  public readonly marketMetaMock = {
    market: 'Spot',
    product: 'Token Exchange',
  } as const;
  public showAdvancedMarketView = false;
  public exchangeAssetsLoading = false;
  public exchangeAssetsError = '';
  public balancesLoading = false;
  public balancesError = '';
  public reviewBusy = false;
  public reviewActionError = '';

  @ViewChild('fromAmountInput')
  private fromAmountInput?: ElementRef<HTMLInputElement>;

  private walletBalances: WalletBalance[] = [];
  private reviewBalanceSub?: Subscription;
  private reviewQuote?: { cancel: () => void };
  private reviewGeneration = 0;
  private tokenMarkets = new Map<string, WalletMarketSnapshot>();
  private comparisonRequestKey = '';
  public activeWallet: ActiveWalletState = {
    connected: false,
    canRequestSwap: false,
    reason: 'Sign in to use your wallet.',
  };
  private walletContextKey = '';
  private activeReviewTraceId = '';

  constructor(
    private readonly httpClient: HttpClient,
    private readonly walletsService: WalletsService,
    private readonly swapFlowFacade: SwapFlowFacade,
    private readonly exchangeAssetsService: ExchangeAssetsService,
    private readonly marketSnapshots: MarketSnapshotsService,
    private readonly activeWalletFacade: ActiveWalletFacade,
    private readonly walletBalancesService: WalletBalancesService,
    private readonly executableQuotes: SwapExecutableQuoteCoordinator,
    private readonly walletGatewayBridge: WalletGatewayBridgeService
  ) {
    this.activeWalletFacade.revalidateBalances();
    this.activeWalletFacade.state$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(state => {
        const previous = this.activeWallet;
        if (
          previous.userId !== state.userId ||
          previous.sessionId !== state.sessionId ||
          previous.wallet?.id !== state.wallet?.id ||
          previous.network !== state.network
        ) {
          this.walletBalances = [];
          this.balancesError = '';
        }
        this.activeWallet = state;
        const key = [
          state.userId,
          state.sessionId,
          state.wallet?.id,
          state.network,
          state.canRequestSwap,
        ].join('|');
        if (key === this.walletContextKey) return;
        this.walletContextKey = key;
        this.walletAddress = state.wallet?.address ?? '';
        this.walletChainId = state.network?.startsWith('eip155:')
          ? Number(state.network.split(':')[1])
          : null;
        const chainType = state.wallet?.chainType;
        this.walletChainType =
          chainType === 'near' ||
          chainType === 'ethereum' ||
          chainType === 'ton'
            ? chainType
            : undefined;
        this.recipientAddress = '';
        this.swapFlowFacade.reset();
        this.alignSelectionsToWallet();
        this.refreshSwapQuotePreview();
      });
    this.activeWalletFacade.balances$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(state => {
        this.walletBalances = state.rows;
        this.balancesLoading = state.status === 'loading';
        this.balancesError =
          state.errorMessage ??
          (state.status === 'idle'
            ? this.activeWallet.wallet
              ? 'Select a wallet network to load balances.'
              : 'Select an active wallet to view holdings.'
            : '');
      });
    this.exchangeAssetsService
      .watchPrices()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(tokens => {
        const prices = new Map(tokens.map(token => [token.assetId, token]));
        const refresh = (token: ExchangeToken): ExchangeToken => ({
          ...token,
          priceUsd: prices.get(token.assetId)?.priceUsd,
          priceUpdatedAt: prices.get(token.assetId)?.priceUpdatedAt,
        });
        this.exchangeTokens = this.exchangeTokens.map(refresh);
        this.fromToken = refresh(this.fromToken);
        this.toToken = refresh(this.toToken);
        this.changeDetector.markForCheck();
      });
    // Re-evaluate time-based quote/balance eligibility even without wallet events.
    timer(1_000, 1_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.changeDetector.markForCheck());

    this.walletsService.swapSubmitted
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        if (!result || result.traceId !== this.activeReviewTraceId) return;
        this.activeReviewTraceId = '';
        this.swapFlowFacade.reset();
        this.intentHash = result.intentHash;
      });

    this.walletsService.swapPreviewRefreshRequested
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(traceId => {
        if (!traceId || traceId !== this.activeReviewTraceId) return;
        this.activeReviewTraceId = '';
        this.refreshSwapQuotePreview();
      });

    this.swapFlowFacade.state$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(state => {
        this.swapFlowState = state;
      });

    this.swapFlowFacade.quotePreview$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(preview => {
        this.quotePreview = preview;
        this.quoteResult = preview?.raw;
      });

    this.swapFlowFacade.error$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(error => {
        this.quoteError = error?.message ?? '';
      });

    this.swapFlowFacade.intentHash$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(intentHash => {
        this.intentHash = intentHash ?? '';
      });

    this.destroyRef.onDestroy(() => {
      this.reviewQuote?.cancel();
      this.reviewBalanceSub?.unsubscribe();
    });
    this.loadExchangeAssets();
    this.loadMarketComparison();
  }

  public submitQuote(): void {
    if (!this.activeWallet.wallet) {
      this.quoteError = '';
      this.activeWalletFacade.requestConnection();
      return;
    }

    const recipientError = this.recipientValidationError();
    if (recipientError) {
      this.quoteError = recipientError;
      if (this.isForeignDestination()) this.openRecipientPanel();
      return;
    }

    const amount = this.toBaseUnits(this.amount, this.fromToken.decimals);

    if (!amount || /^0+$/.test(amount)) {
      this.quoteError = `Enter a valid ${this.fromToken.symbol} amount.`;
      return;
    }

    if (this.fundingSourceError()) {
      return;
    }

    if (this.canReviewSwap()) {
      this.beginSwapReview(amount);
      return;
    }

    this.swapFlowFacade.refreshQuotePreview(this.buildSwapInput(amount));
  }

  public isQuoteLoading(): boolean {
    return (
      this.swapFlowState === 'requestingQuote' ||
      this.swapFlowState === 'validating' ||
      this.swapFlowState === 'awaitingUserSignature' ||
      this.swapFlowState === 'submittingTransaction'
    );
  }

  public canReviewSwap(): boolean {
    const preview = this.quotePreview;
    const input = this.buildQuotePreviewInput();
    return Boolean(
      this.activeWallet.canRequestSwap &&
      preview &&
      input &&
      /^\d+$/.test(preview.amountOutAtomic) &&
      !/^0+$/.test(preview.amountOutAtomic) &&
      Date.parse(preview.expiresAt) > Date.now() &&
      !this.fundingSourceError() &&
      this.destinationTargetMatchesQuote()
    );
  }

  public canRetryQuote(): boolean {
    const input = this.buildQuotePreviewInput();
    return (
      this.activeWallet.canRequestSwap &&
      this.swapFlowState === 'idle' &&
      Boolean(
        this.quoteError ||
        (this.quotePreview &&
          !(Date.parse(this.quotePreview.expiresAt) > Date.now()))
      ) &&
      !this.canReviewSwap() &&
      Boolean(input) &&
      !this.fundingSourceError()
    );
  }

  public isPrimaryActionDisabled(): boolean {
    return (
      this.reviewBusy ||
      Boolean(
        this.activeWallet.wallet &&
        !this.canReviewSwap() &&
        !this.canRetryQuote()
      )
    );
  }

  private buildSwapInput(amount: string): SwapFormInput {
    return {
      source: this.reviewToken(this.fromToken),
      destination: this.reviewToken(this.toToken),
      amount,
      account: this.walletAddress,
      recipient: this.effectiveRecipient(),
      network: {
        id: this.balanceNetwork() ?? '',
        label: this.tokenNetworkLabel(this.fromToken),
      },
      slippageToleranceBps: this.slippageToleranceBps,
      confidential: this.confidentialSwap,
    };
  }

  private openSwapReview(amount: string): void {
    const preview = this.quotePreview;
    const network = this.balanceNetwork();
    if (!preview || !network || !this.canReviewSwap()) return;

    const input = this.buildSwapInput(amount);
    const traceId = preview.traceId ?? createTraceId();
    const minimumAtomic =
      minimumReceivedAtomic(
        preview.amountOutAtomic,
        this.slippageToleranceBps
      ) ?? '0';
    const intent: WalletSwapReview = {
      contractVersion: '2.0.0',
      traceId,
      input,
      sourceDisplay: {
        amountDisplay: this.amount,
        fiatValue: this.fromFiatEstimate(),
      },
      preview: {
        amountOutAtomic: preview.amountOutAtomic,
        amountOutDisplay: this.quotedToAmountDisplay(),
        fiatValue: this.fiatEstimate(
          this.toToken,
          this.quotedToAmountDisplay()
        ),
        expiresAt: preview.expiresAt,
        rate: this.swapRateLabel(),
        minimumReceived: `${this.formatSwapAmount(
          this.fromBaseUnits(
            minimumAtomic,
            this.tokenDecimals(this.toToken.decimals)
          ),
          this.swapAmountFractionDigits(this.tokenSymbolLabel(this.toToken))
        )} ${this.tokenSymbolLabel(this.toToken)}`,
        ...(preview.quoteReference
          ? { quoteReference: preview.quoteReference }
          : {}),
      },
    };

    try {
      this.walletGatewayBridge.openSwapReview(intent);
      this.activeReviewTraceId = traceId;
      this.walletsService.requestOpen('swap-review');
      this.quoteError = '';
    } catch (error) {
      this.quoteError =
        error instanceof Error
          ? error.message
          : 'Swap review is temporarily unavailable.';
    }
  }

  private reviewToken(token: ExchangeToken) {
    return {
      assetId: token.assetId,
      executionAssetId: this.executionAssetId(token),
      symbol: this.tokenSymbolLabel(token),
      name: token.name,
      ...(this.resolveTokenIcon(token)
        ? { icon: this.resolveTokenIcon(token) }
        : {}),
      decimals: this.tokenDecimals(token.decimals),
    };
  }

  private executionAssetId(token: ExchangeToken): string {
    return token.executionAssetId ?? token.assetId;
  }

  public changeComparisonTimeframe(timeframe: ComparisonTimeframe): void {
    if (this.selectedComparisonTimeframe === timeframe) {
      return;
    }

    this.selectedComparisonTimeframe = timeframe;
    this.loadMarketComparison();
  }

  public changeMarketChartMode(mode: MarketChartMode): void {
    if (this.selectedMarketChartMode === mode) {
      return;
    }

    this.selectedMarketChartMode = mode;
    if (this.comparison) {
      this.buildComparisonChart(this.comparison);
      this.comparisonError =
        this.comparison.status === 'unavailable' ||
        this.comparisonChartSeries.length === 0
          ? 'Comparison data unavailable'
          : '';
    }
  }

  public toggleAdvancedMarketView(): void {
    this.showAdvancedMarketView = !this.showAdvancedMarketView;
  }

  public swapTokens(): void {
    if (this.isForeignDestination()) {
      return;
    }
    const previousFrom = this.fromToken;
    this.fromToken = this.toToken;
    this.toToken = previousFrom;
    this.toAmountManual = '';
    this.refreshSwapQuotePreview();
    this.loadMarketComparison();
  }

  public tokenSymbolLabel(token: ExchangeToken): string {
    return tokenAvatarLabel(token);
  }

  public marketSymbolFor(token: ExchangeToken): string {
    return this.tokenSymbolLabel(token).toUpperCase();
  }

  public resolveTokenIcon(token: ExchangeToken): string {
    const directIcon = resolveExchangeTokenIconUrl(token);
    if (directIcon) {
      return directIcon;
    }

    return this.tokenIcon(token.symbol) ?? '';
  }

  public tokenIconFor(token: ExchangeToken): string | undefined {
    const icon = this.resolveTokenIcon(token);
    return icon || undefined;
  }

  public tokenIcon(symbol: string): string | undefined {
    const selectedToken = this.findExchangeToken(symbol);
    if (selectedToken?.icon?.trim()) {
      return selectedToken.icon;
    }

    const comparison = this.comparison;

    if (comparison?.baseToken.symbol === symbol && comparison.baseToken.icon) {
      return comparison.baseToken.icon;
    }

    if (
      comparison?.quoteToken.symbol === symbol &&
      comparison.quoteToken.icon
    ) {
      return comparison.quoteToken.icon;
    }

    return (
      EXCHANGE_TOKEN_ICON_URLS[symbol] ??
      EXCHANGE_TOKEN_ICON_URLS[symbol.replace(/^w/i, '')]
    );
  }

  private findExchangeToken(symbol: string): ExchangeToken | undefined {
    if (this.fromToken.symbol === symbol) {
      return this.fromToken;
    }

    if (this.toToken.symbol === symbol) {
      return this.toToken;
    }

    return this.exchangeTokens.find(token => token.symbol === symbol);
  }

  public fromFiatEstimate(): string {
    return this.fiatEstimate(this.fromToken, this.amount);
  }

  public toFiatEstimate(): string {
    return this.fiatEstimate(this.toToken, this.quotedToAmountDisplay());
  }

  public toAmountUi(): string {
    return this.toAmountDisplay();
  }

  public fromAmountDisplay(): string {
    if (!this.amount.trim()) {
      return '';
    }

    return this.formatSwapAmount(
      this.amount,
      this.maxAmountFractionDigits,
      true
    );
  }

  public toAmountFormatted(): string {
    const raw = this.toAmountUi();
    if (!raw.trim() || this.isZeroAmountValue(raw)) {
      return '0,00';
    }

    return this.formatSwapAmount(
      this.canonicalAmountStorage(raw),
      this.swapAmountFractionDigits(this.toToken.symbol)
    );
  }

  public marketPriceDisplay(): string {
    return this.marketPriceLabel().display;
  }

  public marketPriceTitle(): string {
    return this.marketPriceLabel().title;
  }

  public marketSummaryHeadline(): string {
    if (this.selectedMarketChartMode === 'relative') {
      return this.marketRelativeHeadline();
    }

    return this.marketPriceDisplay();
  }

  public marketSummaryHeadlineTitle(): string {
    if (this.selectedMarketChartMode === 'relative') {
      return '';
    }

    return this.marketPriceTitle();
  }

  public marketSummaryChangePercent(): number | undefined {
    if (this.selectedMarketChartMode === 'relative') {
      return this.marketRelativeStrength();
    }

    return this.comparison?.quoteToken?.changePercent;
  }

  public marketSummaryChangeText(): string {
    const suffix = `(${this.selectedComparisonTimeframe})`;

    if (this.selectedMarketChartMode === 'relative') {
      const comparison = this.comparison;
      if (!comparison) {
        return `— ${suffix}`;
      }

      return `${this.tokenSymbolLabel(this.fromToken)} ${this.formatPercent(
        comparison.baseToken.changePercent
      )} · ${this.tokenSymbolLabel(this.toToken)} ${this.formatPercent(
        comparison.quoteToken.changePercent
      )} ${suffix}`;
    }

    return `${this.formatPercent(this.comparison?.quoteToken?.changePercent)} ${suffix}`;
  }

  private marketRelativeHeadline(): string {
    const relative = this.marketRelativeStrength();
    if (relative === undefined) {
      return '—';
    }

    return `${this.tokenSymbolLabel(this.toToken)} ${this.formatPercent(
      relative
    )} vs ${this.tokenSymbolLabel(this.fromToken)}`;
  }

  private marketRelativeStrength(): number | undefined {
    const comparison = this.comparison;
    if (!comparison) {
      return undefined;
    }

    const fromChange = comparison.baseToken.changePercent;
    const toChange = comparison.quoteToken.changePercent;
    if (fromChange !== undefined && toChange !== undefined) {
      return toChange - fromChange;
    }

    return comparison.relativeStrength;
  }

  public marketPriceLabel() {
    const basePrice = this.comparison?.baseToken?.currentPrice;
    const quotePrice = this.comparison?.quoteToken?.currentPrice;
    if (
      basePrice === undefined ||
      quotePrice === undefined ||
      !Number.isFinite(basePrice) ||
      !Number.isFinite(quotePrice) ||
      quotePrice <= 0
    ) {
      return { display: '—', title: '' };
    }

    const rate = basePrice / quotePrice;

    return formatTokenEquivalentLabel(
      this.tokenSymbolLabel(this.fromToken),
      this.tokenSymbolLabel(this.toToken),
      rate
    );
  }

  public toAmountDisplay(): string {
    if (this.toAmountManual.trim()) {
      return this.toAmountManual;
    }

    return this.quotedToAmountDisplay();
  }

  /** Quote output only — never the To-balance override. */
  public quotedToAmountDisplay(): string {
    const amount = this.rawQuoteAmount();
    if (!amount) {
      return '';
    }

    return amount.formatted
      ? /^\d+(\.\d+)?$/.test(amount.value)
        ? amount.value
        : ''
      : this.normalizeQuoteAmount(amount.value, this.toToken.decimals);
  }

  public primaryActionLabel(): string {
    if (!this.activeWallet.wallet) return 'Connect wallet';
    if (this.reviewActionError) return this.reviewActionError;

    return this.canRetryQuote()
      ? 'Retry quote'
      : (this.quotePreview?.action?.label ?? 'Review');
  }

  public tokenDisplay(symbol: string): string {
    return tokenAvatarFallback(symbol);
  }

  public balanceLabel(token: ExchangeToken): string {
    const balance = this.balanceForToken(token);
    if (balance) {
      return `Balance: ${this.formatBalance(balance)} ${this.tokenSymbolLabel(token)}`;
    }

    return `Balance: — ${this.tokenSymbolLabel(token)}`;
  }

  public canApplyMaxBalance(token: ExchangeToken): boolean {
    return this.canUseBalanceAsMax(this.balanceForToken(token));
  }

  public applyMaxBalance(side: 'from' | 'to'): void {
    if (side === 'from') {
      this.toAmountManual = '';
      this.fillAmountFromTokenBalance(this.fromToken);
      return;
    }

    const toBalance = this.balanceForToken(this.toToken);
    if (!this.canUseBalanceAsMax(toBalance)) {
      return;
    }

    const canonical = this.balanceCanonicalDecimal(toBalance);
    if (!canonical) {
      return;
    }

    this.toAmountManual = canonical;
  }

  public swapRateLabel(): string {
    const amountIn = this.parseAmount(this.amount);
    const amountOut = this.parseQuoteAmount(this.toAmountUi());
    const rate =
      Number.isFinite(amountIn) && amountIn > 0 && Number.isFinite(amountOut)
        ? amountOut / amountIn
        : this.previewSwapRate();

    if (rate === undefined) {
      return `1 ${this.fromToken.symbol} ≈ — ${this.toToken.symbol}`;
    }

    return `1 ${this.fromToken.symbol} ≈ ${this.formatSwapRate(rate)} ${this.toToken.symbol}`;
  }

  public swapPriceImpactLabel(): string {
    const quote = this.quoteResult as Record<string, unknown> | undefined;
    const impact =
      quote?.['priceImpact'] ??
      quote?.['priceImpactPercent'] ??
      quote?.['price_impact'];

    if (typeof impact === 'number' && Number.isFinite(impact)) {
      return `${impact.toFixed(2)}%`;
    }

    if (typeof impact === 'string' && impact.trim()) {
      return impact.includes('%') ? impact : `${impact}%`;
    }

    return '0.12%';
  }

  public slippageLabel(): string {
    return formatSlippagePercentLabel(this.slippageToleranceBps);
  }

  public slippageReceiveAtLeastLabel(): string {
    const preview = this.quotePreview;
    if (!preview?.amountOutAtomic) {
      return '';
    }

    const minimumAtomic = minimumReceivedAtomic(
      preview.amountOutAtomic,
      this.slippageDraftBps
    );
    if (!minimumAtomic) {
      return '';
    }

    const formatted = this.formatSwapAmount(
      this.fromBaseUnits(
        minimumAtomic,
        this.tokenDecimals(this.toToken.decimals)
      ),
      this.swapAmountFractionDigits(this.tokenSymbolLabel(this.toToken))
    );
    return `${formatted} ${this.tokenSymbolLabel(this.toToken)}`;
  }

  public openSlippageSettings(): void {
    this.slippageDraftBps = this.slippageToleranceBps;
    this.isSlippageSettingsOpen = true;
  }

  public setConfidentialSwap(enabled: boolean): void {
    if (this.confidentialSwap === enabled) return;
    this.confidentialSwap = enabled;
    this.refreshSwapQuotePreview();
  }

  public closeSlippageSettings(): void {
    this.isSlippageSettingsOpen = false;
    this.slippageDraftBps = this.slippageToleranceBps;
  }

  public onSlippageDraftChanged(bps: number): void {
    this.slippageDraftBps = bps;
  }

  public saveSlippageSettings(bps: number): void {
    this.slippageToleranceBps = bps;
    this.slippageDraftBps = bps;
    this.isSlippageSettingsOpen = false;
    this.refreshSwapQuotePreview();
  }

  public networkFeeLabel(): string {
    const quote = this.quoteResult as Record<string, unknown> | undefined;
    const fee =
      quote?.['networkFee'] ?? quote?.['estimatedFee'] ?? quote?.['fee'];

    if (typeof fee === 'number' && Number.isFinite(fee)) {
      return fee < 0.01 ? '< $0.01' : `$${fee.toFixed(2)}`;
    }

    if (typeof fee === 'string' && fee.trim()) {
      return fee;
    }

    return '< $0.01';
  }

  public onAmountKeydown(event: KeyboardEvent): void {
    const action = resolveAmountKeydownAction(event);

    if (action === 'allow') {
      return;
    }

    if (action === 'decimal-separator') {
      event.preventDefault();
      this.insertDecimalSeparator(event.target as HTMLInputElement);
      return;
    }

    event.preventDefault();
  }

  public onAmountInput(event: Event): void {
    this.applySanitizedAmount(
      (event.target as HTMLInputElement).value,
      event.target as HTMLInputElement
    );
  }

  public onAmountPaste(event: ClipboardEvent): void {
    const input = event.target as HTMLInputElement;
    const pasted = this.readPastedText(event);
    if (!pasted) {
      return;
    }

    event.preventDefault();
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const nextValue =
      input.value.slice(0, start) + pasted + input.value.slice(end);

    this.applySanitizedAmount(nextValue, input);
  }

  public onAmountFocus(event: FocusEvent): void {
    const input = event.target as HTMLInputElement;
    input.value = this.fromAmountDisplay();
    this.scrollAmountToEnd(input);
  }

  public onAmountBlur(event: FocusEvent): void {
    if (!this.amount.trim() || this.isZeroAmountValue(this.amount)) {
      this.amount = '';
    }

    this.refreshSwapQuotePreview();

    const input = event.target as HTMLInputElement;
    input.value = this.fromAmountDisplay();
    this.scrollAmountToEnd(input);
  }

  public isAmountMuted(): boolean {
    const normalized = this.amount.trim();
    if (!normalized) {
      return true;
    }

    return this.isZeroAmountValue(normalized);
  }

  public isToAmountMuted(): boolean {
    const normalized = this.toAmountUi().trim();
    if (!normalized) {
      return true;
    }

    return this.isZeroAmountValue(normalized);
  }

  private insertDecimalSeparator(input: HTMLInputElement): void {
    if (displayHasDecimalSeparator(input.value, this.maxAmountFractionDigits)) {
      return;
    }

    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const nextValue =
      input.value.slice(0, start) +
      AMOUNT_DECIMAL_SEPARATOR +
      input.value.slice(end);

    this.applySanitizedAmount(nextValue, input);
  }

  private applySanitizedAmount(value: string, input?: HTMLInputElement): void {
    const caret = input?.selectionStart ?? null;
    const previousValue = input?.value ?? value;
    const sanitized = this.sanitizeAmountInput(value);
    const previousAmount = this.amount;
    this.amount = sanitized;

    if (input) {
      const display = this.formatSwapAmount(
        sanitized,
        this.maxAmountFractionDigits,
        true
      );

      input.value = display;

      if (sanitized.endsWith('.')) {
        const commaIndex = display.lastIndexOf(AMOUNT_DECIMAL_SEPARATOR);
        if (commaIndex !== -1) {
          input.setSelectionRange(commaIndex + 1, commaIndex + 1);
        }
      } else if (previousValue !== display) {
        this.restoreCaretAfterDigits(input, previousValue, caret, display);
      }

      if (display.length > previousValue.length) {
        this.scrollAmountToEnd(input);
      }
    }

    if (sanitized !== previousAmount) {
      this.toAmountManual = '';
      this.refreshSwapQuotePreview();
    }
  }

  private refreshSwapQuotePreview(): void {
    this.cancelPendingReview();
    const input = this.buildQuotePreviewInput();

    if (!input) {
      this.swapFlowFacade.watchQuotePreview(undefined);
      this.quotePreview = undefined;
      this.quoteResult = undefined;
      this.quoteError = '';
      this.intentHash = '';
      return;
    }

    this.swapFlowFacade.watchQuotePreview(input);
  }

  private buildQuotePreviewInput(): SwapFormInput | undefined {
    if (!this.activeWallet.canRequestSwap || !this.walletAddress) {
      return undefined;
    }

    if (this.recipientValidationError()) {
      return undefined;
    }

    const amount = this.toBaseUnits(this.amount, this.fromToken.decimals);

    if (!amount || /^0+$/.test(amount)) {
      return undefined;
    }

    return this.buildSwapInput(amount);
  }

  private readPastedText(event: ClipboardEvent): string {
    const data = event.clipboardData;
    if (!data) {
      return '';
    }

    return data.getData('text/plain') || data.getData('text') || '';
  }

  private scrollAmountToEnd(input: HTMLInputElement): void {
    requestAnimationFrame(() => {
      input.scrollLeft = input.scrollWidth;
    });
  }

  private sanitizeAmountInput(value: string): string {
    const cleaned = normalizeAmountInputChars(value);
    return this.normalizeAmountStorage(cleaned);
  }

  private normalizeAmountStorage(value: string): string {
    return normalizeSwapAmountStorage(value, this.maxAmountFractionDigits);
  }

  private parseAmount(value: string): number {
    const normalized = this.canonicalAmountStorage(value);
    if (!isCanonicalDecimalAmount(normalized)) {
      return Number.NaN;
    }

    return Number.parseFloat(normalized);
  }

  private parseQuoteAmount(value: string): number {
    const normalized = value.trim().replace(',', '.');
    if (!normalized) {
      return Number.NaN;
    }

    return Number.parseFloat(normalized);
  }

  private formatSwapAmount(
    value: string,
    maxFractionDigits: number,
    allowEmpty = false
  ): string {
    return formatSwapAmountDisplay(value, maxFractionDigits, allowEmpty);
  }

  private formatSwapRate(rate: number): string {
    return this.formatSwapAmount(rate.toFixed(4), 4);
  }

  private swapAmountFractionDigits(symbol: string): number {
    if (symbol === 'USDC' || symbol === 'USDT') {
      return 2;
    }

    if (symbol === 'NEAR' || symbol === 'ETH' || symbol === 'BTC') {
      return 4;
    }

    return this.maxAmountFractionDigits;
  }

  private restoreCaretAfterDigits(
    input: HTMLInputElement,
    previousValue: string,
    caret: number | null,
    nextValue: string
  ): void {
    if (caret === null) {
      return;
    }

    const digitsBeforeCaret = previousValue
      .slice(0, caret)
      .replace(/[^\d]/g, '').length;

    if (digitsBeforeCaret <= 0) {
      input.setSelectionRange(0, 0);
      return;
    }

    let seen = 0;
    let newCaret = nextValue.length;

    for (let index = 0; index < nextValue.length; index += 1) {
      if (/\d/.test(nextValue[index])) {
        seen += 1;
      }

      if (seen >= digitsBeforeCaret) {
        newCaret = index + 1;
        break;
      }
    }

    input.setSelectionRange(newCaret, newCaret);
  }

  private isZeroAmountValue(value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '.') {
      return true;
    }

    if (isCanonicalDecimalAmount(trimmed)) {
      const [whole, fraction = ''] = trimmed.split('.');
      return /^0*$/.test(whole) && /^0*$/.test(fraction);
    }

    const normalized = this.normalizeAmountStorage(value);
    if (!normalized || normalized === '.') {
      return true;
    }

    if (isCanonicalDecimalAmount(normalized)) {
      const [whole, fraction = ''] = normalized.split('.');
      return /^0*$/.test(whole) && /^0*$/.test(fraction);
    }

    const parsed = Number.parseFloat(normalized);
    return !Number.isNaN(parsed) && parsed === 0;
  }

  private canonicalAmountStorage(value: string): string {
    const trimmed = value.trim();
    if (isCanonicalDecimalAmount(trimmed)) {
      return trimmed;
    }

    return this.normalizeAmountStorage(trimmed);
  }

  public openTokenSelector(side: TokenSelectorSide): void {
    this.tokenSelectorSide = side;
    this.isTokenSelectorOpen = true;
  }

  public closeTokenSelector(): void {
    this.isTokenSelectorOpen = false;
    this.tokenSelectorSide = null;
  }

  public handleTokenSelected(token: ExchangeToken): void {
    const selected = this.enrichToken(token);

    if (this.tokenSelectorSide === 'from') {
      this.fromToken = selected;
    } else if (this.tokenSelectorSide === 'to') {
      this.toToken = selected;
      this.toAmountManual = '';
      this.recipientAddress = '';
    }

    this.refreshSwapQuotePreview();
    this.closeTokenSelector();
    this.loadMarketComparison();
    this.loadWalletBalances();
  }

  public tokenSelectorTitle(): string {
    return this.tokenSelectorSide === 'from'
      ? 'Select source token'
      : 'Select destination token';
  }

  public tokenSelectorSelectedAssetId(): string {
    if (this.tokenSelectorSide === 'from') {
      return this.fromToken.assetId;
    }

    if (this.tokenSelectorSide === 'to') {
      return this.toToken.assetId;
    }

    return '';
  }

  public tokenSelectorExcludedAssetId(): string {
    return this.tokenSelectorSide === 'to' ? this.fromToken.assetId : '';
  }

  public tokenSelectorTokens(): ExchangeToken[] {
    const blockchain = this.connectedWalletBlockchain();
    if (!blockchain) {
      return this.exchangeTokens;
    }

    if (
      this.tokenSelectorSide === 'from' ||
      (this.tokenSelectorSide === 'to' &&
        !this.crossNetworkRecipientIntentSignEnabled)
    ) {
      return this.exchangeTokens.filter(token => {
        if (token.blockchain !== blockchain) return false;
        if (this.tokenSelectorSide !== 'to') return true;
        return (
          this.executionAssetId(token) !== this.executionAssetId(this.fromToken)
        );
      });
    }

    return this.exchangeTokens;
  }

  public tokenSelectorWalletTokens(): WalletTokenOption[] {
    if (this.tokenSelectorSide !== 'from') return [];

    return this.tokenSelectorTokens().flatMap(token => {
      const balance = this.balanceForToken(token);
      if (!balance || !hasPositiveBalance(balance)) return [];

      return [
        {
          token,
          balanceLabel: `${this.formatBalance(balance)} ${this.tokenSymbolLabel(token)}`,
          stale: balance.stale || this.isBalanceExpired(balance),
        },
      ];
    });
  }

  public connectedWalletBlockchain(): string | undefined {
    if (this.walletChainType === 'near') return 'near';
    if (this.walletChainType === 'ethereum') {
      return walletBlockchain(this.walletAddress, this.walletChainId);
    }
    if (this.walletChainType === 'ton') return 'ton';
    return walletBlockchain(this.walletAddress, this.walletChainId);
  }

  public tokenNetworkLabel(token: ExchangeToken): string {
    return networkLabel(token.blockchain);
  }

  public tokenOverviewHasPrice(token: ExchangeToken): boolean {
    return this.tokenOverviewPrice(token) !== undefined;
  }

  public tokenOverviewPriceLabel(token: ExchangeToken): string {
    const price = this.tokenOverviewPrice(token);
    if (price === undefined) {
      return '';
    }
    return formatCurrencyPrice(price);
  }

  public tokenOverviewHasMarketCap(token: ExchangeToken): boolean {
    // Only show snapshot-backed caps. Mock figures must not look like live data.
    return (this.marketSnapshotFor(token)?.marketCapUsd ?? 0) > 0;
  }

  public tokenOverviewMarketCapLabel(token: ExchangeToken): string {
    const marketCapUsd = this.marketSnapshotFor(token)?.marketCapUsd ?? 0;
    return marketCapUsd > 0 ? formatCompactUsd(marketCapUsd) : '';
  }

  public tokenOverviewHasVolume(token: ExchangeToken): boolean {
    return this.tokenOverviewVolumeValue(token) > 0;
  }

  public tokenOverviewVolumeLabel(token: ExchangeToken): string {
    return formatCompactUsd(this.tokenOverviewVolumeValue(token));
  }

  public tokenOverviewWebsiteUrl(token: ExchangeToken): string | null {
    return (
      this.marketSnapshotFor(token)?.websiteUrl?.trim() ||
      this.tokenProjectMock(token)?.websiteUrl ||
      null
    );
  }

  public tokenOverviewWhitepaperUrl(token: ExchangeToken): string | null {
    return (
      this.marketSnapshotFor(token)?.whitepaperUrl?.trim() ||
      this.tokenProjectMock(token)?.whitepaperUrl ||
      null
    );
  }

  public tokenOverviewExplorerUrl(token: ExchangeToken): string | null {
    // Prefer network + contract from the selected token. Symbol mocks (and
    // symbol-keyed snapshots) can point at the wrong chain for bridged assets.
    return (
      explorerUrlForToken(token) ||
      this.marketSnapshotFor(token)?.explorerUrl?.trim() ||
      this.tokenProjectMock(token)?.explorerUrl ||
      null
    );
  }

  public tokenOverviewExplorerLabel(token: ExchangeToken): string {
    const explorer = this.tokenOverviewExplorerUrl(token);
    return explorer ? hostnameLabel(explorer, 'Explorer') : 'Explorer';
  }

  public tokenOverviewSocialLinks(
    token: ExchangeToken
  ): WalletMarketSocialLink[] {
    const fromSnapshot = this.marketSnapshotFor(token)?.socialLinks;
    if (fromSnapshot && fromSnapshot.length > 0) {
      return fromSnapshot;
    }
    return this.tokenProjectMock(token)?.socialLinks ?? [];
  }

  private tokenOverviewVolumeValue(token: ExchangeToken): number {
    const snapshotValue = this.marketSnapshotFor(token)?.volume24hUsd ?? 0;
    if (snapshotValue > 0) {
      return snapshotValue;
    }
    return this.tokenProjectMock(token)?.volume24hUsd ?? 0;
  }

  private tokenProjectMock(token: ExchangeToken): TokenProjectMock | undefined {
    return (
      TOKEN_PROJECT_MOCKS[this.marketSymbolFor(token)] ??
      TOKEN_PROJECT_MOCKS[this.normalizeMarketSymbol(token.symbol)]
    );
  }

  public isForeignDestination(): boolean {
    const walletNetwork = this.connectedWalletBlockchain();
    return Boolean(walletNetwork && this.toToken.blockchain !== walletNetwork);
  }

  public openRecipientPanel(): void {
    this.isRecipientPanelOpen = true;
  }

  public closeRecipientPanel(): void {
    this.isRecipientPanelOpen = false;
  }

  public saveRecipientAddress(address: string): void {
    this.recipientAddress = address;
    this.isRecipientPanelOpen = false;
    this.quoteError = '';
    this.refreshSwapQuotePreview();
  }

  public recipientAddressLabel(): string {
    if (!this.recipientAddress)
      return `Add ${this.tokenNetworkLabel(this.toToken)} address`;
    if (this.recipientAddress.length <= 18) return this.recipientAddress;
    return `${this.recipientAddress.slice(0, 8)}…${this.recipientAddress.slice(-6)}`;
  }

  public tokenColor(symbol: string): string {
    const token = this.exchangeTokens.find(
      item => item.symbol === symbol || this.marketSymbolFor(item) === symbol
    );
    return token?.color || '#fe6c00';
  }

  public formatPrice(value: number | undefined): string {
    return formatCurrencyPrice(value);
  }

  public formatPercent(value: number | undefined): string {
    return formatPricePercent(value);
  }

  public changeClass(value: number | undefined): string {
    return changePriceClass(value);
  }

  public relativeStrengthText(): string {
    const comparison = this.comparison;
    const relative = comparison?.relativeStrength;

    if (!comparison || relative === undefined) {
      return 'Relative strength unavailable';
    }

    if (relative === 0) {
      return `${comparison.base} and ${comparison.quote} moved about the same over ${this.timeframeLabel(comparison.timeframe)}`;
    }

    const stronger = relative > 0 ? comparison.base : comparison.quote;
    const weaker = relative > 0 ? comparison.quote : comparison.base;
    return `${stronger} moved more than ${weaker} by ${Math.abs(relative).toFixed(2)}% over ${this.timeframeLabel(comparison.timeframe)}`;
  }

  public swapInsightText(): string {
    const comparison = this.comparison;
    if (!comparison) {
      return '';
    }

    const from = comparison.baseToken;
    const to = comparison.quoteToken;
    const window = this.timeframeLabel(comparison.timeframe);
    const fromChange = from.changePercent;
    const toChange = to.changePercent;

    if (fromChange === undefined || toChange === undefined) {
      return `Compare ${from.symbol} and ${to.symbol} price moves over ${window} before swapping.`;
    }

    const fromLabel = `${from.symbol} ${this.formatPercent(fromChange)}`;
    const toLabel = `${to.symbol} ${this.formatPercent(toChange)}`;

    if (Math.abs(fromChange) < 0.05 && Math.abs(toChange) < 0.05) {
      return `Both assets were flat over ${window}.`;
    }

    if (Math.abs(fromChange) < 0.05) {
      return `${from.symbol} held steady while ${to.symbol} moved ${this.formatPercent(toChange)} over ${window}.`;
    }

    if (Math.abs(toChange) < 0.05) {
      return `${to.symbol} held steady while ${from.symbol} moved ${this.formatPercent(fromChange)} over ${window}.`;
    }

    if (toChange > fromChange) {
      return `Swapping ${from.symbol} → ${to.symbol}: ${toLabel} vs ${fromLabel} over ${window}.`;
    }

    if (fromChange > toChange) {
      return `Swapping ${from.symbol} → ${to.symbol}: ${fromLabel} vs ${toLabel} over ${window}.`;
    }

    return `${fromLabel} and ${toLabel} over ${window}.`;
  }

  private loadExchangeAssets(): void {
    this.exchangeAssetsLoading = true;
    this.exchangeAssetsError = '';

    this.exchangeAssetsService.loadAssets().subscribe({
      next: tokens => {
        this.exchangeTokens = tokens.map(token => this.enrichToken(token));
        this.exchangeAssetsLoading = false;

        if (tokens.length === 0) {
          this.exchangeAssetsError = 'No tradable assets available.';
          return;
        }

        const previousFrom = this.fromToken;
        const previousTo = this.toToken;
        this.fromToken = this.enrichToken(
          this.resolveSelectedToken(
            previousFrom,
            this.pickDefaultFromToken()
          ) ?? tokens[0]
        );
        const nextToToken = this.enrichToken(
          this.resolveSelectedToken(previousTo, this.pickDefaultToToken()) ??
            tokens[Math.min(1, tokens.length - 1)]
        );
        if (nextToToken.assetId !== this.toToken.assetId) {
          this.toAmountManual = '';
        }
        this.toToken = nextToToken;

        this.alignSelectionsToWallet();

        if (this.fromToken.assetId === this.toToken.assetId) {
          const fallbackTo =
            tokens.find(token => token.assetId !== this.fromToken.assetId) ??
            this.toToken;
          if (fallbackTo.assetId !== this.toToken.assetId) {
            this.toAmountManual = '';
          }
          this.toToken = fallbackTo;
        }

        this.loadMarketComparison();
        this.refreshSwapQuotePreview();
      },
      error: () => {
        this.exchangeTokens = [];
        this.exchangeAssetsLoading = false;
        this.exchangeAssetsError = 'Failed to load assets. Try again later.';
      },
    });
  }

  private loadWalletBalances(): void {
    this.activeWalletFacade.refreshBalances();
  }

  public reviewBlockingReason(): string {
    if (this.activeWallet.reason)
      return this.quoteError || this.activeWallet.reason;
    if (this.recipientValidationError()) return this.recipientValidationError();
    const amount = this.toBaseUnits(this.amount, this.fromToken.decimals);
    if (!amount || /^0+$/.test(amount)) return 'Enter a valid amount.';
    if (!this.canFetchBalance(this.fromToken))
      return 'Select a token on the active wallet network.';
    if (this.fundingSourceError()) return this.fundingSourceError();
    if (this.isQuoteLoading()) return 'Getting a quote…';
    if (this.quoteError) return this.quoteError;
    if (!this.quotePreview) return 'Waiting for a quote.';
    if (!(Date.parse(this.quotePreview.expiresAt) > Date.now()))
      return 'Quote expired. Request a new quote.';
    if (
      !/^\d+$/.test(this.quotePreview.amountOutAtomic) ||
      /^0+$/.test(this.quotePreview.amountOutAtomic)
    )
      return 'Quote output is invalid. Request a new quote.';
    if (!this.destinationTargetMatchesQuote())
      return 'The receive amount does not match this quote.';
    return '';
  }

  public fundingSourceError(): string {
    const action = this.quotePreview?.action;
    return action && !action.supported ? action.description : '';
  }

  private beginSwapReview(amount: string): void {
    const preview = this.quotePreview;
    const network = this.balanceNetwork();
    if (!preview || !network || this.fundingSourceError()) {
      return;
    }

    this.reviewBalanceSub?.unsubscribe();
    this.reviewQuote?.cancel();
    const generation = ++this.reviewGeneration;
    this.reviewActionError = '';
    this.reviewBusy = true;
    const chainType = this.walletChainType;
    this.reviewQuote = this.executableQuotes.start({
      traceId: preview.traceId ?? createTraceId(),
      providerId: 'one-click',
      sourceAssetId: this.fromToken.assetId,
      network,
      originAsset: this.executionAssetId(this.fromToken),
      destinationAsset: this.executionAssetId(this.toToken),
      amount,
      signerId: this.walletAddress,
      recipient: this.effectiveRecipient(),
      recipientType: 'DESTINATION_CHAIN',
      depositType: 'ORIGIN_CHAIN',
      refundType: 'ORIGIN_CHAIN',
      authMethod:
        chainType === 'ethereum' ? 'evm' : chainType === 'ton' ? 'ton' : 'near',
      slippageTolerance: this.slippageToleranceBps,
      deadline: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });

    this.reviewBalanceSub = this.confirmSourceBalance(amount)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(error => {
        if (generation !== this.reviewGeneration) {
          return;
        }
        this.reviewBalanceSub = undefined;
        this.reviewBusy = false;
        if (error) {
          this.reviewQuote?.cancel();
          this.reviewQuote = undefined;
          this.reviewActionError = error;
          return;
        }
        this.reviewQuote = undefined;
        this.openSwapReview(amount);
      });
  }

  private cancelPendingReview(): void {
    this.reviewGeneration += 1;
    this.reviewBalanceSub?.unsubscribe();
    this.reviewBalanceSub = undefined;
    this.reviewQuote?.cancel();
    this.reviewQuote = undefined;
    this.reviewBusy = false;
    this.reviewActionError = '';
  }

  private confirmSourceBalance(amountRaw: string) {
    const symbol = this.tokenSymbolLabel(this.fromToken);
    const unavailable = `Could not confirm ${symbol} balance`;
    const network = this.balanceNetwork();
    const account = this.walletAddress;
    if (!account || !network || !this.canFetchBalance(this.fromToken)) {
      return of(unavailable);
    }

    const assetId = this.fromToken.assetId;
    return this.walletBalancesService
      .loadBalancesWithMeta({
        walletAddress: account,
        network,
        assetIds: [assetId],
      })
      .pipe(
        map(result => {
          if (result.partial) {
            return unavailable;
          }
          const balance = result.balances.find(row =>
            this.balanceMatchesAccount(row, account, network, assetId)
          );
          if (!balance || !this.isBalanceUsable(balance)) {
            return unavailable;
          }
          this.rememberConfirmedBalance(balance);
          try {
            if (BigInt(amountRaw) > BigInt(balance.balanceRaw)) {
              return `Insufficient ${symbol} balance`;
            }
          } catch {
            return unavailable;
          }
          return '';
        }),
        catchError(() => of(unavailable))
      );
  }

  private balanceMatchesAccount(
    balance: WalletBalance,
    account: string,
    network: string,
    assetId: string
  ): boolean {
    if (balance.network !== network || balance.assetId !== assetId) {
      return false;
    }
    if (network.startsWith('eip155:')) {
      return balance.walletAddress.toLowerCase() === account.toLowerCase();
    }
    return balance.walletAddress === account;
  }

  private rememberConfirmedBalance(balance: WalletBalance): void {
    const existing = this.walletBalances.findIndex(
      row => row.network === balance.network && row.assetId === balance.assetId
    );
    if (existing === -1) {
      this.walletBalances = [...this.walletBalances, balance];
      return;
    }
    this.walletBalances = this.walletBalances.map((row, index) =>
      index === existing ? balance : row
    );
  }

  private balanceForToken(token: ExchangeToken): WalletBalance | undefined {
    return tokenBalance(this.walletBalances, token, this.balanceNetwork());
  }

  private canUseBalanceAsMax(
    balance: WalletBalance | undefined
  ): balance is WalletBalance {
    if (!balance || !this.isBalanceUsable(balance)) {
      return false;
    }

    try {
      return BigInt(balance.balanceRaw) > 0n;
    } catch {
      return false;
    }
  }

  private destinationTargetMatchesQuote(): boolean {
    const target = this.toAmountManual.trim();
    if (!target) {
      return true;
    }

    const quoted = this.quotedToAmountDisplay().trim();
    if (!quoted) {
      return false;
    }

    const targetAtomic = this.toBaseUnits(target, this.toToken.decimals);
    const quotedAtomic = this.toBaseUnits(quoted, this.toToken.decimals);

    return Boolean(
      targetAtomic &&
      quotedAtomic &&
      !/^0+$/.test(targetAtomic) &&
      targetAtomic === quotedAtomic
    );
  }

  private balanceCanonicalDecimal(
    balance: WalletBalance | undefined
  ): string | undefined {
    if (!balance) {
      return undefined;
    }

    const decimals = this.tokenDecimals(balance.decimals);
    const raw = balance.balanceRaw?.trim();
    if (raw && /^\d+$/.test(raw)) {
      try {
        return atomicToDecimal(raw, decimals);
      } catch {
        return undefined;
      }
    }

    const decimal = balance.balanceDecimal?.trim();
    if (!decimal) {
      return undefined;
    }

    try {
      return atomicToDecimal(decimalToAtomic(decimal, decimals), decimals);
    } catch {
      return undefined;
    }
  }

  private fillAmountFromTokenBalance(token: ExchangeToken): void {
    const balance = this.balanceForToken(token);
    if (!this.canUseBalanceAsMax(balance)) {
      return;
    }

    const canonical = this.balanceCanonicalDecimal(balance);
    if (!canonical) {
      return;
    }

    this.fillAmountValue(canonical);
  }

  private fillAmountValue(value: string): void {
    const previousAmount = this.amount;
    this.amount = value;

    const input = this.fromAmountInput?.nativeElement;
    if (input) {
      input.value = this.formatSwapAmount(
        value,
        this.maxAmountFractionDigits,
        true
      );
      this.scrollAmountToEnd(input);
    }

    if (value !== previousAmount) {
      this.toAmountManual = '';
      this.refreshSwapQuotePreview();
    }
  }

  private formatBalance(balance: WalletBalance): string {
    const decimal =
      this.balanceCanonicalDecimal(balance) ?? balance.balanceDecimal ?? '0';

    return this.formatSwapAmount(
      decimal,
      this.swapAmountFractionDigits(this.displaySymbolFor(balance.symbol))
    );
  }

  private isBalanceExpired(balance: WalletBalance): boolean {
    const expiresAt = Date.parse(balance.expiresAt);
    return !Number.isFinite(expiresAt) || expiresAt <= Date.now();
  }

  private isBalanceUsable(balance: WalletBalance): boolean {
    return !balance.stale && !this.isBalanceExpired(balance);
  }

  private balanceNetwork(): string | undefined {
    return this.activeWallet.network;
  }

  private canFetchBalance(token: ExchangeToken): boolean {
    const blockchain = this.connectedWalletBlockchain();
    return Boolean(
      this.balanceNetwork() && blockchain && token.blockchain === blockchain
    );
  }

  private pickDefaultFromToken(): ExchangeToken | undefined {
    const blockchain = this.connectedWalletBlockchain();
    return (
      this.exchangeTokens.find(
        token =>
          token.symbol === 'USDC' &&
          (!blockchain || token.blockchain === blockchain)
      ) ??
      this.exchangeTokens.find(
        token => !blockchain || token.blockchain === blockchain
      )
    );
  }

  private pickDefaultToToken(): ExchangeToken | undefined {
    const blockchain = this.connectedWalletBlockchain();
    return (
      this.exchangeTokens.find(
        token =>
          token.assetId === 'near:native' &&
          (!blockchain || token.blockchain === blockchain)
      ) ??
      this.exchangeTokens.find(
        token =>
          (token.symbol === 'wNEAR' || token.symbol === 'NEAR') &&
          (!blockchain || token.blockchain === blockchain)
      ) ??
      this.exchangeTokens.find(
        token =>
          token.assetId !== this.fromToken.assetId &&
          (!blockchain || token.blockchain === blockchain)
      )
    );
  }

  private alignSelectionsToWallet(): void {
    const blockchain = this.connectedWalletBlockchain();
    if (!blockchain || this.exchangeTokens.length === 0) return;

    if (this.fromToken.blockchain !== blockchain) {
      this.fromToken =
        this.exchangeTokens.find(
          token =>
            token.blockchain === blockchain &&
            token.symbol === this.fromToken.symbol
        ) ??
        this.exchangeTokens.find(
          token => token.blockchain === blockchain && token.symbol === 'USDC'
        ) ??
        this.exchangeTokens.find(token => token.blockchain === blockchain) ??
        this.fromToken;
    }

    if (
      this.toToken.blockchain !== blockchain ||
      this.toToken.assetId === this.fromToken.assetId
    ) {
      const nextToToken =
        this.exchangeTokens.find(
          token =>
            token.blockchain === blockchain &&
            token.assetId !== this.fromToken.assetId &&
            (token.displaySymbol || token.symbol) ===
              (this.toToken.displaySymbol || this.toToken.symbol)
        ) ??
        this.exchangeTokens.find(
          token =>
            token.blockchain === blockchain &&
            token.assetId !== this.fromToken.assetId
        ) ??
        this.toToken;
      if (nextToToken.assetId !== this.toToken.assetId) {
        this.toAmountManual = '';
      }
      this.toToken = nextToToken;
    }
  }

  private effectiveRecipient(): string {
    return (
      this.isForeignDestination() ? this.recipientAddress : this.walletAddress
    ).trim();
  }

  private recipientValidationError(): string {
    if (!this.isForeignDestination()) return '';
    if (!this.crossNetworkRecipientIntentSignEnabled) {
      return 'Cross-network recipients are not available until the backend and wallet execution contracts are enabled.';
    }
    return recipientAddressError(
      this.toToken.blockchain,
      this.recipientAddress
    );
  }

  private enrichToken(token: ExchangeToken): ExchangeToken {
    const enriched = enrichExchangeToken(token);

    return {
      ...enriched,
      displaySymbol:
        enriched.displaySymbol ?? this.displaySymbolFor(enriched.symbol),
    };
  }

  private displaySymbolFor(symbol: string): string {
    if (symbol === 'wNEAR') {
      return 'NEAR';
    }

    if (symbol === 'wBTC') {
      return 'BTC';
    }

    return symbol;
  }

  private resolveSelectedToken(
    current: ExchangeToken,
    fallback?: ExchangeToken
  ): ExchangeToken | undefined {
    if (current.assetId) {
      const byAssetId = this.exchangeTokens.find(
        token => token.assetId === current.assetId
      );
      if (byAssetId) {
        return byAssetId;
      }
    }

    const bySymbol = this.exchangeTokens.find(
      token => token.symbol === current.symbol
    );
    if (bySymbol) {
      return bySymbol;
    }

    if (!fallback) {
      return undefined;
    }

    if (fallback.assetId) {
      const byFallbackAssetId = this.exchangeTokens.find(
        token => token.assetId === fallback.assetId
      );
      if (byFallbackAssetId) {
        return byFallbackAssetId;
      }
    }

    return this.exchangeTokens.find(token => token.symbol === fallback.symbol);
  }

  private loadMarketComparison(): void {
    const base = this.marketSymbolFor(this.fromToken);
    const quote = this.marketSymbolFor(this.toToken);
    const timeframe = this.selectedComparisonTimeframe;
    const requestKey = `${this.fromToken.assetId}|${this.toToken.assetId}|${base}|${quote}|${timeframe}`;
    this.comparisonRequestKey = requestKey;
    this.comparisonLoading = true;
    this.comparisonError = '';
    this.loadTokenMarketingSnapshots();

    this.httpClient
      .get<MarketComparisonResponse>(
        `${environment.apiUrl}/api/v1/markets/comparison`,
        {
          params: {
            base,
            quote,
            timeframe,
          },
        }
      )
      .subscribe({
        next: response => {
          if (this.comparisonRequestKey !== requestKey) {
            return;
          }

          this.comparison = response;
          this.buildComparisonChart(response);
          this.comparisonError =
            response.status === 'unavailable' ||
            this.comparisonChartSeries.length === 0
              ? 'Comparison data unavailable'
              : '';
          this.comparisonLoading = false;
          this.changeDetector.markForCheck();
        },
        error: () => {
          if (this.comparisonRequestKey !== requestKey) {
            return;
          }

          this.comparison = undefined;
          this.clearComparisonChart();
          this.comparisonError = 'Comparison data unavailable';
          this.comparisonLoading = false;
          this.changeDetector.markForCheck();
        },
      });
  }

  private loadTokenMarketingSnapshots(): void {
    const symbols = [
      this.marketSymbolFor(this.fromToken),
      this.marketSymbolFor(this.toToken),
    ];
    const requestKey = symbols.join('|');

    this.marketSnapshots.load(symbols).subscribe({
      next: snapshots => {
        if (
          [
            this.marketSymbolFor(this.fromToken),
            this.marketSymbolFor(this.toToken),
          ].join('|') !== requestKey
        ) {
          return;
        }

        this.tokenMarkets = new Map(
          snapshots.map(snapshot => [snapshot.symbol, snapshot])
        );
        this.changeDetector.markForCheck();
      },
      error: () => {
        if (
          [
            this.marketSymbolFor(this.fromToken),
            this.marketSymbolFor(this.toToken),
          ].join('|') !== requestKey
        ) {
          return;
        }

        this.tokenMarkets = new Map();
        this.changeDetector.markForCheck();
      },
    });
  }

  private marketSnapshotFor(
    token: ExchangeToken
  ): WalletMarketSnapshot | undefined {
    return (
      this.tokenMarkets.get(this.marketSymbolFor(token)) ??
      this.tokenMarkets.get(this.normalizeMarketSymbol(token.symbol))
    );
  }

  private tokenOverviewPrice(token: ExchangeToken): number | undefined {
    const snapshotPrice = this.marketSnapshotFor(token)?.priceUsd ?? 0;
    if (snapshotPrice > 0) {
      return snapshotPrice;
    }

    const comparison = this.comparison;
    if (!comparison) {
      return undefined;
    }

    // Comparison is always requested as from=base / to=quote.
    if (token.assetId === this.fromToken.assetId) {
      return comparison.baseToken.currentPrice;
    }
    if (token.assetId === this.toToken.assetId) {
      return comparison.quoteToken.currentPrice;
    }

    return (
      this.tokenPrice(this.marketSymbolFor(token)) ??
      this.tokenPrice(token.symbol)
    );
  }

  private buildComparisonChart(response: MarketComparisonResponse): void {
    const baseSymbol = this.normalizeMarketSymbol(response.base);
    const quoteSymbol = this.normalizeMarketSymbol(response.quote);
    const series = Array.isArray(response.series) ? response.series : [];
    const baseSeries =
      series.find(
        item =>
          this.normalizeMarketSymbol(item.symbol) === baseSymbol &&
          Array.isArray(item.points) &&
          item.points.length > 0
      ) ??
      series.find(item => Array.isArray(item.points) && item.points.length > 0);
    const quoteSeries =
      series.find(
        item =>
          this.normalizeMarketSymbol(item.symbol) === quoteSymbol &&
          Array.isArray(item.points) &&
          item.points.length > 0
      ) ??
      series.find(
        item =>
          this.normalizeMarketSymbol(item.symbol) !==
            this.normalizeMarketSymbol(baseSeries?.symbol ?? '') &&
          Array.isArray(item.points) &&
          item.points.length > 0
      );

    if (!baseSeries || !quoteSeries) {
      this.clearComparisonChart();
      return;
    }

    const chartSeries = (
      this.selectedMarketChartMode === 'relative'
        ? [
            {
              symbol: `${this.normalizeMarketSymbol(
                quoteSeries.symbol
              )}-${this.normalizeMarketSymbol(baseSeries.symbol)}`,
              points: this.buildComparisonDifferencePoints(
                baseSeries.points,
                quoteSeries.points
              ),
            },
          ]
        : [
            {
              symbol: this.normalizeMarketSymbol(baseSeries.symbol),
              points: this.buildIndexedPriceChangePoints(baseSeries.points),
            },
            {
              symbol: this.normalizeMarketSymbol(quoteSeries.symbol),
              points: this.buildIndexedPriceChangePoints(quoteSeries.points),
            },
          ]
    ).filter(seriesItem => seriesItem.points.length >= 2);

    if (chartSeries.length === 0) {
      this.clearComparisonChart();
      return;
    }

    this.comparisonChartSeries = chartSeries.map((seriesItem, index) =>
      this.toMarketOverviewChartSeries(seriesItem, index)
    );
  }

  private clearComparisonChart(): void {
    this.comparisonChartSeries = [];
  }

  private buildComparisonDifferencePoints(
    basePoints: MarketComparisonPoint[],
    quotePoints: MarketComparisonPoint[]
  ): MarketComparisonPoint[] {
    const sortedBasePoints = this.buildIndexedPriceChangePoints(basePoints);
    const sortedQuotePoints = this.buildIndexedPriceChangePoints(quotePoints);
    if (sortedBasePoints.length === 0 || sortedQuotePoints.length === 0) {
      return [];
    }

    return sortedBasePoints
      .map(basePoint => {
        const quoteValue = this.interpolateComparisonValue(
          sortedQuotePoints,
          basePoint.time
        );
        if (quoteValue === undefined) {
          return undefined;
        }

        return {
          time: basePoint.time,
          value: quoteValue - basePoint.value,
        };
      })
      .filter((point): point is MarketComparisonPoint => point !== undefined);
  }

  private buildIndexedPriceChangePoints(
    points: MarketComparisonPoint[]
  ): MarketComparisonPoint[] {
    const sortedPoints = this.sortedFiniteComparisonPoints(points);
    const firstPoint = sortedPoints[0];
    if (!firstPoint || firstPoint.value <= 0) {
      return [];
    }

    return sortedPoints.map(point => ({
      time: point.time,
      value: (point.value / firstPoint.value - 1) * 100,
    }));
  }

  private toMarketOverviewChartSeries(
    seriesItem: ComparisonChartSeries,
    index: number
  ): MarketOverviewChartSeries {
    return {
      id: seriesItem.symbol,
      label: seriesItem.symbol,
      points: seriesItem.points,
      color:
        index === 0 && this.selectedMarketChartMode !== 'relative'
          ? this.tokenColor(this.fromToken.symbol)
          : this.tokenColor(seriesItem.symbol),
    };
  }

  private sortedFiniteComparisonPoints(
    points: MarketComparisonPoint[]
  ): MarketComparisonPoint[] {
    const uniqueByTime = new Map<number, MarketComparisonPoint>();

    for (const point of points) {
      if (
        Number.isFinite(point.time) &&
        Number.isFinite(point.value) &&
        point.value > 0
      ) {
        uniqueByTime.set(point.time, point);
      }
    }

    return Array.from(uniqueByTime.values()).sort(
      (left, right) => left.time - right.time
    );
  }

  private normalizeMarketSymbol(symbol: string): string {
    return symbol.trim().toUpperCase();
  }

  private interpolateComparisonValue(
    points: MarketComparisonPoint[],
    time: number
  ): number | undefined {
    if (points.length === 0) {
      return undefined;
    }

    if (time < points[0].time || time > points[points.length - 1].time) {
      return undefined;
    }

    const exactPoint = points.find(point => point.time === time);
    if (exactPoint) {
      return exactPoint.value;
    }

    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const next = points[index];
      if (time < previous.time || time > next.time) {
        continue;
      }

      const range = next.time - previous.time;
      if (range <= 0) {
        return previous.value;
      }

      return (
        previous.value +
        ((time - previous.time) / range) * (next.value - previous.value)
      );
    }

    return undefined;
  }

  private timeframeLabel(timeframe: ComparisonTimeframe): string {
    if (timeframe === '1H') {
      return 'the last hour';
    }

    if (timeframe === '1D') {
      return 'the last 24 hours';
    }

    return 'the last 7 days';
  }

  private formatComparisonTime(
    time: number,
    timeframe: ComparisonTimeframe
  ): string {
    if (timeframe === '1W') {
      return new Date(time * 1000).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
      });
    }

    return new Date(time * 1000).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private previewSwapRate(): number | undefined {
    const amountIn = this.parseAmount(this.amount);
    const amountOut = Number.parseFloat(this.toAmountDisplay());

    if (
      Number.isFinite(amountIn) &&
      amountIn > 0 &&
      Number.isFinite(amountOut) &&
      amountOut > 0
    ) {
      return amountOut / amountIn;
    }

    const basePrice = this.comparison?.baseToken?.currentPrice;
    const quotePrice = this.comparison?.quoteToken?.currentPrice;

    if (
      basePrice !== undefined &&
      quotePrice !== undefined &&
      basePrice > 0 &&
      quotePrice > 0
    ) {
      return basePrice / quotePrice;
    }

    if (
      this.fromToken.symbol === 'USDC' &&
      (this.toToken.symbol === 'NEAR' || this.toToken.symbol === 'wNEAR')
    ) {
      return 0.4561;
    }

    return undefined;
  }

  private fiatEstimate(token: ExchangeToken, amountValue: string): string {
    return formatSwapFiatEstimate(
      isFreshAssetPrice(token.priceUpdatedAt) ? token.priceUsd : undefined,
      this.canonicalAmountStorage(amountValue)
    );
  }

  private tokenPrice(symbol: string): number | undefined {
    const comparison = this.comparison;
    if (!comparison) {
      return undefined;
    }

    const normalized = this.normalizeMarketSymbol(symbol);
    const matches = (tokenSymbol: string): boolean => {
      const candidate = this.normalizeMarketSymbol(tokenSymbol);
      if (!candidate || !normalized) {
        return false;
      }
      if (candidate === normalized) {
        return true;
      }
      const unwrap = (value: string): string => value.replace(/^W/, '');
      return unwrap(candidate) === unwrap(normalized);
    };

    if (matches(comparison.baseToken.symbol)) {
      return comparison.baseToken.currentPrice;
    }

    if (matches(comparison.quoteToken.symbol)) {
      return comparison.quoteToken.currentPrice;
    }

    return undefined;
  }

  public comparisonChartAriaLabel(): string {
    if (this.selectedMarketChartMode === 'relative') {
      return (
        this.tokenSymbolLabel(this.toToken) +
        ' minus ' +
        this.tokenSymbolLabel(this.fromToken) +
        ' relative price change'
      );
    }

    return `${this.tokenSymbolLabel(this.fromToken)} and ${this.tokenSymbolLabel(this.toToken)} price change over time`;
  }

  public comparisonNoteText(): string {
    if (this.selectedMarketChartMode === 'relative') {
      return `Line shows ${this.tokenSymbolLabel(this.toToken)} percentage move minus ${this.tokenSymbolLabel(this.fromToken)} percentage move`;
    }

    return `${this.tokenSymbolLabel(this.fromToken)} and ${this.tokenSymbolLabel(this.toToken)} are normalized to 0% at the start of the selected timeframe`;
  }

  private isQuoteRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private rawQuoteAmount(): { value: string; formatted: boolean } | undefined {
    const quote = this.quoteResult;
    const nested = quote?.['quote'];
    const quoteBody = this.isQuoteRecord(nested) ? nested : quote;
    const formatted =
      quoteBody?.['amountOutFormatted'] ??
      quoteBody?.['destinationAmountFormatted'] ??
      quoteBody?.['toAmountFormatted'];
    const amount =
      formatted ??
      quoteBody?.['amountOut'] ??
      quoteBody?.['destinationAmount'] ??
      quoteBody?.['toAmount'] ??
      this.quotePreview?.amountOutAtomic;
    const value = typeof amount === 'string' ? amount.trim() : undefined;
    return value ? { value, formatted: formatted !== undefined } : undefined;
  }

  private normalizeQuoteAmount(rawAmount: string, decimals?: number): string {
    const trimmed = rawAmount.trim();
    if (!trimmed) {
      return '';
    }

    // Quote payloads often send atomic integers without a decimal point.
    if (/^\d+$/.test(trimmed)) {
      try {
        return atomicToDecimal(trimmed, this.tokenDecimals(decimals));
      } catch {
        return '';
      }
    }

    if (isCanonicalDecimalAmount(trimmed)) {
      return trimmed;
    }

    const normalized = this.normalizeAmountStorage(trimmed);
    if (!normalized) {
      return '';
    }

    if (normalized.includes('.')) {
      return normalized;
    }

    try {
      return atomicToDecimal(normalized, this.tokenDecimals(decimals));
    } catch {
      return '';
    }
  }

  private toBaseUnits(value: string, decimals?: number): string {
    const precision = this.tokenDecimals(decimals);
    const canonical = this.canonicalAmountStorage(value);
    if (!canonical || canonical === '.') {
      return '';
    }

    try {
      return decimalToAtomic(canonical, precision);
    } catch {
      return '';
    }
  }

  private fromBaseUnits(value: string, decimals: number): string {
    try {
      return atomicToDecimal(value, decimals);
    } catch {
      return '0';
    }
  }

  private tokenDecimals(value?: number): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      return this.maxAmountFractionDigits;
    }

    return Math.min(value, 30);
  }
}
