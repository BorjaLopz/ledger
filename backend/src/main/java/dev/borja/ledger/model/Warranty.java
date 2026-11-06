package dev.borja.ledger.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "warranties")
public class Warranty {
    @Id
    public String id;

    @Column(nullable = false)
    public String uid;

    @Column(nullable = false, length = 100)
    public String name;

    @Column(name = "purchase_date", nullable = false)
    public LocalDate purchaseDate;

    @Column(nullable = false)
    public int months;

    @Column(nullable = false)
    public String note = "";

    @Column(name = "receipt_path")
    public String receiptPath;

    @Column(name = "created_at", nullable = false, updatable = false)
    public Instant createdAt;

    public LocalDate expiresOn() {
        return purchaseDate.plusMonths(months);
    }

    @PrePersist
    void prePersist() {
        if (id == null) id = UUID.randomUUID().toString();
        if (createdAt == null) createdAt = Instant.now();
    }
}
