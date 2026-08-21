import { environment } from '../../../environments/environment';
import { PortfolioApiService } from './portfolio-api.service';

describe('PortfolioApiService', () => {
  it('accepts only API and application origins for authorization continuation', () => {
    const service = new PortfolioApiService(null as never, null as never);

    expect(
      service.isTrustedContinuation(`${environment.apiUrl}/oauth/complete?id=1`)
    ).toBeTrue();
    expect(
      service.isTrustedContinuation(`${environment.origin}en/portfolio`)
    ).toBeTrue();
    expect(
      service.isTrustedContinuation('https://attacker.example/oauth/complete')
    ).toBeFalse();
    expect(service.isTrustedContinuation('not-a-url')).toBeFalse();
  });
});
