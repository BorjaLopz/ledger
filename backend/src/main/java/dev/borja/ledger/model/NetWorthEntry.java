package dev.borja.ledger.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "net_worth_entries")
public class NetWorthEntry {
    @Id
    public String id;

    @Column(nullable = false)
    public String uid;

    @NotNull
    @Column(nullable = false)
    public LocalDate date;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    public List<NetWorthItem> items = new ArrayList<>();

    @NotNull
    @Column(nullable = false, precision = 16, scale = 2)
    public BigDecimal total;

    @PrePersist
    void ensureId() {
        if (id == null) id = UUID.randomUUID().toString();
    }
}
