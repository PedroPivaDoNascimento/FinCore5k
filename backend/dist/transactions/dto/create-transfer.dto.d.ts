export declare class CreateTransferDto {
    accountId: string;
    destinationAccountId: string;
    amountInCents: number;
    type: 'PIX' | 'TED' | 'PAYMENT' | 'WITHDRAW';
    idempotencyKey?: string;
}
