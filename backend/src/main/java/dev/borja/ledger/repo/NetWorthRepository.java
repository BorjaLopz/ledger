package dev.borja.ledger.repo;

import dev.borja.ledger.model.NetWorthEntry;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NetWorthRepository extends JpaRepository<NetWorthEntry, String> {
    List<NetWorthEntry> findByUidOrderByDateAsc(String uid);

    Optional<NetWorthEntry> findByIdAndUid(String id, String uid);
}
