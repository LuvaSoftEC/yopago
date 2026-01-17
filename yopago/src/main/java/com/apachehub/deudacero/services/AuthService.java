package com.apachehub.deudacero.services;

import com.apachehub.deudacero.dto.LoginDto;
import com.apachehub.deudacero.dto.UserProfileDTO;
import com.apachehub.deudacero.dto.UserRegistrationDTO;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Service
public class AuthService {

    private static final Logger LOGGER = LoggerFactory.getLogger(AuthService.class);

    @Value("${keycloak.resource:yopago-api}")
    private String clientId;

    @Value("${keycloak.credentials.secret:LDhFgHxG9G487snNRZyWK3PPWThdDw2b}")
    private String clientSecret;

    @Value("${keycloak.auth-server-url}")
    private String keycloakAuthServerUrl;

    @Value("${keycloak.realm}")
    private String realm;

    @Value("${keycloak.admin.realm:master}")
    private String adminRealm;

    @Value("${keycloak.admin.username:admin}")
    private String adminUsername;

    @Value("${keycloak.admin.password:admin123}")
    private String adminPassword;

    @Value("${app.frontend.base-url:http://localhost:8080}")
    private String frontendBaseUrl;

    private String normalizedAuthServerUrl;
    private String tokenUrl;
    private String keycloakAdminUrl;
    private String keycloakAdminTokenUrl;
    private String logoutUrl;
    private String loginUrl;
    private String userInfoUrl;

    private final UserSyncService userSyncService;

    // Constructor
    public AuthService(UserSyncService userSyncService) {
        this.userSyncService = userSyncService;
    }

    @PostConstruct
    private void init() {
        normalizedAuthServerUrl = normalizeBaseUrl(keycloakAuthServerUrl);
        if (realm == null || realm.isBlank()) {
            throw new IllegalStateException("Keycloak realm must be configured");
        }
        if (adminRealm == null || adminRealm.isBlank()) {
            adminRealm = "master";
        }
        tokenUrl = buildRealmEndpoint("protocol/openid-connect/token");
        keycloakAdminUrl = normalizedAuthServerUrl + "/admin/realms/" + realm;
        keycloakAdminTokenUrl = normalizedAuthServerUrl + "/realms/" + adminRealm + "/protocol/openid-connect/token";
        logoutUrl = buildRealmEndpoint("protocol/openid-connect/logout");
        loginUrl = buildRealmEndpoint("protocol/openid-connect/auth");
        userInfoUrl = buildRealmEndpoint("protocol/openid-connect/userinfo");
    }

    private String normalizeBaseUrl(String url) {
        if (url == null || url.isBlank()) {
            throw new IllegalStateException("Keycloak auth server URL must be configured");
        }
        String trimmed = url.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }

    private String buildRealmEndpoint(String suffix) {
        return normalizedAuthServerUrl + "/realms/" + realm + "/" + suffix;
    }

    /**
     * Extrae información básica del usuario desde el JWT
     */
    public Map<String, Object> extractUserInfo(Jwt jwt) {
        Map<String, Object> userInfo = new HashMap<>();

        userInfo.put("sub", jwt.getSubject());
        userInfo.put("username", jwt.getClaimAsString("preferred_username"));
        userInfo.put("email", jwt.getClaimAsString("email"));
        userInfo.put("email_verified", jwt.getClaimAsBoolean("email_verified"));
        userInfo.put("name", jwt.getClaimAsString("name"));
        userInfo.put("given_name", jwt.getClaimAsString("given_name"));
        userInfo.put("family_name", jwt.getClaimAsString("family_name"));
        userInfo.put("roles", extractUserRoles(jwt));
        userInfo.put("session_state", jwt.getClaimAsString("session_state"));

        return userInfo;
    }

    /**
     * Construye un UserProfileDTO desde el JWT
     */
    public UserProfileDTO buildUserProfile(Jwt jwt) {
        UserProfileDTO profile = new UserProfileDTO();

        profile.setUsername(jwt.getClaimAsString("preferred_username"));
        profile.setEmail(jwt.getClaimAsString("email"));
        profile.setEmailVerified(jwt.getClaimAsBoolean("email_verified"));
        profile.setFirstName(jwt.getClaimAsString("given_name"));
        profile.setLastName(jwt.getClaimAsString("family_name"));

        return profile;
    }

    /**
     * Extrae los roles del usuario desde el JWT
     */
    public List<String> extractUserRoles(Jwt jwt) {
        try {
            Map<String, Object> realmAccess = jwt.getClaimAsMap("realm_access");
            if (realmAccess != null && realmAccess.containsKey("roles")) {
                @SuppressWarnings("unchecked")
                List<String> roles = (List<String>) realmAccess.get("roles");
                return roles != null ? roles : new ArrayList<>();
            }
        } catch (Exception e) {
            // Si hay error en la extracción, devolver lista vacía
        }
        return new ArrayList<>();
    }

    /**
     * Valida el token y retorna información completa
     */
    public Map<String, Object> validateTokenAndGetInfo(Jwt jwt) {
        Map<String, Object> validation = new HashMap<>();

        validation.put("valid", true);
        validation.put("username", jwt.getClaimAsString("preferred_username"));
        validation.put("subject", jwt.getSubject());
        validation.put("issued_at", jwt.getIssuedAt());
        validation.put("expires_at", jwt.getExpiresAt());
        validation.put("issuer", jwt.getIssuer());
        validation.put("roles", extractUserRoles(jwt));
        validation.put("email", jwt.getClaimAsString("email"));

        return validation;
    }

    /**
     * Construye información de la sesión actual
     */
    public Map<String, Object> buildSessionInfo(Jwt jwt) {
        Map<String, Object> sessionInfo = new HashMap<>();
        sessionInfo.put("session_id", jwt.getClaimAsString("session_state"));
        sessionInfo.put("token_type", "Bearer");
        sessionInfo.put("issued_at", jwt.getIssuedAt());
        sessionInfo.put("expires_at", jwt.getExpiresAt());
        sessionInfo.put("issuer", jwt.getIssuer());
        sessionInfo.put("audience", jwt.getAudience());
        sessionInfo.put("subject", jwt.getSubject());
        sessionInfo.put("active", true);

        return sessionInfo;
    }

    /**
     * Construye información para el proceso de logout
     */
    public Map<String, Object> buildLogoutInfo(Jwt jwt) {
        Map<String, Object> logoutInfo = new HashMap<>();
        logoutInfo.put("keycloak_logout_url", logoutUrl);
        logoutInfo.put("session_id", jwt.getClaimAsString("session_state"));
        logoutInfo.put("username", jwt.getClaimAsString("preferred_username"));
        logoutInfo.put("post_logout_redirect_uri", frontendBaseUrl);

        return logoutInfo;
    }

    /**
     * Obtiene la configuración de autenticación del sistema
     */
    public Map<String, Object> getAuthConfiguration() {
        Map<String, Object> authConfig = new HashMap<>();
        authConfig.put("keycloak_url", normalizedAuthServerUrl);
        authConfig.put("realm", realm);
        authConfig.put("client_id", clientId);
        authConfig.put("login_url", loginUrl);
        authConfig.put("token_url", tokenUrl);
        authConfig.put("userinfo_url", userInfoUrl);
        authConfig.put("supported_scopes", List.of("openid", "profile", "email"));

        return authConfig;
    }

    /**
     * Construye respuesta específica para administradores
     */
    public Map<String, Object> buildAdminResponse(Jwt jwt) {
        Map<String, Object> adminResponse = new HashMap<>();
        adminResponse.put("message", "Acceso autorizado para administrador");
        adminResponse.put("admin_user", jwt.getClaimAsString("preferred_username"));
        adminResponse.put("admin_roles", extractUserRoles(jwt));
        adminResponse.put("timestamp", System.currentTimeMillis());
        adminResponse.put("admin_privileges", List.of(
                "manage_users",
                "view_all_groups",
                "manage_system_settings",
                "access_admin_panel"));

        return adminResponse;
    }

    /**
     * Verifica si el usuario es administrador
     */
    public boolean isAdmin(Jwt jwt) {
        List<String> roles = extractUserRoles(jwt);
        return roles.contains("admin");
    }

    /**
     * Verifica si el usuario tiene un rol específico
     */
    public boolean hasRole(Jwt jwt, String role) {
        List<String> roles = extractUserRoles(jwt);
        return roles.contains(role);
    }

    /**
     * Registra un nuevo usuario en Keycloak y crea Member en la base de datos
     */
    public Map<String, Object> registerUser(UserRegistrationDTO registrationDTO) {
        Map<String, Object> response = new HashMap<>();

        try {
            // Validaciones básicas
            if (!registrationDTO.getPassword().equals(registrationDTO.getConfirmPassword())) {
                response.put("success", false);
                response.put("message", "Las contraseñas no coinciden");
                return response;
            }

            // 1. OBTENER TOKEN DE ADMIN para usar Keycloak Admin API
            String adminToken = getKeycloakAdminToken();
            if (adminToken == null) {
                response.put("success", false);
                response.put("message", "Error al obtener acceso administrativo a Keycloak");
                return response;
            }

            // 2. CREAR USUARIO EN KEYCLOAK
            String keycloakUserId = createUserInKeycloak(adminToken, registrationDTO);
            if (keycloakUserId == null) {
                response.put("success", false);
                response.put("message", "Error al crear usuario en Keycloak - posiblemente ya existe");
                return response;
            }

            // 3. CREAR MEMBER EN BASE DE DATOS
            try {
                String fullName = (registrationDTO.getFirstName() + " " + registrationDTO.getLastName()).trim();
                if (fullName.isEmpty()) {
                    fullName = registrationDTO.getUsername();
                }

                userSyncService.createRegisteredMember(
                        keycloakUserId,
                        registrationDTO.getUsername(),
                        registrationDTO.getEmail(),
                        fullName);

                // 4. RESPUESTA EXITOSA
                response.put("success", true);
                response.put("message", "Usuario registrado exitosamente. Ahora puede iniciar sesión.");
                response.put("data", Map.of(
                        "username", registrationDTO.getUsername(),
                        "email", registrationDTO.getEmail(),
                        "keycloak_user_id", keycloakUserId,
                        "name", fullName));

            } catch (Exception e) {
                // Si falla la creación del Member, intentar eliminar el usuario de Keycloak
                try {
                    deleteUserInKeycloak(adminToken, keycloakUserId);
                } catch (Exception cleanupEx) {
                    System.err.println("Error al limpiar usuario de Keycloak: " + cleanupEx.getMessage());
                }

                response.put("success", false);
                response.put("message",
                        "Usuario creado en Keycloak pero error al sincronizar datos: " + e.getMessage());
                return response;
            }

        } catch (Exception e) {
            response.put("success", false);
            response.put("message", "Error al registrar usuario: " + e.getMessage());
        }

        return response;
    }

    /**
     * Obtiene token de administrador para usar Keycloak Admin API
     */
    private String getKeycloakAdminToken() {
        try {
            RestTemplate restTemplate = new RestTemplate();

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
            params.add("grant_type", "password");
            params.add("client_id", "admin-cli");
            params.add("username", adminUsername);
            params.add("password", adminPassword);

            HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(params, headers);

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    keycloakAdminTokenUrl,
                    HttpMethod.POST,
                    request,
                    new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {
                    });

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                return (String) response.getBody().get("access_token");
            }

            LOGGER.error("Error obteniendo token admin. Status: {} Body: {}", response.getStatusCode(), response.getBody());
        } catch (RestClientResponseException e) {
            LOGGER.error("Error HTTP obteniendo token admin. Status: {} Body: {}", e.getStatusCode().value(), e.getResponseBodyAsString(), e);
        } catch (Exception e) {
            LOGGER.error("Error obteniendo token admin: {}", e.getMessage(), e);
        }
        return null;
    }

    /**
     * Crea usuario en Keycloak usando Admin API
     */
    private String createUserInKeycloak(String adminToken, UserRegistrationDTO registrationDTO) {
        try {
            RestTemplate restTemplate = new RestTemplate();

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(adminToken);

            // Estructura del usuario para Keycloak
            Map<String, Object> keycloakUser = new HashMap<>();
            keycloakUser.put("username", registrationDTO.getUsername());
            keycloakUser.put("email", registrationDTO.getEmail());
            keycloakUser.put("emailVerified", true);
            keycloakUser.put("firstName", registrationDTO.getFirstName());
            keycloakUser.put("lastName", registrationDTO.getLastName());
            keycloakUser.put("enabled", true);

            // Configurar credencial de contraseña
            Map<String, Object> credential = new HashMap<>();
            credential.put("type", "password");
            credential.put("value", registrationDTO.getPassword());
            credential.put("temporary", false);
            keycloakUser.put("credentials", List.of(credential));

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(keycloakUser, headers);

            // Crear usuario
            ResponseEntity<String> response = restTemplate.exchange(
                    keycloakAdminUrl + "/users",
                    HttpMethod.POST,
                    request,
                    String.class);

            if (response.getStatusCode() == HttpStatus.CREATED) {
                // Extraer el ID del usuario de la header Location
                String location = response.getHeaders().getFirst("Location");
                if (location != null) {
                    String userId = location.substring(location.lastIndexOf("/") + 1);

                    // ✅ ASIGNAR ROL user AUTOMÁTICAMENTE
                    boolean roleAssigned = assignUserRole(adminToken, userId);
                    if (roleAssigned) {
                        System.out.println("✅ Rol user asignado automáticamente al usuario: " + userId);
                    } else {
                        System.err.println("⚠️ No se pudo asignar rol user al usuario: " + userId);
                    }

                    return userId;
                }
            }
        } catch (Exception e) {
            System.err.println("Error creando usuario en Keycloak: " + e.getMessage());
        }
        return null;
    }

    /**
     * Asigna el rol user al usuario en Keycloak
     */
    private boolean assignUserRole(String adminToken, String userId) {
        try {
            RestTemplate restTemplate = new RestTemplate();

            // 1. Recuperar la representación completa del rol "user"
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(adminToken);

            HttpEntity<?> roleRequest = new HttpEntity<>(headers);
            ResponseEntity<Map<String, Object>> roleResponse = restTemplate.exchange(
                    keycloakAdminUrl + "/roles/user",
                    HttpMethod.GET,
                    roleRequest,
                    new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {
                    });

            if (roleResponse.getStatusCode() != HttpStatus.OK || roleResponse.getBody() == null) {
                System.err.println("❌ Rol USER no encontrado en Keycloak");
                return false;
            }

            Map<String, Object> roleRepresentation = roleResponse.getBody();

            // 2. Asignar el rol usando la representación devuelta por Keycloak
            HttpEntity<List<Map<String, Object>>> assignRoleRequest = new HttpEntity<>(
                    List.of(roleRepresentation),
                    headers);

            ResponseEntity<String> assignResponse = restTemplate.exchange(
                    keycloakAdminUrl + "/users/" + userId + "/role-mappings/realm",
                    HttpMethod.POST,
                    assignRoleRequest,
                    String.class);

            return assignResponse.getStatusCode() == HttpStatus.NO_CONTENT;

        } catch (Exception e) {
            System.err.println("❌ Error asignando rol USER: " + e.getMessage());
        }
        return false;
    }

    /**
     * Elimina usuario de Keycloak (para rollback en caso de error)
     */
    private void deleteUserInKeycloak(String adminToken, String keycloakUserId) {
        try {
            RestTemplate restTemplate = new RestTemplate();

            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(adminToken);

            HttpEntity<?> request = new HttpEntity<>(headers);

            restTemplate.exchange(
            keycloakAdminUrl + "/users/" + keycloakUserId,
                    HttpMethod.DELETE,
                    request,
                    String.class);
        } catch (Exception e) {
            System.err.println("Error eliminando usuario de Keycloak: " + e.getMessage());
        }
    }

    /**
     * Realiza login del usuario usando Keycloak
     */
    public Map<String, Object> loginUser(LoginDto loginDto) {
        Map<String, Object> response = new HashMap<>();

        try {
            // LOGS PARA DEBUG - Verificar valores de configuración
            System.out.println("=== KEYCLOAK CONFIG DEBUG ===");
            System.out.println("Client ID: " + clientId);
            System.out.println("Client Secret: "
                    + (clientSecret != null ? clientSecret.substring(0, Math.min(clientSecret.length(), 10)) + "..."
                            : "NULL"));
        System.out.println("Token URL: " + tokenUrl);
            System.out.println("==============================");

            RestTemplate restTemplate = new RestTemplate();

            // Configurar headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            // Configurar parámetros del token request usando propiedades de configuración
            MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
            params.add("grant_type", "password");
            params.add("client_id", clientId);
            params.add("client_secret", clientSecret);
            params.add("username", loginDto.getUsername());
            params.add("password", loginDto.getPassword());
            params.add("scope", "openid profile email");

            HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(params, headers);

            // Hacer llamada a Keycloak usando URL de configuración
            ResponseEntity<Map<String, Object>> tokenResponse = restTemplate.exchange(
                    tokenUrl,
                    HttpMethod.POST,
                    request,
                    new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {
                    });

            if (tokenResponse.getStatusCode() == HttpStatus.OK) {
                Map<String, Object> tokenData = tokenResponse.getBody();

                if (tokenData != null) {
                    // Log para debug
                    System.out.println("=== TOKEN RESPONSE DEBUG ===");
                    System.out.println("Token data keys: " + tokenData.keySet());
                    System.out.println("Access token present: " + tokenData.containsKey("access_token"));
                    System.out.println("=============================");

                    response.put("success", true);
                    response.put("message", "Login exitoso");
                    response.put("access_token", tokenData.get("access_token"));
                    response.put("refresh_token", tokenData.get("refresh_token"));
                    response.put("token_type", tokenData.get("token_type"));
                    response.put("expires_in", tokenData.get("expires_in"));
                    response.put("scope", tokenData.get("scope"));
                } else {
                    response.put("success", false);
                    response.put("message", "Respuesta vacía del servidor");
                }
            } else {
                response.put("success", false);
                response.put("message", "Credenciales inválidas");
            }

        } catch (Exception e) {
            response.put("success", false);
            response.put("message", "Error de autenticación: " + e.getMessage());
        }

        return response;
    }
}