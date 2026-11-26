import { TestBed } from '@angular/core/testing';
import {
  ClientRpcProbeService,
  expectedEvmChainId,
  parseHexChainId,
} from './client-rpc-probe.service';

describe('ClientRpcProbeService', () => {
  let service: ClientRpcProbeService;
  let fetchSpy: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ClientRpcProbeService],
    });
    service = TestBed.inject(ClientRpcProbeService);
    fetchSpy = spyOn(window, 'fetch');
  });

  function jsonRpcOk(result: unknown): Response {
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  it('parses CAIP and hex chain ids', () => {
    expect(expectedEvmChainId('eip155:8453')).toBe(8453);
    expect(expectedEvmChainId('near:mainnet')).toBeNull();
    expect(parseHexChainId('0x2105')).toBe(8453);
    expect(parseHexChainId('0x1')).toBe(1);
  });

  it('marks an EVM endpoint healthy only when eth_chainId matches', async () => {
    fetchSpy.and.callFake(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        method?: string;
      };
      if (body.method === 'eth_chainId') {
        return jsonRpcOk('0x2105');
      }
      if (body.method === 'eth_blockNumber') {
        return jsonRpcOk('0x123');
      }
      return jsonRpcOk(null);
    });

    const ok = await service.probe('eip155:8453', 'https://base.example');
    expect(ok.ok).toBeTrue();
    expect(ok.level).toBe('healthy');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('rejects an Ethereum URL when Base is selected', async () => {
    fetchSpy.and.callFake(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        method?: string;
      };
      if (body.method === 'eth_chainId') {
        return jsonRpcOk('0x1');
      }
      return jsonRpcOk('0x123');
    });

    const result = await service.probe(
      'eip155:8453',
      'https://ethereum.example'
    );
    expect(result.ok).toBeFalse();
    expect(result.level).toBe('failing');
    expect(result.error).toContain('chain mismatch');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
