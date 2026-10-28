import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import type { ExchangeToken } from '@shared/models/exchange-token.model';
import {
  resolveExchangeTokenIconUrl,
  tokenAvatarFallback,
  tokenAvatarLabel,
} from '@shared/utils/token-avatar.utils';
import type { TokenGroup } from '../token-select-panel/token-groups.utils';
import {
  buildAddFundsGroups,
  filterTokenGroups,
  networkOptionLabel,
  splitPopularGroups,
  type AddFundsStep,
} from './add-funds-deposit.utils';
import { buildDepositQrDataUrl } from './add-funds-qr.utils';
import {
  DepositInstructions,
  usableDepositInstructions,
} from './deposit-instructions';

@Component({
  selector: 'app-add-funds-panel',
  standalone: false,
  templateUrl: './add-funds-panel.component.html',
  styleUrls: ['./add-funds-panel.component.scss'],
})
export class AddFundsPanelComponent
  implements OnChanges, AfterViewInit, OnDestroy
{
  @Input() isOpen = false;
  @Input() tokens: ExchangeToken[] = [];
  @Input() loading = false;
  @Input() loadError = '';
  @Input() depositLoading = false;
  @Input() depositError = '';
  @Input() depositInstructions: DepositInstructions | null = null;
  @Output() depositRequested = new EventEmitter<{
    token: ExchangeToken;
    amount: string;
  }>();
  private qrGeneration = 0;
  private expiryTimer?: ReturnType<typeof setTimeout>;

  @Output() closeRequested = new EventEmitter<void>();
  @Output() retryRequested = new EventEmitter<void>();

  @ViewChild('panelRoot') private readonly panelRoot?: ElementRef<HTMLElement>;
  @ViewChild('searchInput')
  private readonly searchInput?: ElementRef<HTMLInputElement>;

  public step: AddFundsStep = 'token';
  public filterQuery = '';
  public selectedGroup: TokenGroup | null = null;
  public selectedToken: ExchangeToken | null = null;
  public depositAddress = '';
  public depositAmount = '';
  private requestedAmount: string | null = null;
  public qrDataUrl = '';
  public qrError = '';
  public qrLoading = false;
  public copied = false;
  public copyError = '';
  public transitionDirection: 'forward' | 'back' = 'forward';

  public readonly tokenIconUrl = resolveExchangeTokenIconUrl;
  public readonly tokenAvatarFallback = tokenAvatarFallback;
  public readonly tokenAvatarLabel = tokenAvatarLabel;
  public readonly networkLabel = networkOptionLabel;

  public get allGroups(): TokenGroup[] {
    return buildAddFundsGroups(this.tokens);
  }

  public get filteredGroups(): TokenGroup[] {
    return filterTokenGroups(this.allGroups, this.filterQuery);
  }

  public get popularGroups(): TokenGroup[] {
    return splitPopularGroups(this.filteredGroups).popular;
  }

  public get remainingGroups(): TokenGroup[] {
    return splitPopularGroups(this.filteredGroups).rest;
  }

  public get hasSearchQuery(): boolean {
    return this.filterQuery.trim().length > 0;
  }

  public get emptySearch(): boolean {
    return (
      !this.loading &&
      !this.loadError &&
      this.hasSearchQuery &&
      this.filteredGroups.length === 0
    );
  }

  public get stepIndex(): number {
    if (this.step === 'token') return 0;
    if (this.step === 'network') return 1;
    return 2;
  }

  public get stepTitle(): string {
    if (this.step === 'token') return 'Select crypto';
    if (this.step === 'network') return 'Select network';
    return 'Deposit';
  }

  public ngAfterViewInit(): void {
    if (this.isOpen) {
      this.focusInitialControl();
    }
  }

  public ngOnDestroy(): void {
    this.clearDepositState();
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['depositInstructions'] && this.step === 'deposit') {
      this.applyDepositInstructions();
    }
    if (changes['isOpen']) {
      if (this.isOpen) {
        queueMicrotask(() => this.focusInitialControl());
      } else {
        this.resetFlow();
      }
    }
  }

  public handleClose(): void {
    this.closeRequested.emit();
  }

  public handleBack(): void {
    this.transitionDirection = 'back';
    if (this.step === 'deposit') {
      this.clearDepositState();
      if (this.selectedGroup && this.selectedGroup.tokens.length === 1) {
        this.step = 'token';
        this.selectedToken = null;
        return;
      }
      this.step = 'network';
      return;
    }
    if (this.step === 'network') {
      this.step = 'token';
      // Keep selectedGroup so returning from a Change path can restore context;
      // clear only the network pick.
      this.selectedToken = null;
    }
  }

  public selectGroup(group: TokenGroup): void {
    this.transitionDirection = 'forward';
    this.selectedGroup = group;
    this.selectedToken = null;
    this.clearDepositState();

    if (group.tokens.length === 1) {
      this.selectNetwork(group.tokens[0]);
      return;
    }
    this.step = 'network';
  }

  public selectNetwork(token: ExchangeToken): void {
    this.transitionDirection = 'forward';
    this.selectedToken = token;
    if (!this.selectedGroup) {
      this.selectedGroup =
        this.allGroups.find(group =>
          group.tokens.some(item => item.assetId === token.assetId)
        ) ?? null;
    }
    this.clearDepositState();
    this.step = 'deposit';
    this.copied = false;
    this.copyError = '';
    this.depositAmount = '';
    this.requestedAmount = null;
  }

  public changeAmount(value: string): void {
    this.depositAmount = value;
    this.requestedAmount = null;
    this.clearDepositState();
  }

  public get validAmount(): boolean {
    return (
      /^(0|[1-9]\d*)(\.\d+)?$/.test(this.depositAmount) &&
      /[1-9]/.test(this.depositAmount) &&
      this.depositAmount.length <= 80
    );
  }

  public requestDeposit(): void {
    if (!this.selectedToken || !this.validAmount || this.depositLoading) return;
    this.clearDepositState();
    this.requestedAmount = this.depositAmount;
    this.depositRequested.emit({
      token: this.selectedToken,
      amount: this.depositAmount,
    });
  }

  public changeToken(): void {
    this.transitionDirection = 'back';
    this.step = 'token';
    this.selectedToken = null;
    this.clearDepositState();
  }

  public changeNetwork(): void {
    this.transitionDirection = 'back';
    if (this.selectedGroup && this.selectedGroup.tokens.length === 1) {
      this.changeToken();
      return;
    }
    this.clearDepositState();
    this.step = 'network';
  }

  public networkInitial(token: ExchangeToken): string {
    return networkOptionLabel(token).charAt(0).toUpperCase();
  }

  public get canChangeNetwork(): boolean {
    return (this.selectedGroup?.tokens.length ?? 0) > 1;
  }

  public async copyAddress(): Promise<void> {
    if (
      !this.selectedToken ||
      this.requestedAmount === null ||
      this.depositInstructions?.amount !== this.requestedAmount ||
      !usableDepositInstructions(
        this.depositInstructions,
        this.selectedToken.assetId
      ) ||
      !this.depositAddress
    ) {
      this.clearDepositState();
      return;
    }
    this.copyError = '';
    try {
      await navigator.clipboard.writeText(this.depositAddress);
      this.copied = true;
      window.setTimeout(() => {
        this.copied = false;
      }, 1600);
    } catch {
      this.copyError = 'Could not copy address. Try again.';
      this.copied = false;
    }
  }

  public networkCountLabel(group: TokenGroup): string {
    const count = group.tokens.length;
    return count === 1 ? '1 network' : `${count} networks`;
  }

  private applyDepositInstructions(): void {
    this.clearDepositState();
    if (
      !this.selectedToken ||
      this.requestedAmount === null ||
      this.depositInstructions?.amount !== this.requestedAmount ||
      !usableDepositInstructions(
        this.depositInstructions,
        this.selectedToken.assetId
      )
    ) {
      return;
    }
    const instructions = this.depositInstructions;
    this.depositAddress = instructions.address;
    this.expiryTimer = setTimeout(
      () => this.clearDepositState(),
      Math.min(Date.parse(instructions.expiresAt) - Date.now(), 2147483647)
    );
    // Address-only QR cannot carry mandatory routing memos safely.
    if (!instructions.memo) {
      void this.renderQr(this.selectedToken, instructions.address);
    }
  }

  private async renderQr(token: ExchangeToken, address: string): Promise<void> {
    const generation = this.qrGeneration;
    this.qrLoading = true;
    this.qrError = '';
    this.qrDataUrl = '';
    try {
      const dataUrl = await buildDepositQrDataUrl({
        address,
        symbol: token.displaySymbol || token.symbol,
        iconUrl: this.tokenIconUrl(token),
      });
      if (
        generation === this.qrGeneration &&
        usableDepositInstructions(this.depositInstructions, token.assetId)
      )
        this.qrDataUrl = dataUrl;
    } catch {
      if (generation === this.qrGeneration)
        this.qrError = 'Could not generate QR code.';
    } finally {
      if (generation === this.qrGeneration) this.qrLoading = false;
    }
  }

  private focusInitialControl(): void {
    if (this.step === 'token') {
      this.searchInput?.nativeElement.focus();
      return;
    }
    this.panelRoot?.nativeElement.focus();
  }

  private clearDepositState(): void {
    this.qrGeneration++;
    clearTimeout(this.expiryTimer);
    this.depositAddress = '';
    this.qrDataUrl = '';
    this.qrError = '';
    this.qrLoading = false;
    this.copied = false;
    this.copyError = '';
  }

  private resetFlow(): void {
    this.step = 'token';
    this.filterQuery = '';
    this.selectedGroup = null;
    this.selectedToken = null;
    this.clearDepositState();
    this.transitionDirection = 'forward';
  }
}
