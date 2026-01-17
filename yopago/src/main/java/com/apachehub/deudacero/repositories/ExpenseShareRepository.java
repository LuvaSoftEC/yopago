package com.apachehub.deudacero.repositories;

import com.apachehub.deudacero.entities.ExpenseShare;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ExpenseShareRepository extends JpaRepository<ExpenseShare, Long> {
}
