package dev.borja.ledger.repo;

import dev.borja.ledger.model.Transaction;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TransactionRepository extends JpaRepository<Transaction, String> {
    List<Transaction> findByUidOrderByDateDesc(String uid);

    Optional<Transaction> findByIdAndUid(String id, String uid);
}
