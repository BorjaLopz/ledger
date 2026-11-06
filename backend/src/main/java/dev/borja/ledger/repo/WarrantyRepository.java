package dev.borja.ledger.repo;

import dev.borja.ledger.model.Warranty;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WarrantyRepository extends JpaRepository<Warranty, String> {
    List<Warranty> findByUid(String uid);

    Optional<Warranty> findByIdAndUid(String id, String uid);
}
