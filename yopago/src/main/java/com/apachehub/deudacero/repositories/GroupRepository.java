package com.apachehub.deudacero.repositories;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.apachehub.deudacero.entities.Group;

public interface GroupRepository extends JpaRepository<Group, Long> {
    Group findByCode(String code);

    @Query("SELECT DISTINCT g FROM Group g JOIN g.members m WHERE m.id = :memberId")
    List<Group> findByMemberId(@Param("memberId") Long memberId);

    List<Group> findByCreatedById(Long memberId);

    Group findByCodeIgnoreCase(String code);
}
