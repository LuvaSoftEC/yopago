package com.apachehub.deudacero.repositories;

import com.apachehub.deudacero.entities.ExpenseItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ExpenseItemRepository extends JpaRepository<ExpenseItem, Long> {
    List<ExpenseItem> findByExpenseId(Long expenseId);
}