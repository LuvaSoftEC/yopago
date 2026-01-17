package com.apachehub.deudacero.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.Data;

@Data
public class ExpenseDTO {
    @NotNull
    private Long groupId;
    @NotNull
    private Long payerId;
    @NotNull
    @Positive
    private Double amount;
    @Size(max = 255)
    private String note;
    private String tag;
    private String currency = "USD";

    // Para división personalizada (se usa cuando NO hay items detallados)
    private List<ShareDTO> shares;
    
    // Para gastos con items detallados
    private List<ExpenseItemDTO> items;

    @Data
    public static class ShareDTO {
        private Long memberId;
        private Double percentage;
        private Double amount; // opcional, si quieres permitir monto directo
    }
}
