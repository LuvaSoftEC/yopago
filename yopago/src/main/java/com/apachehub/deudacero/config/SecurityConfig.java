
package com.apachehub.deudacero.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

        @Bean
        public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
                http
                                .csrf(csrf -> csrf.disable())
                                .sessionManagement(session -> session.sessionCreationPolicy(
                                                org.springframework.security.config.http.SessionCreationPolicy.STATELESS))
                                .oauth2ResourceServer(oauth2 -> oauth2
                                                .jwt(jwt -> jwt.jwtAuthenticationConverter(
                                                                jwtAuthenticationConverter())))
                                .authorizeHttpRequests(auth -> auth
                                                // Endpoints públicos (no requieren autenticación)
                                                .requestMatchers("/api/health").permitAll()
                                                .requestMatchers("/api/auth/**").permitAll()
                                                .requestMatchers("/api/guest/**").permitAll() // 🎫 Endpoints para
                                                                                              // invitados
                                                .requestMatchers("/swagger-ui/**", "/api-docs/**").permitAll()
                                                .requestMatchers("/ws/**").permitAll()
                                                // Endpoints que requieren roles específicos
                                                .requestMatchers("/api/expenses/ocr/**")
                                                .hasAnyRole("user", "admin", "group_manager")
                                                .requestMatchers("/api/admin/**").hasRole("admin")
                                                .requestMatchers("/api/groups/**")
                                                .hasAnyRole("group_manager", "admin", "user")
                                                // Todos los demás endpoints requieren autenticación
                                                .anyRequest().authenticated());
                return http.build();
        }

        @Bean
        public org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter jwtAuthenticationConverter() {
                org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter converter = new org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter();
                converter.setJwtGrantedAuthoritiesConverter(jwt -> {
                        // Log para debug
                        System.out.println("=== JWT DEBUG ===");
                        System.out.println("JWT Claims: " + jwt.getClaims());
                        System.out.println("realm_access: " + jwt.getClaimAsMap("realm_access"));

                        // Intentar extraer roles de diferentes lugares
                        java.util.List<String> roles = new java.util.ArrayList<>();

                        // Método 1: realm_access.roles (más común)
                        Object realmAccess = jwt.getClaimAsMap("realm_access");
                        if (realmAccess != null && realmAccess instanceof java.util.Map) {
                                Object rolesObj = ((java.util.Map<?, ?>) realmAccess).get("roles");
                                if (rolesObj instanceof java.util.List<?>) {
                                        @SuppressWarnings("unchecked")
                                        java.util.List<String> realmRoles = (java.util.List<String>) rolesObj;
                                        roles.addAll(realmRoles);
                                }
                        }

                        // Método 2: resource_access (cliente) - buscar roles en resource_access para el
                        // client (azp)
                        Object resourceAccess = jwt.getClaimAsMap("resource_access");
                        if (resourceAccess != null && resourceAccess instanceof java.util.Map) {
                                @SuppressWarnings("unchecked")
                                java.util.Map<String, Object> ra = (java.util.Map<String, Object>) resourceAccess;
                                // Preferir roles del client (azp) si están presentes
                                String client = jwt.getClaimAsString("azp");
                                if (client != null && ra.containsKey(client)) {
                                        Object clientObj = ra.get(client);
                                        if (clientObj instanceof java.util.Map) {
                                                Object clientRolesObj = ((java.util.Map<?, ?>) clientObj).get("roles");
                                                if (clientRolesObj instanceof java.util.List<?>) {
                                                        @SuppressWarnings("unchecked")
                                                        java.util.List<String> clientRoles = (java.util.List<String>) clientRolesObj;
                                                        roles.addAll(clientRoles);
                                                }
                                        }
                                }

                                // Si aún no hay roles, intentar recolectar cualquier role disponible en
                                // resource_access
                                if (roles.isEmpty()) {
                                        for (Object key : ra.keySet()) {
                                                Object v = ra.get(key);
                                                if (v instanceof java.util.Map) {
                                                        Object rObj = ((java.util.Map<?, ?>) v).get("roles");
                                                        if (rObj instanceof java.util.List<?>) {
                                                                @SuppressWarnings("unchecked")
                                                                java.util.List<String> rlist = (java.util.List<String>) rObj;
                                                                roles.addAll(rlist);
                                                        }
                                                }
                                        }
                                }
                        }

                        // Normalizar roles: mapear roles por defecto de realm a roles de aplicación
                        java.util.List<String> normalized = new java.util.ArrayList<>();
                        for (String r : roles) {
                                if (r == null)
                                        continue;
                                String nr = r;
                                // Ignorar roles técnicos
                                if ("offline_access".equals(r) || "uma_authorization".equals(r))
                                        continue;
                                // Mapear default-roles-<realm> a 'user' (comportamiento común en Keycloak)
                                if (r.startsWith("default-roles-")) {
                                        nr = "user";
                                }
                                normalized.add(nr);
                        }

                        System.out.println("Roles extraídos: " + roles);
                        System.out.println("Roles normalizados: " + normalized);
                        System.out.println("================");

                        return normalized.stream()
                                        .map(role -> new org.springframework.security.core.authority.SimpleGrantedAuthority(
                                                        "ROLE_" + role.toLowerCase()))
                                        .collect(java.util.stream.Collectors.toList());
                });
                return converter;
        }
}
