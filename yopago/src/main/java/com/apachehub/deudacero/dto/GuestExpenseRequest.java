package com.apachehub.deudacero.dto;

import java.util.List;

public class GuestExpenseRequest {
    public String groupCode;
    public String memberName;
    public String email;
    public String description;
    public Double amount;
    public String category;
    public List<Long> participantMemberIds;
    public List<ItemDTO> items;

    public String getGroupCode() {
        return groupCode;
    }

    public String getMemberName() {
        return memberName;
    }

    public String getEmail() {
        return email;
    }

    public String getDescription() {
        return description;
    }

    public Double getAmount() {
        return amount;
    }

    public String getCategory() {
        return category;
    }

    public List<Long> getParticipantMemberIds() {
        return participantMemberIds;
    }

    public List<ItemDTO> getItems() {
        return items;
    }

    public static class ItemDTO {
        public String description;
        public Double amount;
        public Integer quantity;
        public Boolean onlyForMe; // true = solo para el invitado, false/null = división equitativa
        public List<Long> participantMemberIds;

        public String getDescription() {
            return description;
        }

        public Double getAmount() {
            return amount;
        }

        public Integer getQuantity() {
            return quantity;
        }

        public Boolean getOnlyForMe() {
            return onlyForMe;
        }

        public List<Long> getParticipantMemberIds() {
            return participantMemberIds;
        }
    }
}
