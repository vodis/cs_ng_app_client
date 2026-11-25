import {
  classifyRpcLatency,
  RPC_LATENCY_HEALTHY_MS,
  RPC_LATENCY_SLOW_MS,
} from './client-rpc.models';

describe('classifyRpcLatency', () => {
  it('marks failed probes as failing', () => {
    expect(classifyRpcLatency(100, false)).toBe('failing');
    expect(classifyRpcLatency(null, true)).toBe('failing');
  });

  it('classifies healthy and slow bands', () => {
    expect(classifyRpcLatency(RPC_LATENCY_HEALTHY_MS - 1, true)).toBe(
      'healthy'
    );
    expect(classifyRpcLatency(RPC_LATENCY_HEALTHY_MS, true)).toBe('slow');
    expect(classifyRpcLatency(RPC_LATENCY_SLOW_MS - 1, true)).toBe('slow');
    expect(classifyRpcLatency(RPC_LATENCY_SLOW_MS, true)).toBe('failing');
  });
});
