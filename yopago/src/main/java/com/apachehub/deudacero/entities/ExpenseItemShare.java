package com.apachehub.deudacero.entities;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "expense_item_shares")
@Data
@NoArgsConstructor
public class ExpenseItemShare {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "expense_item_id")
    private ExpenseItem expenseItem;

    @ManyToOne
    @JoinColumn(name = "member_id")
    private Member member;

    // Si es null, se divide equitativamente con otros miembros del item
    // Si tiene valor, es un porcentaje específico (0-100)
    private Double percentage;

    // Si es null, se calcula automáticamente
    // Si tiene valor, es un monto específico
    private Double amount;

    // Tipo de asignación: 'SPECIFIC' (solo para este miembro), 'SHARED' (compartido)
    @Enumerated(EnumType.STRING)
    private ShareType shareType = ShareType.SHARED;

    public enum ShareType {
        SPECIFIC, // Solo para este miembro específico
        SHARED    // Compartido entre miembros asignados
    }

    // Método para calcular el monto si está null
    @Transient
    public Double getCalculatedAmount() {
        if (amount != null) {
            return amount;
        }
        if (percentage != null && expenseItem != null && expenseItem.getAmount() != null) {
            return expenseItem.getAmount() * (percentage / 100.0);
        }
        return null;
    }
}