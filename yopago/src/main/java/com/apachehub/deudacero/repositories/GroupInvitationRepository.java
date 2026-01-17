package com.apachehub.deudacero.repositories;

import com.apachehub.deudacero.entities.GroupInvitation;
import com.apachehub.deudacero.entities.GroupInvitationStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GroupInvitationRepository extends JpaRepository<GroupInvitation, Long> {

    Optional<GroupInvitation> findByToken(String token);

    boolean existsByToken(String token);

    List<GroupInvitation> findByGroupIdOrderByCreatedAtDesc(Long groupId);

    @Query("SELECT gi FROM GroupInvitation gi WHERE gi.group.id = :groupId AND LOWER(gi.email) = LOWER(:email) "
            + "AND gi.status IN :statuses")
    List<GroupInvitation> findActiveByGroupAndEmail(@Param("groupId") Long groupId,
            @Param("email") String email,
            @Param("statuses") List<GroupInvitationStatus> statuses);
}
