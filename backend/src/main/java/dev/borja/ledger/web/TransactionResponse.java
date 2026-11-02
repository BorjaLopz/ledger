package dev.borja.ledger.web;

import dev.borja.ledger.model.Transaction;
import dev.borja.ledger.service.ReceiptService;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record TransactionResponse(
        String id,
        String uid,
        String type,
        BigDecimal amount,
        String categoryId,
        LocalDate date,
        String note,
        String receiptUrl,
        String recurringId,
        Instant createdAt) {

    public static TransactionResponse from(Transaction t, ReceiptService receipts) {
        return new TransactionResponse(t.id, t.uid, t.type, t.amount, t.categoryId, t.date, t.note,
                receipts.signedUrl(t.receiptPath), t.recurringId, t.createdAt);
    }
}
