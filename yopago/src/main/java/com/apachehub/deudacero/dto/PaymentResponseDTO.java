package com.apachehub.deudacero.dto;

import com.apachehub.deudacero.entities.Member;
import com.apachehub.deudacero.entities.Payment;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDateTime;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class PaymentResponseDTO {

    private Long id;
    private Double amount;
    private String note;
    private Boolean confirmed;
    private LocalDateTime createdAt;
    private Long groupId;
    private MemberSummary fromMember;
    private MemberSummary toMember;

    public static PaymentResponseDTO from(Payment payment) {
        PaymentResponseDTO dto = new PaymentResponseDTO();
        dto.id = payment.getId();
        dto.amount = payment.getAmount();
        dto.note = payment.getNote();
        dto.confirmed = payment.getConfirmed();
        dto.createdAt = payment.getCreatedAt();
        dto.groupId = payment.getGroup() != null ? payment.getGroup().getId() : null;
        dto.fromMember = MemberSummary.from(payment.getFromMember());
        dto.toMember = MemberSummary.from(payment.getToMember());
        return dto;
    }

    public Long getId() {
        return id;
    }

    public Double getAmount() {
        return amount;
    }

    public String getNote() {
        return note;
    }

    public Boolean getConfirmed() {
        return confirmed;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public Long getGroupId() {
        return groupId;
    }

    public MemberSummary getFromMember() {
        return fromMember;
    }

    public MemberSummary getToMember() {
        return toMember;
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class MemberSummary {
        private Long id;
        private String name;
        private String email;
        private Boolean registered;
        private Boolean guest;

        public static MemberSummary from(Member member) {
            if (member == null) {
                return null;
            }
            MemberSummary summary = new MemberSummary();
            summary.id = member.getId();
            summary.name = member.getName();
            summary.email = member.getEmail();
            summary.registered = member.getIsRegistered();
            summary.guest = member.isGuest();
            return summary;
        }

        public Long getId() {
            return id;
        }

        public String getName() {
            return name;
        }

        public String getEmail() {
            return email;
        }

        public Boolean getRegistered() {
            return registered;
        }

        public Boolean getGuest() {
            return guest;
        }
    }
}
