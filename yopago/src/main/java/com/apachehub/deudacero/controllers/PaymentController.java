package com.apachehub.deudacero.controllers;

import com.apachehub.deudacero.services.PaymentService;
import com.apachehub.deudacero.entities.Payment;
import com.apachehub.deudacero.dto.PaymentResponseDTO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Parameter;

/**
 * 💸 PAYMENT CONTROLLER
 * 
 * API para gestionar pagos entre miembros del grupo
 */
@RestController
@RequestMapping("/api/payments")
@CrossOrigin(origins = "*")
@Tag(name = "Payments", description = "API para gestión de pagos entre miembros")
public class PaymentController {

    @Autowired
    private PaymentService paymentService;

    /**
     * 💸 Registrar un pago entre miembros
     */
    @Operation(summary = "Registrar pago", description = "Registra un pago realizado entre miembros del grupo")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Pago registrado exitosamente"),
            @ApiResponse(responseCode = "400", description = "Datos inválidos"),
            @ApiResponse(responseCode = "500", description = "Error interno del servidor")
    })
    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> registerPayment(
            @Parameter(description = "Datos del pago") @RequestBody Map<String, Object> paymentData) {

        try {
            Long fromMemberId = Long.valueOf(paymentData.get("fromMemberId").toString());
            Long toMemberId = Long.valueOf(paymentData.get("toMemberId").toString());
            Long groupId = Long.valueOf(paymentData.get("groupId").toString());
            Double amount = Double.valueOf(paymentData.get("amount").toString());
            String note = (String) paymentData.get("note");

        Payment payment = paymentService.registerPayment(fromMemberId, toMemberId, groupId, amount, note);

        return ResponseEntity.ok(Map.of(
            "success", true,
            "message", "Pago registrado exitosamente",
            "payment", PaymentResponseDTO.from(payment)));

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Error: " + e.getMessage()));
        }
    }

    /**
     * ✅ Confirmar un pago
     */
    @Operation(summary = "Confirmar pago", description = "Confirma un pago registrado")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Pago confirmado exitosamente"),
            @ApiResponse(responseCode = "404", description = "Pago no encontrado"),
            @ApiResponse(responseCode = "403", description = "Sin permisos para confirmar")
    })
    @PutMapping("/{paymentId}/confirm")
    public ResponseEntity<Map<String, Object>> confirmPayment(
            @Parameter(description = "ID del pago") @PathVariable Long paymentId,
            @Parameter(description = "ID del miembro que confirma") @RequestBody Map<String, Long> request) {

        try {
            Long memberId = request.get("memberId");
        Payment payment = paymentService.confirmPayment(paymentId, memberId);

        return ResponseEntity.ok(Map.of(
            "success", true,
            "message", "Pago confirmado exitosamente",
            "payment", PaymentResponseDTO.from(payment)));

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Error: " + e.getMessage()));
        }
    }

    /**
     * 📋 Obtener pagos de un grupo
     */
    @Operation(summary = "Obtener pagos del grupo", description = "Obtiene todos los pagos registrados en un grupo")
    @ApiResponse(responseCode = "200", description = "Pagos obtenidos exitosamente")
    @GetMapping("/group/{groupId}")
    public ResponseEntity<Map<String, Object>> getGroupPayments(
            @Parameter(description = "ID del grupo") @PathVariable Long groupId) {

        try {
        List<Payment> payments = paymentService.getPaymentsByGroup(groupId);

        return ResponseEntity.ok(Map.of(
            "success", true,
            "payments", payments.stream()
                .map(PaymentResponseDTO::from)
                .collect(Collectors.toList())));

        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "Error: " + e.getMessage()));
        }
    }

    /**
     * 📊 Obtener balance actualizado con pagos
     */
    @Operation(summary = "Balance actualizado", description = "Obtiene el balance del grupo considerando pagos realizados")
    @ApiResponse(responseCode = "200", description = "Balance calculado exitosamente")
    @GetMapping("/balance/{groupId}")
    public ResponseEntity<Map<String, Object>> getBalanceWithPayments(
            @Parameter(description = "ID del grupo") @PathVariable Long groupId) {

        try {
            Map<String, Object> balance = paymentService.getBalanceWithPayments(groupId);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "balance", balance));

        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "Error: " + e.getMessage()));
        }
    }

    /**
     * 👤 Resumen de pagos para un miembro
     */
    @Operation(summary = "Resumen de pagos de miembro", description = "Obtiene resumen de pagos enviados y recibidos por un miembro")
    @ApiResponse(responseCode = "200", description = "Resumen obtenido exitosamente")
    @GetMapping("/member/{memberId}/summary")
    public ResponseEntity<Map<String, Object>> getMemberPaymentSummary(
            @Parameter(description = "ID del miembro") @PathVariable Long memberId,
            @Parameter(description = "ID del grupo") @RequestParam Long groupId) {

        try {
            Map<String, Object> summary = paymentService.getPaymentSummaryForMember(memberId, groupId);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "summary", summary));

        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "Error: " + e.getMessage()));
        }
    }

    /**
     * 🗑️ Eliminar pago
     */
    @Operation(summary = "Eliminar pago", description = "Elimina un pago no confirmado")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Pago eliminado exitosamente"),
            @ApiResponse(responseCode = "403", description = "No se puede eliminar pago confirmado"),
            @ApiResponse(responseCode = "404", description = "Pago no encontrado")
    })
    @DeleteMapping("/{paymentId}")
    public ResponseEntity<Map<String, Object>> deletePayment(
            @Parameter(description = "ID del pago") @PathVariable Long paymentId,
            @Parameter(description = "ID del miembro que elimina") @RequestParam Long memberId) {

        try {
            paymentService.deletePayment(paymentId, memberId);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Pago eliminado exitosamente"));

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Error: " + e.getMessage()));
        }
    }
}