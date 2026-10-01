import { JwtAuthGuard } from './jwt-auth.guard';
import { createHmac, randomBytes } from 'node:crypto';

/**
 * TASK 2.3 (unitario) - Guard Bearer JWT: validacao HS256 na borda.
 */
describe('JwtAuthGuard (unitario)', () => {
  const secret = 'unit-test-secret';
  process.env.TEST_JWT_SECRET = secret;

  const b64u = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');

  function sign(payload: Record<string, unknown>, signingSecret = secret): string {
    const header = b64u({ alg: 'HS256', typ: 'JWT' });
    const body = b64u(payload);
    const sig = createHmac('sha256', signingSecret).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${sig}`;
  }

  const httpContext = (headers: Record<string, string>) => {
    const request: any = { headers };
    return { switchToHttp: () => ({ getRequest: () => request }) } as any;
  };

  let guard: JwtAuthGuard;
  beforeEach(() => {
    guard = new JwtAuthGuard();
  });

  it('aceita token HS256 valido e injeta o payload em request.user', () => {
    const token = sign({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) + 60 });
    const ctx = httpContext({ authorization: `Bearer ${token}` });

    expect(guard.canActivate(ctx)).toBe(true);
    expect(ctx.switchToHttp().getRequest().user).toMatchObject({ sub: 'user-1' });
  });

  it('rejeita requisicao sem header Authorization (401)', () => {
    expect(() => guard.canActivate(httpContext({}))).toThrow(/Bearer/);
  });

  it('rejeita esquema de autenticacao diferente de Bearer (401)', () => {
    expect(() => guard.canActivate(httpContext({ authorization: `Basic ${randomBytes(8).toString('hex')}` }))).toThrow(/Bearer/);
  });

  it('rejeita JWT malformado (sem 3 partes) com 401', () => {
    expect(() => guard.canActivate(httpContext({ authorization: 'Bearer abc.def' }))).toThrow(/malformado/);
  });

  it('bloqueia ataque alg=none / algorithm confusion (401)', () => {
    const header = b64u({ alg: 'none', typ: 'JWT' });
    const body = b64u({ sub: 'attacker', exp: Math.floor(Date.now() / 1000) + 600 });
    expect(() =>
      guard.canActivate(httpContext({ authorization: `Bearer ${header}.${body}.` })),
    ).toThrow(/nao suportado/);
  });

  it('rejeita assinatura invalida (constante-time compare) com 401', () => {
    const token = sign({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) + 60 }, 'segredo-errado');
    expect(() => guard.canActivate(httpContext({ authorization: `Bearer ${token}` }))).toThrow(/Assinatura JWT invalida/);
  });

  it('rejeita JWT expirado com 401', () => {
    const token = sign({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) - 10 });
    expect(() => guard.canActivate(httpContext({ authorization: `Bearer ${token}` }))).toThrow(/expirado/);
  });
});
