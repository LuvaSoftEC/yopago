package com.apachehub.deudacero.repositories;

import com.apachehub.deudacero.entities.GroupShare;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GroupShareRepository extends JpaRepository<GroupShare, Long> {
    List<GroupShare> findByGroupId(Long groupId);

    GroupShare findByGroupIdAndMemberId(Long groupId, Long memberId);
}
