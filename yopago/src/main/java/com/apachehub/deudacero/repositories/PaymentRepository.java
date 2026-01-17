package com.apachehub.deudacero.repositories;

import com.apachehub.deudacero.entities.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 💸 PAYMENT REPOSITORY
 * 
 * Repositorio para gestionar pagos entre miembros
 */
@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {

        /**
         * Obtener todos los pagos de un grupo
         */
        List<Payment> findByGroupId(Long groupId);

        /**
         * Obtener todos los pagos de un grupo ordenados por fecha de creación (más
         * recientes primero)
         */
        List<Payment> findByGroupIdOrderByCreatedAtDesc(Long groupId);

        /**
         * Obtener pagos donde un miembro es el pagador
         */
        List<Payment> findByFromMemberId(Long memberId);

        /**
         * Obtener pagos donde un miembro es el receptor
         */
        List<Payment> findByToMemberId(Long memberId);

        /**
         * Obtener pagos entre dos miembros específicos
         */
        @Query("SELECT p FROM Payment p WHERE " +
                        "(p.fromMember.id = :member1Id AND p.toMember.id = :member2Id) OR " +
                        "(p.fromMember.id = :member2Id AND p.toMember.id = :member1Id)")
        List<Payment> findPaymentsBetweenMembers(@Param("member1Id") Long member1Id,
                        @Param("member2Id") Long member2Id);

        /**
         * Obtener pagos confirmados de un grupo
         */
        List<Payment> findByGroupIdAndConfirmedTrue(Long groupId);

        /**
         * Obtener pagos pendientes de confirmación de un grupo
         */
        List<Payment> findByGroupIdAndConfirmedFalse(Long groupId);

        /**
         * Eliminar todos los pagos asociados a un grupo.
         */
        void deleteByGroupId(Long groupId);
}