package com.apachehub.deudacero.services;

import com.apachehub.deudacero.entities.Member;
import com.apachehub.deudacero.repositories.MemberRepository;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Servicio para sincronizar usuarios de Keycloak con Members en la base de
 * datos
 */
@Service
public class UserSyncService {

    private final MemberRepository memberRepository;

    public UserSyncService(MemberRepository memberRepository) {
        this.memberRepository = memberRepository;
    }

    /**
     * Sincroniza un usuario autenticado con la base de datos
     * - Si el usuario ya existe como Member registrado, actualiza su último login
     * - Si no existe, crea un nuevo Member registrado
     * - Si existe como invitado con el mismo email, lo convierte a registrado
     */
    @Transactional
    public Member syncAuthenticatedUser(Jwt jwt) {
        String keycloakUserId = jwt.getSubject();
        String username = jwt.getClaimAsString("preferred_username");
        String email = jwt.getClaimAsString("email");
        String fullName = jwt.getClaimAsString("name");

        // Si no hay nombre completo, usar el username
        if (fullName == null || fullName.trim().isEmpty()) {
            fullName = username;
        }

        // 1. Buscar por Keycloak User ID (más confiable)
        Optional<Member> existingMember = memberRepository.findByKeycloakUserId(keycloakUserId);

        if (existingMember.isPresent()) {
            // Usuario ya existe como registrado, actualizar último login
            Member member = existingMember.get();
            member.setLastLogin(LocalDateTime.now());

            // Actualizar información por si cambió en Keycloak
            member.setUsername(username);
            member.setEmail(email);
            member.setName(fullName);

            return memberRepository.save(member);
        }

        // 2. Buscar por email si existe como invitado
        if (email != null && !email.trim().isEmpty()) {
            Optional<Member> guestMember = memberRepository.findByEmailAndIsRegisteredFalse(email);

            if (guestMember.isPresent()) {
                // Convertir invitado a usuario registrado
                Member member = guestMember.get();
                member.setKeycloakUserId(keycloakUserId);
                member.setUsername(username);
                member.setEmail(email);
                member.setName(fullName);
                member.setIsRegistered(true);
                member.setLastLogin(LocalDateTime.now());

                return memberRepository.save(member);
            }
        }

        // 3. Crear nuevo usuario registrado
        Member newMember = new Member(keycloakUserId, username, email, fullName);
        newMember.setLastLogin(LocalDateTime.now());

        return memberRepository.save(newMember);
    }

    /**
     * Obtiene el Member asociado al usuario autenticado
     */
    public Optional<Member> getAuthenticatedMember(Jwt jwt) {
        String keycloakUserId = jwt.getSubject();
        return memberRepository.findByKeycloakUserId(keycloakUserId);
    }

    /**
     * Verifica si un usuario está registrado en el sistema
     */
    public boolean isUserRegistered(String keycloakUserId) {
        return memberRepository.findByKeycloakUserId(keycloakUserId).isPresent();
    }

    /**
     * Busca Members invitados que podrían corresponder al usuario actual
     */
    public Optional<Member> findPotentialGuestMember(String email) {
        if (email == null || email.trim().isEmpty()) {
            return Optional.empty();
        }
        return memberRepository.findByEmailAndIsRegisteredFalse(email);
    }

    /**
     * Crea un Member registrado directamente (usado en registro)
     * Este método es usado cuando se registra un usuario nuevo desde cero
     */
    @Transactional
    public Member createRegisteredMember(String keycloakUserId, String username, String email, String fullName) {
        // Verificar que no existe ya un Member con este Keycloak ID
        Optional<Member> existing = memberRepository.findByKeycloakUserId(keycloakUserId);
        if (existing.isPresent()) {
            throw new IllegalArgumentException("Ya existe un Member con este Keycloak User ID: " + keycloakUserId);
        }

        // Verificar si hay un Member invitado con este email que podamos convertir
        if (email != null && !email.trim().isEmpty()) {
            Optional<Member> guestMember = memberRepository.findByEmailAndIsRegisteredFalse(email);
            if (guestMember.isPresent()) {
                // Convertir el Member invitado a registrado
                Member member = guestMember.get();
                member.setKeycloakUserId(keycloakUserId);
                member.setUsername(username);
                member.setEmail(email);
                member.setName(fullName);
                member.setIsRegistered(true);
                member.setLastLogin(LocalDateTime.now());

                return memberRepository.save(member);
            }
        }

        // Crear nuevo Member registrado
        Member newMember = new Member(keycloakUserId, username, email, fullName);
        newMember.setLastLogin(LocalDateTime.now());

        return memberRepository.save(newMember);
    }
}