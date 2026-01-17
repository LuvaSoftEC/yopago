package com.apachehub.deudacero.entities;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonManagedReference;
import lombok.Data;

@Entity
@Table(name = "expense_items")
@Data
public class ExpenseItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "expense_id")
    private Expense expense;

    private String description;

    private Double amount;

    private Integer quantity;

    private LocalDateTime createdAt;

    // Relación con las shares del item (quién paga qué parte de este item)
    @OneToMany(mappedBy = "expenseItem", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    private List<ExpenseItemShare> itemShares;

    // Constructor por defecto para inicializar fecha (reemplaza @NoArgsConstructor)
    public ExpenseItem() {
        this.createdAt = LocalDateTime.now();
    }

    // Constructor con parámetros
    public ExpenseItem(String description, Double amount, Integer quantity) {
        this();
        this.description = description;
        this.amount = amount;
        this.quantity = quantity;
    }
}