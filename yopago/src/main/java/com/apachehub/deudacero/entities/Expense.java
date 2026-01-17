package com.apachehub.deudacero.entities;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonBackReference;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonManagedReference;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Data
@NoArgsConstructor
public class Expense {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Double amount;
    private String note;
    private String tag;
    private String currency = "USD";

    @OneToMany(mappedBy = "expense", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    private List<ExpenseItem> items = new java.util.ArrayList<>();

    @ManyToOne
    @JoinColumn(name = "group_id")
    @JsonBackReference
    private Group group;

    @ManyToOne
    @JoinColumn(name = "payer_id")
    private Member payer;

    // Relación con ExpenseShare para mostrar cuánto debe pagar cada participante
    @OneToMany(mappedBy = "expense", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    private List<ExpenseShare> shares;

    // Sobrescribe el getter para la serialización JSON
    @com.fasterxml.jackson.annotation.JsonProperty("shares")
    public List<ExpenseShareDTO> getShares() {
        if (shares == null)
            return null;
        return shares.stream().map(ExpenseShareDTO::new).toList();
    }

    public static class ExpenseShareDTO {
        public Long id;
        public Member member;
        public Double amount;
        public Double percentage;

        public ExpenseShareDTO(ExpenseShare share) {
            this.id = share.getId();
            this.member = share.getMember();
            this.percentage = share.getPercentage();
            this.amount = share.getCalculatedAmount();
        }
    }

    // Custom methods for SettlementService
    @Transient
    public Long getPayerId() {
        return payer != null ? payer.getId() : null;
    }

    // Constructor personalizado para facilitar la deserialización
    public Expense(Double amount, String note, String tag, String currency, Group group, Member payer) {
        this.amount = amount;
        this.note = note;
        this.tag = tag;
        this.currency = currency;
        this.group = group;
        this.payer = payer;
        this.items = new java.util.ArrayList<>();
        this.shares = new java.util.ArrayList<>();
    }

    // Getters and setters
    // ...
    public void setDescription(String description) {
        this.note = description;
    }

    public void setDate(java.util.Date date) {
        // Si tienes un campo date, asígnalo aquí. Si no, deja vacío o implementa según
        // tu modelo.
    }
}
