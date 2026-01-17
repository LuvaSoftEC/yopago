package com.apachehub.deudacero.repositories;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.apachehub.deudacero.entities.Member;

public interface MemberRepository extends JpaRepository<Member, Long> {

       @Query("SELECT m FROM Member m JOIN m.groups g WHERE g.id = :groupId")
       List<Member> findByGroupId(@Param("groupId") Long groupId);

       // Métodos para usuarios registrados
       Optional<Member> findByKeycloakUserId(String keycloakUserId);

       Optional<Member> findByUsername(String username);

       Optional<Member> findByEmail(String email);

       Optional<Member> findByEmailIgnoreCase(String email);

       // Buscar invitados que podrían convertirse en usuarios registrados
       Optional<Member> findByEmailAndIsRegisteredFalse(String email);

       // Buscar todos los usuarios registrados
       List<Member> findByIsRegisteredTrue();

       // Buscar todos los invitados
       List<Member> findByIsRegisteredFalse();

       // Verificar si un email ya está usado por un usuario registrado
       @Query("SELECT COUNT(m) > 0 FROM Member m WHERE m.email = :email AND m.isRegistered = true")
       boolean existsByEmailAndIsRegisteredTrue(@Param("email") String email);

       // Verificar si un username ya está usado
       boolean existsByUsername(String username);

       @Query("SELECT m FROM Member m JOIN m.groups g WHERE LOWER(m.email) = LOWER(:email) AND g.id = :groupId")
       Optional<Member> findByEmailAndGroupId(@Param("email") String email, @Param("groupId") Long groupId);
}
