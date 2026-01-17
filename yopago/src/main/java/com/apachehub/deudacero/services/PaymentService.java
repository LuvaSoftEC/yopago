package com.apachehub.deudacero.services;

import com.apachehub.deudacero.entities.Payment;
import com.apachehub.deudacero.entities.Member;
import com.apachehub.deudacero.entities.Group;
import com.apachehub.deudacero.repositories.PaymentRepository;
import com.apachehub.deudacero.repositories.MemberRepository;
import com.apachehub.deudacero.repositories.GroupRepository;
import com.apachehub.deudacero.utils.MathUtils;
import com.apachehub.deudacero.dto.PaymentResponseDTO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.Optional;

/**
 * 💸 PAYMENT SERVICE
 *
 * Maneja toda la lógica de negocio para registrar pagos entre miembros
 */
@Service
public class PaymentService {

        @Autowired
        private PaymentRepository paymentRepository;

        @Autowired
        private MemberRepository memberRepository;

        @Autowired
        private GroupRepository groupRepository;

        @Autowired
        private SettlementService settlementService;

        @Autowired
        private RealTimeEventPublisher realTimeEventPublisher;

        /**
         * 💸 Registrar un pago entre miembros
         */
        public Payment registerPayment(Long fromMemberId, Long toMemberId, Long groupId,
                        Double amount, String note) {

                // Validar datos
                if (amount == null || amount <= 0) {
                        throw new IllegalArgumentException("El monto debe ser mayor a 0");
                }

                if (fromMemberId.equals(toMemberId)) {
                        throw new IllegalArgumentException("No puedes registrar un pago a ti mismo");
                }

                // Buscar entidades
                Member fromMember = memberRepository.findById(fromMemberId)
                                .orElseThrow(() -> new RuntimeException("Miembro pagador no encontrado"));

                Member toMember = memberRepository.findById(toMemberId)
                                .orElseThrow(() -> new RuntimeException("Miembro receptor no encontrado"));

                Group group = groupRepository.findById(groupId)
                                .orElseThrow(() -> new RuntimeException("Grupo no encontrado"));

                // Verificar que ambos miembros pertenecen al grupo
                if (!fromMember.belongsToGroup(groupId) || !toMember.belongsToGroup(groupId)) {
                        throw new RuntimeException("Ambos miembros deben pertenecer al mismo grupo");
                }

                // Crear el pago
                Payment payment = new Payment(fromMember, toMember, group, amount, note);
                Payment savedPayment = paymentRepository.save(payment);

                java.util.Map<String, Object> payload = new java.util.HashMap<>();
                payload.put("paymentId", savedPayment.getId());
                payload.put("fromMemberId", fromMemberId);
                payload.put("toMemberId", toMemberId);
                payload.put("amount", amount);
                payload.put("note", note);
                payload.put("confirmed", savedPayment.getConfirmed());
                realTimeEventPublisher.publishGroupEvent(groupId, "group.payment.created", payload);

                java.util.Map<String, Object> payerEvent = new java.util.HashMap<>();
                payerEvent.put("paymentId", savedPayment.getId());
                payerEvent.put("direction", "sent");
                payerEvent.put("counterpartyId", toMemberId);
                payerEvent.put("amount", amount);
                realTimeEventPublisher.publishUserEvent(fromMemberId, "user.payment.created", payerEvent);

                java.util.Map<String, Object> receiverEvent = new java.util.HashMap<>();
                receiverEvent.put("paymentId", savedPayment.getId());
                receiverEvent.put("direction", "received");
                receiverEvent.put("counterpartyId", fromMemberId);
                receiverEvent.put("amount", amount);
                realTimeEventPublisher.publishUserEvent(toMemberId, "user.payment.created", receiverEvent);

                return savedPayment;
        }

        /**
         * ✅ Confirmar un pago (ambos miembros deben confirmar)
         */
        public Payment confirmPayment(Long paymentId, Long memberId) {
                Payment payment = paymentRepository.findById(paymentId)
                                .orElseThrow(() -> new RuntimeException("Pago no encontrado"));

                // Verificar que el miembro es parte del pago
                if (!payment.getFromMember().getId().equals(memberId)
                                && !payment.getToMember().getId().equals(memberId)) {
                        throw new RuntimeException("No tienes permisos para confirmar este pago");
                }

                payment.setConfirmed(true);
                Payment savedPayment = paymentRepository.save(payment);

                java.util.Map<String, Object> payload = new java.util.HashMap<>();
                payload.put("paymentId", savedPayment.getId());
                payload.put("confirmedBy", memberId);
                payload.put("fromMemberId", savedPayment.getFromMember().getId());
                payload.put("toMemberId", savedPayment.getToMember().getId());
                payload.put("amount", savedPayment.getAmount());
                realTimeEventPublisher.publishGroupEvent(savedPayment.getGroup().getId(), "group.payment.confirmed",
                                payload);

                return savedPayment;
        }

        /**
         * 📋 Obtener todos los pagos de un grupo
         */
        public List<Payment> getPaymentsByGroup(Long groupId) {
                return paymentRepository.findByGroupId(groupId);
        }

        /**
         * 📊 Obtener balance actualizado considerando pagos registrados
         */
        public Map<String, Object> getBalanceWithPayments(Long groupId) {
                // Obtener balance base de gastos
                Map<String, Object> settlement = settlementService.calculateSettlement(groupId);
                @SuppressWarnings("unchecked")
                Map<Long, Double> baseBalances = Optional.ofNullable((Map<Long, Double>) settlement.get("balances"))
                                .orElseGet(HashMap::new);

                // Obtener pagos confirmados
                List<Payment> confirmedPayments = paymentRepository.findByGroupIdAndConfirmedTrue(groupId);
                List<Payment> pendingPayments = paymentRepository.findByGroupIdAndConfirmedFalse(groupId);

                // Ajustar balances con pagos realizados
                Map<Long, Double> adjustedBalances = new HashMap<>(baseBalances);
                for (Payment payment : confirmedPayments) {
                        Long fromId = payment.getFromMember().getId();
                        Long toId = payment.getToMember().getId();
                        Double amount = payment.getAmount();

                        // El que pagó reduce su deuda (o aumenta su crédito)
                        double fromBalance = MathUtils
                                        .roundToTwoDecimals(adjustedBalances.getOrDefault(fromId, 0.0) + amount);
                        adjustedBalances.put(fromId, fromBalance);
                        // El que recibió aumenta su deuda (o reduce su crédito)
                        double toBalance = MathUtils
                                        .roundToTwoDecimals(adjustedBalances.getOrDefault(toId, 0.0) - amount);
                        adjustedBalances.put(toId, toBalance);
                }

                return Map.of(
                                "originalBalances", baseBalances,
                                "adjustedBalances", adjustedBalances,
                                "confirmedPayments", confirmedPayments.stream()
                                                .map(PaymentResponseDTO::from)
                                                .toList(),
                                "pendingPayments", pendingPayments.stream()
                                                .map(PaymentResponseDTO::from)
                                                .toList());
        }

        /**
         * 🔍 Obtener pagos entre dos miembros específicos
         */
        public List<Payment> getPaymentsBetweenMembers(Long member1Id, Long member2Id) {
                return paymentRepository.findPaymentsBetweenMembers(member1Id, member2Id);
        }

        /**
         * 📈 Obtener resumen de pagos para un miembro
         */
        public Map<String, Object> getPaymentSummaryForMember(Long memberId, Long groupId) {
                List<Payment> sentPayments = paymentRepository.findByFromMemberId(memberId);
                List<Payment> receivedPayments = paymentRepository.findByToMemberId(memberId);

                // Filtrar por grupo
                sentPayments = sentPayments.stream()
                                .filter(p -> p.getGroup().getId().equals(groupId))
                                .toList();
                receivedPayments = receivedPayments.stream()
                                .filter(p -> p.getGroup().getId().equals(groupId))
                                .toList();

                double totalSent = MathUtils.roundToTwoDecimals(
                                sentPayments.stream()
                                                .filter(Payment::getConfirmed)
                                                .mapToDouble(Payment::getAmount)
                                                .sum());

                double totalReceived = MathUtils.roundToTwoDecimals(
                                receivedPayments.stream()
                                                .filter(Payment::getConfirmed)
                                                .mapToDouble(Payment::getAmount)
                                                .sum());

                return Map.of(
                                "totalSent", totalSent,
                                "totalReceived", totalReceived,
                                "netBalance", totalReceived - totalSent,
                                "sentPayments", sentPayments.stream()
                                                .map(PaymentResponseDTO::from)
                                                .toList(),
                                "receivedPayments", receivedPayments.stream()
                                                .map(PaymentResponseDTO::from)
                                                .toList());
        }

        /**
         * 🧹 Eliminar todos los pagos asociados a un grupo.
         */
        @Transactional
        public void deletePaymentsByGroup(Long groupId) {
                paymentRepository.deleteByGroupId(groupId);
        }

        /**
         * 🗑️ Eliminar un pago (solo si no está confirmado)
         */
        public boolean deletePayment(Long paymentId, Long memberId) {
                Payment payment = paymentRepository.findById(paymentId)
                                .orElseThrow(() -> new RuntimeException("Pago no encontrado"));

                // Solo el creador del pago puede eliminarlo y solo si no está confirmado
                if (!payment.getFromMember().getId().equals(memberId)) {
                        throw new RuntimeException("Solo quien registró el pago puede eliminarlo");
                }

                if (payment.getConfirmed()) {
                        throw new RuntimeException("No se puede eliminar un pago confirmado");
                }

                Long groupId = payment.getGroup() != null ? payment.getGroup().getId() : null;
                Long toMemberId = payment.getToMember() != null ? payment.getToMember().getId() : null;
                Double amount = payment.getAmount();

                paymentRepository.delete(payment);

                if (groupId != null) {
                        java.util.Map<String, Object> payload = new java.util.HashMap<>();
                        payload.put("paymentId", paymentId);
                        payload.put("fromMemberId", memberId);
                        payload.put("toMemberId", toMemberId);
                        payload.put("amount", amount);
                        realTimeEventPublisher.publishGroupEvent(groupId, "group.payment.deleted", payload);
                }

                return true;
        }
}
