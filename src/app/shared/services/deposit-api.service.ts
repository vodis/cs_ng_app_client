import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthProviderService } from '@core/auth/auth-provider.service';
import { environment } from '../../../environments/environment';
import {
  DepositInstructions,
  usableDepositInstructions,
} from '../components/add-funds-panel/deposit-instructions';

@Injectable({ providedIn: 'root' })
export class DepositApiService {
  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthProviderService
  ) {}

  async create(
    walletId: string,
    assetId: string,
    network: string,
    recipient: string,
    amount: string
  ): Promise<DepositInstructions> {
    const token = await this.auth.getAccessToken();
    if (!token) throw new Error('Sign in to receive funds.');
    const response = await firstValueFrom(
      this.http.post<unknown>(
        `${environment.apiUrl}/api/v1/deposits/instructions`,
        { walletId, assetId, amount },
        { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
      )
    );
    if (!isRecord(response) || !isRecord(response['data']))
      throw new Error('Invalid deposit instructions');
    const data = response['data'];
    if (
      data['amount'] !== amount ||
      typeof data['minimumReceived'] !== 'string' ||
      !/^(0|[1-9]\d*)(\.\d+)?$/.test(data['minimumReceived']) ||
      !/[1-9]/.test(data['minimumReceived']) ||
      data['walletId'] !== walletId ||
      data['recipient'] !== recipient ||
      data['network'] !== network ||
      typeof data['assetId'] !== 'string' ||
      typeof data['address'] !== 'string' ||
      typeof data['expiresAt'] !== 'string' ||
      (data['memo'] !== undefined && typeof data['memo'] !== 'string')
    ) {
      throw new Error('Invalid deposit instructions');
    }
    const instructions: DepositInstructions = {
      amount,
      minimumReceived: data['minimumReceived'],
      assetId: data['assetId'],
      address: data['address'],
      expiresAt: data['expiresAt'],
      ...(typeof data['memo'] === 'string' ? { memo: data['memo'] } : {}),
    };
    if (!usableDepositInstructions(instructions, assetId))
      throw new Error('Invalid deposit instructions');
    return instructions;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
