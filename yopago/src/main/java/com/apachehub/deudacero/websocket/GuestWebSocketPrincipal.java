package com.apachehub.deudacero.websocket;

import java.security.Principal;

/**
 * Principal ligero para conexiones WebSocket realizadas por invitados.
 * Permite identificar al invitado y su grupo asociado sin requerir JWT.
 */
public class GuestWebSocketPrincipal implements Principal {

    private final Long memberId;
    private final Long groupId;
    private final String displayName;

    public GuestWebSocketPrincipal(Long memberId, Long groupId, String displayName) {
        this.memberId = memberId;
        this.groupId = groupId;
        this.displayName = displayName != null ? displayName : "guest";
    }

    @Override
    public String getName() {
        return "guest-" + memberId;
    }

    public Long getMemberId() {
        return memberId;
    }

    public Long getGroupId() {
        return groupId;
    }

    public String getDisplayName() {
        return displayName;
    }
}
