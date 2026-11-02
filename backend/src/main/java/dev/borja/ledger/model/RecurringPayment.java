package dev.borja.ledger.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "recurring_payments")
public class RecurringPayment {
    @Id
    public String id;

    @Column(nullable = false)
    public String uid;

    @NotBlank @Pattern(regexp = "expense|income")
    @Column(nullable = false)
    public String type;

    @NotNull @DecimalMin("0")
    @Column(nullable = false, precision = 14, scale = 2)
    public BigDecimal amount;

    @NotBlank @Size(max = 64)
    @Column(name = "category_id", nullable = false)
    public String categoryId;

    @NotBlank @Pattern(regexp = "weekly|monthly|yearly")
    @Column(nullable = false)
    public String frequency;

    @NotNull
    @Column(name = "next_date", nullable = false)
    public LocalDate nextDate;

    @Column(nullable = false)
    public boolean active = true;

    @NotNull
    @Column(nullable = false)
    public String note = "";

    @PrePersist
    void ensureId() {
        if (id == null) id = UUID.randomUUID().toString();
    }
}
