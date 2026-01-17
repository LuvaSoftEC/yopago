package com.apachehub.deudacero.controllers;

import com.apachehub.deudacero.dto.UserProfileDTO;
import com.apachehub.deudacero.dto.UserRegistrationDTO;
import com.apachehub.deudacero.dto.LoginDto;
import com.apachehub.deudacero.dto.ApiResponseDto;
import com.apachehub.deudacero.services.AuthService;
import com.apachehub.deudacero.services.UserSyncService;
import com.apachehub.deudacero.entities.Group;
import com.apachehub.deudacero.entities.Member;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
@Tag(name = "Authentication", description = "Endpoints para gestión de cuentas de usuario")
public class AuthController {

    private final AuthService authService;
    private final UserSyncService userSyncService;

    public AuthController(AuthService authService, UserSyncService userSyncService) {
        this.authService = authService;
        this.userSyncService = userSyncService;
    }

    @Operation(summary = "Obtener información del usuario autenticado con sincronización automática")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Información del usuario obtenida exitosamente"),
            @ApiResponse(responseCode = "401", description = "Usuario no autenticado")
    })
    @GetMapping("/me")
    @PreAuthorize("hasRole('user') or hasRole('admin')")
    public ResponseEntity<Map<String, Object>> getCurrentUser(@AuthenticationPrincipal Jwt jwt) {
        try {
            // 1. Sincronizar usuario automáticamente
            Member syncedMember = userSyncService.syncAuthenticatedUser(jwt);

            // 2. Obtener información de Keycloak
            Map<String, Object> userInfo = authService.extractUserInfo(jwt);

            // 3. Agregar información del Member sincronizado
            userInfo.put("member_id", syncedMember.getId());
            userInfo.put("is_registered", syncedMember.getIsRegistered());
            userInfo.put("created_at", syncedMember.getCreatedAt());
            userInfo.put("last_login", syncedMember.getLastLogin());

            return ResponseEntity.ok(userInfo);
        } catch (Exception e) {
            // Si hay error en la sincronización, devolver solo info de Keycloak
            Map<String, Object> userInfo = authService.extractUserInfo(jwt);
            userInfo.put("sync_error", "Error al sincronizar usuario: " + e.getMessage());
            return ResponseEntity.ok(userInfo);
        }
    }

    @Operation(summary = "Obtener perfil del usuario")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Perfil obtenido exitosamente"),
            @ApiResponse(responseCode = "401", description = "Usuario no autenticado")
    })
    @GetMapping("/profile")
    @PreAuthorize("hasRole('user') or hasRole('admin')")
    public ResponseEntity<UserProfileDTO> getUserProfile(@AuthenticationPrincipal Jwt jwt) {
        UserProfileDTO profile = authService.buildUserProfile(jwt);
        return ResponseEntity.ok(profile);
    }

    @Operation(summary = "Información de la sesión actual")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Información de sesión obtenida"),
            @ApiResponse(responseCode = "401", description = "Usuario no autenticado")
    })
    @GetMapping("/session")
    @PreAuthorize("hasRole('user') or hasRole('admin')")
    public ResponseEntity<Map<String, Object>> getSessionInfo(@AuthenticationPrincipal Jwt jwt) {
        Map<String, Object> sessionInfo = authService.buildSessionInfo(jwt);
        return ResponseEntity.ok(sessionInfo);
    }

    @Operation(summary = "Verificar si el token es válido")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Token válido"),
            @ApiResponse(responseCode = "401", description = "Token inválido o expirado")
    })
    @GetMapping("/validate")
    @PreAuthorize("hasRole('user') or hasRole('admin')")
    public ResponseEntity<Map<String, Object>> validateToken(@AuthenticationPrincipal Jwt jwt) {
        Map<String, Object> validation = authService.validateTokenAndGetInfo(jwt);
        return ResponseEntity.ok(validation);
    }

    @Operation(summary = "Obtener información para logout")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Información de logout obtenida"),
            @ApiResponse(responseCode = "401", description = "Usuario no autenticado")
    })
    @GetMapping("/logout-info")
    @PreAuthorize("hasRole('user') or hasRole('admin')")
    public ResponseEntity<Map<String, Object>> getLogoutInfo(@AuthenticationPrincipal Jwt jwt) {
        Map<String, Object> logoutInfo = authService.buildLogoutInfo(jwt);
        return ResponseEntity.ok(logoutInfo);
    }

    @Operation(summary = "Endpoint público para obtener información de autenticación")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Información de autenticación obtenida")
    })
    @GetMapping("/info")
    public ResponseEntity<Map<String, Object>> getAuthInfo() {
        Map<String, Object> authInfo = authService.getAuthConfiguration();
        return ResponseEntity.ok(authInfo);
    }

    @Operation(summary = "Endpoint para administradores")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Acceso autorizado para admin"),
            @ApiResponse(responseCode = "403", description = "Acceso denegado - se requiere rol admin")
    })
    @GetMapping("/admin-only")
    @PreAuthorize("hasRole('admin')")
    public ResponseEntity<Map<String, Object>> adminOnly(@AuthenticationPrincipal Jwt jwt) {
        Map<String, Object> response = authService.buildAdminResponse(jwt);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Verificar roles del usuario")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Roles obtenidos exitosamente"),
            @ApiResponse(responseCode = "401", description = "Usuario no autenticado")
    })
    @GetMapping("/roles")
    @PreAuthorize("hasRole('user') or hasRole('admin')")
    public ResponseEntity<Map<String, Object>> getUserRoles(@AuthenticationPrincipal Jwt jwt) {
        Map<String, Object> rolesInfo = Map.of(
                "username", jwt.getClaimAsString("preferred_username"),
                "roles", authService.extractUserRoles(jwt),
                "is_admin", authService.isAdmin(jwt),
                "has_user_role", authService.hasRole(jwt, "user"));
        return ResponseEntity.ok(rolesInfo);
    }

    @Operation(summary = "Registrar nuevo usuario")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Usuario registrado exitosamente"),
            @ApiResponse(responseCode = "400", description = "Datos de registro inválidos"),
            @ApiResponse(responseCode = "409", description = "Usuario ya existe")
    })
    @PostMapping("/register")
    public ResponseEntity<ApiResponseDto> register(@Valid @RequestBody UserRegistrationDTO registrationDto) {
        try {
            // Validar que las contraseñas coincidan
            if (!registrationDto.passwordsMatch()) {
                return ResponseEntity.badRequest().body(
                        new ApiResponseDto(false, "Las contraseñas no coinciden", null));
            }

            Map<String, Object> result = authService.registerUser(registrationDto);

            if ((Boolean) result.get("success")) {
                return ResponseEntity.ok(new ApiResponseDto(
                        true,
                        "Usuario registrado exitosamente",
                        result.get("data")));
            } else {
                HttpStatus status = result.containsKey("userExists") && (Boolean) result.get("userExists")
                        ? HttpStatus.CONFLICT
                        : HttpStatus.BAD_REQUEST;

                return ResponseEntity.status(status).body(new ApiResponseDto(
                        false,
                        (String) result.get("message"),
                        null));
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponseDto(false, "Error interno del servidor: " + e.getMessage(), null));
        }
    }

    @Operation(summary = "Iniciar sesión y obtener token")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Login exitoso"),
            @ApiResponse(responseCode = "401", description = "Credenciales inválidas"),
            @ApiResponse(responseCode = "400", description = "Datos de login inválidos")
    })
    @PostMapping("/login")
    public ResponseEntity<ApiResponseDto> login(@Valid @RequestBody LoginDto loginDto) {
        try {
            Map<String, Object> result = authService.loginUser(loginDto);

            if ((Boolean) result.get("success")) {
                // Extraer solo los datos del token para el campo data
                Map<String, Object> tokenData = new HashMap<>();
                tokenData.put("access_token", result.get("access_token"));
                tokenData.put("refresh_token", result.get("refresh_token"));
                tokenData.put("token_type", result.get("token_type"));
                tokenData.put("expires_in", result.get("expires_in"));

                return ResponseEntity.ok(new ApiResponseDto(
                        true,
                        "Login exitoso",
                        tokenData));
            } else {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new ApiResponseDto(false, (String) result.get("message"), null));
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponseDto(false, "Error interno del servidor: " + e.getMessage(), null));
        }
    }

    @Operation(summary = "Obtener perfil completo del usuario como Member")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Perfil del Member obtenido exitosamente"),
            @ApiResponse(responseCode = "401", description = "Usuario no autenticado"),
            @ApiResponse(responseCode = "404", description = "Member no encontrado")
    })
    @GetMapping("/member-profile")
    @PreAuthorize("hasRole('user') or hasRole('admin')")
    public ResponseEntity<ApiResponseDto> getMemberProfile(@AuthenticationPrincipal Jwt jwt) {
        try {
            // Sincronizar usuario y obtener Member
            Member syncedMember = userSyncService.syncAuthenticatedUser(jwt);

            // Crear respuesta con información completa
            Map<String, Object> profileData = new HashMap<>();
            profileData.put("id", syncedMember.getId());
            profileData.put("name", syncedMember.getName());
            profileData.put("email", syncedMember.getEmail());
            profileData.put("username", syncedMember.getUsername());
            profileData.put("is_registered", syncedMember.getIsRegistered());
            profileData.put("created_at", syncedMember.getCreatedAt());
            profileData.put("last_login", syncedMember.getLastLogin());
            profileData.put("keycloak_user_id", syncedMember.getKeycloakUserId());

            // Información de grupos (si tiene)
            List<Map<String, Object>> groupsInfo = new ArrayList<>();
            if (syncedMember.getGroups() != null) {
                for (Group group : syncedMember.getGroups()) {
                    if (group == null) {
                        continue;
                    }
                    Map<String, Object> groupInfo = new HashMap<>();
                    groupInfo.put("id", group.getId());
                    groupInfo.put("name", group.getName());
                    groupInfo.put("code", group.getCode());
                    groupsInfo.add(groupInfo);
                }
            }

            if (!groupsInfo.isEmpty()) {
                profileData.put("groups", groupsInfo);
                profileData.put("current_group", groupsInfo.get(0));
            }

            return ResponseEntity.ok(new ApiResponseDto(
                    true,
                    "Perfil obtenido exitosamente",
                    profileData));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponseDto(false, "Error al obtener perfil: " + e.getMessage(), null));
        }
    }
}