package com.apachehub.deudacero.controllers;

import com.apachehub.deudacero.dto.ExpenseDTO;
import com.apachehub.deudacero.dto.ExpenseResponseDTO;
import com.apachehub.deudacero.entities.Expense;
import com.apachehub.deudacero.services.ExpenseService;
import com.apachehub.deudacero.services.OcrService;
import com.apachehub.deudacero.dto.OcrExpenseRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/expenses")
@CrossOrigin(origins = "*")
@Tag(name = "Expenses", description = "API para gestión de gastos")
public class ExpenseController {

    private final ExpenseService expenseService;
    private final OcrService ocrService;

    public ExpenseController(ExpenseService expenseService, OcrService ocrService) {
        this.expenseService = expenseService;
        this.ocrService = ocrService;
    }

    @Operation(summary = "Crear un nuevo gasto")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "201", description = "Gasto creado exitosamente"),
            @ApiResponse(responseCode = "400", description = "Datos inválidos"),
            @ApiResponse(responseCode = "401", description = "No autorizado")
    })
    @PostMapping
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> createExpense(@RequestBody ExpenseDTO expenseDTO) {
        try {
            Expense saved = expenseService.createExpense(expenseDTO);
            return ResponseEntity.status(HttpStatus.CREATED).body(saved);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @Operation(summary = "Procesar una factura con OCR y crear un gasto")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "201", description = "Gasto creado exitosamente a partir del OCR"),
            @ApiResponse(responseCode = "400", description = "Datos inválidos o OCR sin resultados"),
            @ApiResponse(responseCode = "401", description = "No autorizado"),
            @ApiResponse(responseCode = "500", description = "Error al procesar el recibo")
    })
    @PostMapping("/process-receipt")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> processReceipt(@RequestBody OcrExpenseRequest request) {
        if (request.getFileBase64() == null || request.getFileBase64().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Se requiere el archivo en Base64"));
        }
        if (request.getGroupId() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Se requiere el identificador del grupo"));
        }
        if (request.getPayerId() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Se requiere el identificador del pagador"));
        }

        try {
            OcrService.OcrResult ocrResult = ocrService.analyzeImageBase64(request.getFileBase64());
            if (ocrResult == null || ocrResult.structured == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "El OCR no devolvió datos utilizables"));
            }

            ExpenseDTO expenseDTO = expenseService.createExpenseDTOFromOcr(
                    ocrResult.structured,
                    request.getPayerId(),
                    request.getGroupId(),
                    request.getNote(),
                    request.getCurrency(),
                    request.getShares());

            Expense saved = expenseService.createExpense(expenseDTO);
            ExpenseResponseDTO responseDTO = expenseService.convertToResponseDTO(saved);

            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                    "expense", responseDTO,
                    "ocrText", ocrResult.text));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @Operation(summary = "Obtener todos los gastos con paginación")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Lista de gastos obtenida exitosamente"),
            @ApiResponse(responseCode = "401", description = "No autorizado")
    })
    @GetMapping
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> listExpenses(
            @Parameter(description = "ID del grupo (opcional)") @RequestParam(required = false) Long groupId,
            Pageable pageable) {

        if (groupId != null) {
            // Si se especifica groupId, devolver gastos del grupo con DTO ligero
            try {
                List<ExpenseResponseDTO> expenses = expenseService.getExpensesByGroupLight(groupId);
                return ResponseEntity.ok(expenses);
            } catch (Exception e) {
                return ResponseEntity.notFound().build();
            }
        } else {
            // Si no se especifica groupId, devolver página completa (comportamiento
            // original)
            Page<Expense> page = expenseService.getAllExpenses(pageable);
            return ResponseEntity.ok(page);
        }
    }

    @Operation(summary = "Obtener un gasto por ID")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Gasto encontrado"),
            @ApiResponse(responseCode = "404", description = "Gasto no encontrado"),
            @ApiResponse(responseCode = "401", description = "No autorizado")
    })
    @GetMapping("/{id}")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> getExpense(@Parameter(description = "ID del gasto") @PathVariable Long id) {
        Optional<Expense> opt = expenseService.getExpenseById(id);
        return opt.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @Operation(summary = "Obtener todos los gastos de un grupo")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Gastos del grupo obtenidos exitosamente"),
            @ApiResponse(responseCode = "404", description = "Grupo no encontrado")
    })
    @GetMapping("/group/{groupId}")
    public ResponseEntity<List<ExpenseResponseDTO>> getExpensesByGroup(
            @Parameter(description = "ID del grupo") @PathVariable Long groupId) {
        try {
            List<ExpenseResponseDTO> expenses = expenseService.getExpensesByGroupLight(groupId);
            return ResponseEntity.ok(expenses);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @Operation(summary = "Actualizar un gasto existente")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Gasto actualizado exitosamente"),
            @ApiResponse(responseCode = "400", description = "Datos inválidos"),
            @ApiResponse(responseCode = "404", description = "Gasto no encontrado"),
            @ApiResponse(responseCode = "401", description = "No autorizado")
    })
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> updateExpense(@Parameter(description = "ID del gasto") @PathVariable Long id,
            @RequestBody ExpenseDTO expenseDTO) {
        try {
            Expense updated = expenseService.updateExpense(id, expenseDTO);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Error interno del servidor"));
        }
    }

    @Operation(summary = "Eliminar un gasto")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "204", description = "Gasto eliminado exitosamente"),
            @ApiResponse(responseCode = "404", description = "Gasto no encontrado"),
            @ApiResponse(responseCode = "401", description = "No autorizado")
    })
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> deleteExpense(@Parameter(description = "ID del gasto") @PathVariable Long id) {
        try {
            boolean deleted = expenseService.deleteExpense(id);
            if (deleted) {
                return ResponseEntity.noContent().build();
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Error interno del servidor"));
        }
    }
}
