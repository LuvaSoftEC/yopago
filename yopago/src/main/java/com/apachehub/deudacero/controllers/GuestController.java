package com.apachehub.deudacero.controllers;

import com.apachehub.deudacero.dto.ExpenseDTO;
import com.apachehub.deudacero.dto.ExpenseItemDTO;
import com.apachehub.deudacero.dto.ExpenseResponseDTO;
import com.apachehub.deudacero.dto.GuestExpenseRequest;
import com.apachehub.deudacero.dto.GuestPaymentRequest;
import com.apachehub.deudacero.dto.OcrExpenseRequest;
import com.apachehub.deudacero.entities.ExpenseItem;
import com.apachehub.deudacero.repositories.GroupRepository;
import com.apachehub.deudacero.repositories.MemberRepository;
import com.apachehub.deudacero.entities.Expense;
import com.apachehub.deudacero.entities.Member;
import com.apachehub.deudacero.services.ExpenseService;
import com.apachehub.deudacero.services.GuestService;
import com.apachehub.deudacero.services.OcrService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpSession;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Parameter;

/**
 * 🎫 GUEST CONTROLLER
 * 
 * Permite que usuarios INVITADOS accedan a funcionalidades básicas
 * usando el código del grupo, SIN necesidad de registro/login.
 * 
 * FUNCIONALIDADES PARA INVITADOS:
 * ✅ Ver información del grupo
 * ✅ Ver gastos del grupo
 * ✅ Ver balances/liquidaciones
 * ✅ Agregar gastos (como miembro existente)
 * ❌ Crear grupos (solo usuarios registrados)
 * ❌ Invitar otros miembros (solo usuarios registrados)
 */
@RestController
@RequestMapping("/api/guest")
@CrossOrigin(origins = "*")
@Tag(name = "Guest Access", description = "API para acceso de invitados sin registro")
public class GuestController {

    @Autowired
    private GuestService guestService;
    @Autowired
    private ExpenseService expenseService;
    @Autowired
    private MemberRepository memberRepository;
    @Autowired
    private GroupRepository groupRepository;
    @Autowired
    private OcrService ocrService;
    /**
     * 🔐 ACCEDER CON CÓDIGO DE GRUPO
     * 
     * Permite que un invitado "se autentique" usando el código del grupo.
     * Guarda la información en sesión para requests posteriores.
     */
    @Operation(summary = "Acceder con código de grupo", description = "Permite que un invitado acceda usando el código del grupo")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Acceso concedido exitosamente"),
            @ApiResponse(responseCode = "400", description = "Código de grupo inválido o datos faltantes"),
            @ApiResponse(responseCode = "500", description = "Error interno del servidor")
    })
    @PostMapping("/access")
    public ResponseEntity<Map<String, Object>> accessWithGroupCode(
            @Parameter(description = "Datos de acceso del invitado") @RequestBody Map<String, String> request,
            HttpSession session) {

        String groupCode = request.get("groupCode");
        String guestName = request.get("guestName");
        String email = request.get("email");
        String phoneNumber = request.get("phoneNumber");

        if (groupCode == null || guestName == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("success", false, "message", "groupCode y guestName son requeridos"));
        }
        if (email == null || email.trim().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("success", false, "message", "email es requerido"));
        }

        try {
            Map<String, Object> result = guestService.accessWithGroupCode(groupCode, guestName, email, phoneNumber);

            storeGuestSession(session, result);

            return ResponseEntity.ok(result);

        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", "Error: " + e.getMessage()));
        }
    }

    @Operation(summary = "Acceder con invitación", description = "Permite que un invitado acceda usando un token de invitación")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Acceso concedido exitosamente"),
            @ApiResponse(responseCode = "400", description = "Token inválido o datos faltantes"),
            @ApiResponse(responseCode = "500", description = "Error interno del servidor")
    })
    @PostMapping("/invitations/{token}/redeem")
    public ResponseEntity<Map<String, Object>> redeemInvitation(
            @Parameter(description = "Token de invitación") @PathVariable String token,
            @Parameter(description = "Datos del invitado") @RequestBody Map<String, String> request,
            HttpSession session) {

        String guestName = request.get("guestName");
        String email = request.get("email");
        String phoneNumber = request.get("phoneNumber");

        if (guestName == null || guestName.trim().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("success", false, "message", "guestName es requerido"));
        }

        if (email == null || email.trim().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("success", false, "message", "email es requerido"));
        }

        try {
            Map<String, Object> result = guestService.accessWithInvitation(token, guestName, email, phoneNumber);
            storeGuestSession(session, result);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("success", false, "message", "Error: " + e.getMessage()));
        }
    }

    @PostMapping("/profile/phone")
    public ResponseEntity<Map<String, Object>> updatePhoneNumber(
            @RequestBody Map<String, String> request,
            HttpSession session) {

        if (!isValidGuestSession(session)) {
            return ResponseEntity.status(401)
                    .body(Map.of("success", false, "message", "Sesión de invitado inválida"));
        }

        String phoneNumber = request.get("phoneNumber");
        if (phoneNumber == null || phoneNumber.trim().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("success", false, "message", "phoneNumber es requerido"));
        }

        Long memberId = (Long) session.getAttribute("guestMemberId");

        try {
            Map<String, Object> result = guestService.updateGuestPhone(memberId, phoneNumber);
            Object memberObj = result.get("member");
            if (memberObj instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> memberMap = (Map<String, Object>) memberObj;
                Object phoneObj = memberMap.get("phoneNumber");
                if (phoneObj != null) {
                    session.setAttribute("guestPhone", phoneObj);
                }
            }
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("success", false, "message", "Error al actualizar contacto: " + e.getMessage()));
        }
    }

    /**
     * 👥 VER INFORMACIÓN DEL GRUPO
     */
    @Operation(summary = "Obtener información del grupo", description = "Obtiene información detallada del grupo y sus miembros")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Información del grupo obtenida exitosamente"),
            @ApiResponse(responseCode = "401", description = "Sesión de invitado inválida"),
            @ApiResponse(responseCode = "404", description = "Grupo no encontrado")
    })
    @GetMapping("/group")
    public ResponseEntity<Map<String, Object>> getGroupInfo(HttpSession session) {
        if (!isValidGuestSession(session)) {
            return ResponseEntity.status(401)
                    .body(Map.of("success", false, "message", "Sesión de invitado inválida"));
        }

        try {
            Long groupId = (Long) session.getAttribute("guestGroupId");
            Map<String, Object> result = guestService.getGroupInfo(groupId);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", "Error: " + e.getMessage()));
        }
    }

    /**
     * 💰 VER GASTOS DEL GRUPO
     */
    @Operation(summary = "Obtener gastos del grupo", description = "Obtiene todos los gastos del grupo")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Gastos obtenidos exitosamente"),
            @ApiResponse(responseCode = "401", description = "Sesión de invitado inválida")
    })
    @GetMapping("/expenses")
    public ResponseEntity<Map<String, Object>> getGroupExpenses(HttpSession session) {
        if (!isValidGuestSession(session)) {
            return ResponseEntity.status(401)
                    .body(Map.of("success", false, "message", "Sesión de invitado inválida"));
        }

        try {
            Long groupId = (Long) session.getAttribute("guestGroupId");
            Map<String, Object> result = guestService.getGroupExpenses(groupId);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", "Error: " + e.getMessage()));
        }
    }

    /**
     * 🧮 VER BALANCES/LIQUIDACIONES
     */
    @Operation(summary = "Obtener balances del grupo", description = "Calcula y obtiene los balances y liquidaciones del grupo")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Balances calculados exitosamente"),
            @ApiResponse(responseCode = "401", description = "Sesión de invitado inválida"),
            @ApiResponse(responseCode = "404", description = "Grupo no encontrado")
    })
    @GetMapping("/settlement")
    public ResponseEntity<Map<String, Object>> getSettlement(HttpSession session) {
        if (!isValidGuestSession(session)) {
            return ResponseEntity.status(401)
                    .body(Map.of("success", false, "message", "Sesión de invitado inválida"));
        }

        try {
            Long groupId = (Long) session.getAttribute("guestGroupId");
            Map<String, Object> result = guestService.getSettlement(groupId);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", "Error: " + e.getMessage()));
        }
    }

    /**
     * 💸 CREAR GASTO COMO INVITADO (con items y validación de email único)
     */
    @Operation(summary = "Crear gasto como invitado (con items)", description = "Permite a un invitado crear un gasto con items, validando email único en el grupo.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Gasto creado exitosamente"),
            @ApiResponse(responseCode = "400", description = "Datos inválidos o email duplicado"),
            @ApiResponse(responseCode = "401", description = "Sesión de invitado inválida"),
            @ApiResponse(responseCode = "500", description = "Error interno del servidor")
    })
    @PostMapping("/expenses")
    public ResponseEntity<Map<String, Object>> createGuestExpense(
            @RequestBody GuestExpenseRequest request,
            HttpSession session) {

        if (!isValidGuestSession(session)) {
            return ResponseEntity.status(401)
                    .body(Map.of("success", false, "message", "Sesión de invitado inválida"));
        }

        try {
            Long groupId = (Long) session.getAttribute("guestGroupId");
            Long guestMemberId = (Long) session.getAttribute("guestMemberId");
            
            // Validar que el miembro invitado existe
            Member guestMember = memberRepository.findById(guestMemberId)
                    .orElseThrow(() -> new RuntimeException("Miembro invitado no encontrado"));

            // Validar que el grupo existe
            groupRepository.findById(groupId)
                    .orElseThrow(() -> new RuntimeException("Grupo no encontrado"));

            List<Member> groupMembers = memberRepository.findByGroupId(groupId);
            Map<Long, Member> memberMap = groupMembers.stream()
                    .collect(Collectors.toMap(Member::getId, member -> member, (existing, duplicate) -> existing));

            // Crear ExpenseDTO para usar la lógica completa del ExpenseService
            ExpenseDTO expenseDTO = new ExpenseDTO();
            expenseDTO.setGroupId(groupId);
            expenseDTO.setPayerId(guestMemberId); // El invitado es el pagador
            expenseDTO.setAmount(request.getAmount());
            expenseDTO.setNote(request.getDescription());
            expenseDTO.setTag(request.getCategory());
            expenseDTO.setCurrency("USD");

            List<Member> overallParticipants = resolveParticipantsOrNull(request.getParticipantMemberIds(), memberMap);
            List<Member> defaultParticipants = (overallParticipants != null && !overallParticipants.isEmpty())
                    ? overallParticipants
                    : groupMembers;

            // CASO 1: Gasto con items detallados
            if (request.getItems() != null && !request.getItems().isEmpty()) {
                // Convertir items del request a ExpenseItemDTO
                List<ExpenseItemDTO> items = new ArrayList<>();
                for (GuestExpenseRequest.ItemDTO itemDTO : request.getItems()) {
                    ExpenseItemDTO expenseItemDTO = new ExpenseItemDTO();
                    expenseItemDTO.setDescription(itemDTO.getDescription());
                    expenseItemDTO.setAmount(itemDTO.getAmount());
                    expenseItemDTO.setQuantity(itemDTO.getQuantity());

                    List<Member> itemParticipants;
                    if (Boolean.TRUE.equals(itemDTO.getOnlyForMe())) {
                        itemParticipants = Collections.singletonList(guestMember);
                    } else {
                        List<Member> specificParticipants = resolveParticipantsOrNull(itemDTO.getParticipantMemberIds(), memberMap);
                        itemParticipants = (specificParticipants != null && !specificParticipants.isEmpty())
                                ? specificParticipants
                                : defaultParticipants;
                    }

                    if (itemParticipants == null || itemParticipants.isEmpty()) {
                        throw new RuntimeException(
                                "Selecciona al menos un miembro válido para dividir el item \"" + itemDTO.getDescription() + "\"");
                    }

                    List<ExpenseItemDTO.ItemShareDTO> itemShares = new ArrayList<>();
                    boolean singleParticipant = itemParticipants.size() == 1;
                    for (Member participant : itemParticipants) {
                        ExpenseItemDTO.ItemShareDTO share = new ExpenseItemDTO.ItemShareDTO();
                        share.setMemberId(participant.getId());
                        share.setShareType(singleParticipant ? "SPECIFIC" : "SHARED");
                        itemShares.add(share);
                    }

                    expenseItemDTO.setItemShares(itemShares);
                    items.add(expenseItemDTO);
                }
                expenseDTO.setItems(items);
                expenseDTO.setShares(null);
            }
            // CASO 2: Gasto simple (sin items) - utilizar participantes seleccionados o todo el grupo
            if (expenseDTO.getItems() == null || expenseDTO.getItems().isEmpty()) {
                List<Member> shareParticipants = defaultParticipants;
                if (shareParticipants == null || shareParticipants.isEmpty()) {
                    shareParticipants = groupMembers;
                    if (shareParticipants == null || shareParticipants.isEmpty()) {
                        shareParticipants = new ArrayList<>();
                        shareParticipants.add(guestMember);
                    }
                }
                expenseDTO.setShares(buildSharesForMembers(shareParticipants));
            }

            // Usar ExpenseService para crear el gasto con toda la lógica de shares
            Expense savedExpense = expenseService.createExpense(expenseDTO);

            // Crear respuesta ligera (sin referencias circulares)
            Map<String, Object> expenseInfo = new HashMap<>();
            expenseInfo.put("id", savedExpense.getId());
            expenseInfo.put("amount", savedExpense.getAmount());
            expenseInfo.put("note", savedExpense.getNote());
            expenseInfo.put("tag", savedExpense.getTag());
            expenseInfo.put("currency", savedExpense.getCurrency());
            
            // Información del pagador (invitado)
            Map<String, Object> payerInfo = new HashMap<>();
            payerInfo.put("id", guestMember.getId());
            payerInfo.put("name", guestMember.getName());
            expenseInfo.put("payer", payerInfo);

            // Información de items si existen
            if (savedExpense.getItems() != null && !savedExpense.getItems().isEmpty()) {
                List<Map<String, Object>> itemsInfo = new ArrayList<>();
                for (ExpenseItem item : savedExpense.getItems()) {
                    Map<String, Object> itemInfo = new HashMap<>();
                    itemInfo.put("id", item.getId());
                    itemInfo.put("description", item.getDescription());
                    itemInfo.put("amount", item.getAmount());
                    itemInfo.put("quantity", item.getQuantity());
                    itemsInfo.add(itemInfo);
                }
                expenseInfo.put("items", itemsInfo);
            }

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("expense", expenseInfo);
            response.put("message", "Gasto creado exitosamente y dividido entre los miembros del grupo");
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("success", false, "message", "Error: " + e.getMessage()));
        }
    }

    @Operation(summary = "Capturar recibo como invitado", description = "Permite a un invitado procesar un recibo y crear el gasto con OCR")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Recibo procesado y gasto creado"),
            @ApiResponse(responseCode = "400", description = "Datos inválidos"),
            @ApiResponse(responseCode = "401", description = "Sesión de invitado inválida"),
            @ApiResponse(responseCode = "500", description = "Error al procesar la factura")
    })
    @PostMapping("/expenses/process-receipt")
    public ResponseEntity<Map<String, Object>> processReceipt(
            @RequestBody OcrExpenseRequest request,
            HttpSession session) {

        if (!isValidGuestSession(session)) {
            return ResponseEntity.status(401)
                    .body(Map.of("success", false, "message", "Sesión de invitado inválida"));
        }

        if (request.getFileBase64() == null || request.getFileBase64().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("success", false, "message", "Se requiere el archivo en Base64"));
        }

        try {
            Long groupId = (Long) session.getAttribute("guestGroupId");
            Long guestMemberId = (Long) session.getAttribute("guestMemberId");

            Long payerId = request.getPayerId() != null ? request.getPayerId() : guestMemberId;
            if (payerId == null) {
                throw new RuntimeException("No se pudo determinar el pagador del gasto");
            }

            Member payer = memberRepository.findById(payerId)
                    .orElseThrow(() -> new RuntimeException("Pagador no encontrado"));

            if (!payer.belongsToGroup(groupId)) {
                throw new RuntimeException("El pagador seleccionado no pertenece al grupo");
            }

            request.setGroupId(groupId);
            request.setPayerId(payerId);

            OcrService.OcrResult ocrResult = ocrService.analyzeImageBase64(request.getFileBase64());
            if (ocrResult == null || ocrResult.structured == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("success", false, "message", "El OCR no devolvió datos utilizables"));
            }

            ExpenseDTO expenseDTO = expenseService.createExpenseDTOFromOcr(
                    ocrResult.structured,
                    payerId,
                    groupId,
                    request.getNote(),
                    request.getCurrency(),
                    request.getShares());

            Expense saved = expenseService.createExpense(expenseDTO);
            ExpenseResponseDTO responseDTO = expenseService.convertToResponseDTO(saved);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("expense", responseDTO);
            response.put("ocrText", ocrResult.text);
            response.put("message", "Recibo procesado correctamente");

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", "Error al procesar la factura: " + e.getMessage()));
        }
    }

    /**
     * 🚪 CERRAR SESIÓN DE INVITADO
     */
    @Operation(summary = "Cerrar sesión de invitado", description = "Termina la sesión del invitado")
    @ApiResponse(responseCode = "200", description = "Sesión cerrada exitosamente")
    @PostMapping("/logout")
    public ResponseEntity<Map<String, Object>> logout(HttpSession session) {
        session.invalidate();
        return ResponseEntity.ok(Map.of("success", true, "message", "Sesión cerrada"));
    }

    /**
     * ℹ️ INFO DE SESIÓN ACTUAL
     */
    @Operation(summary = "Obtener información de sesión", description = "Obtiene información de la sesión actual del invitado")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Información obtenida exitosamente"),
            @ApiResponse(responseCode = "401", description = "No hay sesión activa")
    })
    @GetMapping("/info")
    public ResponseEntity<Map<String, Object>> getGuestInfo(HttpSession session) {
        if (!isValidGuestSession(session)) {
            return ResponseEntity.status(401)
                    .body(Map.of("success", false, "message", "No hay sesión de invitado activa"));
        }

        Long memberId = (Long) session.getAttribute("guestMemberId");

        Map<String, Object> memberInfo;
        try {
            memberInfo = guestService.getMemberSummary(memberId);
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("success", false, "message", "Error al obtener la información: " + e.getMessage()));
        }

        if (memberInfo == null) {
            return ResponseEntity.status(404)
                    .body(Map.of("success", false, "message", "Miembro no encontrado"));
        }

        Map<String, Object> info = new HashMap<>();
        info.put("success", true);
        info.put("isGuest", true);
        info.put("guestName", session.getAttribute("guestName"));
        info.put("groupId", session.getAttribute("guestGroupId"));
        info.put("memberId", memberId);
        info.put("member", memberInfo);
        info.put("phoneNumber", memberInfo.get("phoneNumber"));

        return ResponseEntity.ok(info);
    }

    private List<Member> resolveParticipantsOrNull(List<Long> memberIds, Map<Long, Member> memberMap) {
        if (memberIds == null) {
            return null;
        }

        Set<Long> normalizedIds = new LinkedHashSet<>();
        for (Long id : memberIds) {
            if (id != null) {
                normalizedIds.add(id);
            }
        }

        if (normalizedIds.isEmpty()) {
            return null;
        }

        List<Member> participants = new ArrayList<>();
        for (Long id : normalizedIds) {
            Member member = memberMap.get(id);
            if (member == null) {
                throw new RuntimeException("Miembro no válido seleccionado para dividir el gasto");
            }
            participants.add(member);
        }

        if (participants.isEmpty()) {
            throw new RuntimeException("Debes seleccionar al menos un miembro válido para dividir el gasto");
        }

        return participants;
    }

    private List<ExpenseDTO.ShareDTO> buildSharesForMembers(List<Member> participants) {
        List<ExpenseDTO.ShareDTO> shares = new ArrayList<>();
        if (participants == null || participants.isEmpty()) {
            return shares;
        }

        int size = participants.size();
        double basePercentage = 100.0 / size;
        double accumulated = 0.0;

        for (int i = 0; i < size; i++) {
            ExpenseDTO.ShareDTO shareDTO = new ExpenseDTO.ShareDTO();
            shareDTO.setMemberId(participants.get(i).getId());

            double percentage = i == size - 1
                    ? Math.max(0.0, 100.0 - accumulated)
                    : Math.round(basePercentage * 100.0) / 100.0;

            accumulated += percentage;
            shareDTO.setPercentage(percentage);
            shares.add(shareDTO);
        }

        if (!shares.isEmpty()) {
            double total = shares.stream()
                    .map(ExpenseDTO.ShareDTO::getPercentage)
                    .filter(value -> value != null)
                    .mapToDouble(Double::doubleValue)
                    .sum();

            if (Math.abs(total - 100.0) > 0.01) {
                ExpenseDTO.ShareDTO lastShare = shares.get(shares.size() - 1);
                double adjusted = lastShare.getPercentage() + (100.0 - total);
                lastShare.setPercentage(Math.max(0.0, adjusted));
            }
        }

        return shares;
    }

    /**
     * Reasignar un gasto a otro miembro del grupo
     */
    @Operation(summary = "Reasignar gasto", description = "Permite reasignar un gasto a otro miembro del grupo")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Gasto reasignado exitosamente"),
            @ApiResponse(responseCode = "400", description = "Datos incompletos o inválidos"),
            @ApiResponse(responseCode = "401", description = "Sesión de invitado inválida"),
            @ApiResponse(responseCode = "403", description = "Sin permisos para esta operación"),
            @ApiResponse(responseCode = "500", description = "Error interno del servidor")
    })
    @PutMapping("/expenses/{expenseId}/reassign")
    public ResponseEntity<?> reassignExpense(
            @Parameter(description = "ID del gasto a reasignar") @PathVariable Long expenseId,
            @Parameter(description = "Datos de reasignación") @RequestBody Map<String, Long> request,
            HttpSession session) {

        if (!isValidGuestSession(session)) {
            return ResponseEntity.status(401).body(Map.of(
                    "error", "No autorizado",
                    "message", "Sesión de invitado inválida"));
        }

        try {
            Long groupId = (Long) session.getAttribute("guestGroupId");
            Long memberId = (Long) session.getAttribute("guestMemberId");
            Long newPayerId = request.get("newPayerId");

            if (newPayerId == null) {
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "Datos incompletos",
                        "message", "El ID del nuevo pagador es requerido"));
            }

            Map<String, Object> result = guestService.reassignExpense(expenseId, newPayerId, memberId, groupId);
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                    "error", "Error del servidor",
                    "message", "Error al reasignar el gasto: " + e.getMessage()));
        }
    }

    /**
     * Dividir un gasto entre miembros específicos del grupo
     */
    @Operation(summary = "Dividir gasto", description = "Permite dividir un gasto entre miembros específicos del grupo")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Gasto dividido exitosamente"),
            @ApiResponse(responseCode = "400", description = "Datos incompletos"),
            @ApiResponse(responseCode = "401", description = "Sesión de invitado inválida"),
            @ApiResponse(responseCode = "403", description = "Acceso denegado al gasto"),
            @ApiResponse(responseCode = "500", description = "Error interno del servidor")
    })
    @PutMapping("/expenses/{expenseId}/divide")
    public ResponseEntity<?> divideExpense(
            @Parameter(description = "ID del gasto a dividir") @PathVariable Long expenseId,
            @Parameter(description = "Datos de división del gasto") @RequestBody Map<String, Object> request,
            HttpSession session) {

        if (!isValidGuestSession(session)) {
            return ResponseEntity.status(401).body(Map.of(
                    "error", "No autorizado",
                    "message", "Sesión de invitado inválida"));
        }

        try {
            Long groupId = (Long) session.getAttribute("guestGroupId");
            @SuppressWarnings("unchecked")
            List<Long> memberIds = (List<Long>) request.get("memberIds");
            String divisionType = (String) request.get("divisionType");
            @SuppressWarnings("unchecked")
            Map<String, Double> divisionData = (Map<String, Double>) request.get("divisionData");

            if (memberIds == null || memberIds.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "Datos incompletos",
                        "message", "Debe especificar al menos un miembro"));
            }

            Map<String, Object> result = guestService.divideExpense(expenseId, memberIds, divisionType, divisionData,
                    groupId);
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                    "error", "Error del servidor",
                    "message", "Error al dividir el gasto: " + e.getMessage()));
        }
    }

    /**
     * ⚖️ Verificar permisos del usuario currente
     */
    @Operation(summary = "Obtener permisos del invitado", description = "Obtiene los permisos disponibles para el invitado en el grupo")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Permisos obtenidos exitosamente"),
            @ApiResponse(responseCode = "401", description = "Sesión de invitado inválida"),
            @ApiResponse(responseCode = "500", description = "Error interno del servidor")
    })
    @GetMapping("/permissions")
    public ResponseEntity<Map<String, Object>> getPermissions(HttpSession session) {
        if (!isValidGuestSession(session)) {
            return ResponseEntity.status(401)
                    .body(Map.of("success", false, "message", "Sesión de invitado inválida"));
        }

        try {
            Long groupId = (Long) session.getAttribute("guestGroupId");
            Long memberId = (Long) session.getAttribute("guestMemberId");

            Map<String, Object> result = guestService.getPermissions(memberId, groupId);
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", "Error: " + e.getMessage()));
        }
    }

    /**
     * � VER PAGOS DEL GRUPO
     */
    @Operation(summary = "Ver pagos del grupo como invitado", description = "Permite a un invitado ver todos los pagos del grupo")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Pagos obtenidos exitosamente"),
            @ApiResponse(responseCode = "401", description = "Sesión de invitado inválida"),
            @ApiResponse(responseCode = "500", description = "Error interno del servidor")
    })
    @GetMapping("/payments")
    public ResponseEntity<Map<String, Object>> getGroupPayments(HttpSession session) {

        if (!isValidGuestSession(session)) {
            return ResponseEntity.status(401)
                    .body(Map.of("success", false, "message", "Sesión de invitado inválida"));
        }

        try {
            Long groupId = (Long) session.getAttribute("guestGroupId");
            Map<String, Object> paymentsInfo = guestService.getGroupPayments(groupId);
            
            return ResponseEntity.ok(paymentsInfo);

        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false,
                            "message", "Error al obtener los pagos: " + e.getMessage()));
        }
    }

    /**
     * �💵 REGISTRAR PAGO
     */
    @Operation(summary = "Registrar pago como invitado", description = "Permite a un invitado registrar un pago a otro miembro del grupo")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Pago registrado exitosamente"),
            @ApiResponse(responseCode = "400", description = "Datos inválidos"),
            @ApiResponse(responseCode = "401", description = "Sesión de invitado inválida"),
            @ApiResponse(responseCode = "500", description = "Error interno del servidor")
    })
    @PostMapping("/payments")
    public ResponseEntity<Map<String, Object>> registerPayment(
            @RequestBody GuestPaymentRequest request,
            HttpSession session) {

        if (!isValidGuestSession(session)) {
            return ResponseEntity.status(401)
                    .body(Map.of("success", false, "message", "Sesión de invitado inválida"));
        }

        try {
            Long groupId = (Long) session.getAttribute("guestGroupId");
            Long fromMemberId = (Long) session.getAttribute("guestMemberId");
            Long toMemberId = request.getToMemberId();
            Double amount = request.getAmount();
            String note = request.getNote();

            if (toMemberId == null || amount == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("success", false,
                                "message", "toMemberId y amount son requeridos"));
            }

            if (toMemberId.equals(fromMemberId)) {
                return ResponseEntity.badRequest()
                        .body(Map.of("success", false,
                                "message", "No puedes registrar un pago a ti mismo"));
            }

            Map<String, Object> result = guestService.registerPayment(fromMemberId, toMemberId, groupId, amount, note);
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false,
                            "message", "Error al registrar el pago: " + e.getMessage()));
        }
    }

    /**
     * ✅ CONFIRMAR PAGO
     */
    @Operation(summary = "Confirmar pago como invitado", description = "Permite a un invitado confirmar un pago registrado")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Pago confirmado exitosamente"),
            @ApiResponse(responseCode = "400", description = "Datos inválidos o sin permisos"),
            @ApiResponse(responseCode = "401", description = "Sesión de invitado inválida"),
            @ApiResponse(responseCode = "404", description = "Pago no encontrado"),
            @ApiResponse(responseCode = "500", description = "Error interno del servidor")
    })
    @PutMapping("/payments/{paymentId}/confirm")
    public ResponseEntity<Map<String, Object>> confirmPayment(
            @Parameter(description = "ID del pago a confirmar") @PathVariable Long paymentId,
            HttpSession session) {

        if (!isValidGuestSession(session)) {
            return ResponseEntity.status(401)
                    .body(Map.of("success", false, "message", "Sesión de invitado inválida"));
        }

        try {
            Long guestMemberId = (Long) session.getAttribute("guestMemberId");
            Long groupId = (Long) session.getAttribute("guestGroupId");
            
            Map<String, Object> result = guestService.confirmPayment(paymentId, guestMemberId, groupId);
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("success", false,
                            "message", "Error al confirmar el pago: " + e.getMessage()));
        }
    }

    /**
     * Validar si la sesión de invitado es válida
     */
    private boolean isValidGuestSession(HttpSession session) {
        return session.getAttribute("isGuest") != null &&
                (Boolean) session.getAttribute("isGuest") &&
                session.getAttribute("guestGroupId") != null &&
                session.getAttribute("guestMemberId") != null;
    }

    private void storeGuestSession(HttpSession session, Map<String, Object> result) {
        if (session == null || result == null) {
            return;
        }

        Object groupObj = result.get("group");
        Object memberObj = result.get("member");

        if (!(groupObj instanceof Map) || !(memberObj instanceof Map)) {
            return;
        }

        Map<?, ?> group = (Map<?, ?>) groupObj;
        Map<?, ?> member = (Map<?, ?>) memberObj;

        Object groupId = group.get("id");
        Object memberId = member.get("id");
        Object name = member.get("name");

        if (groupId instanceof Number) {
            session.setAttribute("guestGroupId", ((Number) groupId).longValue());
        } else if (groupId != null) {
            session.setAttribute("guestGroupId", groupId);
        }

        if (memberId instanceof Number) {
            session.setAttribute("guestMemberId", ((Number) memberId).longValue());
        } else if (memberId != null) {
            session.setAttribute("guestMemberId", memberId);
        }

        if (name != null) {
            session.setAttribute("guestName", name);
        }

        Object phone = member.get("phoneNumber");
        if (phone != null) {
            session.setAttribute("guestPhone", phone);
        }

        session.setAttribute("isGuest", true);
    }
}