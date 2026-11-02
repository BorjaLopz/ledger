package dev.borja.ledger.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
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
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "transactions")
public class Transaction {
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

    @NotNull
    @Column(nullable = false)
    public LocalDate date;

    @NotNull
    @Column(nullable = false)
    public String note = "";

    /** Ruta relativa dentro del almacen de tickets: "{uid}/{fichero}". Nunca se expone tal cual. */
    @JsonIgnore
    @Column(name = "receipt_path")
    public String receiptPath;

    @Column(name = "recurring_id")
    public String recurringId;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt;

    @PrePersist
    void prePersist() {
        if (id == null) id = UUID.randomUUID().toString();
        if (createdAt == null) createdAt = Instant.now();
    }
}
