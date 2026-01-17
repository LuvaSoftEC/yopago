package com.apachehub.deudacero.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.Data;

@Data
public class ExpenseItemDTO {
    @NotNull
    @Size(min = 1, max = 255)
    private String description;
    
    @NotNull
    @Positive
    private Double amount;
    
    private Integer quantity = 1;
    
    // Lista de miembros y cómo se divide este item
    private List<ItemShareDTO> itemShares;

    @Data
    public static class ItemShareDTO {
        @NotNull
        private Long memberId;
        
        // 'SPECIFIC' = solo para este miembro, 'SHARED' = compartido con otros
        private String shareType = "SHARED";
        
        // Porcentaje específico (opcional, si no se especifica se divide equitativamente)
        private Double percentage;
        
        // Monto específico (opcional, tiene precedencia sobre percentage)
        private Double amount;
    }
}