package com.apachehub.deudacero.entities;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Data
@NoArgsConstructor
public class ExpenseShare {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "expense_id")
    @com.fasterxml.jackson.annotation.JsonBackReference
    private Expense expense;

    @ManyToOne
    @JoinColumn(name = "member_id")
    private Member member;

    // Monto que debe pagar este participante en este gasto
    private Double amount;

    // Opcional: porcentaje del total
    private Double percentage;

    // Calcula el monto si está null y hay porcentaje
    @jakarta.persistence.Transient
    public Double getCalculatedAmount() {
        if (amount != null)
            return amount;
        if (percentage != null && expense != null && expense.getAmount() != null) {
            return expense.getAmount() * (percentage / 100.0);
        }
        return null;
    }
}
