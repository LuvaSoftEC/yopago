package com.apachehub.deudacero.repositories;

import com.apachehub.deudacero.entities.ExpenseItemShare;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ExpenseItemShareRepository extends JpaRepository<ExpenseItemShare, Long> {
    List<ExpenseItemShare> findByExpenseItemId(Long expenseItemId);
    List<ExpenseItemShare> findByMemberId(Long memberId);
}