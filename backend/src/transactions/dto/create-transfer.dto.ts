import {
  IsIn,
  IsInt,
  IsPositive,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

/**
 * TASK E2E 2.2 - DTO de transferencia (POST /transactions/transfer).
 *
 * REGRA ABSOLUTA (RULES.md secao 1): `amountInCents` e SEMPRE inteiro de
 * centavos. `@IsInt()` rejeita floats na borda HTTP (400 antes do Ledger);
 * o LedgerService revalida internamente (defesa em profundidade).
 */
export class CreateTransferDto {
  @IsString()
  @MinLength(1)
  accountId!: string;

  @IsString()
  @MinLength(1)
  destinationAccountId!: string;

  /** Inteiro positivo em CENTAVOS (ex.: R$ 100,50 -> 10050). Nunca float. */
  @IsInt()
  @IsPositive()
  amountInCents!: number;

  @IsIn(['PIX', 'TED', 'PAYMENT', 'WITHDRAW'])
  type!: 'PIX' | 'TED' | 'PAYMENT' | 'WITHDRAW';

  /**
   * Opcional no body: a fonte canonica e o header X-Idempotency-Key
   * (IdempotencyInterceptor). Quando informado deve ser UUID.
   */
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
    message: 'idempotencyKey (quando informado) deve ser um UUID.',
  })
  idempotencyKey?: string;
}
