package com.yopago.api.repository;

import com.yopago.api.model.ExpenseGroup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ExpenseGroupRepository extends JpaRepository<ExpenseGroup, Long> {
    List<ExpenseGroup> findByCreatedBy(String createdBy);
}
