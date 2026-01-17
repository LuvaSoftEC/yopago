package com.apachehub.deudacero.dto;

public class JoinGroupRequest {
    private String code; // Puede ser joinCode o groupId
    private Long memberId;
    private Boolean applyToHistory; // si true, re-split histórico al unirse

    public Boolean getApplyToHistory() {
        return applyToHistory;
    }

    public void setApplyToHistory(Boolean applyToHistory) {
        this.applyToHistory = applyToHistory;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public Long getMemberId() {
        return memberId;
    }

    public void setMemberId(Long memberId) {
        this.memberId = memberId;
    }
}
