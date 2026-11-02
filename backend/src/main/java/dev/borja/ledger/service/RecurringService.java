package dev.borja.ledger.service;

import dev.borja.ledger.model.RecurringPayment;
import dev.borja.ledger.model.Transaction;
import dev.borja.ledger.repo.RecurringRepository;
import dev.borja.ledger.repo.TransactionRepository;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RecurringService {

    private static final int MAX_CATCH_UP_ITERATIONS = 24;

    private final RecurringRepository recurring;
    private final TransactionRepository transactions;
    private final ZoneId zone;

    public RecurringService(RecurringRepository recurring, TransactionRepository transactions,
                            @Value("${app.timezone}") String timezone) {
        this.recurring = recurring;
        this.transactions = transactions;
        this.zone = ZoneId.of(timezone);
    }

    /**
     * Genera las transacciones de los pagos recurrentes vencidos. Es atomico y bloquea las filas,
     * asi que llamarlo desde varios dispositivos a la vez no duplica movimientos.
     */
    @Transactional
    public int sync(String uid) {
        LocalDate today = LocalDate.now(zone);
        List<RecurringPayment> due = recurring.findDueForUpdate(uid, today);
        int created = 0;
        for (RecurringPayment r : due) {
            LocalDate next = r.nextDate;
            int iterations = 0;
            while (!next.isAfter(today) && iterations < MAX_CATCH_UP_ITERATIONS) {
                Transaction t = new Transaction();
                t.uid = uid;
                t.type = r.type;
                t.amount = r.amount;
                t.categoryId = r.categoryId;
                t.date = next;
                t.note = r.note;
                t.recurringId = r.id;
                transactions.save(t);
                next = advance(next, r.frequency);
                iterations++;
                created++;
            }
            r.nextDate = next;
        }
        return created;
    }

    static LocalDate advance(LocalDate date, String frequency) {
        return switch (frequency) {
            case "weekly" -> date.plusWeeks(1);
            case "monthly" -> date.plusMonths(1);
            case "yearly" -> date.plusYears(1);
            default -> throw new IllegalArgumentException("Frecuencia desconocida: " + frequency);
        };
    }
}
