package dev.borja.ledger.repo;

import dev.borja.ledger.model.Transaction;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TransactionRepository extends JpaRepository<Transaction, String> {
    List<Transaction> findByUidOrderByDateDesc(String uid);

    Optional<Transaction> findByIdAndUid(String id, String uid);

    Optional<Transaction> findFirstByUidOrderByCreatedAtDesc(String uid);

    /** Ultimo movimiento apuntado a mano (sin contar los generados por pagos recurrentes). */
    Optional<Transaction> findFirstByUidAndRecurringIdIsNullOrderByCreatedAtDesc(String uid);

    long countByUidAndCategoryId(String uid, String categoryId);

    List<Transaction> findByUidAndCategoryId(String uid, String categoryId);
}
