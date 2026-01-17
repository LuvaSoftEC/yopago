package com.apachehub.deudacero.dto;

import java.util.List;
import lombok.Data;

/**
 * DTO ligero para mostrar gastos sin referencias circulares
 */
@Data
public class ExpenseResponseDTO {
    private Long id;
    private Double amount;
    private String note;
    private String tag;
    private String currency;
    
    // Información básica del pagador
    private MemberInfo payer;
    
    // Información básica del grupo
    private GroupInfo group;
    
    // Items del gasto (si los tiene)
    private List<ItemInfo> items;
    
    // Información de división/shares
    private List<ShareInfo> shares;

    @Data
    public static class MemberInfo {
        private Long id;
        private String name;
        private Boolean isGuest;
    }

    @Data
    public static class GroupInfo {
        private Long id;
        private String name;
        private String groupCode;
    }

    @Data
    public static class ItemInfo {
        private Long id;
        private String description;
        private Double amount;
        private Integer quantity;
    }

    @Data
    public static class ShareInfo {
        private Long id;
        private MemberInfo member;
        private Double amount;
        private Double percentage;
    }
}