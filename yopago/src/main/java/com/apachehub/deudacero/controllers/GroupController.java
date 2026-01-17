package com.apachehub.deudacero.controllers;

import com.apachehub.deudacero.entities.Group;
import com.apachehub.deudacero.entities.Member;
import com.apachehub.deudacero.entities.Expense;
import com.apachehub.deudacero.dto.JoinGroupRequest;
import com.apachehub.deudacero.services.GroupService;
import com.apachehub.deudacero.services.MemberService;
import com.apachehub.deudacero.services.SettlementService;
import com.apachehub.deudacero.services.UserSyncService;

import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;

import com.apachehub.deudacero.dto.CreateGroupRequest;
import com.apachehub.deudacero.dto.GroupResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;

import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.Optional;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/groups")
@Tag(name = "Groups", description = "API para gestión de grupos")
public class GroupController {

    private final GroupService groupService;
    private final SettlementService settlementService;
    private final MemberService memberService;
    private final UserSyncService userSyncService;

    public GroupController(GroupService groupService, SettlementService settlementService,
            MemberService memberService, UserSyncService userSyncService) {
        this.groupService = groupService;
        this.settlementService = settlementService;
        this.memberService = memberService;
        this.userSyncService = userSyncService;
    }

    @Operation(summary = "Crear un nuevo grupo")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "201", description = "Grupo creado exitosamente"),
            @ApiResponse(responseCode = "400", description = "Datos inválidos")
    })
    @PostMapping
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<GroupResponse> createGroup(@RequestBody CreateGroupRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        try {
            GroupResponse response = groupService.createGroupWithCode(request, jwt);
            return new ResponseEntity<>(response, HttpStatus.CREATED);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }

    @Operation(summary = "Obtener un grupo por ID")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Grupo encontrado"),
            @ApiResponse(responseCode = "404", description = "Grupo no encontrado")
    })
    @GetMapping("/{id}")
    public ResponseEntity<Group> getGroupById(@PathVariable Long id) {
        Optional<Group> group = groupService.getGroupById(id);
        return group.map(value -> new ResponseEntity<>(value, HttpStatus.OK))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    @Operation(summary = "Obtener detalles completos de un grupo")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Detalles del grupo obtenidos exitosamente"),
            @ApiResponse(responseCode = "404", description = "Grupo no encontrado"),
            @ApiResponse(responseCode = "500", description = "Error interno del servidor")
    })
    @GetMapping("/{id}/details")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<Map<String, Object>> getGroupDetails(@PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {
        try {
            Member member = userSyncService.syncAuthenticatedUser(jwt);
            Optional<Map<String, Object>> groupDetails = groupService.getGroupDetailsForViewer(id, member.getId());

            if (groupDetails.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Grupo no encontrado"));
            }

            return ResponseEntity.ok(groupDetails.get());
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "No tienes acceso a este grupo"));
        } catch (Exception e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "Error al obtener detalles del grupo: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    @Operation(summary = "Obtener todos los grupos")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Grupos obtenidos exitosamente")
    })
    @GetMapping
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<List<Map<String, Object>>> getAllGroups() {
        try {
            List<Map<String, Object>> groups = groupService.getAllGroupsLight();
            return new ResponseEntity<>(groups, HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>(null, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Operation(summary = "Obtener los grupos asociados al usuario autenticado")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Grupos del usuario obtenidos exitosamente"),
            @ApiResponse(responseCode = "401", description = "Usuario no autenticado")
    })
    @GetMapping("/user")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> getGroupsForCurrentUser(@AuthenticationPrincipal Jwt jwt) {
        try {
            Member member = userSyncService.syncAuthenticatedUser(jwt);
            List<Map<String, Object>> groups = groupService.getGroupsForMember(member.getId());
            List<Map<String, Object>> createdGroups = groupService.getGroupsCreatedBy(member.getId());

            Map<String, Object> response = new HashMap<>();
            response.put("memberId", member.getId());
            response.put("groups", groups);
            response.put("createdGroups", createdGroups);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Error al obtener los grupos del usuario: " + e.getMessage()));
        }
    }

    @Operation(summary = "Unirse a un grupo usando código de invitación")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Miembro unido exitosamente"),
            @ApiResponse(responseCode = "403", description = "El miembro no coincide con el usuario autenticado"),
            @ApiResponse(responseCode = "404", description = "Grupo no encontrado")
    })
    @PostMapping("/join")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> joinGroupByCode(@RequestBody JoinGroupRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        try {
            if (request == null || request.getCode() == null || request.getCode().trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "El código del grupo es requerido"));
            }

            Member member = userSyncService.syncAuthenticatedUser(jwt);
            Long memberId = member.getId();
            Long requestedMemberId = request.getMemberId();
            if (requestedMemberId != null && !requestedMemberId.equals(memberId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "No puedes unirte en nombre de otro miembro"));
            }

            String normalizedCode = request.getCode().trim();
            Optional<Group> groupOpt = groupService.findByCodeOrId(normalizedCode);
            if (groupOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Grupo no encontrado para el código proporcionado"));
            }

            Group group = groupOpt.get();
            boolean alreadyMember = group.hasMember(memberId);

            JoinGroupRequest joinRequest = new JoinGroupRequest();
            joinRequest.setCode(normalizedCode);
            joinRequest.setMemberId(memberId);
            joinRequest.setApplyToHistory(request.getApplyToHistory());
            groupService.joinGroup(joinRequest);

            Map<String, Object> payload = groupService.getGroupDetails(group.getId())
                    .map(details -> new HashMap<>(details))
                    .orElseGet(() -> {
                        HashMap<String, Object> fallback = new HashMap<>();
                        fallback.put("id", group.getId());
                        fallback.put("name", group.getName());
                        fallback.put("description", group.getDescription());
                        fallback.put("code", group.getCode());
                        fallback.put("totalMembers", group.getTotalMembers());
                        fallback.put("totalExpenses", group.getTotalExpenses());
                        return fallback;
                    });

            payload.put("alreadyMember", alreadyMember);
            payload.putIfAbsent("id", group.getId());
            payload.putIfAbsent("code", group.getCode());

            return ResponseEntity.ok(payload);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Error al unirse al grupo: " + e.getMessage()));
        }
    }

    @Operation(summary = "Unirse a un grupo por ID")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Miembro unido exitosamente"),
            @ApiResponse(responseCode = "404", description = "Grupo no encontrado")
    })
    @PostMapping("/{groupId}/join")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> joinGroup(@PathVariable Long groupId, @RequestBody Map<String, Object> memberData) {
        try {
            // Caso 1: Miembro registrado que se une al grupo
            if (memberData.containsKey("memberId")) {
                Long memberId = Long.valueOf(memberData.get("memberId").toString());
                JoinGroupRequest request = new JoinGroupRequest();
                request.setCode(groupId.toString());
                request.setMemberId(memberId);
                request.setApplyToHistory(false);

                Member joinedMember = groupService.joinGroup(request);
                return ResponseEntity.ok(Map.of(
                        "success", true,
                        "message", "Miembro registrado unido exitosamente",
                        "member", joinedMember));
            }

            // Caso 2: Crear miembro invitado y agregarlo al grupo
            else if (memberData.containsKey("memberName")) {
                String memberName = memberData.get("memberName").toString();
                String email = memberData.containsKey("email") ? memberData.get("email").toString() : null;

                Member guestMember = groupService.createGuestMemberAndAddToGroup(groupId, memberName, email);
                return ResponseEntity.ok(Map.of(
                        "success", true,
                        "message", "Miembro invitado creado y agregado exitosamente",
                        "member", guestMember));
            }

            else {
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "Se requiere 'memberId' para miembros registrados o 'memberName' para invitados"));
            }

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Error al unirse al grupo: " + e.getMessage()));
        }
    }

    @Operation(summary = "Agregar un miembro existente a un grupo")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Miembro agregado exitosamente"),
            @ApiResponse(responseCode = "400", description = "Datos inválidos"),
            @ApiResponse(responseCode = "404", description = "Grupo o miembro no encontrado")
    })
    @PostMapping("/{groupId}/members")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> addMemberToGroup(@PathVariable Long groupId, @RequestBody Map<String, Object> body) {
        try {
            if (body == null || !body.containsKey("memberId")) {
                return ResponseEntity.badRequest().body(Map.of("error", "memberId is required in body"));
            }

            Long memberId;
            try {
                memberId = Long.valueOf(body.get("memberId").toString());
            } catch (Exception e) {
                return ResponseEntity.badRequest().body(Map.of("error", "memberId must be a number"));
            }

            Map<String, Object> result = groupService.addMemberToGroup(groupId, memberId);
            return ResponseEntity.ok(result);

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    @Operation(summary = "Eliminar un miembro del grupo")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Miembro eliminado exitosamente"),
            @ApiResponse(responseCode = "400", description = "El miembro tiene gastos pendientes o datos inválidos"),
            @ApiResponse(responseCode = "403", description = "No tienes permisos para eliminar este miembro"),
            @ApiResponse(responseCode = "404", description = "Grupo o miembro no encontrado")
    })
    @DeleteMapping("/{groupId}/members/{memberId}")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> removeMemberFromGroup(
            @PathVariable Long groupId,
            @PathVariable Long memberId,
            @AuthenticationPrincipal Jwt jwt) {
        try {
            // Obtener el miembro que está haciendo la petición usando su keycloakUserId
            String keycloakUserId = jwt.getSubject();
            Optional<Member> requestingMemberOpt = memberService.findByKeycloakUserId(keycloakUserId);

            if (requestingMemberOpt.isEmpty()) {
                Map<String, Object> errorResult = new HashMap<>();
                errorResult.put("error", "Usuario solicitante no encontrado");
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(errorResult);
            }

            Long requestingUserId = requestingMemberOpt.get().getId();
            Map<String, Object> result = groupService.removeMemberFromGroup(groupId, memberId, requestingUserId);

            if (result.containsKey("error")) {
                String error = result.get("error").toString();
                if (error.contains("no encontrado")) {
                    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(result);
                } else if (error.contains("permisos")) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN).body(result);
                } else {
                    return ResponseEntity.badRequest().body(result);
                }
            }

            return ResponseEntity.ok(result);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Error interno del servidor: " + e.getMessage()));
        }
    }

    @Operation(summary = "Eliminar un grupo")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Grupo eliminado exitosamente"),
            @ApiResponse(responseCode = "403", description = "No tienes permisos para eliminar este grupo"),
            @ApiResponse(responseCode = "404", description = "Grupo no encontrado")
    })
    @DeleteMapping("/{groupId}")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> deleteGroup(
            @PathVariable Long groupId,
            @AuthenticationPrincipal Jwt jwt) {
        try {
            String keycloakUserId = jwt.getSubject();
            Optional<Member> requestingMemberOpt = memberService.findByKeycloakUserId(keycloakUserId);

            if (requestingMemberOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "Usuario solicitante no encontrado"));
            }

            Long requestingUserId = requestingMemberOpt.get().getId();
            Map<String, Object> result = groupService.deleteGroup(groupId, requestingUserId);

            if (result.containsKey("error")) {
                Object reasonObj = result.get("reason");
                String reason = reasonObj != null ? reasonObj.toString() : "";
                if ("NOT_FOUND".equals(reason)) {
                    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(result);
                }
                if ("FORBIDDEN".equals(reason)) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN).body(result);
                }
                return ResponseEntity.badRequest().body(result);
            }

            return ResponseEntity.ok(result);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Error interno del servidor: " + e.getMessage()));
        }
    }
}