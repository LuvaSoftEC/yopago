package com.apachehub.deudacero.services;

import com.apachehub.deudacero.entities.Group;
import com.apachehub.deudacero.entities.GroupInvitation;
import com.apachehub.deudacero.entities.GroupInvitationStatus;
import com.apachehub.deudacero.entities.Member;
import com.apachehub.deudacero.repositories.GroupInvitationRepository;
import com.apachehub.deudacero.repositories.GroupRepository;
import com.apachehub.deudacero.repositories.MemberRepository;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GroupInvitationService {

    private final GroupInvitationRepository invitationRepository;
    private final GroupRepository groupRepository;
    private final MemberRepository memberRepository;

    public GroupInvitationService(GroupInvitationRepository invitationRepository,
            GroupRepository groupRepository,
            MemberRepository memberRepository) {
        this.invitationRepository = invitationRepository;
        this.groupRepository = groupRepository;
        this.memberRepository = memberRepository;
    }

    public GroupInvitation createInvitation(Long groupId, Long requesterId, String email,
            Integer expiresInHours, Boolean singleUse) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("Grupo no encontrado"));

        Member requester = memberRepository.findById(requesterId)
                .orElseThrow(() -> new RuntimeException("Miembro solicitante no encontrado"));

        ensureOwnerPermission(group, requesterId);

        String normalizedEmail = normalizeEmail(email);
        GroupInvitation invitation = new GroupInvitation();
        invitation.setGroup(group);
        invitation.setCreatedBy(requester);
        invitation.setEmail(normalizedEmail);
        invitation.setToken(generateUniqueToken());
        invitation.setExpiresAt(calculateExpiration(expiresInHours));

        if (Boolean.TRUE.equals(singleUse)) {
            invitation.setStatus(GroupInvitationStatus.PENDING);
        }

        return invitationRepository.save(invitation);
    }

    public List<GroupInvitation> getInvitationsForGroup(Long groupId, Long requesterId) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("Grupo no encontrado"));
        ensureOwnerPermission(group, requesterId);

        List<GroupInvitation> invitations = invitationRepository.findByGroupIdOrderByCreatedAtDesc(groupId);
        List<GroupInvitation> updated = new ArrayList<>();
        for (GroupInvitation invitation : invitations) {
            if (invitation.getStatus() == GroupInvitationStatus.PENDING && invitation.isExpired()) {
                invitation.setStatus(GroupInvitationStatus.EXPIRED);
                updated.add(invitation);
            }
        }
        if (!updated.isEmpty()) {
            invitationRepository.saveAll(updated);
        }
        return invitations;
    }

    @Transactional
    public GroupInvitation revokeInvitation(Long groupId, Long invitationId, Long requesterId) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("Grupo no encontrado"));
        ensureOwnerPermission(group, requesterId);

        GroupInvitation invitation = invitationRepository.findById(invitationId)
                .orElseThrow(() -> new RuntimeException("Invitación no encontrada"));

        if (!invitation.getGroup().getId().equals(groupId)) {
            throw new RuntimeException("La invitación no pertenece a este grupo");
        }

        if (invitation.getStatus() == GroupInvitationStatus.REVOKED) {
            return invitation;
        }

        invitation.setStatus(GroupInvitationStatus.REVOKED);
        invitation.setRevokedAt(LocalDateTime.now());
        invitationRepository.save(invitation);
        return invitation;
    }

    public GroupInvitation validateForRedemption(String token, String email) {
        GroupInvitation invitation = invitationRepository.findByToken(token)
                .orElseThrow(() -> new RuntimeException("Invitación no encontrada"));

        if (invitation.getStatus() == GroupInvitationStatus.REVOKED) {
            throw new RuntimeException("La invitación fue revocada");
        }

        if (invitation.isExpired()) {
            invitation.setStatus(GroupInvitationStatus.EXPIRED);
            invitationRepository.save(invitation);
            throw new RuntimeException("La invitación expiró");
        }

        String normalizedEmail = normalizeEmail(email);
        if (normalizedEmail == null) {
            throw new RuntimeException("El correo es requerido para usar la invitación");
        }

        if (invitation.getEmail() != null && !invitation.getEmail().equalsIgnoreCase(normalizedEmail)) {
            throw new RuntimeException("El correo no coincide con la invitación");
        }

        if (invitation.getStatus() == GroupInvitationStatus.USED && invitation.getUsedBy() != null) {
            String usedByEmail = invitation.getUsedBy().getEmail();
            if (usedByEmail != null && !usedByEmail.equalsIgnoreCase(normalizedEmail)) {
                throw new RuntimeException("La invitación ya fue utilizada por otro invitado");
            }
        }

        return invitation;
    }

    @Transactional
    public GroupInvitation registerUsage(GroupInvitation invitation, Member member) {
        if (invitation == null) {
            throw new RuntimeException("Invitación inválida");
        }

        if (invitation.getStatus() == GroupInvitationStatus.REVOKED) {
            throw new RuntimeException("La invitación fue revocada");
        }

        if (invitation.isExpired()) {
            invitation.setStatus(GroupInvitationStatus.EXPIRED);
            invitationRepository.save(invitation);
            throw new RuntimeException("La invitación expiró");
        }

        if (invitation.getUsedBy() != null && !invitation.getUsedBy().getId().equals(member.getId())) {
            throw new RuntimeException("La invitación ya fue utilizada por otro invitado");
        }

        if (member.getEmail() != null && invitation.getEmail() == null) {
            invitation.setEmail(normalizeEmail(member.getEmail()));
        }

        invitation.setUsedBy(member);
        invitation.setUsedAt(LocalDateTime.now());
        invitation.setStatus(GroupInvitationStatus.USED);
        return invitationRepository.save(invitation);
    }

    private void ensureOwnerPermission(Group group, Long requesterId) {
        if (group.getCreatedBy() == null || group.getCreatedBy().getId() == null) {
            throw new RuntimeException("El grupo no tiene propietario asignado");
        }
        if (!group.getCreatedBy().getId().equals(requesterId)) {
            throw new RuntimeException("Solo el creador del grupo puede gestionar invitaciones");
        }
    }

    private String generateUniqueToken() {
        String token;
        do {
            token = UUID.randomUUID().toString().replaceAll("-", "");
        } while (invitationRepository.existsByToken(token));
        return token;
    }

    private LocalDateTime calculateExpiration(Integer expiresInHours) {
        if (expiresInHours == null || expiresInHours <= 0) {
            return LocalDateTime.now().plusDays(7);
        }
        return LocalDateTime.now().plusHours(expiresInHours.longValue());
    }

    private String normalizeEmail(String email) {
        if (email == null) {
            return null;
        }
        String trimmed = email.trim();
        return trimmed.isEmpty() ? null : trimmed.toLowerCase();
    }

    public Optional<GroupInvitation> findByToken(String token) {
        return invitationRepository.findByToken(token);
    }
}
