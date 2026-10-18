import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * TASK E2E 2.3 - Guard de autenticacao Bearer JWT (validacao na borda).
 *
 * Decisao de design: validacao HMAC-SHA256 nativa via `node:crypto` em vez de
 * trazer `@nestjs/passport` + `jsonwebtoken`. RULES.md 3.1 cobra dependencias
 * minimas no hot-path de 5k CCU; o algoritmo e o mesmo (JWT HS256 com
 * comparacao de assinatura em tempo constante).
 *
 * Seguranca reforada:
 *  - rejeita `alg: none` / assinaturas invalidas (consttimingSafeEqual);
 *  - expiração (`exp`) obrigatoriamente valida;
 *  - segredo exclusivo de teste (`TEST_JWT_SECRET`) para o ambiente e2e —
 *    em producao o secret vem do Secrets Manager do K8s (PRD RF-5).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly secret: string;

  constructor() {
    this.secret = process.env.TEST_JWT_SECRET ?? 'fincore-e2e-secret';
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const auth: string | undefined = request.headers['authorization'];

    if (!auth || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token JWT obrigatorio.');
    }

    const token = auth.slice('Bearer '.length).trim();
    const payload = this.verify(token);
    request.user = payload; // disponivel para rate-limit por usuario / auditoria
    return true;
  }

  /** Verifica header.payload.signature (HS256) e retorna o payload decodificado. */
  verify(token: string): Record<string, unknown> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('JWT malformado.');
    }
    const [b64Header, b64Payload, b64Sig] = parts;

    let header: { alg?: string; typ?: string };
    try {
      header = JSON.parse(Buffer.from(b64Header, 'base64url').toString());
    } catch {
      throw new UnauthorizedException('JWT malformado.');
    }
    if (header.alg !== 'HS256') {
      // Bloqueio explicito de alg=none / algorithm confusion.
      throw new UnauthorizedException('Algoritmo JWT nao suportado.');
    }

    const expectedSig = Buffer.from(
      require('node:crypto')
        .createHmac('sha256', this.secret)
        .update(`${b64Header}.${b64Payload}`)
        .digest(),
    );
    const providedSig = Buffer.from(b64Sig, 'base64url');
    if (
      providedSig.length !== expectedSig.length ||
      !require('node:crypto').timingSafeEqual(providedSig, expectedSig)
    ) {
      throw new UnauthorizedException('Assinatura JWT invalida.');
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString());
    } catch {
      throw new UnauthorizedException('JWT malformado.');
    }
    const exp = Number(payload.exp ?? 0);
    if (!exp || exp * 1000 < Date.now()) {
      throw new UnauthorizedException('JWT expirado.');
    }
    return payload;
  }
}
