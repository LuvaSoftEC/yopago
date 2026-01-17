package com.apachehub.deudacero.services;

import com.apachehub.deudacero.dto.ExpenseDTO;
import com.apachehub.deudacero.dto.ExpenseItemDTO;
import com.apachehub.deudacero.dto.ExpenseResponseDTO;
import com.apachehub.deudacero.entities.Expense;
import com.apachehub.deudacero.entities.ExpenseShare;
import com.apachehub.deudacero.entities.ExpenseItem;
import com.apachehub.deudacero.entities.ExpenseItemShare;
import com.apachehub.deudacero.entities.Member;
import com.apachehub.deudacero.repositories.ExpenseRepository;
import com.apachehub.deudacero.repositories.ExpenseShareRepository;
import com.apachehub.deudacero.repositories.ExpenseItemRepository;
import com.apachehub.deudacero.repositories.ExpenseItemShareRepository;
import com.apachehub.deudacero.repositories.GroupRepository;
import com.apachehub.deudacero.repositories.MemberRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import com.apachehub.deudacero.utils.MathUtils;
import java.util.List;
import java.util.Optional;
import java.util.ArrayList;

@Service
public class ExpenseService {
    @Autowired
    private ExpenseRepository expenseRepository;
    @Autowired
    private MemberRepository memberRepository;
    @Autowired
    private GroupRepository groupRepository;
    @Autowired
    private ExpenseShareRepository expenseShareRepository;
    @Autowired
    private ExpenseItemRepository expenseItemRepository;
    @Autowired
    private ExpenseItemShareRepository expenseItemShareRepository;
    @Autowired
    private com.apachehub.deudacero.repositories.GroupShareRepository groupShareRepository;
    @Autowired
    private RealTimeEventPublisher realTimeEventPublisher;

    public Expense createExpense(ExpenseDTO expenseDTO) throws Exception {
        Member payer = memberRepository.findById(expenseDTO.getPayerId()).orElse(null);
        if (payer == null) {
            throw new Exception("Pagador no encontrado");
        }
        com.apachehub.deudacero.entities.Group group = null;
        if (expenseDTO.getGroupId() != null) {
            group = groupRepository.findById(expenseDTO.getGroupId()).orElse(null);
            if (group == null) {
                throw new Exception("Grupo no encontrado");
            }
        }
        boolean exists = expenseRepository.existsByGroupIdAndPayer_IdAndAmountAndNote(
                expenseDTO.getGroupId(),
                expenseDTO.getPayerId(),
                expenseDTO.getAmount(),
                expenseDTO.getNote());
        if (exists) {
            throw new Exception("Gasto duplicado");
        }

        Expense expense = new Expense();
        expense.setAmount(expenseDTO.getAmount());
        expense.setNote(expenseDTO.getNote());
        expense.setTag(expenseDTO.getTag());
        expense.setCurrency(expenseDTO.getCurrency());
        expense.setPayer(payer);
        if (group != null) {
            expense.setGroup(group);
        }

        if (group == null || group.getMembers() == null || group.getMembers().isEmpty()) {
            throw new Exception("El grupo no tiene miembros");
        }
        List<Member> allMembers = group.getMembers();

        Expense savedExpense;

        // CASO 1: Gasto con items detallados
        if (expenseDTO.getItems() != null && !expenseDTO.getItems().isEmpty()) {
            savedExpense = createExpenseWithItems(expense, expenseDTO, allMembers);
        }

        // CASO 2: División personalizada con shares (flujo tradicional)
        else if (expenseDTO.getShares() != null && !expenseDTO.getShares().isEmpty()) {
            double totalPercentage = 0.0;
            double totalAmount = 0.0;
            List<ExpenseShare> sharesToSave = new java.util.ArrayList<>();
            boolean includesPayer = false;
            for (ExpenseDTO.ShareDTO shareDTO : expenseDTO.getShares()) {
                Member member = memberRepository.findById(shareDTO.getMemberId()).orElse(null);
                if (member == null) {
                    throw new Exception("Miembro con ID " + shareDTO.getMemberId() + " no encontrado");
                }

                // Verificar si el miembro está en el grupo
                final Long memberId = member.getId();
                boolean isInGroup = group.getMembers().stream()
                        .anyMatch(m -> m.getId().equals(memberId));

                if (!isInGroup) {
                    throw new Exception(
                            "El miembro " + member.getName() + " (ID: " + member.getId() + ") no pertenece al grupo");
                }

                ExpenseShare share = new ExpenseShare();
                share.setMember(member);
                share.setPercentage(shareDTO.getPercentage());
                share.setAmount(shareDTO.getAmount());
                share.setExpense(expense);

                if (member.getId() != null && member.getId().equals(payer.getId())) {
                    includesPayer = true;
                }
                if (shareDTO.getPercentage() != null) {
                    totalPercentage += shareDTO.getPercentage();
                }
                if (shareDTO.getAmount() != null) {
                    totalAmount += shareDTO.getAmount();
                }
                sharesToSave.add(share);
            }
            // Si el payer no está entre los shares, añadir la porción restante
            // automáticamente
            if (!includesPayer) {
                if (totalPercentage > 0) {
                    double remainingPct = 100.0 - totalPercentage;
                    if (remainingPct < -0.01) {
                        throw new Exception("Shares inválidos: porcentajes suman más de 100%");
                    }
                    // Agregar share del payer con la porción restante (si remainingPct casi 0, no
                    // agregar)
                    if (remainingPct > 0.01) {
                        ExpenseShare payerShare = new ExpenseShare();
                        payerShare.setMember(payer);
                        payerShare.setPercentage(remainingPct);
                        payerShare.setAmount(null); // calculado por porcentaje
                        payerShare.setExpense(expense);
                        sharesToSave.add(payerShare);
                        totalPercentage += remainingPct;
                    }
                } else if (totalAmount > 0) {
                    double remainingAmt = expenseDTO.getAmount() - totalAmount;
                    if (remainingAmt < -0.01) {
                        throw new Exception("Shares inválidos: montos suman más que el total");
                    }
                    if (remainingAmt > 0.01) {
                        ExpenseShare payerShare = new ExpenseShare();
                        payerShare.setMember(payer);
                        payerShare.setAmount(remainingAmt);
                        payerShare.setPercentage(null);
                        payerShare.setExpense(expense);
                        sharesToSave.add(payerShare);
                        totalAmount += remainingAmt;
                    }
                } else {
                    // No se especificaron porcentajes ni montos -> invalid (handled below)
                }
            }
            boolean valid = false;
            if (totalPercentage > 0) {
                long totalScaledPercentage = Math.round(totalPercentage * 100.0);
                valid = Math.abs(totalScaledPercentage - 10000) <= 1;
            } else if (totalAmount > 0) {
                valid = Math.abs(totalAmount - expenseDTO.getAmount()) < 0.01;
            }
            if (!valid) {
                throw new Exception("Shares inválidos");
            }
            Expense saved = expenseRepository.save(expense);
            List<ExpenseShare> sharesFinal = new java.util.ArrayList<>();
            for (ExpenseShare share : sharesToSave) {
                share.setExpense(saved);
                ExpenseShare savedShare = expenseShareRepository.save(share);
                sharesFinal.add(savedShare);
                // Actualizar GroupShare agregado
                if (saved.getGroup() != null && share.getMember() != null) {
                    com.apachehub.deudacero.entities.GroupShare gs = groupShareRepository
                            .findByGroupIdAndMemberId(saved.getGroup().getId(), share.getMember().getId());
                    if (gs == null) {
                        gs = new com.apachehub.deudacero.entities.GroupShare();
                        gs.setGroup(saved.getGroup());
                        gs.setMember(share.getMember());
                        gs.setAmountTotal(0.0);
                    }
                    double add = share.getAmount() != null ? share.getAmount() : 0.0;
                    gs.setAmountTotal(MathUtils.roundToTwoDecimals(gs.getAmountTotal() + add));
                    gs.setUpdatedAt(java.time.LocalDateTime.now());
                    groupShareRepository.save(gs);
                }
            }
            saved.setShares(sharesFinal);
            savedExpense = saved;
        } else {
            Expense saved = expenseRepository.save(expense);
            double shareAmount = MathUtils.roundToTwoDecimals(saved.getAmount() / allMembers.size());
            java.util.List<ExpenseShare> shares = new java.util.ArrayList<>();
            for (Member member : allMembers) {
                ExpenseShare share = new ExpenseShare();
                share.setExpense(saved);
                share.setMember(member);
                share.setAmount(shareAmount);
                share.setPercentage(MathUtils.roundToTwoDecimals(100.0 / allMembers.size()));
                ExpenseShare savedShare = expenseShareRepository.save(share);
                shares.add(savedShare);
                // Actualizar GroupShare
                com.apachehub.deudacero.entities.GroupShare gs = groupShareRepository
                        .findByGroupIdAndMemberId(saved.getGroup().getId(), member.getId());
                if (gs == null) {
                    gs = new com.apachehub.deudacero.entities.GroupShare();
                    gs.setGroup(saved.getGroup());
                    gs.setMember(member);
                    gs.setAmountTotal(0.0);
                }
                gs.setAmountTotal(gs.getAmountTotal() + shareAmount);
                gs.setUpdatedAt(java.time.LocalDateTime.now());
                groupShareRepository.save(gs);
            }
            saved.setShares(shares);
            savedExpense = saved;
        }

        if (savedExpense.getGroup() != null && savedExpense.getGroup().getId() != null) {
            java.util.Map<String, Object> payload = new java.util.HashMap<>();
            payload.put("expenseId", savedExpense.getId());
            payload.put("amount", savedExpense.getAmount());
            payload.put("currency", savedExpense.getCurrency());
            payload.put("note", savedExpense.getNote());
            if (savedExpense.getPayer() != null) {
                payload.put("payerId", savedExpense.getPayer().getId());
            }
            realTimeEventPublisher.publishGroupEvent(savedExpense.getGroup().getId(), "group.expense.created",
                    payload);
        }

        return savedExpense;
    }

    /**
     * Recalcula los GroupShare a partir de los gastos existentes del grupo.
     * Esta operación sobrescribe los totales actuales.
     */
    public void reSplitGroupShares(Long groupId) throws Exception {
        com.apachehub.deudacero.entities.Group group = groupRepository.findById(groupId).orElse(null);
        if (group == null)
            throw new Exception("Grupo no encontrado");

        // Inicializar totales a 0 para todos los miembros actuales
        List<com.apachehub.deudacero.entities.Member> members = group.getMembers();
        java.util.Map<Long, Double> totals = new java.util.HashMap<>();
        for (com.apachehub.deudacero.entities.Member m : members) {
            totals.put(m.getId(), 0.0);
        }

        // Recalcular a partir de expenses
        List<Expense> expenses = expenseRepository.findByGroupId(groupId);
        for (Expense expense : expenses) {
            if (expense.getShares() != null && !expense.getShares().isEmpty()) {
                for (Expense.ExpenseShareDTO share : expense.getShares()) {
                    Long memberId = share.member.getId();
                    double amount = share.amount != null ? share.amount : 0.0;
                    totals.put(memberId, totals.getOrDefault(memberId, 0.0) + amount);
                }
            } else {
                // equal split entre miembros actuales
                double split = expense.getAmount() / members.size();
                for (com.apachehub.deudacero.entities.Member m : members) {
                    totals.put(m.getId(), totals.getOrDefault(m.getId(), 0.0) + split);
                }
            }
        }

        // Borrar o actualizar GroupShare existentes
        List<com.apachehub.deudacero.entities.GroupShare> existing = groupShareRepository.findByGroupId(groupId);
        // Elimina los que no están en members actuales
        for (com.apachehub.deudacero.entities.GroupShare gs : existing) {
            boolean found = false;
            for (com.apachehub.deudacero.entities.Member m : members) {
                if (gs.getMember().getId().equals(m.getId())) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                groupShareRepository.delete(gs);
            }
        }

        // Guardar totales nuevos
        for (com.apachehub.deudacero.entities.Member m : members) {
            double tot = totals.getOrDefault(m.getId(), 0.0);
            com.apachehub.deudacero.entities.GroupShare gs = groupShareRepository.findByGroupIdAndMemberId(groupId,
                    m.getId());
            if (gs == null) {
                gs = new com.apachehub.deudacero.entities.GroupShare();
                gs.setGroup(group);
                gs.setMember(m);
            }
            gs.setAmountTotal(tot);
            gs.setUpdatedAt(java.time.LocalDateTime.now());
            groupShareRepository.save(gs);
        }
    }

    /**
     * Obtiene todos los gastos con paginación
     */
    public Page<Expense> getAllExpenses(Pageable pageable) {
        return expenseRepository.findAll(pageable);
    }

    /**
     * Obtiene un gasto por su ID
     */
    public Optional<Expense> getExpenseById(Long id) {
        return expenseRepository.findById(id);
    }

    /**
     * Re-split expenses of a group equally among current members.
     * This method overwrites existing ExpenseShare entries for affected expenses.
     */
    public void reSplitExpenses(Long groupId) throws Exception {
        com.apachehub.deudacero.entities.Group group = groupRepository.findById(groupId).orElse(null);
        if (group == null)
            throw new Exception("Grupo no encontrado");
        List<Member> members = group.getMembers();
        if (members == null || members.isEmpty())
            return;

        List<Expense> expenses = expenseRepository.findByGroupId(groupId);
        for (Expense expense : expenses) {
            // delete existing shares for this expense
            List<ExpenseShare> existing = expenseShareRepository.findAll();
            // filter and delete those belonging to this expense
            for (ExpenseShare es : existing) {
                if (es.getExpense() != null && es.getExpense().getId() != null
                        && es.getExpense().getId().equals(expense.getId())) {
                    expenseShareRepository.delete(es);
                }
            }

            // create equal shares among current members
            double shareAmount = expense.getAmount() / members.size();
            List<ExpenseShare> newShares = new java.util.ArrayList<>();
            for (Member m : members) {
                ExpenseShare share = new ExpenseShare();
                share.setExpense(expense);
                share.setMember(m);
                share.setAmount(shareAmount);
                share.setPercentage(100.0 / members.size());
                ExpenseShare savedShare = expenseShareRepository.save(share);
                newShares.add(savedShare);
            }
            expense.setShares(newShares);
            expenseRepository.save(expense);
        }
    }

    /**
     * Busca un gasto por ID - retorna null si no existe
     */
    public Expense findById(Long id) {
        return expenseRepository.findById(id).orElse(null);
    }

    /**
     * 📊 Obtiene todos los gastos de un grupo específico
     */
    public List<Expense> getExpensesByGroup(Long groupId) {
        return expenseRepository.findByGroupId(groupId);
    }

    /**
     * 📋 Obtiene gastos del grupo como DTOs ligeros
     */
    public List<ExpenseResponseDTO> getExpensesByGroupLight(Long groupId) {
        List<Expense> expenses = expenseRepository.findByGroupIdOrderByIdDesc(groupId);
        return expenses.stream().map(this::convertToResponseDTO).collect(java.util.stream.Collectors.toList());
    }

    /**
     * 🔄 Convierte una entidad Expense a ExpenseResponseDTO ligero
     */
    public ExpenseResponseDTO convertToResponseDTO(Expense expense) {
        ExpenseResponseDTO dto = new ExpenseResponseDTO();
        dto.setId(expense.getId());
        dto.setAmount(expense.getAmount());
        dto.setNote(expense.getNote());
        dto.setTag(expense.getTag());
        dto.setCurrency(expense.getCurrency());
        // Note: Expense entity doesn't have createdAt field

        // Información del pagador
        ExpenseResponseDTO.MemberInfo payerInfo = new ExpenseResponseDTO.MemberInfo();
        payerInfo.setId(expense.getPayer().getId());
        payerInfo.setName(expense.getPayer().getName());
        payerInfo.setIsGuest(expense.getPayer().isGuest());
        dto.setPayer(payerInfo);

        // Información del grupo
        ExpenseResponseDTO.GroupInfo groupInfo = new ExpenseResponseDTO.GroupInfo();
        groupInfo.setId(expense.getGroup().getId());
        groupInfo.setName(expense.getGroup().getName());
        groupInfo.setGroupCode(expense.getGroup().getCode()); // Use getCode() instead of getGroupCode()
        dto.setGroup(groupInfo);

        // Items del gasto (si los tiene)
        if ((expense.getItems() == null || expense.getItems().isEmpty()) && expense.getId() != null) {
            expense.setItems(expenseItemRepository.findByExpenseId(expense.getId()));
        }

        if (expense.getItems() != null && !expense.getItems().isEmpty()) {
            List<ExpenseResponseDTO.ItemInfo> itemsInfo = new ArrayList<>();
            for (com.apachehub.deudacero.entities.ExpenseItem item : expense.getItems()) {
                ExpenseResponseDTO.ItemInfo itemInfo = new ExpenseResponseDTO.ItemInfo();
                itemInfo.setId(item.getId());
                itemInfo.setDescription(item.getDescription());
                itemInfo.setAmount(item.getAmount());
                itemInfo.setQuantity(item.getQuantity());
                itemsInfo.add(itemInfo);
            }
            dto.setItems(itemsInfo);
        }

        // Note: Skipping shares for now to avoid complexity - can be added later if
        // needed

        return dto;
    }

    /**
     * ✏️ Actualiza un gasto existente
     */
    public Expense updateExpense(Long id, ExpenseDTO expenseDTO) throws Exception {
        Optional<Expense> expenseOpt = expenseRepository.findById(id);
        if (expenseOpt.isEmpty()) {
            throw new RuntimeException("Gasto no encontrado");
        }

        Expense expense = expenseOpt.get();

        // Validar y actualizar el pagador si se proporciona
        if (expenseDTO.getPayerId() != null) {
            Member payer = memberRepository.findById(expenseDTO.getPayerId()).orElse(null);
            if (payer == null) {
                throw new IllegalArgumentException("Pagador no encontrado");
            }
            expense.setPayer(payer);
        }

        // Validar y actualizar el grupo si se proporciona
        if (expenseDTO.getGroupId() != null) {
            com.apachehub.deudacero.entities.Group group = groupRepository.findById(expenseDTO.getGroupId())
                    .orElse(null);
            if (group == null) {
                throw new IllegalArgumentException("Grupo no encontrado");
            }
            expense.setGroup(group);
        }

        // Actualizar campos básicos
        if (expenseDTO.getAmount() != null) {
            expense.setAmount(expenseDTO.getAmount());
        }
        if (expenseDTO.getNote() != null) {
            expense.setNote(expenseDTO.getNote());
        }
        if (expenseDTO.getCurrency() != null) {
            expense.setCurrency(expenseDTO.getCurrency());
        }

        // Actualizar shares si se proporcionan
        if (expenseDTO.getShares() != null && !expenseDTO.getShares().isEmpty()) {
            // Eliminar shares existentes - buscar todos y filtrar por expense
            List<ExpenseShare> allShares = expenseShareRepository.findAll();
            List<ExpenseShare> existingShares = allShares.stream()
                    .filter(share -> share.getExpense() != null && share.getExpense().getId().equals(expense.getId()))
                    .collect(java.util.stream.Collectors.toList());
            expenseShareRepository.deleteAll(existingShares);

            // Crear nuevos shares
            List<ExpenseShare> newShares = new ArrayList<>();
            for (ExpenseDTO.ShareDTO shareDTO : expenseDTO.getShares()) {
                Member member = memberRepository.findById(shareDTO.getMemberId()).orElse(null);
                if (member != null) {
                    ExpenseShare share = new ExpenseShare();
                    share.setMember(member);
                    share.setExpense(expense);
                    share.setPercentage(shareDTO.getPercentage());
                    share.setAmount(shareDTO.getAmount());
                    newShares.add(share);
                }
            }
            expense.setShares(newShares);
        }

        Expense savedExpense = expenseRepository.save(expense);

        if (savedExpense.getGroup() != null && savedExpense.getGroup().getId() != null) {
            java.util.Map<String, Object> payload = new java.util.HashMap<>();
            payload.put("expenseId", savedExpense.getId());
            payload.put("amount", savedExpense.getAmount());
            payload.put("currency", savedExpense.getCurrency());
            payload.put("note", savedExpense.getNote());
            if (savedExpense.getPayer() != null) {
                payload.put("payerId", savedExpense.getPayer().getId());
            }
            realTimeEventPublisher.publishGroupEvent(savedExpense.getGroup().getId(), "group.expense.updated",
                    payload);
        }

        return savedExpense;
    }

    /**
     * 🗑️ Elimina un gasto
     */
    public boolean deleteExpense(Long id) {
        Optional<Expense> expenseOpt = expenseRepository.findById(id);
        if (expenseOpt.isEmpty()) {
            return false;
        }

        Expense expense = expenseOpt.get();
        Long groupId = expense.getGroup() != null ? expense.getGroup().getId() : null;

        // Eliminar shares relacionados primero
        List<ExpenseShare> allShares = expenseShareRepository.findAll();
        List<ExpenseShare> sharesToDelete = allShares.stream()
                .filter(share -> share.getExpense() != null && share.getExpense().getId().equals(id))
                .collect(java.util.stream.Collectors.toList());
        expenseShareRepository.deleteAll(sharesToDelete);

        // Eliminar el gasto
        expenseRepository.deleteById(id);

        if (groupId != null) {
            java.util.Map<String, Object> payload = new java.util.HashMap<>();
            payload.put("expenseId", id);
            payload.put("note", expense.getNote());
            realTimeEventPublisher.publishGroupEvent(groupId, "group.expense.deleted", payload);
        }

        return true;
    }

    /**
     * Parsea texto de shares en formato JSON a lista de ShareDTO
     */
    public List<ExpenseDTO.ShareDTO> parseShares(String sharesText) {
        if (sharesText == null || sharesText.isEmpty()) {
            return null;
        }
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            return mapper.readValue(sharesText,
                    mapper.getTypeFactory().constructCollectionType(List.class, ExpenseDTO.ShareDTO.class));
        } catch (Exception e) {
            System.out.println("[ExpenseService] Error al parsear shares: " + e.getMessage());
            return null;
        }
    }

    /**
     * Crea un ExpenseDTO desde datos de OCR
     */
    public ExpenseDTO createExpenseDTOFromOcr(Object ocrStructured, Long payerId, Long groupId,
            String note, String currency, List<ExpenseDTO.ShareDTO> shares) throws Exception {
        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        com.fasterxml.jackson.databind.JsonNode node = mapper.valueToTree(ocrStructured);

        java.util.function.Function<com.fasterxml.jackson.databind.JsonNode, Double> parseDouble = value -> {
            if (value == null || value.isNull()) {
                return null;
            }
            if (value.isNumber()) {
                return value.asDouble();
            }
            String text = value.asText();
            if (text == null || text.isBlank()) {
                return null;
            }
            text = text.replace(" ", "").replace("$", "").replace("€", "").replace(",", ".");
            try {
                return Double.parseDouble(text);
            } catch (NumberFormatException ex) {
                return null;
            }
        };

        Double totalAmount = parseDouble.apply(node.get("amount"));
        if (totalAmount == null) {
            throw new Exception("No se pudo extraer el monto total del recibo");
        }

        ExpenseDTO expenseDTO = new ExpenseDTO();
        expenseDTO.setAmount(totalAmount);
        expenseDTO.setCurrency(currency != null ? currency : "USD");
        expenseDTO.setPayerId(payerId);
        expenseDTO.setGroupId(groupId);
        expenseDTO.setShares(shares);

        String fecha = node.has("fecha") && !node.get("fecha").isNull() ? node.get("fecha").asText() : null;
        String structuredText = node.has("text") && !node.get("text").isNull() ? node.get("text").asText() : null;
        StringBuilder noteBuilder = new StringBuilder();
        if (note != null && !note.isBlank()) {
            noteBuilder.append(note);
        } else {
            noteBuilder.append("Gasto extraído por OCR");
        }
        if (fecha != null && !fecha.isBlank()) {
            noteBuilder.append(" | Fecha ticket: ").append(fecha);
        }
        expenseDTO.setNote(noteBuilder.toString());
        expenseDTO.setTag("OCR");

        java.util.List<ExpenseItemDTO> itemDTOs = new java.util.ArrayList<>();
        com.fasterxml.jackson.databind.JsonNode itemsNode = node.get("items");
        if (itemsNode != null && itemsNode.isArray()) {
            for (com.fasterxml.jackson.databind.JsonNode itemNode : itemsNode) {
                Double itemAmount = parseDouble.apply(itemNode.get("monto"));
                if (itemAmount == null) {
                    continue;
                }
                ExpenseItemDTO itemDTO = new ExpenseItemDTO();
                itemDTO.setDescription(
                        itemNode.has("descripcion") ? itemNode.get("descripcion").asText("Item") : "Item");
                Integer cantidad = itemNode.has("cantidad") && !itemNode.get("cantidad").isNull()
                        ? itemNode.get("cantidad").asInt()
                        : 1;
                itemDTO.setQuantity(Math.max(cantidad, 1));
                itemDTO.setAmount(itemAmount);
                itemDTOs.add(itemDTO);
            }
        }

        Double ivaAmount = parseDouble.apply(node.get("iva"));
        if (ivaAmount != null && ivaAmount > 0.0) {
            ExpenseItemDTO ivaItem = new ExpenseItemDTO();
            ivaItem.setDescription("Impuestos (IVA)");
            ivaItem.setAmount(ivaAmount);
            ivaItem.setQuantity(1);
            itemDTOs.add(ivaItem);
        }

        Double propinaAmount = parseDouble.apply(node.get("propina"));
        if (propinaAmount != null && propinaAmount > 0.0) {
            ExpenseItemDTO tipItem = new ExpenseItemDTO();
            tipItem.setDescription("Propina");
            tipItem.setAmount(propinaAmount);
            tipItem.setQuantity(1);
            itemDTOs.add(tipItem);
        }

        Double subtotalAmount = parseDouble.apply(node.get("subtotal"));
        if (subtotalAmount != null && subtotalAmount > 0.0 && itemDTOs.isEmpty()) {
            ExpenseItemDTO subtotalItem = new ExpenseItemDTO();
            subtotalItem.setDescription("Subtotal");
            subtotalItem.setAmount(subtotalAmount);
            subtotalItem.setQuantity(1);
            itemDTOs.add(subtotalItem);
        }

        double sumItems = itemDTOs.stream().mapToDouble(ExpenseItemDTO::getAmount).sum();
        double difference = totalAmount - sumItems;
        if (Math.abs(difference) > 0.01) {
            ExpenseItemDTO adjustment = new ExpenseItemDTO();
            adjustment.setDescription("Ajuste OCR (impuestos/servicios)");
            adjustment.setAmount(MathUtils.roundToTwoDecimals(difference));
            adjustment.setQuantity(1);
            itemDTOs.add(adjustment);
        }

        if (!itemDTOs.isEmpty()) {
            expenseDTO.setItems(itemDTOs);
        }

        if (structuredText != null && !structuredText.isBlank()) {
            expenseDTO.setNote(expenseDTO.getNote() + " | " + structuredText.split("\n")[0]);
        }

        return expenseDTO;
    }

    /**
     * Crea un miembro temporal y lo agrega al grupo
     */
    // MÉTODO DESHABILITADO - Ya no creamos miembros automáticamente
    private Member createTemporaryMember(Long memberId, com.apachehub.deudacero.entities.Group group) throws Exception {
        // Verificar si el miembro ya existe en la base de datos
        Optional<Member> existingMember = memberRepository.findById(memberId);
        if (existingMember.isPresent()) {
            Member member = existingMember.get();
            // Verificar si ya está en el grupo
            if (group.getMembers().stream().noneMatch(m -> m.getId().equals(memberId))) {
                // Agregar al grupo
                group.getMembers().add(member);
                groupRepository.save(group);
            }
            return member;
        }

        // Si el miembro no existe con ese ID, buscar por nombre temporal
        String tempName = "Miembro " + memberId;
        String tempEmail = "member" + memberId + "@yopago.temp";

        // Buscar si ya existe un miembro temporal con este email
        Optional<Member> existingTempMember = memberRepository.findByEmail(tempEmail);
        if (existingTempMember.isPresent()) {
            Member tempMember = existingTempMember.get();
            // Verificar si ya está en el grupo
            if (group.getMembers().stream().noneMatch(m -> m.getId().equals(tempMember.getId()))) {
                group.getMembers().add(tempMember);
                groupRepository.save(group);
            }
            return tempMember;
        }

        // Crear nuevo miembro temporal
        Member temporaryMember = new Member();
        temporaryMember.setName(tempName);
        temporaryMember.setEmail(tempEmail);
        temporaryMember.setIsRegistered(false); // Marcar como no registrado (temporal)

        // Guardar el miembro temporal
        Member savedMember = memberRepository.save(temporaryMember);

        // Agregar al grupo
        if (group.getMembers() == null) {
            group.setMembers(new ArrayList<>());
        }
        group.getMembers().add(savedMember);
        groupRepository.save(group);

        return savedMember;
    }

    /**
     * Crea un gasto con items detallados
     */
    private Expense createExpenseWithItems(Expense expense, ExpenseDTO expenseDTO, List<Member> allMembers)
            throws Exception {
        // Guardar el expense principal primero
        Expense savedExpense = expenseRepository.save(expense);

        // Validar que el total de items coincida con el monto del expense
        double totalItemsAmount = expenseDTO.getItems().stream()
                .mapToDouble(ExpenseItemDTO::getAmount)
                .sum();

        if (Math.abs(totalItemsAmount - expenseDTO.getAmount()) > 0.01) {
            throw new Exception("El total de items ($" + totalItemsAmount + ") no coincide con el monto del gasto ($"
                    + expenseDTO.getAmount() + ")");
        }

        // Lista para almacenar las shares finales por miembro
        java.util.Map<Long, Double> memberTotals = new java.util.HashMap<>();

        // Procesar cada item
        for (ExpenseItemDTO itemDTO : expenseDTO.getItems()) {
            // Crear el ExpenseItem
            ExpenseItem item = new ExpenseItem();
            item.setDescription(itemDTO.getDescription());
            item.setAmount(itemDTO.getAmount());
            item.setQuantity(itemDTO.getQuantity());
            item.setExpense(savedExpense);

            ExpenseItem savedItem = expenseItemRepository.save(item);

            // Procesar las shares del item
            if (itemDTO.getItemShares() != null && !itemDTO.getItemShares().isEmpty()) {
                processItemShares(savedItem, itemDTO.getItemShares(), memberTotals);
            } else {
                // Si no hay shares específicas, dividir equitativamente entre todos los
                // miembros
                processItemEqually(savedItem, allMembers, memberTotals);
            }
        }

        // Crear ExpenseShares basadas en los totales calculados
        List<ExpenseShare> finalShares = new ArrayList<>();
        for (java.util.Map.Entry<Long, Double> entry : memberTotals.entrySet()) {
            Member member = memberRepository.findById(entry.getKey())
                    .orElseThrow(() -> new Exception("Miembro no encontrado: " + entry.getKey()));

            ExpenseShare share = new ExpenseShare();
            share.setExpense(savedExpense);
            share.setMember(member);
            share.setAmount(entry.getValue());
            share.setPercentage((entry.getValue() / savedExpense.getAmount()) * 100.0);

            ExpenseShare savedShare = expenseShareRepository.save(share);
            finalShares.add(savedShare);

            // Actualizar GroupShare
            updateGroupShare(savedExpense.getGroup(), member, entry.getValue());
        }

        savedExpense.setShares(finalShares);
        return savedExpense;
    }

    /**
     * Procesa las shares específicas de un item
     */
    private void processItemShares(ExpenseItem item, List<ExpenseItemDTO.ItemShareDTO> itemShares,
            java.util.Map<Long, Double> memberTotals) throws Exception {

        // Separar shares SPECIFIC de SHARED
        List<ExpenseItemDTO.ItemShareDTO> specificShares = new ArrayList<>();
        List<ExpenseItemDTO.ItemShareDTO> sharedShares = new ArrayList<>();

        for (ExpenseItemDTO.ItemShareDTO shareDTO : itemShares) {
            if ("SPECIFIC".equals(shareDTO.getShareType())) {
                specificShares.add(shareDTO);
            } else {
                sharedShares.add(shareDTO);
            }
        }

        double remainingAmount = item.getAmount();

        // 1. Procesar shares SPECIFIC (montos fijos para miembros específicos)
        for (ExpenseItemDTO.ItemShareDTO shareDTO : specificShares) {
            Member member = memberRepository.findById(shareDTO.getMemberId())
                    .orElseThrow(() -> new Exception("Miembro no encontrado: " + shareDTO.getMemberId()));

            double shareAmount = item.getAmount(); // Por defecto, todo el item si es específico
            if (shareDTO.getAmount() != null) {
                shareAmount = shareDTO.getAmount();
            } else if (shareDTO.getPercentage() != null) {
                shareAmount = item.getAmount() * (shareDTO.getPercentage() / 100.0);
            }

            // Crear ExpenseItemShare
            ExpenseItemShare itemShare = new ExpenseItemShare();
            itemShare.setExpenseItem(item);
            itemShare.setMember(member);
            itemShare.setAmount(shareAmount);
            itemShare.setShareType(ExpenseItemShare.ShareType.SPECIFIC);
            expenseItemShareRepository.save(itemShare);

            // Acumular en totales del miembro
            memberTotals.merge(member.getId(), shareAmount, Double::sum);
            remainingAmount -= shareAmount;
        }

        // 2. Procesar shares SHARED (dividir el monto restante)
        if (!sharedShares.isEmpty() && remainingAmount > 0.01) {
            double sharePerMember = remainingAmount / sharedShares.size();

            for (ExpenseItemDTO.ItemShareDTO shareDTO : sharedShares) {
                Member member = memberRepository.findById(shareDTO.getMemberId())
                        .orElseThrow(() -> new Exception("Miembro no encontrado: " + shareDTO.getMemberId()));

                double shareAmount = sharePerMember;
                if (shareDTO.getAmount() != null) {
                    shareAmount = shareDTO.getAmount();
                } else if (shareDTO.getPercentage() != null) {
                    shareAmount = remainingAmount * (shareDTO.getPercentage() / 100.0);
                }

                // Crear ExpenseItemShare
                ExpenseItemShare itemShare = new ExpenseItemShare();
                itemShare.setExpenseItem(item);
                itemShare.setMember(member);
                itemShare.setAmount(shareAmount);
                itemShare.setShareType(ExpenseItemShare.ShareType.SHARED);
                expenseItemShareRepository.save(itemShare);

                // Acumular en totales del miembro
                memberTotals.merge(member.getId(), shareAmount, Double::sum);
            }
        }
    }

    /**
     * Procesa un item sin shares específicas (división equitativa)
     */
    private void processItemEqually(ExpenseItem item, List<Member> allMembers,
            java.util.Map<Long, Double> memberTotals) {
        double sharePerMember = item.getAmount() / allMembers.size();

        for (Member member : allMembers) {
            // Crear ExpenseItemShare
            ExpenseItemShare itemShare = new ExpenseItemShare();
            itemShare.setExpenseItem(item);
            itemShare.setMember(member);
            itemShare.setAmount(sharePerMember);
            itemShare.setPercentage(100.0 / allMembers.size());
            itemShare.setShareType(ExpenseItemShare.ShareType.SHARED);
            expenseItemShareRepository.save(itemShare);

            // Acumular en totales del miembro
            memberTotals.merge(member.getId(), sharePerMember, Double::sum);
        }
    }

    /**
     * Actualiza el GroupShare para un miembro
     */
    private void updateGroupShare(com.apachehub.deudacero.entities.Group group, Member member, Double amount) {
        if (group != null && member != null && amount != null) {
            com.apachehub.deudacero.entities.GroupShare gs = groupShareRepository
                    .findByGroupIdAndMemberId(group.getId(), member.getId());
            if (gs == null) {
                gs = new com.apachehub.deudacero.entities.GroupShare();
                gs.setGroup(group);
                gs.setMember(member);
                gs.setAmountTotal(0.0);
            }
            gs.setAmountTotal(gs.getAmountTotal() + amount);
            gs.setUpdatedAt(java.time.LocalDateTime.now());
            groupShareRepository.save(gs);
        }
    }
}
