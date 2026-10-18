import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { TransactionsService, TransferResult } from './transactions.service';

/**
 * TASK E2E 2.2 / 2.3 - Rotas de movimentacao financeira.
 *
 * RULES.md secao 2.1: TODA rota de movimentacao DEVE usar
 * `@UseInterceptors(IdempotencyInterceptor)` — aplicada aqui em nivel de
 * classe para cobrir transfer e deposit (defesa contra rotas futuras).
 * RULES.md secao 4.1 (frontend) assume UUIDv4 gerado no cliente; o backend
 * revalida o formato do header antes de tocar no Redis.
 */
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller('transactions')
@UseGuards(JwtAuthGuard)
@UseInterceptors(IdempotencyInterceptor)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post('transfer')
  @HttpCode(201)
  async transfer(
    @Body() dto: CreateTransferDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<TransferResult> {
    this.assertIdempotencyKey(idempotencyKey);
    return this.transactionsService.transfer(dto, idempotencyKey as string);
  }

  /** Rota de seed/exemplo: credito inicial de conta (tambem idempotente). */
  @Post('deposit')
  @HttpCode(201)
  async deposit(
    @Body('accountId') accountId: string,
    @Body('amountInCents') amountInCents: number,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<{ status: 'COMMITTED'; accountId: string; amountCents: number }> {
    this.assertIdempotencyKey(idempotencyKey);
    await this.transactionsService.deposit(accountId, Number(amountInCents), idempotencyKey as string);
    return { status: 'COMMITTED', accountId, amountCents: Number(amountInCents) };
  }

  @Get('balance/:accountId')
  async balance(@Param('accountId') accountId: string): Promise<{ accountId: string; balanceCents: number }> {
    const balanceCents = await this.transactionsService.getBalance(accountId);
    return { accountId, balanceCents };
  }

  private assertIdempotencyKey(key?: string): void {
    if (!key || !UUID_V4_RE.test(key.trim())) {
      throw new UnauthorizedException(
        'Header X-Idempotency-Key obrigatorio e deve ser um UUID valido.',
      );
    }
  }
}
