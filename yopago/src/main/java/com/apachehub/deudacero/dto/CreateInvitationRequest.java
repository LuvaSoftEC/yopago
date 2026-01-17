package com.apachehub.deudacero.dto;

import lombok.Data;

@Data
public class CreateInvitationRequest {
    private String email;
    private Integer expiresInHours;
    private Boolean singleUse;
}
