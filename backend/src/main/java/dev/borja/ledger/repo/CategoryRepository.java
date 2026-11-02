package dev.borja.ledger.repo;

import dev.borja.ledger.model.Category;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoryRepository extends JpaRepository<Category, String> {
    List<Category> findByUid(String uid);

    Optional<Category> findByIdAndUid(String id, String uid);

    long countByUid(String uid);
}
