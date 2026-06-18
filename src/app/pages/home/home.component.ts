import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import { ExchangeAssetsService } from '@shared/services/exchange-assets.service';
import { ExchangeToken } from '@shared/models/exchange-token.model';
import { SwapFlowFacade } from '@domains/exchange/application/swap-flow.facade';
import type {
  SwapFlowState,
  SwapPrepareRequest,
  SwapQuotePreview,
} from '@domains/exchange/models/swap.models';
import { environment } from '../../../environments/environment';
import type { WalletAccount } from '@domains/wallet/models/wallet.models';
import {
  changeClass as changePriceClass,
  formatPercent as formatPricePercent,
  formatPrice as formatCurrencyPrice,
  formatSwapFiatEstimate,
} from './home-price.utils';
import {
  AMOUNT_DECIMAL_SEPARATOR,
  displayHasDecimalSeparator,
  formatSwapAmountDisplay,
  normalizeAmountInputChars,
  normalizeAmountStorage as normalizeSwapAmountStorage,
  resolveAmountKeydownAction,
} from '@shared/utils/amount-format.utils';
import type { MarketOverviewChartSeries } from '@shared/components/market-overview-chart/market-overview-chart.component';

type TokenSelectorSide = 'from' | 'to';

type ComparisonTimeframe = '1H' | '1D' | '1W';
type MarketChartMode = 'price' | 'relative';
type SupportedSwapAuthMethod = SwapPrepareRequest['authMethod'];

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

interface RecentActivityItem {
  time: string;
  fromSymbol: string;
  toSymbol: string;
  fromDisplay: string;
  toDisplay: string;
  fromCoinClass?: string;
  toCoinClass?: string;
  amount: string;
  receive: string;
  status: string;
}

@Component({
  selector: 'app-home',
  standalone: false,
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly slippageToleranceBps = 35;
  private readonly maxAmountFractionDigits = 18;
  private readonly tokenIconUrls: Record<string, string> = {
    BTC: 'https://s2.coinmarketcap.com/static/img/coins/128x128/1.png',
    ETH: 'https://s2.coinmarketcap.com/static/img/coins/128x128/1027.png',
    NEAR: 'https://s2.coinmarketcap.com/static/img/coins/128x128/6535.png',
    SOL: 'https://s2.coinmarketcap.com/static/img/coins/128x128/5426.png',
    USDC: 'https://s2.coinmarketcap.com/static/img/coins/128x128/3408.png',
    USDT: 'https://s2.coinmarketcap.com/static/img/coins/128x128/825.png',
  };

  public readonly recentActivity: RecentActivityItem[] = [
    {
      time: '14:25',
      fromSymbol: 'USDC',
      toSymbol: 'NEAR',
      fromDisplay: '$',
      toDisplay: 'N',
      toCoinClass: 'greenMini',
      amount: '100.00 USDC',
      receive: '45.61 NEAR',
      status: 'Completed',
    },
    {
      time: '13:58',
      fromSymbol: 'ETH',
      toSymbol: 'USDT',
      fromDisplay: '♦',
      toDisplay: 'T',
      fromCoinClass: 'purple',
      toCoinClass: 'teal',
      amount: '0.50 ETH',
      receive: '780.25 USDT',
      status: 'Completed',
    },
    {
      time: '12:42',
      fromSymbol: 'SOL',
      toSymbol: 'USDC',
      fromDisplay: '≡',
      toDisplay: '$',
      fromCoinClass: 'black',
      amount: '10.00 SOL',
      receive: '186.72 USDC',
      status: 'Completed',
    },
    {
      time: '11:21',
      fromSymbol: 'BTC',
      toSymbol: 'NEAR',
      fromDisplay: '₿',
      toDisplay: 'N',
      fromCoinClass: 'orangeMini',
      toCoinClass: 'greenMini',
      amount: '0.002 BTC',
      receive: '0.91 NEAR',
      status: 'Completed',
    },
    {
      time: '10:05',
      fromSymbol: 'USDC',
      toSymbol: 'ETH',
      fromDisplay: '$',
      toDisplay: '♦',
      toCoinClass: 'purple',
      amount: '250.00 USDC',
      receive: '0.12 ETH',
      status: 'Completed',
    },
  ];

  public exchangeTokens: ExchangeToken[] = [
    {
      symbol: 'USDC',
      name: 'USD Coin',
      assetId:
        'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near',
      color: '#2f8cff',
      icon: 'https://s2.coinmarketcap.com/static/img/coins/128x128/3408.png',
    },
    {
      symbol: 'NEAR',
      name: 'NEAR Protocol',
      assetId: 'nep141:wrap.near',
      color: '#2fd17c',
      icon: 'https://s2.coinmarketcap.com/static/img/coins/128x128/6535.png',
    },
  ];

  public amount = '';
  public walletAddress = '';
  public walletChainId: number | null = null;
  public fromToken = this.exchangeTokens[0];
  public toToken = this.exchangeTokens[1];
  public isTokenSelectorOpen = false;
  public tokenSelectorSide: TokenSelectorSide | null = null;
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
  public showAdvancedMarketView = false;
  public exchangeAssetsLoading = false;
  public exchangeAssetsError = '';

  constructor(
    private readonly httpClient: HttpClient,
    private readonly walletsService: WalletsService,
    private readonly swapFlowFacade: SwapFlowFacade,
    private readonly exchangeAssetsService: ExchangeAssetsService
  ) {
    this.walletsService.account
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(account => {
        const nextWalletAddress = account?.account ?? '';
        const nextWalletChainId = account?.chainId ?? null;
        if (
          this.walletAddress !== nextWalletAddress ||
          this.walletChainId !== nextWalletChainId
        ) {
          this.walletAddress = nextWalletAddress;
          this.walletChainId = nextWalletChainId;
          this.refreshSwapQuotePreview();
        }
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

    this.loadExchangeAssets();
    this.loadMarketComparison();
  }

  public submitQuote(): void {
    if (!this.walletAddress) {
      this.quoteError = 'Connect wallet first.';
      return;
    }

    const authMethod = this.resolveSwapAuthMethod({
      account: this.walletAddress,
      chainId: this.walletChainId,
    });

    if (!authMethod) {
      this.quoteError =
        'This wallet is not supported for swaps yet. Connect an EVM or NEAR wallet.';
      return;
    }

    const amount = this.toBaseUnits(this.amount, this.fromToken.decimals);

    if (!amount || /^0+$/.test(amount)) {
      this.quoteError = `Enter a valid ${this.fromToken.symbol} amount.`;
      return;
    }

    if (this.quoteResult && this.canExecuteSwap()) {
      void this.executeSwap(amount, authMethod);
      return;
    }

    this.swapFlowFacade.refreshQuotePreview(
      this.buildSwapInput(amount, authMethod)
    );
  }

  public isQuoteLoading(): boolean {
    return (
      this.swapFlowState === 'requestingQuote' ||
      this.swapFlowState === 'validating' ||
      this.swapFlowState === 'awaitingUserSignature' ||
      this.swapFlowState === 'submittingTransaction'
    );
  }

  private canExecuteSwap(): boolean {
    return (
      this.swapFlowState === 'idle' ||
      this.swapFlowState === 'completed' ||
      this.swapFlowState === 'failed'
    );
  }

  private async executeSwap(
    amount: string,
    authMethod: SupportedSwapAuthMethod
  ): Promise<void> {
    await this.swapFlowFacade.executeSwap(
      this.buildSwapInput(amount, authMethod)
    );
  }

  private buildSwapInput(
    amount: string,
    authMethod: SupportedSwapAuthMethod
  ): Omit<SwapPrepareRequest, 'traceId'> {
    return {
      originAsset: this.fromToken.assetId,
      destinationAsset: this.toToken.assetId,
      amount,
      userAddress: this.walletAddress.toLowerCase(),
      slippageTolerance: 50,
      deadline: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      authMethod,
    };
  }

  private resolveSwapAuthMethod(
    wallet: WalletAccount
  ): SupportedSwapAuthMethod | undefined {
    if (/^0x[a-fA-F0-9]{40}$/.test(wallet.account)) {
      return 'evm';
    }

    if (/^[a-z0-9._-]+\.(?:near|testnet|tg)$/i.test(wallet.account)) {
      return 'near';
    }

    return undefined;
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
    const previousFrom = this.fromToken;
    this.fromToken = this.toToken;
    this.toToken = previousFrom;
    this.refreshSwapQuotePreview();
    this.loadMarketComparison();
  }

  public tokenSymbolLabel(token: ExchangeToken): string {
    return token.displaySymbol?.trim() || token.symbol;
  }

  public marketSymbolFor(token: ExchangeToken): string {
    return this.tokenSymbolLabel(token).toUpperCase();
  }

  public resolveTokenIcon(token: ExchangeToken): string {
    const directIcon = token.icon?.trim();
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
      this.tokenIconUrls[symbol] ??
      this.tokenIconUrls[symbol.replace(/^w/i, '')]
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
    return this.fiatEstimate(this.fromToken.symbol, this.amount);
  }

  public toFiatEstimate(): string {
    return this.fiatEstimate(this.toToken.symbol, this.toAmountUi());
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
    if (
      !raw.trim() ||
      this.isZeroAmountValue(this.normalizeAmountStorage(raw))
    ) {
      return '0,00';
    }

    return this.formatSwapAmount(
      raw,
      this.swapAmountFractionDigits(this.toToken.symbol)
    );
  }

  public marketPriceDisplay(): string {
    const basePrice = this.comparison?.baseToken?.currentPrice;
    const quotePrice = this.comparison?.quoteToken?.currentPrice;
    if (
      basePrice === undefined ||
      quotePrice === undefined ||
      !Number.isFinite(basePrice) ||
      !Number.isFinite(quotePrice) ||
      quotePrice <= 0
    ) {
      return '—';
    }

    const rate = basePrice / quotePrice;
    const fractionDigits = this.swapAmountFractionDigits(this.toToken.symbol);
    return `1 ${this.tokenSymbolLabel(this.fromToken)} = ${rate.toFixed(fractionDigits)} ${this.tokenSymbolLabel(this.toToken)}`;
  }

  public toAmountDisplay(): string {
    const amount = this.rawQuoteAmount();
    if (!amount) {
      return '';
    }

    return this.normalizeQuoteAmount(amount, this.toToken.decimals);
  }

  public primaryActionLabel(): string {
    if (!this.walletAddress) {
      return 'Connect wallet';
    }

    if (this.quoteResult) {
      return this.isQuoteLoading() ? 'Signing swap...' : 'Sign & swap';
    }

    return this.isQuoteLoading() ? 'Quoting...' : 'Get quote';
  }

  public tokenDisplay(symbol: string): string {
    if (symbol === 'USDC') {
      return '$';
    }

    return symbol[0] ?? '?';
  }

  public balanceLabel(symbol: string): string {
    if (symbol === 'USDC') {
      return 'Balance: 1,250.00 USDC';
    }

    if (symbol === 'NEAR' || symbol === 'wNEAR') {
      return 'Balance: 42.5000 NEAR';
    }

    return `Balance: — ${symbol}`;
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
    return '0.35%';
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
    event.preventDefault();

    const input = event.target as HTMLInputElement;
    const pasted = event.clipboardData?.getData('text') ?? '';
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

    if (!input) {
      return;
    }

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

    if (sanitized !== previousAmount) {
      this.refreshSwapQuotePreview();
    }

    if (display.length > previousValue.length) {
      this.scrollAmountToEnd(input);
    }
  }

  private refreshSwapQuotePreview(): void {
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

  private buildQuotePreviewInput():
    | Omit<SwapPrepareRequest, 'traceId'>
    | undefined {
    if (!this.walletAddress) {
      return undefined;
    }

    const authMethod = this.resolveSwapAuthMethod({
      account: this.walletAddress,
      chainId: this.walletChainId,
    });

    if (!authMethod) {
      return undefined;
    }

    const amount = this.toBaseUnits(this.amount, this.fromToken.decimals);

    if (!amount || /^0+$/.test(amount)) {
      return undefined;
    }

    return this.buildSwapInput(amount, authMethod);
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
    const normalized = this.normalizeAmountStorage(value);
    if (!normalized) {
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
    const normalized = this.normalizeAmountStorage(value);
    if (!normalized || normalized === '.') {
      return true;
    }

    const parsed = Number.parseFloat(normalized);
    return !Number.isNaN(parsed) && parsed === 0;
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
    }

    this.refreshSwapQuotePreview();
    this.closeTokenSelector();
    this.loadMarketComparison();
  }

  public tokenSelectorTitle(): string {
    return this.tokenSelectorSide === 'from'
      ? 'Select source token'
      : 'Select destination token';
  }

  public tokenSelectorSelectedSymbol(): string {
    if (this.tokenSelectorSide === 'from') {
      return this.fromToken.symbol;
    }

    if (this.tokenSelectorSide === 'to') {
      return this.toToken.symbol;
    }

    return '';
  }

  public tokenSelectorExcludedSymbol(): string {
    if (this.tokenSelectorSide === 'from') {
      return this.toToken.symbol;
    }

    if (this.tokenSelectorSide === 'to') {
      return this.fromToken.symbol;
    }

    return '';
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
        this.exchangeTokens = tokens;
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
        this.toToken = this.enrichToken(
          this.resolveSelectedToken(previousTo, this.pickDefaultToToken()) ??
            tokens[Math.min(1, tokens.length - 1)]
        );

        if (this.fromToken.assetId === this.toToken.assetId) {
          this.toToken =
            tokens.find(token => token.assetId !== this.fromToken.assetId) ??
            this.toToken;
        }

        this.loadMarketComparison();
      },
      error: () => {
        this.exchangeTokens = [];
        this.exchangeAssetsLoading = false;
        this.exchangeAssetsError = 'Failed to load assets. Try again later.';
      },
    });
  }

  private pickDefaultFromToken(): ExchangeToken | undefined {
    return this.exchangeTokens.find(token => token.symbol === 'USDC');
  }

  private pickDefaultToToken(): ExchangeToken | undefined {
    return (
      this.exchangeTokens.find(token => token.assetId === 'nep141:wrap.near') ??
      this.exchangeTokens.find(
        token => token.symbol === 'wNEAR' || token.symbol === 'NEAR'
      ) ??
      this.exchangeTokens.find(token => token.symbol !== this.fromToken.symbol)
    );
  }

  private enrichToken(token: ExchangeToken): ExchangeToken {
    const icon =
      token.icon?.trim() ||
      this.tokenIconUrls[token.symbol] ||
      this.tokenIconUrls[token.symbol.replace(/^w/i, '')];

    return {
      ...token,
      displaySymbol: token.displaySymbol ?? this.displaySymbolFor(token.symbol),
      icon: icon || token.icon,
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
    const timeframe = this.selectedComparisonTimeframe;
    this.comparisonLoading = true;
    this.comparisonError = '';

    this.httpClient
      .get<MarketComparisonResponse>(
        `${environment.apiUrl}/api/v1/markets/comparison`,
        {
          params: {
            base: this.marketSymbolFor(this.fromToken),
            quote: this.marketSymbolFor(this.toToken),
            timeframe,
          },
        }
      )
      .subscribe({
        next: response => {
          if (this.selectedComparisonTimeframe !== timeframe) {
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
        },
        error: () => {
          if (this.selectedComparisonTimeframe !== timeframe) {
            return;
          }

          this.comparison = undefined;
          this.clearComparisonChart();
          this.comparisonError = 'Comparison data unavailable';
          this.comparisonLoading = false;
        },
      });
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

  private fiatEstimate(symbol: string, amountValue: string): string {
    const price = this.tokenPrice(symbol);
    const amount = this.parseAmount(amountValue);

    if (price === undefined || Number.isNaN(amount)) {
      return '$0';
    }

    return formatSwapFiatEstimate(price * amount);
  }

  private tokenPrice(symbol: string): number | undefined {
    const comparison = this.comparison;
    if (!comparison) {
      return undefined;
    }

    if (comparison.baseToken.symbol === symbol) {
      return comparison.baseToken.currentPrice;
    }

    if (comparison.quoteToken.symbol === symbol) {
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

  private rawQuoteAmount(): string {
    const quote = this.quoteResult;
    const quoteBody =
      quote && typeof quote['quote'] === 'object' && quote['quote'] !== null
        ? (quote['quote'] as Record<string, unknown>)
        : quote;
    const amount =
      quoteBody?.['amountOutFormatted'] ??
      quoteBody?.['destinationAmountFormatted'] ??
      quoteBody?.['toAmountFormatted'] ??
      quoteBody?.['amountOut'] ??
      quoteBody?.['destinationAmount'] ??
      quoteBody?.['toAmount'] ??
      this.quotePreview?.amountOut;

    if (typeof amount === 'number') {
      return Number.isFinite(amount) ? String(amount) : '';
    }

    if (typeof amount === 'string') {
      return amount.trim();
    }

    return '';
  }

  private normalizeQuoteAmount(rawAmount: string, decimals?: number): string {
    const normalized = this.normalizeAmountStorage(rawAmount);
    if (!normalized) {
      return '';
    }

    if (normalized.includes('.')) {
      return normalized;
    }

    return this.fromBaseUnits(normalized, this.tokenDecimals(decimals));
  }

  private toBaseUnits(value: string, decimals?: number): string {
    const normalized = this.normalizeAmountStorage(value);
    const precision = this.tokenDecimals(decimals);
    const decimalPattern = new RegExp(`^\\d+(\\.\\d{0,${precision}})?$`);

    if (!decimalPattern.test(normalized)) {
      return '';
    }

    const [whole, fraction = ''] = normalized.split('.');
    const digits = `${whole}${fraction.padEnd(precision, '0')}`.replace(
      /^0+(?=\d)/,
      ''
    );
    return digits || '0';
  }

  private fromBaseUnits(value: string, decimals: number): string {
    const digits = value.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '');
    if (!digits) {
      return '0';
    }

    if (decimals <= 0) {
      return digits;
    }

    if (digits.length <= decimals) {
      const padded = digits.padStart(decimals, '0');
      return `0.${padded}`.replace(/\.?0+$/, '') || '0';
    }

    const whole = digits.slice(0, digits.length - decimals);
    const fraction = digits.slice(digits.length - decimals).replace(/0+$/, '');
    return fraction ? `${whole}.${fraction}` : whole;
  }

  private tokenDecimals(value?: number): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      return this.maxAmountFractionDigits;
    }

    return Math.min(value, 30);
  }
}
