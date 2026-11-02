package dev.borja.ledger.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

@Entity
@Table(name = "categories")
public class Category {
    @Id
    public String id;

    @Column(nullable = false)
    public String uid;

    @NotBlank @Size(max = 100)
    @Column(nullable = false)
    public String name;

    @NotBlank @Size(max = 20)
    @Column(nullable = false)
    public String color;

    @NotBlank @Size(max = 60)
    @Column(nullable = false)
    public String icon;

    @NotBlank @Pattern(regexp = "expense|income")
    @Column(nullable = false)
    public String type;

    @PrePersist
    void ensureId() {
        if (id == null) id = UUID.randomUUID().toString();
    }
}
