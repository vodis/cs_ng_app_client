import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  emptyMarketSnapshot,
  type WalletMarketSnapshot,
  type WalletMarketSocialKind,
  type WalletMarketSocialLink,
} from '@shared/utils/market-display.util';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';

const maxSymbolsPerRequest = 30;

type MarketSnapshotsResponse = {
  data?: unknown;
};

@Injectable({
  providedIn: 'root',
})
export class MarketSnapshotsService {
  constructor(private readonly httpClient: HttpClient) {}

  load(symbols: string[]): Observable<WalletMarketSnapshot[]> {
    const requested = [
      ...new Set(
        symbols
          .map(symbol => symbol.trim().toUpperCase())
          .filter(symbol => symbol.length > 0)
      ),
    ];
    if (requested.length === 0) {
      return of([]);
    }

    const batches: string[][] = [];
    for (
      let index = 0;
      index < requested.length;
      index += maxSymbolsPerRequest
    ) {
      batches.push(requested.slice(index, index + maxSymbolsPerRequest));
    }

    return forkJoin(batches.map(batch => this.loadBatch(batch))).pipe(
      map(results => results.flat())
    );
  }

  private loadBatch(symbols: string[]): Observable<WalletMarketSnapshot[]> {
    return this.httpClient
      .get<MarketSnapshotsResponse>(
        `${environment.apiUrl}/api/v1/markets/snapshots`,
        { params: { symbols: symbols.join(',') } }
      )
      .pipe(
        map(response => this.parse(response, symbols)),
        catchError(() => of(symbols.map(symbol => emptyMarketSnapshot(symbol))))
      );
  }

  private parse(
    response: MarketSnapshotsResponse,
    symbols: string[]
  ): WalletMarketSnapshot[] {
    if (!Array.isArray(response?.data)) {
      throw new Error('Market snapshot response is invalid');
    }

    const bySymbol = new Map<string, WalletMarketSnapshot>();
    for (const item of response.data) {
      const snapshot = this.parseSnapshot(item);
      if (snapshot) {
        bySymbol.set(snapshot.symbol, snapshot);
      }
    }

    return symbols.map(
      symbol => bySymbol.get(symbol) ?? emptyMarketSnapshot(symbol)
    );
  }

  private parseSnapshot(value: unknown): WalletMarketSnapshot | undefined {
    if (!this.isRecord(value) || typeof value['symbol'] !== 'string') {
      return undefined;
    }

    const sparkline = Array.isArray(value['sparkline7d'])
      ? value['sparkline7d'].filter(
          (point): point is number =>
            typeof point === 'number' && Number.isFinite(point)
        )
      : [];

    const websiteUrl = this.firstUrl(
      value['websiteUrl'],
      value['website'],
      value['homepageUrl'],
      this.nestedUrl(value['urls'], 'website', 'homepage')
    );
    const whitepaperUrl = this.firstUrl(
      value['whitepaperUrl'],
      value['whitepaper'],
      value['docsUrl'],
      value['documentationUrl'],
      this.nestedUrl(value['urls'], 'technical_doc', 'whitepaper', 'docs')
    );
    const explorerUrl = this.firstUrl(
      value['explorerUrl'],
      value['explorer'],
      this.nestedUrl(value['urls'], 'explorer', 'block_explorer')
    );
    const socialLinks = this.socialLinksFrom(value);

    return {
      symbol: value['symbol'].trim().toUpperCase(),
      priceUsd: this.numberOrZero(value['priceUsd']),
      change24hPercent: this.numberOrZero(value['change24hPercent']),
      marketCapUsd: this.numberOrZero(value['marketCapUsd']),
      volume24hUsd: this.numberOrZero(value['volume24hUsd']),
      sparkline7d: sparkline.length >= 2 ? sparkline : [0, 0],
      ...(websiteUrl ? { websiteUrl } : {}),
      ...(whitepaperUrl ? { whitepaperUrl } : {}),
      ...(explorerUrl ? { explorerUrl } : {}),
      ...(socialLinks.length > 0 ? { socialLinks } : {}),
    };
  }

  private socialLinksFrom(
    value: Record<string, unknown>
  ): WalletMarketSocialLink[] {
    const collected: WalletMarketSocialLink[] = [];
    const seen = new Set<string>();

    const push = (kind: WalletMarketSocialKind, raw: unknown): void => {
      const url = this.asHttpUrl(raw);
      if (!url || seen.has(url)) {
        return;
      }
      seen.add(url);
      collected.push({ kind, url, label: this.socialLabel(kind) });
    };

    const socials = value['socials'] ?? value['socialLinks'] ?? value['links'];
    if (Array.isArray(socials)) {
      for (const item of socials) {
        if (!this.isRecord(item)) {
          continue;
        }
        const kind = this.socialKindFrom(
          item['kind'] ?? item['type'] ?? item['network'] ?? item['name']
        );
        push(kind, item['url'] ?? item['href'] ?? item['link']);
      }
    }

    const urls = value['urls'];
    if (this.isRecord(urls)) {
      push('x', urls['twitter'] ?? urls['x']);
      push('github', urls['github'] ?? urls['source_code']);
      push('discord', urls['discord'] ?? urls['chat']);
      push('telegram', urls['telegram'] ?? urls['message_board']);
      push('reddit', urls['reddit']);
    }

    push('x', value['twitterUrl'] ?? value['twitter'] ?? value['xUrl']);
    push('github', value['githubUrl'] ?? value['github']);
    push('discord', value['discordUrl'] ?? value['discord']);
    push('telegram', value['telegramUrl'] ?? value['telegram']);
    push('reddit', value['redditUrl'] ?? value['reddit']);

    return collected;
  }

  private socialKindFrom(value: unknown): WalletMarketSocialKind {
    const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (raw === 'x' || raw.includes('twitter')) {
      return 'x';
    }
    if (raw.includes('github') || raw.includes('source')) {
      return 'github';
    }
    if (raw.includes('discord') || raw.includes('chat')) {
      return 'discord';
    }
    if (raw.includes('telegram')) {
      return 'telegram';
    }
    if (raw.includes('reddit')) {
      return 'reddit';
    }
    return 'other';
  }

  private socialLabel(kind: WalletMarketSocialKind): string {
    switch (kind) {
      case 'x':
        return 'X';
      case 'github':
        return 'GitHub';
      case 'discord':
        return 'Discord';
      case 'telegram':
        return 'Telegram';
      case 'reddit':
        return 'Reddit';
      default:
        return 'Social';
    }
  }

  private nestedUrl(container: unknown, ...keys: string[]): string | undefined {
    if (!this.isRecord(container)) {
      return undefined;
    }
    for (const key of keys) {
      const value = container[key];
      const url = this.asHttpUrl(value);
      if (url) {
        return url;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          const nested = this.asHttpUrl(item);
          if (nested) {
            return nested;
          }
        }
      }
    }
    return undefined;
  }

  private firstUrl(...candidates: unknown[]): string | undefined {
    for (const candidate of candidates) {
      const url = this.asHttpUrl(candidate);
      if (url) {
        return url;
      }
    }
    return undefined;
  }

  private asHttpUrl(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return undefined;
      }
      return trimmed;
    } catch {
      return undefined;
    }
  }

  private numberOrZero(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
