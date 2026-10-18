import { CreateTransferDto } from './dto/create-transfer.dto';
import { TransactionsService, TransferResult } from './transactions.service';
export declare class TransactionsController {
    private readonly transactionsService;
    constructor(transactionsService: TransactionsService);
    transfer(dto: CreateTransferDto, idempotencyKey?: string): Promise<TransferResult>;
    deposit(accountId: string, amountInCents: number, idempotencyKey?: string): Promise<{
        status: 'COMMITTED';
        accountId: string;
        amountCents: number;
    }>;
    balance(accountId: string): Promise<{
        accountId: string;
        balanceCents: number;
    }>;
    private assertIdempotencyKey;
}
