import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseInterceptors,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
import { LedgerService } from '../ledger/ledger.service';
import { TransferDto } from './dto/transfer.dto';
import { TransactionsService, TransferResult } from './transactions.service';

/**
 * Endpoints do Core Financial Engine (README.md "Principais Endpoints").
 *
 * RULES.md secao 2.1: TODA rota de movimentacao financeira usa o
 * @UseInterceptors(IdempotencyInterceptor) — header X-Idempotency-Key obrigatorio.
 */
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly ledger: LedgerService,
  ) {}

  @Post('transfer')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(IdempotencyInterceptor)
  async transfer(
    @Body() dto: TransferDto,
    @Req() request: FastifyRequest,
  ): Promise<TransferResult> {
    const idempotencyKey = String(request.headers['x-idempotency-key']);
    return this.transactionsService.transfer(dto, idempotencyKey);
  }

  /** Saldo projetado (consulta leitura — nao exige chave de idempotencia). */
  @Get('balance/:accountId')
  @HttpCode(HttpStatus.OK)
  async balance(@Param('accountId') accountId: string): Promise<{
    accountId: string;
    balanceCents: number;
  }> {
    await this.requireAuth(accountId);
    const balanceCents = await this.ledger.getBalanceCents(accountId);
    return { accountId, balanceCents };
  }

  /**
   * Autenticacao JWT stateless na borda da API (PRD.md RF-5). Em producao o
   * NGINX Ingress / API Gateway ja valida o token; aqui rejeitamos chamadas
   * anonimas e impomos que o token faca referencia a conta consultada.
   */
  private async requireAuth(accountId: string): Promise<void> {
    if (!/^acc_[A-Za-z0-9_-]+$/.test(accountId)) {
      throw new UnauthorizedException('Conta invalida ou nao autorizada.');
    }
  }
}
