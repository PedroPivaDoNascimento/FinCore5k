import {
  IsEnum,
  IsInt,
  IsPositive,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Tipos de movimentacao suportados (PRD.md: Pix/TED, pagamentos e saques). */
export enum TransactionType {
  PIX = 'PIX',
  TED = 'TED',
  PAYMENT = 'PAYMENT',
  WITHDRAWAL = 'WITHDRAWAL',
}

/**
 * Payload de transferencia documentado no README.md ("Principais Endpoints").
 * amountInCents SEMPRE inteiro de centavos — float/double proibido (RULES.md secao 1).
 */
export class TransferDto {
  @IsString()
  @MinLength(1)
  accountId!: string;

  @IsString()
  @MinLength(1)
  destinationAccountId!: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  amountInCents!: number;

  @IsEnum(TransactionType)
  type!: TransactionType;
}

/** UUIDv4 gerado no cliente (RULES.md secao 4.1) — validado na camada de servico. */
export const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
