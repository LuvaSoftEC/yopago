package com.apachehub.deudacero.repositories;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.apachehub.deudacero.entities.Expense;

public interface ExpenseRepository extends JpaRepository<Expense, Long> {

      List<Expense> findByGroupId(Long groupId);

      List<Expense> findByGroupIdOrderByIdDesc(Long groupId);

      // Buscar gasto duplicado por grupo, pagador, monto y nota
      boolean existsByGroupIdAndPayer_IdAndAmountAndNote(Long groupId, Long payerId, Double amount, String note);

      // Verificar si un miembro tiene gastos como pagador dentro de un grupo específico
      @org.springframework.data.jpa.repository.Query(
                  "SELECT CASE WHEN COUNT(e) > 0 THEN true ELSE false END FROM Expense e "
                              + "WHERE e.group.id = :groupId AND e.payer.id = :memberId")
      boolean existsByGroupIdAndPayerId(
                  @org.springframework.data.repository.query.Param("groupId") Long groupId,
                  @org.springframework.data.repository.query.Param("memberId") Long memberId);

      // Verificar si un miembro participa en shares dentro de un grupo específico
      @org.springframework.data.jpa.repository.Query(
                  "SELECT CASE WHEN COUNT(es) > 0 THEN true ELSE false END FROM Expense e "
                              + "JOIN e.shares es WHERE e.group.id = :groupId AND es.member.id = :memberId")
      boolean existsShareByGroupIdAndMemberId(
                  @org.springframework.data.repository.query.Param("groupId") Long groupId,
                  @org.springframework.data.repository.query.Param("memberId") Long memberId);
}
