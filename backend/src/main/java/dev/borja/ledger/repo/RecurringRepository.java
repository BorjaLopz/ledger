package dev.borja.ledger.repo;

import dev.borja.ledger.model.RecurringPayment;
import jakarta.persistence.LockModeType;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RecurringRepository extends JpaRepository<RecurringPayment, String> {
    List<RecurringPayment> findByUid(String uid);

    Optional<RecurringPayment> findByIdAndUid(String id, String uid);

    /** Bloquea las filas para que dos sincronizaciones simultaneas no dupliquen transacciones. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from RecurringPayment r where r.uid = :uid and r.active = true and r.nextDate <= :today")
    List<RecurringPayment> findDueForUpdate(@Param("uid") String uid, @Param("today") LocalDate today);
}
