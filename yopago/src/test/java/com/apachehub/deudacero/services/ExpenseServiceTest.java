package com.apachehub.deudacero.services;

import com.apachehub.deudacero.dto.ExpenseDTO;
import com.apachehub.deudacero.dto.ExpenseItemDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ExpenseServiceTest {

    private ExpenseService expenseService;

    @BeforeEach
    void setUp() {
        expenseService = new ExpenseService();
    }

    @Test
    void createExpenseDTOFromOcr_shouldMapItemsAndAdjustDifference() throws Exception {
        Map<String, Object> structured = new HashMap<>();
        structured.put("amount", 42.61);
        structured.put("fecha", "15/10/2025 22:33:28");
        structured.put("items", List.of(
                Map.of("descripcion", "HUNTERS BARIL HENIK", "cantidad", 2, "monto", 13.10),
                Map.of("descripcion", "12 ALITAS", "cantidad", 1, "monto", 13.59),
                Map.of("descripcion", "6 ALITAS SEMIPICANTE", "cantidad", 1, "monto", 7.40)));
        structured.put("iva", 5.11);
        structured.put("subtotal", 34.09);

        ExpenseDTO dto = expenseService.createExpenseDTOFromOcr(structured, 1L, 99L,
                null, "USD", null);

        assertEquals(42.61, dto.getAmount(), 0.001);
        assertEquals(1L, dto.getPayerId());
        assertEquals(99L, dto.getGroupId());
        assertEquals("USD", dto.getCurrency());
        assertNotNull(dto.getItems());
        assertEquals(5, dto.getItems().size(), "Debe crear items + IVA + ajuste");

        ExpenseItemDTO first = dto.getItems().stream()
                .filter(item -> "HUNTERS BARIL HENIK".equals(item.getDescription()))
                .findFirst().orElseThrow();
        assertEquals(13.10, first.getAmount(), 0.001);
        assertEquals(2, first.getQuantity());

        ExpenseItemDTO ivaItem = dto.getItems().stream()
                .filter(item -> item.getDescription().equals("Impuestos (IVA)"))
                .findFirst().orElseThrow();
        assertEquals(5.11, ivaItem.getAmount(), 0.001);

        ExpenseItemDTO adjustment = dto.getItems().stream()
                .filter(item -> item.getDescription().equals("Ajuste OCR (impuestos/servicios)"))
                .findFirst().orElseThrow();
        assertEquals(3.41, adjustment.getAmount(), 0.001);

        assertTrue(dto.getNote().contains("Fecha ticket: 15/10/2025"));
        assertEquals("OCR", dto.getTag());
    }

    @Test
    void createExpenseDTOFromOcr_shouldHandlePropinaAndSubtotalWhenNoItems() throws Exception {
        Map<String, Object> structured = new HashMap<>();
        structured.put("amount", 50.0);
        structured.put("subtotal", 45.0);
        structured.put("propina", 5.0);

        ExpenseDTO dto = expenseService.createExpenseDTOFromOcr(structured, 5L, 7L,
                "Cena de prueba", "EUR", null);

        assertEquals(50.0, dto.getAmount(), 0.001);
        assertEquals("EUR", dto.getCurrency());
        assertTrue(dto.getNote().startsWith("Cena de prueba"));
        assertNotNull(dto.getItems());
        assertEquals(2, dto.getItems().size());

        ExpenseItemDTO subtotalItem = dto.getItems().stream()
                .filter(item -> item.getDescription().equals("Subtotal"))
                .findFirst().orElseThrow();
        assertEquals(45.0, subtotalItem.getAmount(), 0.001);

        ExpenseItemDTO tipItem = dto.getItems().stream()
                .filter(item -> item.getDescription().equals("Propina"))
                .findFirst().orElseThrow();
        assertEquals(5.0, tipItem.getAmount(), 0.001);
    }
}
