package com.apachehub.deudacero.services;

import com.apachehub.deudacero.entities.Group;
import com.apachehub.deudacero.entities.Member;
import com.apachehub.deudacero.repositories.MemberRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class MemberService {

    private final MemberRepository memberRepository;

    public MemberService(MemberRepository memberRepository) {
        this.memberRepository = memberRepository;
    }

    /**
     * Obtiene todos los miembros
     */
    public List<Member> getAllMembers() {
        return memberRepository.findAll();
    }

    /**
     * Obtiene un miembro por su ID
     */
    public Optional<Member> getMemberById(Long id) {
        return memberRepository.findById(id);
    }

    /**
     * Crea un nuevo miembro
     */
    public Member createMember(Member member) {
        return memberRepository.save(member);
    }

    /**
     * Actualiza un miembro existente
     */
    public Member updateMember(Long id, Member updatedMember) throws Exception {
        Member existing = memberRepository.findById(id)
                .orElseThrow(() -> new Exception("Miembro no encontrado"));

        existing.setName(updatedMember.getName());
        // Si hay más campos en el futuro, agregar aquí

        return memberRepository.save(existing);
    }

    /**
     * Elimina un miembro por su ID
     */
    public boolean deleteMember(Long id) {
        if (!memberRepository.existsById(id)) {
            return false;
        }
        memberRepository.deleteById(id);
        return true;
    }

    /**
     * Verifica si existe un miembro con el ID dado
     */
    public boolean existsById(Long id) {
        return memberRepository.existsById(id);
    }

    /**
     * Busca un miembro por nombre y grupo (para invitados)
     */
    public Member findByNameAndGroup(String name, com.apachehub.deudacero.entities.Group group) {
        // Como no tenemos este método en el repository, buscamos manualmente
        List<Member> groupMembers = memberRepository.findByGroupId(group.getId());
        return groupMembers.stream()
                .filter(member -> member.getName().equals(name))
                .findFirst()
                .orElse(null);
    }

    /**
     * Busca un miembro por email dentro de un grupo específico
     */
    public Member findByEmailAndGroup(String email, Group group) {
        if (email == null || email.trim().isEmpty() || group == null || group.getId() == null) {
            return null;
        }
        return memberRepository.findByEmailAndGroupId(email.trim().toLowerCase(), group.getId()).orElse(null);
    }

    public Optional<Member> findByEmail(String email) {
        if (email == null || email.trim().isEmpty()) {
            return Optional.empty();
        }
        String trimmed = email.trim();
        Optional<Member> memberOpt = memberRepository.findByEmailIgnoreCase(trimmed);
        return memberOpt.isPresent() ? memberOpt : memberRepository.findByEmail(trimmed);
    }

    /**
     * Busca miembros por grupo
     */
    public List<Member> findByCurrentGroup(com.apachehub.deudacero.entities.Group group) {
        return memberRepository.findByGroupId(group.getId());
    }

    /**
     * Guarda un miembro
     */
    public Member save(Member member) {
        return memberRepository.save(member);
    }

    /**
     * Busca un miembro por ID
     */
    public Optional<Member> findById(Long id) {
        return memberRepository.findById(id);
    }

    /**
     * Busca un miembro por ID - retorna null si no existe
     */
    public Member findByIdOrNull(Long id) {
        return memberRepository.findById(id).orElse(null);
    }

    /**
     * Busca un miembro por su keycloakUserId
     */
    public Optional<Member> findByKeycloakUserId(String keycloakUserId) {
        return memberRepository.findByKeycloakUserId(keycloakUserId);
    }

    /**
     * Obtiene solo los miembros registrados (autenticados)
     */
    public List<Member> getRegisteredMembers() {
        return memberRepository.findByIsRegisteredTrue();
    }

    /**
     * Obtiene solo los miembros invitados (no autenticados)
     */
    public List<Member> getGuestMembers() {
        return memberRepository.findByIsRegisteredFalse();
    }
}