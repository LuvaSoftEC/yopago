package com.apachehub.deudacero.services;

import com.apachehub.deudacero.dto.CreateGroupRequest;
import com.apachehub.deudacero.dto.GroupResponse;
import com.apachehub.deudacero.dto.JoinGroupRequest;
import com.apachehub.deudacero.entities.Expense;
import com.apachehub.deudacero.entities.ExpenseItem;
import com.apachehub.deudacero.entities.ExpenseItemShare;
import com.apachehub.deudacero.entities.Group;
import com.apachehub.deudacero.entities.Member;
import com.apachehub.deudacero.repositories.ExpenseRepository;
import com.apachehub.deudacero.repositories.GroupRepository;
import com.apachehub.deudacero.repositories.MemberRepository;
import com.apachehub.deudacero.utils.MathUtils;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.Map;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;
import java.util.Base64;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.common.BitMatrix;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GroupService {

    private final GroupRepository groupRepository;
    private final MemberRepository memberRepository;
    private final ExpenseRepository expenseRepository;
    private final ExpenseService expenseService;
    private final com.apachehub.deudacero.repositories.GroupShareRepository groupShareRepository;
    private final PaymentService paymentService;
    private final RealTimeEventPublisher realTimeEventPublisher;

    public GroupService(GroupRepository groupRepository, MemberRepository memberRepository,
            ExpenseRepository expenseRepository, ExpenseService expenseService,
            com.apachehub.deudacero.repositories.GroupShareRepository groupShareRepository,
            PaymentService paymentService, RealTimeEventPublisher realTimeEventPublisher) {
        this.groupRepository = groupRepository;
        this.memberRepository = memberRepository;
        this.expenseRepository = expenseRepository;
        this.expenseService = expenseService;
        this.groupShareRepository = groupShareRepository;
        this.paymentService = paymentService;
        this.realTimeEventPublisher = realTimeEventPublisher;
    }

    private Map<String, Object> buildGroupLight(Group group) {
        return buildGroupLight(group, null);
    }

    private Map<String, Object> buildGroupLight(Group group, Long viewerMemberId) {
        Map<String, Object> groupInfo = new HashMap<>();
        groupInfo.put("id", group.getId());
        groupInfo.put("name", group.getName());
        groupInfo.put("description", group.getDescription());
        groupInfo.put("code", group.getCode());
        groupInfo.put("isActive", group.getIsActive());
        groupInfo.put("createdAt", group.getCreatedAt());

        if (group.getCreatedBy() != null) {
            Map<String, Object> creatorInfo = new HashMap<>();
            creatorInfo.put("id", group.getCreatedBy().getId());
            creatorInfo.put("name", group.getCreatedBy().getName());
            creatorInfo.put("email", group.getCreatedBy().getEmail());
            groupInfo.put("createdBy", creatorInfo);
        }

        List<Member> members = group.getMembers();
        groupInfo.put("totalMembers", members != null ? members.size() : 0);

        List<Expense> expenses = group.getExpenses();
        groupInfo.put("totalExpenses", expenses != null ? expenses.size() : 0);

        double totalAmount = expenses != null ? expenses.stream().mapToDouble(Expense::getAmount).sum() : 0.0;
        groupInfo.put("totalAmount", totalAmount);

        if (viewerMemberId != null) {
            boolean isMember = group.hasMember(viewerMemberId);
            boolean isOwner = group.getCreatedBy() != null && viewerMemberId.equals(group.getCreatedBy().getId());

            groupInfo.put("currentUserIsMember", isMember);
            groupInfo.put("currentUserIsOwner", isOwner);
        }

        return groupInfo;
    }

    public GroupResponse createGroupWithCode(CreateGroupRequest request, Jwt jwt) {
        if (request == null || request.getName() == null || request.getName().trim().isEmpty()) {
            throw new IllegalArgumentException("El nombre del grupo es requerido");
        }

        Group group = new Group();
        group.setName(request.getName().trim());
        group.setDescription(request.getDescription());

        String joinCode = generateUniqueJoinCode();
        group.setCode(joinCode);

        Member creator = null;
        if (jwt != null) {
            String keycloakId = jwt.getSubject();
            if (keycloakId != null) {
                creator = memberRepository.findByKeycloakUserId(keycloakId).orElse(null);
            }
        }

        if (creator != null) {
            group.setCreatedBy(creator);
            group.addMember(creator);
        }

        Group savedGroup = groupRepository.save(group);
        if (creator != null) {
            memberRepository.save(creator);
        }

        GroupResponse response = new GroupResponse();
        response.setGroupId(savedGroup.getId());
        response.setName(savedGroup.getName());
        response.setDescription(savedGroup.getDescription());
        response.setCreatedAt(savedGroup.getCreatedAt());
        response.setIsActive(savedGroup.getIsActive());
        response.setJoinCode(joinCode);
        response.setQrCodeBase64(generateQrCodeBase64(joinCode));

        java.util.Map<String, Object> createdPayload = new java.util.HashMap<>();
        createdPayload.put("groupId", savedGroup.getId());
        createdPayload.put("name", savedGroup.getName());
        realTimeEventPublisher.publishGroupEvent(savedGroup.getId(), "group.created", createdPayload);

        if (creator != null && creator.getId() != null) {
            java.util.Map<String, Object> ownerPayload = new java.util.HashMap<>();
            ownerPayload.put("groupId", savedGroup.getId());
            ownerPayload.put("name", savedGroup.getName());
            ownerPayload.put("role", "owner");
            realTimeEventPublisher.publishUserEvent(creator.getId(), "user.group.created", ownerPayload);
        }

        return response;
    }

    public Optional<Group> getGroupById(Long id) {
        return groupRepository.findById(id);
    }

    public Optional<Group> findById(Long id) {
        return groupRepository.findById(id);
    }

    public Optional<Group> findByShareCode(String shareCode) {
        if (shareCode == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(groupRepository.findByCodeIgnoreCase(shareCode.trim()));
    }

    public Optional<Group> findByCodeOrId(String codeOrId) {
        if (codeOrId == null || codeOrId.trim().isEmpty()) {
            return Optional.empty();
        }

        String normalized = codeOrId.trim();
        Group byCode = groupRepository.findByCodeIgnoreCase(normalized);
        if (byCode != null) {
            return Optional.of(byCode);
        }

        try {
            Long numericId = Long.valueOf(normalized);
            return groupRepository.findById(numericId);
        } catch (NumberFormatException ignored) {
            return Optional.empty();
        }
    }

    public List<Map<String, Object>> getAllGroupsLight() {
        List<Group> groups = groupRepository.findAll();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Group group : groups) {
            result.add(buildGroupLight(group));
        }
        return result;
    }

    public List<Map<String, Object>> getGroupsForMember(Long memberId) {
        if (memberId == null) {
            return List.of();
        }

        List<Group> groups = groupRepository.findByMemberId(memberId);
        List<Map<String, Object>> result = new ArrayList<>();
        for (Group group : groups) {
            result.add(buildGroupLight(group, memberId));
        }
        return result;
    }

    public List<Map<String, Object>> getGroupsCreatedBy(Long memberId) {
        if (memberId == null) {
            return List.of();
        }

        List<Group> groups = groupRepository.findByCreatedById(memberId);
        List<Map<String, Object>> result = new ArrayList<>();
        for (Group group : groups) {
            result.add(buildGroupLight(group, memberId));
        }
        return result;
    }

    /**
     * Actualiza un grupo existente
     */
    public Group updateGroup(Long id, Group updatedGroup) throws Exception {
        Group existing = groupRepository.findById(id)
                .orElseThrow(() -> new Exception("Grupo no encontrado"));

        existing.setName(updatedGroup.getName());
        existing.setDescription(updatedGroup.getDescription());

        Group savedGroup = groupRepository.save(existing);

        java.util.Map<String, Object> updatedPayload = new java.util.HashMap<>();
        updatedPayload.put("groupId", savedGroup.getId());
        updatedPayload.put("name", savedGroup.getName());
        realTimeEventPublisher.publishGroupEvent(savedGroup.getId(), "group.updated", updatedPayload);

        return savedGroup;
    }

    /**
     * Elimina un grupo por su ID
     */
    @Transactional
    public Map<String, Object> deleteGroup(Long id, Long requestingUserId) {
        Map<String, Object> result = new HashMap<>();

        if (requestingUserId == null) {
            result.put("error", "Usuario solicitante inválido");
            result.put("reason", "FORBIDDEN");
            return result;
        }

        Optional<Group> groupOpt = groupRepository.findById(id);
        if (groupOpt.isEmpty()) {
            result.put("error", "Grupo no encontrado");
            result.put("reason", "NOT_FOUND");
            return result;
        }

        Group group = groupOpt.get();

        if (group.getCreatedBy() == null || group.getCreatedBy().getId() == null
                || !group.getCreatedBy().getId().equals(requestingUserId)) {
            result.put("error", "Solo el creador del grupo puede eliminarlo");
            result.put("reason", "FORBIDDEN");
            return result;
        }

        // Limpiar pagos y balances agregados antes de eliminar el grupo
        paymentService.deletePaymentsByGroup(id);

        List<com.apachehub.deudacero.entities.GroupShare> groupShares = groupShareRepository.findByGroupId(id);
        if (!groupShares.isEmpty()) {
            groupShareRepository.deleteAll(groupShares);
        }

        // Eliminar relaciones con miembros para limpiar la tabla pivote, conservar
        // lista para eventos
        List<Member> members = new ArrayList<>(group.getMembers());
        for (Member member : members) {
            group.removeMember(member);
        }
        if (!members.isEmpty()) {
            memberRepository.saveAll(members);
        }

        groupRepository.delete(group);

        result.put("success", true);
        result.put("message", "Grupo eliminado exitosamente");
        result.put("groupId", id);

        java.util.Map<String, Object> deletedPayload = new java.util.HashMap<>();
        deletedPayload.put("groupId", id);
        deletedPayload.put("deletedBy", requestingUserId);
        realTimeEventPublisher.publishGroupEvent(id, "group.deleted", deletedPayload);

        for (Member member : members) {
            if (member != null && member.getId() != null) {
                java.util.Map<String, Object> memberPayload = new java.util.HashMap<>();
                memberPayload.put("groupId", id);
                memberPayload.put("name", group.getName());
                memberPayload.put("reason", "deleted");
                memberPayload.put("timestamp", java.time.Instant.now().toString());
                realTimeEventPublisher.publishUserEvent(member.getId(), "user.group.deleted", memberPayload);
            }
        }
        return result;
    }

    /**
     * Permite a un miembro unirse a un grupo
     */
    public Member joinGroup(JoinGroupRequest request) throws Exception {
        Group group = findGroupByCodeOrId(request.getCode());
        if (group == null) {
            throw new Exception("Grupo no encontrado");
        }

        Member member = memberRepository.findById(request.getMemberId())
                .orElseThrow(() -> new Exception("Miembro no encontrado"));

        if (group.hasMember(member.getId())) {
            return member;
        }

        group.addMember(member);
        groupRepository.save(group);
        Member saved = memberRepository.save(member);

        // Si el cliente solicitó, re-split histórico automáticamente
        if (request.getApplyToHistory() != null && request.getApplyToHistory()) {
            try {
                expenseService.reSplitExpenses(group.getId());
            } catch (Exception e) {
                System.out.println("[GroupService] Error re-splitting expenses: " + e.getMessage());
            }
        }

        java.util.Map<String, Object> joinedPayload = new java.util.HashMap<>();
        joinedPayload.put("memberId", member.getId());
        joinedPayload.put("memberName", member.getName());
        joinedPayload.put("source", "joinCode");
        realTimeEventPublisher.publishGroupEvent(group.getId(), "group.member.joined", joinedPayload);

        if (member.getId() != null) {
            java.util.Map<String, Object> memberJoinedEvent = new java.util.HashMap<>();
            memberJoinedEvent.put("groupId", group.getId());
            memberJoinedEvent.put("name", group.getName());
            memberJoinedEvent.put("role", "member");
            memberJoinedEvent.put("source", "join");
            memberJoinedEvent.put("timestamp", java.time.Instant.now().toString());
            realTimeEventPublisher.publishUserEvent(member.getId(), "user.group.joined", memberJoinedEvent);
        }

        return saved;
    }

    /**
     * Obtiene los gastos de un grupo
     */
    public List<Expense> getExpensesByGroup(Long groupId) {
        return expenseRepository.findByGroupId(groupId);
    }

    /**
     * Busca un grupo por código de invitación o ID
     */
    private Group findGroupByCodeOrId(String code) {
        return findByCodeOrId(code).orElse(null);
    }

    /**
     * Genera un código de invitación único
     */
    private String generateUniqueJoinCode() {
        String joinCode;
        do {
            joinCode = UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        } while (groupRepository.findByCodeIgnoreCase(joinCode) != null);

        return joinCode;
    }

    /**
     * Genera un código QR en formato base64
     */
    private String generateQrCodeBase64(String text) {
        try {
            QRCodeWriter qrCodeWriter = new QRCodeWriter();
            BitMatrix bitMatrix = qrCodeWriter.encode(text, BarcodeFormat.QR_CODE, 200, 200);

            BufferedImage image = new BufferedImage(200, 200, BufferedImage.TYPE_INT_RGB);
            for (int x = 0; x < 200; x++) {
                for (int y = 0; y < 200; y++) {
                    image.setRGB(x, y, bitMatrix.get(x, y) ? 0xFF000000 : 0xFFFFFFFF);
                }
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(image, "png", baos);
            return Base64.getEncoder().encodeToString(baos.toByteArray());
        } catch (Exception e) {
            System.out.println("[GroupService] Error generando QR: " + e.getMessage());
            return null;
        }
    }

    /**
     * 📊 Obtiene los detalles completos de un grupo incluyendo miembros, gastos y
     * balances
     */
    public Optional<Map<String, Object>> getGroupDetails(Long id) {
        return getGroupById(id).map(this::buildGroupDetailsMap);
    }

    public Optional<Map<String, Object>> getGroupDetailsForViewer(Long id, Long viewerMemberId) {
        Optional<Group> groupOpt = getGroupById(id);
        if (groupOpt.isEmpty()) {
            return Optional.empty();
        }

        Group group = groupOpt.get();
        boolean isOwner = viewerMemberId != null && group.getCreatedBy() != null
                && viewerMemberId.equals(group.getCreatedBy().getId());
        boolean isMember = viewerMemberId != null && group.hasMember(viewerMemberId);

        if (!isOwner && !isMember) {
            throw new AccessDeniedException("El miembro no pertenece a este grupo");
        }

        return Optional.of(buildGroupDetailsMap(group));
    }

    private Map<String, Object> buildGroupDetailsMap(Group group) {
        Map<String, Object> groupDetails = new java.util.HashMap<>();

        // Información básica del grupo
        groupDetails.put("id", group.getId());
        groupDetails.put("name", group.getName());
        groupDetails.put("description", group.getDescription());
        groupDetails.put("createdAt", group.getCreatedAt());
        groupDetails.put("isActive", group.getIsActive());
        groupDetails.put("code", group.getCode());

        // Información del creador
        if (group.getCreatedBy() != null) {
            Map<String, Object> creatorInfo = new java.util.HashMap<>();
            creatorInfo.put("id", group.getCreatedBy().getId());
            creatorInfo.put("name", group.getCreatedBy().getName());
            creatorInfo.put("email", group.getCreatedBy().getEmail());
            groupDetails.put("createdBy", creatorInfo);
        }

        // Miembros del grupo (DTO ligero)
        List<Member> members = group.getMembers();
        List<Map<String, Object>> membersInfo = new ArrayList<>();
        if (members != null) {
            for (Member member : members) {
                Map<String, Object> memberInfo = new HashMap<>();
                memberInfo.put("id", member.getId());
                memberInfo.put("name", member.getName());
                memberInfo.put("email", member.getEmail());
                memberInfo.put("isGuest", member.isGuest());
                memberInfo.put("joinedAt", member.getCreatedAt());
                membersInfo.add(memberInfo);
            }
        }
        groupDetails.put("members", membersInfo);
        groupDetails.put("totalMembers", members != null ? members.size() : 0);

        // Gastos del grupo (DTO ligero)
        List<Expense> expenses = group.getExpenses();
        Map<Long, Double> totalPaidByMember = new HashMap<>();
        List<Map<String, Object>> expensesInfo = new ArrayList<>();
        if (expenses != null) {
            for (Expense expense : expenses) {
                Map<String, Object> expenseInfo = new HashMap<>();
                expenseInfo.put("id", expense.getId());
                expenseInfo.put("amount", expense.getAmount());
                expenseInfo.put("note", expense.getNote());
                expenseInfo.put("description", expense.getNote());
                expenseInfo.put("tag", expense.getTag());
                expenseInfo.put("currency", expense.getCurrency());

                // Info del pagador
                if (expense.getPayer() != null) {
                    Map<String, Object> payerInfo = new HashMap<>();
                    payerInfo.put("id", expense.getPayer().getId());
                    payerInfo.put("name", expense.getPayer().getName());
                    expenseInfo.put("payer", payerInfo);

                    Long payerId = expense.getPayer().getId();
                    if (payerId != null) {
                        double amountPaid = expense.getAmount() != null ? expense.getAmount() : 0.0;
                        double updatedTotal = MathUtils.roundToTwoDecimals(
                                totalPaidByMember.getOrDefault(payerId, 0.0) + amountPaid);
                        totalPaidByMember.put(payerId, updatedTotal);
                    }
                }

                expensesInfo.add(expenseInfo);

                // Shares agregadas del gasto
                if (expense.getShares() != null && !expense.getShares().isEmpty()) {
                    List<Map<String, Object>> shareInfos = new ArrayList<>();
                    for (Expense.ExpenseShareDTO shareDTO : expense.getShares()) {
                        Map<String, Object> shareInfo = new HashMap<>();
                        shareInfo.put("id", shareDTO.id);
                        if (shareDTO.member != null) {
                            shareInfo.put("memberId", shareDTO.member.getId());
                            shareInfo.put("memberName", shareDTO.member.getName());
                            shareInfo.put("memberEmail", shareDTO.member.getEmail());
                        }
                        if (shareDTO.amount != null) {
                            shareInfo.put("amount", MathUtils.roundToTwoDecimals(shareDTO.amount));
                        }
                        if (shareDTO.percentage != null) {
                            shareInfo.put("percentage", shareDTO.percentage);
                        }
                        shareInfos.add(shareInfo);
                    }
                    expenseInfo.put("shares", shareInfos);
                }

                // Detalle de items del gasto
                if (expense.getItems() != null && !expense.getItems().isEmpty()) {
                    List<Map<String, Object>> itemsInfo = new ArrayList<>();
                    for (ExpenseItem item : expense.getItems()) {
                        Map<String, Object> itemInfo = new HashMap<>();
                        itemInfo.put("id", item.getId());
                        itemInfo.put("description", item.getDescription());
                        itemInfo.put("amount", item.getAmount());
                        itemInfo.put("quantity", item.getQuantity());

                        if (item.getItemShares() != null && !item.getItemShares().isEmpty()) {
                            List<Map<String, Object>> itemSharesInfo = new ArrayList<>();
                            for (ExpenseItemShare itemShare : item.getItemShares()) {
                                Map<String, Object> itemShareInfo = new HashMap<>();
                                itemShareInfo.put("id", itemShare.getId());
                                if (itemShare.getMember() != null) {
                                    itemShareInfo.put("memberId", itemShare.getMember().getId());
                                    itemShareInfo.put("memberName", itemShare.getMember().getName());
                                    itemShareInfo.put("memberEmail", itemShare.getMember().getEmail());
                                }
                                if (itemShare.getAmount() != null) {
                                    itemShareInfo.put("amount", MathUtils.roundToTwoDecimals(itemShare.getAmount()));
                                } else {
                                    Double calculatedAmount = itemShare.getCalculatedAmount();
                                    if (calculatedAmount != null) {
                                        itemShareInfo.put("amount", MathUtils.roundToTwoDecimals(calculatedAmount));
                                    }
                                }
                                if (itemShare.getPercentage() != null) {
                                    itemShareInfo.put("percentage", itemShare.getPercentage());
                                }
                                if (itemShare.getShareType() != null) {
                                    itemShareInfo.put("shareType", itemShare.getShareType().name());
                                }
                                itemSharesInfo.add(itemShareInfo);
                            }
                            itemInfo.put("shares", itemSharesInfo);
                        }

                        itemsInfo.add(itemInfo);
                    }
                    expenseInfo.put("items", itemsInfo);
                }
            }
        }
        groupDetails.put("expenses", expensesInfo);
        groupDetails.put("totalExpenses", expenses != null ? expenses.size() : 0);

        // Calcular monto total
        double totalAmount = expenses != null ? expenses.stream().mapToDouble(Expense::getAmount).sum() : 0.0;
        groupDetails.put("totalAmount", totalAmount);

        // Promedio por miembro
        int memberCount = members != null ? members.size() : 0;
        double averagePerMember = memberCount > 0 ? totalAmount / memberCount : 0.0;
        groupDetails.put("averagePerMember", averagePerMember);

        // Obtener GroupShare agregados (totales por miembro)
        try {
            List<com.apachehub.deudacero.entities.GroupShare> groupShares = groupShareRepository
                    .findByGroupId(group.getId());
            Map<Long, com.apachehub.deudacero.entities.GroupShare> sharesByMember = new HashMap<>();
            for (com.apachehub.deudacero.entities.GroupShare groupShare : groupShares) {
                if (groupShare.getMember() != null && groupShare.getMember().getId() != null) {
                    sharesByMember.put(groupShare.getMember().getId(), groupShare);
                }
            }
            List<Map<String, Object>> aggregatedShares = new ArrayList<>();

            Map<Long, Double> originalBalances = new HashMap<>();
            Map<Long, Double> adjustedBalances = new HashMap<>();
            List<?> confirmedPayments = java.util.Collections.emptyList();
            List<?> pendingPayments = java.util.Collections.emptyList();

            try {
                Map<String, Object> balancesWithPayments = paymentService.getBalanceWithPayments(group.getId());
                if (balancesWithPayments != null) {
                    originalBalances = castBalanceMap(balancesWithPayments.get("originalBalances"));
                    adjustedBalances = castBalanceMap(balancesWithPayments.get("adjustedBalances"));

                    Object confirmedObj = balancesWithPayments.get("confirmedPayments");
                    if (confirmedObj instanceof List<?> list) {
                        confirmedPayments = list;
                    }

                    Object pendingObj = balancesWithPayments.get("pendingPayments");
                    if (pendingObj instanceof List<?> list) {
                        pendingPayments = list;
                    }
                }
            } catch (Exception e) {
                System.out.println("[GroupService] Error obteniendo balances con pagos: " + e.getMessage());
            }

            List<Member> membersList = members != null ? members : new ArrayList<>();
            for (Member member : membersList) {
                Long memberId = member.getId();
                com.apachehub.deudacero.entities.GroupShare memberShare = memberId != null
                        ? sharesByMember.get(memberId)
                        : null;

                double totalOwed = memberShare != null && memberShare.getAmountTotal() != null
                        ? MathUtils.roundToTwoDecimals(memberShare.getAmountTotal())
                        : 0.0;
                double totalPaid = MathUtils.roundToTwoDecimals(totalPaidByMember.getOrDefault(memberId, 0.0));
                double balanceBase = MathUtils.roundToTwoDecimals(totalPaid - totalOwed);
                double balanceBeforePayments = originalBalances.containsKey(memberId)
                        ? MathUtils.roundToTwoDecimals(originalBalances.get(memberId))
                        : balanceBase;
                double balanceAfterPayments = adjustedBalances.containsKey(memberId)
                        ? MathUtils.roundToTwoDecimals(adjustedBalances.get(memberId))
                        : balanceBeforePayments;
                double balanceAdjustment = MathUtils.roundToTwoDecimals(balanceAfterPayments - balanceBeforePayments);

                Map<String, Object> shareInfo = new java.util.HashMap<>();
                shareInfo.put("memberId", memberId);
                shareInfo.put("memberName", member.getName());
                shareInfo.put("totalPaid", totalPaid);
                shareInfo.put("totalOwed", totalOwed);
                shareInfo.put("balance", balanceAfterPayments);
                shareInfo.put("balanceBeforePayments", balanceBeforePayments);
                shareInfo.put("balanceAdjustment", balanceAdjustment);
                shareInfo.put("totalAmount", totalOwed);
                aggregatedShares.add(shareInfo);
            }

            groupDetails.put("aggregatedShares", aggregatedShares);
            groupDetails.put("balanceOriginal", originalBalances);
            groupDetails.put("balanceAdjusted", adjustedBalances);
            groupDetails.put("confirmedPayments", confirmedPayments);
            groupDetails.put("pendingPayments", pendingPayments);
        } catch (Exception e) {
            groupDetails.put("aggregatedShares", new ArrayList<>());
            groupDetails.put("balanceOriginal", new HashMap<Long, Double>());
            groupDetails.put("balanceAdjusted", new HashMap<Long, Double>());
            groupDetails.put("confirmedPayments", new ArrayList<>());
            groupDetails.put("pendingPayments", new ArrayList<>());
            System.out.println("[GroupService] Error agregando shares agregados: " + e.getMessage());
        }

        // Generar y agregar QR code
        String qrCodeBase64 = generateQRCode(group.getCode());
        groupDetails.put("qrCodeBase64", qrCodeBase64);

        return groupDetails;
    }

    /**
     * 👥 Agrega un miembro existente a un grupo
     */
    public Map<String, Object> addMemberToGroup(Long groupId, Long memberId) {
        Optional<Group> groupOpt = getGroupById(groupId);
        if (groupOpt.isEmpty()) {
            throw new RuntimeException("Grupo no encontrado");
        }

        Optional<Member> memberOpt = memberRepository.findById(memberId);
        if (memberOpt.isEmpty()) {
            throw new RuntimeException("Miembro no encontrado");
        }

        Member member = memberOpt.get();
        Group group = groupOpt.get();

        // Verificar si el miembro ya está en el grupo
        if (group.hasMember(member.getId())) {
            throw new IllegalArgumentException("El miembro ya pertenece a este grupo");
        }

        group.addMember(member);
        groupRepository.save(group);
        memberRepository.save(member);

        Map<String, Object> result = new java.util.HashMap<>();
        result.put("message", "Miembro agregado al grupo exitosamente");
        result.put("memberId", member.getId());
        result.put("groupId", group.getId());
        result.put("memberName", member.getName());
        result.put("groupName", group.getName());

        java.util.Map<String, Object> joinedByAdminPayload = new java.util.HashMap<>();
        joinedByAdminPayload.put("memberId", member.getId());
        joinedByAdminPayload.put("memberName", member.getName());
        joinedByAdminPayload.put("source", "admin");
        realTimeEventPublisher.publishGroupEvent(group.getId(), "group.member.joined", joinedByAdminPayload);

        if (member.getId() != null) {
            java.util.Map<String, Object> memberJoinedEvent = new java.util.HashMap<>();
            memberJoinedEvent.put("groupId", group.getId());
            memberJoinedEvent.put("name", group.getName());
            memberJoinedEvent.put("role", "member");
            memberJoinedEvent.put("source", "admin");
            memberJoinedEvent.put("timestamp", java.time.Instant.now().toString());
            realTimeEventPublisher.publishUserEvent(member.getId(), "user.group.joined", memberJoinedEvent);
        }

        return result;
    }

    /**
     * Crea un miembro invitado y lo agrega al grupo
     */
    public Member createGuestMemberAndAddToGroup(Long groupId, String memberName, String email) throws Exception {
        // Verificar que el grupo existe
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new Exception("Grupo no encontrado"));

        // Validar nombre requerido
        if (memberName == null || memberName.trim().isEmpty()) {
            throw new Exception("El nombre del miembro es requerido");
        }

        // Crear miembro invitado
        Member guestMember = new Member();
        guestMember.setName(memberName.trim());
        guestMember.setEmail(email);
        guestMember.setIsRegistered(false); // Marcar como invitado (no registrado)
        guestMember.setCreatedAt(java.time.LocalDateTime.now());

        // Guardar el miembro para obtener su ID
        Member savedMember = memberRepository.save(guestMember);

        // Asociar al miembro con el grupo
        group.addMember(savedMember);
        groupRepository.save(group);

        System.out.println("✅ Miembro invitado '" + memberName + "' (ID: " + savedMember.getId()
                + ") creado y agregado al grupo '" + group.getName() + "' (ID: " + group.getId() + ")");

        java.util.Map<String, Object> guestPayload = new java.util.HashMap<>();
        guestPayload.put("memberId", savedMember.getId());
        guestPayload.put("memberName", savedMember.getName());
        guestPayload.put("source", "guest");
        realTimeEventPublisher.publishGroupEvent(groupId, "group.member.joined", guestPayload);

        return savedMember;
    }

    /**
     * 🗑️ Elimina un miembro del grupo
     */
    public Map<String, Object> removeMemberFromGroup(Long groupId, Long memberId, Long requestingUserId) {
        Map<String, Object> result = new HashMap<>();

        try {
            // Verificar que el grupo existe
            Optional<Group> groupOpt = getGroupById(groupId);
            if (groupOpt.isEmpty()) {
                result.put("error", "Grupo no encontrado");
                return result;
            }
            Group group = groupOpt.get();

            // Verificar que el miembro existe
            Optional<Member> memberOpt = memberRepository.findById(memberId);
            if (memberOpt.isEmpty()) {
                result.put("error", "Miembro no encontrado");
                return result;
            }
            Member member = memberOpt.get();

            // Verificar que el miembro pertenece al grupo
            if (!group.hasMember(memberId)) {
                result.put("error", "El miembro no pertenece a este grupo");
                return result;
            }

            // Verificar permisos: solo el creador del grupo o el propio miembro pueden
            // eliminar
            Optional<Member> requestingMemberOpt = memberRepository.findById(requestingUserId);
            if (requestingMemberOpt.isEmpty()) {
                result.put("error", "Usuario solicitante no encontrado");
                return result;
            }
            Member requestingMember = requestingMemberOpt.get();

            boolean isGroupCreator = group.getCreatedBy() != null
                    && group.getCreatedBy().getId().equals(requestingUserId);
            boolean isSelfRemoval = requestingMember.getId().equals(memberId);

            if (!isGroupCreator && !isSelfRemoval) {
                result.put("error", "No tienes permisos para eliminar este miembro del grupo");
                return result;
            }

            // Verificar si el miembro tiene gastos pendientes
            boolean hasExpenses = expenseRepository.existsByGroupIdAndPayerId(groupId, memberId)
                    || expenseRepository.existsShareByGroupIdAndMemberId(groupId, memberId);
            if (hasExpenses) {
                result.put("error",
                        "No se puede eliminar el miembro porque tiene gastos asociados. Liquida primero todas las deudas.");
                return result;
            }

            // Guardar información del miembro antes de eliminarlo
            String memberName = member.getName();
            String memberEmail = member.getEmail();

            // Eliminar el miembro del grupo
            group.removeMember(member);
            groupRepository.save(group);

            // Si es un miembro invitado (no registrado) y no pertenece a otros grupos,
            // eliminarlo completamente
            if (!member.getIsRegistered() && (member.getGroups() == null || member.getGroups().isEmpty())) {
                memberRepository.delete(member);
                result.put("message", "Miembro invitado '" + memberName + "' eliminado del grupo exitosamente");
            } else {
                // Si es un miembro registrado, solo removerlo del grupo
                memberRepository.save(member);
                result.put("message", "Miembro '" + memberName + "' removido del grupo exitosamente");
            }

            result.put("success", true);
            result.put("removedMemberName", memberName);
            result.put("removedMemberEmail", memberEmail);
            result.put("groupName", group.getName());

            java.util.Map<String, Object> removedPayload = new java.util.HashMap<>();
            removedPayload.put("memberId", memberId);
            removedPayload.put("memberName", memberName);
            removedPayload.put("requestedBy", requestingUserId);
            realTimeEventPublisher.publishGroupEvent(groupId, "group.member.removed", removedPayload);

        } catch (Exception e) {
            result.put("error", "Error interno del servidor: " + e.getMessage());
            result.put("success", false);
        }

        return result;
    }

    /**
     * Genera un código QR en formato Base64 para el código del grupo
     */
    private String generateQRCode(String groupCode) {
        try {
            QRCodeWriter qrCodeWriter = new QRCodeWriter();
            BitMatrix bitMatrix = qrCodeWriter.encode(groupCode, BarcodeFormat.QR_CODE, 200, 200);

            BufferedImage bufferedImage = new BufferedImage(200, 200, BufferedImage.TYPE_INT_RGB);
            for (int x = 0; x < 200; x++) {
                for (int y = 0; y < 200; y++) {
                    bufferedImage.setRGB(x, y, bitMatrix.get(x, y) ? 0x000000 : 0xFFFFFF);
                }
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(bufferedImage, "png", baos);
            byte[] imageBytes = baos.toByteArray();

            return Base64.getEncoder().encodeToString(imageBytes);
        } catch (Exception e) {
            System.err.println("Error generando QR code: " + e.getMessage());
            return ""; // Retorna cadena vacía en caso de error
        }
    }

    private Map<Long, Double> castBalanceMap(Object balancesObj) {
        Map<Long, Double> result = new HashMap<>();
        if (balancesObj instanceof Map<?, ?> rawMap) {
            rawMap.forEach((key, value) -> {
                if (key instanceof Number && value instanceof Number) {
                    result.put(((Number) key).longValue(),
                            MathUtils.roundToTwoDecimals(((Number) value).doubleValue()));
                }
            });
        }
        return result;
    }
}