package com.apachehub.deudacero.controllers;

import com.apachehub.deudacero.dto.CreateInvitationRequest;
import com.apachehub.deudacero.entities.GroupInvitation;
import com.apachehub.deudacero.entities.Member;
import com.apachehub.deudacero.services.GroupInvitationService;
import com.apachehub.deudacero.services.UserSyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/groups/{groupId}/invitations")
@Tag(name = "Group invitations", description = "API para gestionar invitaciones de acceso a grupos")
public class GroupInvitationController {

    private final GroupInvitationService groupInvitationService;
    private final UserSyncService userSyncService;

    public GroupInvitationController(GroupInvitationService groupInvitationService,
            UserSyncService userSyncService) {
        this.groupInvitationService = groupInvitationService;
        this.userSyncService = userSyncService;
    }

    @Operation(summary = "Crear invitación de invitado")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "201", description = "Invitación creada exitosamente"),
            @ApiResponse(responseCode = "400", description = "Datos inválidos"),
            @ApiResponse(responseCode = "403", description = "Sin permisos"),
            @ApiResponse(responseCode = "500", description = "Error interno")
    })
    @PostMapping
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<Map<String, Object>> createInvitation(
            @PathVariable Long groupId,
            @RequestBody(required = false) CreateInvitationRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        try {
            Member requester = userSyncService.syncAuthenticatedUser(jwt);
            GroupInvitation invitation = groupInvitationService.createInvitation(
                    groupId,
                    requester.getId(),
                    request != null ? request.getEmail() : null,
                    request != null ? request.getExpiresInHours() : null,
                    request != null ? request.getSingleUse() : null);

            Map<String, Object> payload = Map.of(
                    "success", true,
                    "invitation", buildInvitationPayload(invitation));

            return ResponseEntity.status(HttpStatus.CREATED).body(payload);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false,
                            "message", "Error al crear la invitación: " + e.getMessage()));
        }
    }

    @Operation(summary = "Listar invitaciones de un grupo")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Invitaciones obtenidas exitosamente"),
            @ApiResponse(responseCode = "403", description = "Sin permisos"),
            @ApiResponse(responseCode = "404", description = "Grupo no encontrado")
    })
    @GetMapping
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<Map<String, Object>> listInvitations(
            @PathVariable Long groupId,
            @AuthenticationPrincipal Jwt jwt) {
        try {
            Member requester = userSyncService.syncAuthenticatedUser(jwt);
            List<GroupInvitation> invitations = groupInvitationService.getInvitationsForGroup(groupId,
                    requester.getId());

            List<Map<String, Object>> invitationPayloads = invitations.stream()
                    .map(this::buildInvitationPayload)
                    .collect(Collectors.toList());

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("invitations", invitationPayloads);
            response.put("count", invitationPayloads.size());

            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false,
                            "message", "Error al obtener las invitaciones: " + e.getMessage()));
        }
    }

    @Operation(summary = "Revocar invitación")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Invitación revocada exitosamente"),
            @ApiResponse(responseCode = "403", description = "Sin permisos"),
            @ApiResponse(responseCode = "404", description = "Invitación o grupo no encontrado")
    })
    @DeleteMapping("/{invitationId}")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<Map<String, Object>> revokeInvitation(
            @PathVariable Long groupId,
            @PathVariable Long invitationId,
            @AuthenticationPrincipal Jwt jwt) {
        try {
            Member requester = userSyncService.syncAuthenticatedUser(jwt);
            GroupInvitation invitation = groupInvitationService.revokeInvitation(groupId, invitationId,
                    requester.getId());

            Map<String, Object> payload = Map.of(
                    "success", true,
                    "invitation", buildInvitationPayload(invitation));

            return ResponseEntity.ok(payload);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false,
                            "message", "Error al revocar la invitación: " + e.getMessage()));
        }
    }

    private Map<String, Object> buildInvitationPayload(GroupInvitation invitation) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("id", invitation.getId());
        payload.put("groupId", invitation.getGroup() != null ? invitation.getGroup().getId() : null);
        payload.put("token", invitation.getToken());
        payload.put("status", invitation.getStatus());
        payload.put("email", invitation.getEmail());
        payload.put("createdAt", invitation.getCreatedAt());
        payload.put("expiresAt", invitation.getExpiresAt());
        payload.put("usedAt", invitation.getUsedAt());
        payload.put("revokedAt", invitation.getRevokedAt());
        payload.put("isExpired", invitation.isExpired());
        payload.put("isActive", invitation.isActive());
        payload.put("redeemUrl", "/guest/invitations/" + invitation.getToken());

        if (invitation.getUsedBy() != null) {
            Member usedBy = invitation.getUsedBy();
            Map<String, Object> usedByInfo = new HashMap<>();
            usedByInfo.put("id", usedBy.getId());
            usedByInfo.put("name", usedBy.getName());
            usedByInfo.put("email", usedBy.getEmail());
            payload.put("usedBy", usedByInfo);
        }

        return payload;
    }
}
