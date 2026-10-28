import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
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
  buildDemoDepositAddress,
  filterTokenGroups,
  networkOptionLabel,
  splitPopularGroups,
  type AddFundsStep,
} from './add-funds-deposit.utils';
import { buildDepositQrDataUrl } from './add-funds-qr.utils';

@Component({
  selector: 'app-add-funds-panel',
  standalone: false,
  templateUrl: './add-funds-panel.component.html',
  styleUrls: ['./add-funds-panel.component.scss'],
})
export class AddFundsPanelComponent implements OnChanges, AfterViewInit {
  @Input() isOpen = false;
  @Input() tokens: ExchangeToken[] = [];
  @Input() loading = false;
  @Input() loadError = '';

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

  public ngOnChanges(changes: SimpleChanges): void {
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
    this.depositAddress = buildDemoDepositAddress(token);
    this.step = 'deposit';
    this.copied = false;
    this.copyError = '';
    void this.renderQr(token, this.depositAddress);
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
    if (!this.depositAddress) {
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

  private async renderQr(token: ExchangeToken, address: string): Promise<void> {
    this.qrLoading = true;
    this.qrError = '';
    this.qrDataUrl = '';
    try {
      this.qrDataUrl = await buildDepositQrDataUrl({
        address,
        symbol: token.displaySymbol || token.symbol,
        iconUrl: this.tokenIconUrl(token),
      });
    } catch {
      this.qrError = 'Could not generate QR code.';
    } finally {
      this.qrLoading = false;
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
