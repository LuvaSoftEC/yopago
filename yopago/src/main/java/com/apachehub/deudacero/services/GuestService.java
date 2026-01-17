package com.apachehub.deudacero.services;

import com.apachehub.deudacero.entities.*;
import com.apachehub.deudacero.dto.ExpenseDTO;
import com.apachehub.deudacero.repositories.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.ArrayList;
import java.util.Locale;
import java.util.Optional;

/**
 * 🎫 GUEST SERVICE
 * 
 * Maneja toda la lógica de negocio para usuarios invitados
 * que acceden a funcionalidades básicas usando códigos de grupo
 */
@Service
public class GuestService {

    @Autowired
    private GroupService groupService;

    @Autowired
    private MemberService memberService;

    @Autowired
    private ExpenseService expenseService;

    @Autowired
    private ExpenseRepository expenseRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private SettlementService settlementService;

    @Autowired
    private GroupInvitationService groupInvitationService;

    /**
     * 🔐 Permite el acceso de un invitado usando código de grupo
     */
    public Map<String, Object> accessWithGroupCode(String groupCode, String guestName, String email, String phoneNumber) {
        if (groupCode == null || guestName == null) {
            throw new IllegalArgumentException("groupCode y guestName son requeridos");
        }

        if (email == null || email.trim().isEmpty()) {
            throw new IllegalArgumentException("email es requerido");
        }

        try {
            Optional<Group> groupOpt = groupService.findByShareCode(groupCode);

            if (groupOpt.isEmpty()) {
                try {
                    Long maybeId = Long.valueOf(groupCode.trim());
                    groupOpt = groupService.findById(maybeId);
                } catch (NumberFormatException ignored) {
                    // No es un ID numérico
                }
            }

            if (groupOpt.isEmpty()) {
                throw new RuntimeException("Código de grupo inválido");
            }

            Group group = groupOpt.get();
            Member guestMember = resolveGuestMember(group, guestName, email, phoneNumber);

            return buildGuestAccessResponse(group, guestMember);

        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Error al procesar acceso de invitado: " + e.getMessage());
        }
    }

    public Map<String, Object> accessWithInvitation(String token, String guestName, String email, String phoneNumber) {
        if (token == null || token.trim().isEmpty()) {
            throw new IllegalArgumentException("token es requerido");
        }
        if (guestName == null || guestName.trim().isEmpty()) {
            throw new IllegalArgumentException("guestName es requerido");
        }
        if (email == null || email.trim().isEmpty()) {
            throw new IllegalArgumentException("email es requerido");
        }

        try {
            GroupInvitation invitation = groupInvitationService.validateForRedemption(token, email);
            Long groupId = invitation.getGroup().getId();

            Group group = groupService.findById(groupId)
                    .orElseThrow(() -> new RuntimeException("Grupo no encontrado para la invitación"));

            Member guestMember = resolveGuestMember(group, guestName, email, phoneNumber);
            groupInvitationService.registerUsage(invitation, guestMember);

            return buildGuestAccessResponse(group, guestMember);

        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Error al procesar la invitación: " + e.getMessage());
        }
    }

    /**
     * 👥 Obtiene información del grupo para un invitado
     */
    public Map<String, Object> getGroupInfo(Long groupId) {
        Optional<Group> groupOpt = groupService.findById(groupId);

        if (groupOpt.isEmpty()) {
            throw new RuntimeException("Grupo no encontrado");
        }

        Group group = groupOpt.get();
        List<Member> members = memberService.findByCurrentGroup(group);

        // Crear DTO ligero del grupo (solo información básica)
        Map<String, Object> groupInfo = new HashMap<>();
        groupInfo.put("id", group.getId());
        groupInfo.put("name", group.getName());
        groupInfo.put("description", group.getDescription());
        groupInfo.put("code", group.getCode());
        groupInfo.put("isActive", group.getIsActive());
        groupInfo.put("createdAt", group.getCreatedAt());

        List<Map<String, Object>> membersInfo = new ArrayList<>();
        for (Member member : members) {
            membersInfo.add(buildMemberSummary(member));
        }

        groupInfo.put("members", membersInfo);
        groupInfo.put("totalMembers", membersInfo.size());

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("group", groupInfo);
        response.put("members", membersInfo);
        response.put("totalMembers", membersInfo.size());

        return response;
    }

    /**
     * 💰 Obtiene los gastos del grupo para un invitado
     */
    public Map<String, Object> getGroupExpenses(Long groupId) {
        List<Expense> expenses = expenseRepository.findByGroupId(groupId);

        // Crear DTOs ligeros de los gastos (solo información básica)
        List<Map<String, Object>> expensesInfo = new ArrayList<>();
        for (Expense expense : expenses) {
            Map<String, Object> expenseInfo = new HashMap<>();
            expenseInfo.put("id", expense.getId());
            expenseInfo.put("amount", expense.getAmount());
            expenseInfo.put("note", expense.getNote());
            expenseInfo.put("tag", expense.getTag());
            expenseInfo.put("currency", expense.getCurrency());
            
            // Información básica del pagador
            if (expense.getPayer() != null) {
                Map<String, Object> payerInfo = new HashMap<>();
                payerInfo.put("id", expense.getPayer().getId());
                payerInfo.put("name", expense.getPayer().getName());
                expenseInfo.put("payer", payerInfo);
            }
            
            expensesInfo.add(expenseInfo);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("expenses", expensesInfo);
        response.put("totalExpenses", expensesInfo.size());

        return response;
    }

    /**
     * 🧮 Obtiene balances/liquidaciones para un invitado
     */
    public Map<String, Object> getSettlement(Long groupId) {
        Optional<Group> groupOpt = groupService.findById(groupId);

        if (groupOpt.isEmpty()) {
            throw new RuntimeException("Grupo no encontrado");
        }

        try {
            Map<String, Object> settlement = settlementService.calculateSettlement(groupId);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("settlement", settlement);

            return response;
        } catch (Exception e) {
            throw new RuntimeException("Error al calcular liquidaciones: " + e.getMessage());
        }
    }

    /**
     * ➕ Crea un gasto como invitado
     */
    public Map<String, Object> createExpense(Long groupId, Long memberId, Map<String, Object> expenseData) {
        try {
            // Crear ExpenseDTO para usar el servicio
            ExpenseDTO expenseDTO = new ExpenseDTO();
            expenseDTO.setNote((String) expenseData.get("description"));
            expenseDTO.setAmount(((Number) expenseData.get("amount")).doubleValue());
            expenseDTO.setCurrency("USD"); // Por defecto USD
            expenseDTO.setPayerId(memberId);
            expenseDTO.setGroupId(groupId);

            // Usar ExpenseService que crea shares automáticas
            Expense savedExpense = expenseService.createExpense(expenseDTO);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("expense", savedExpense);
            response.put("message", "Gasto creado exitosamente con shares automáticas");

            return response;
        } catch (Exception e) {
            throw new RuntimeException("Error al crear gasto: " + e.getMessage());
        }
    }

    /**
     * 🔄 Reasigna un gasto a otro miembro
     */
    public Map<String, Object> reassignExpense(Long expenseId, Long newPayerId, Long currentMemberId, Long groupId) {
        // Verificar permisos
        if (!canAssignExpense(currentMemberId, expenseId, groupId)) {
            throw new RuntimeException("Solo el creador del grupo o quien creó el gasto puede reasignarlo");
        }

        // Verificar que el gasto pertenece al grupo
        Expense expense = expenseService.findById(expenseId);
        if (expense == null || !expense.getGroup().getId().equals(groupId)) {
            throw new RuntimeException("No tienes acceso a este gasto");
        }

        // Verificar que el nuevo pagador es miembro del grupo
        Member newPayer = memberService.findByIdOrNull(newPayerId);
        if (newPayer == null || !newPayer.belongsToGroup(groupId)) {
            throw new RuntimeException("El pagador debe ser miembro del grupo");
        }

        // Actualizar el pagador
        expense.setPayer(newPayer);
        expenseRepository.save(expense);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Gasto reasignado exitosamente");
        response.put("expense", expense);

        return response;
    }

    /**
     * ✂️ Divide un gasto entre miembros específicos
     */
    public Map<String, Object> divideExpense(Long expenseId, List<Long> memberIds, String divisionType,
            Map<String, Double> divisionData, Long groupId) {
        // Verificar que el gasto pertenece al grupo
        Expense expense = expenseService.findById(expenseId);
        if (expense == null || !expense.getGroup().getId().equals(groupId)) {
            throw new RuntimeException("No tienes acceso a este gasto");
        }

        // Actualizar nota del gasto con información de división
        String divisionNote = String.format("Dividido entre %d miembros (%s)",
                memberIds.size(), divisionType);
        expense.setNote(expense.getNote() + " - " + divisionNote);
        expenseRepository.save(expense);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "División del gasto actualizada");
        response.put("expense", expense);
        response.put("division", Map.of(
                "memberIds", memberIds,
                "type", divisionType,
                "data", divisionData));

        return response;
    }

    /**
     * 🔐 Obtiene permisos del usuario invitado
     */
    public Map<String, Object> getPermissions(Long memberId, Long groupId) {
        boolean isCreator = isGroupCreator(memberId, groupId);

        Map<String, Object> permissions = new HashMap<>();
        permissions.put("isGroupCreator", isCreator);
        permissions.put("canAssignAnyExpense", isCreator);
        permissions.put("canAssignOwnExpenses", true);
        permissions.put("canViewAllExpenses", true);
        permissions.put("canCreateExpenses", true);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("permissions", permissions);
        response.put("message", isCreator ? "Eres el creador del grupo" : "Eres un miembro del grupo");

        return response;
    }

    /**
     * ✅ Valida si una sesión de invitado es válida
     */
    public boolean isValidGuestSession(Long guestGroupId, Long guestMemberId, String guestName) {
        return guestGroupId != null && guestMemberId != null && guestName != null && !guestName.trim().isEmpty();
    }

    private Member resolveGuestMember(Group group, String guestName, String email, String phoneNumber) {
        if (group == null) {
            throw new RuntimeException("Grupo no válido para invitados");
        }

        String trimmedName = guestName != null ? guestName.trim() : "";
        if (trimmedName.isEmpty()) {
            throw new RuntimeException("El nombre del invitado es requerido");
        }

        String normalizedEmail = normalizeEmail(email);
        if (normalizedEmail == null) {
            throw new RuntimeException("El correo electrónico es obligatorio para acceder como invitado");
        }

        String providedEmail = email.trim();
        String providedPhone = phoneNumber != null ? phoneNumber.trim() : null;

        Member guestMember = null;

        Optional<Member> existingByEmail = memberService.findByEmail(providedEmail);
        if (existingByEmail.isPresent()) {
            Member existing = existingByEmail.get();
            if (Boolean.TRUE.equals(existing.getIsRegistered())) {
                throw new RuntimeException("El correo pertenece a un usuario registrado. Inicia sesión para acceder.");
            }
            guestMember = existing;
        }

        if (guestMember == null) {
            guestMember = memberService.findByEmailAndGroup(normalizedEmail, group);
        }

        if (guestMember == null) {
            guestMember = memberService.findByNameAndGroup(trimmedName, group);
            if (guestMember != null) {
                String storedEmail = guestMember.getEmail();
                if (storedEmail != null && !storedEmail.trim().isEmpty()
                        && !storedEmail.equalsIgnoreCase(providedEmail)) {
                    throw new RuntimeException(
                            "El nombre ya está asociado a otro correo electrónico. Debes usar el mismo nombre y correo que registraste la primera vez.");
                }
            }
        }

        if (guestMember == null) {
            Member newMember = new Member();
            newMember.setName(trimmedName);
            newMember.setEmail(providedEmail);
            if (providedPhone != null && !providedPhone.isEmpty()) {
                newMember.setPhoneNumber(providedPhone);
            }
            newMember.setIsRegistered(false);
            newMember.setGuest(true);
            guestMember = memberService.save(newMember);
        } else {
            enforceNameAndEmailConsistency(guestMember, trimmedName, providedEmail);

            boolean updated = false;

            if (guestMember.getName() == null || guestMember.getName().trim().isEmpty()) {
                guestMember.setName(trimmedName);
                updated = true;
            }

            if (guestMember.getEmail() == null || guestMember.getEmail().trim().isEmpty()) {
                guestMember.setEmail(providedEmail);
                updated = true;
            }

            if (providedPhone != null && !providedPhone.isEmpty()
                    && (guestMember.getPhoneNumber() == null || guestMember.getPhoneNumber().trim().isEmpty())) {
                guestMember.setPhoneNumber(providedPhone);
                updated = true;
            }

            if (!guestMember.isGuest()) {
                guestMember.setGuest(true);
                updated = true;
            }

            if (guestMember.getIsRegistered() == null) {
                guestMember.setIsRegistered(false);
                updated = true;
            }

            if (updated) {
                guestMember = memberService.save(guestMember);
            }
        }

        if (!group.hasMember(guestMember.getId())) {
            groupService.addMemberToGroup(group.getId(), guestMember.getId());
        }

        return guestMember;
    }

    private void enforceNameAndEmailConsistency(Member member, String providedName, String providedEmail) {
        String normalizedStoredName = normalizeName(member.getName());
        String normalizedProvidedName = normalizeName(providedName);

        if (normalizedStoredName != null && normalizedProvidedName != null
                && !normalizedStoredName.equals(normalizedProvidedName)) {
            throw new RuntimeException(String.format(
                    "Debes ingresar exactamente el mismo nombre que usaste la primera vez (%s).", member.getName()));
        }

        String storedEmail = member.getEmail();
        if (storedEmail != null && !storedEmail.trim().isEmpty()
                && !storedEmail.equalsIgnoreCase(providedEmail)) {
            throw new RuntimeException("Debes usar el mismo correo electrónico que registraste en tu primer acceso.");
        }
    }

    private String normalizeName(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return null;
        }

        return trimmed.replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    private String normalizeEmail(String email) {
        if (email == null) {
            return null;
        }
        String trimmed = email.trim();
        return trimmed.isEmpty() ? null : trimmed.toLowerCase();
    }

    private Map<String, Object> buildGuestAccessResponse(Group group, Member guestMember) {
        Map<String, Object> groupInfo = new HashMap<>();
        groupInfo.put("id", group.getId());
        groupInfo.put("name", group.getName());
        groupInfo.put("description", group.getDescription());
        groupInfo.put("shareCode", group.getCode());

        Map<String, Object> memberInfo = buildMemberSummary(guestMember);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Acceso concedido como invitado");
        response.put("group", groupInfo);
        response.put("member", memberInfo);

        return response;
    }

    private Map<String, Object> buildMemberSummary(Member member) {
        Map<String, Object> memberInfo = new HashMap<>();
        memberInfo.put("id", member.getId());
        memberInfo.put("name", member.getName());
        memberInfo.put("email", member.getEmail());
        memberInfo.put("phoneNumber", member.getPhoneNumber());
        memberInfo.put("isRegistered", Boolean.TRUE.equals(member.getIsRegistered()));
        memberInfo.put("isGuest", member.isGuest());
        memberInfo.put("createdAt", member.getCreatedAt());
        return memberInfo;
    }

    public Map<String, Object> updateGuestPhone(Long memberId, String phoneNumber) {
        if (memberId == null) {
            throw new IllegalArgumentException("memberId es requerido");
        }

        String trimmedPhone = phoneNumber != null ? phoneNumber.trim() : null;
        if (trimmedPhone == null || trimmedPhone.isEmpty()) {
            throw new IllegalArgumentException("phoneNumber es requerido");
        }

        Member member = memberService.findByIdOrNull(memberId);
        if (member == null) {
            throw new RuntimeException("Miembro no encontrado");
        }

        member.setPhoneNumber(trimmedPhone);
        member = memberService.save(member);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Información de contacto actualizada");
        response.put("member", buildMemberSummary(member));
        return response;
    }

    public Map<String, Object> getMemberSummary(Long memberId) {
        Member member = memberService.findByIdOrNull(memberId);
        if (member == null) {
            throw new RuntimeException("Miembro no encontrado");
        }
        return buildMemberSummary(member);
    }

    /**
     * 👑 Verifica si el miembro es creador del grupo
     */
    private boolean isGroupCreator(Long memberId, Long groupId) {
        try {
            Optional<Group> groupOpt = groupService.findById(groupId);
            if (groupOpt.isPresent()) {
                Group group = groupOpt.get();
                return group.getCreatedBy() != null && group.getCreatedBy().getId().equals(memberId);
            }
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * � Registra un nuevo pago
     */
    public Map<String, Object> registerPayment(Long fromMemberId, Long toMemberId, Long groupId, Double amount,
            String note) {
        // Validar que el grupo exista
        Optional<Group> groupOpt = groupService.findById(groupId);
        if (groupOpt.isEmpty()) {
            throw new RuntimeException("Grupo no encontrado");
        }
        Group group = groupOpt.get();

        // Validar que los miembros existan
        Member fromMember = memberService.findByIdOrNull(fromMemberId);
        Member toMember = memberService.findByIdOrNull(toMemberId);

        if (fromMember == null) {
            throw new RuntimeException("Miembro pagador no encontrado");
        }
        if (toMember == null) {
            throw new RuntimeException("Miembro receptor no encontrado");
        }

        // Validar que ambos miembros pertenezcan al grupo
        if (!fromMember.belongsToGroup(groupId) || !toMember.belongsToGroup(groupId)) {
            throw new RuntimeException("Los miembros deben pertenecer al mismo grupo");
        }

        // Crear y guardar el pago
        Payment payment = new Payment();
        payment.setFromMember(fromMember);
        payment.setToMember(toMember);
        payment.setGroup(group);
        payment.setAmount(amount);
        payment.setNote(note);
        payment.setCreatedAt(java.time.LocalDateTime.now());
        payment.setConfirmed(false);
        payment.setCurrency("USD");

        payment = paymentRepository.save(payment);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("paymentId", payment.getId());
        response.put("message", "Pago registrado exitosamente");
        return response;
    }

    /**
     * 👀 Obtener pagos del grupo para invitados
     */
    public Map<String, Object> getGroupPayments(Long groupId) {
        // Validar que el grupo exista
        Optional<Group> groupOpt = groupService.findById(groupId);
        if (groupOpt.isEmpty()) {
            throw new RuntimeException("Grupo no encontrado");
        }

        // Obtener todos los pagos del grupo
        List<Payment> payments = paymentRepository.findByGroupIdOrderByCreatedAtDesc(groupId);

        // Crear lista ligera de pagos para evitar referencias circulares
        List<Map<String, Object>> paymentsInfo = new ArrayList<>();
        for (Payment payment : payments) {
            Map<String, Object> paymentInfo = new HashMap<>();
            paymentInfo.put("id", payment.getId());
            paymentInfo.put("amount", payment.getAmount());
            paymentInfo.put("currency", payment.getCurrency());
            paymentInfo.put("note", payment.getNote());
            paymentInfo.put("confirmed", payment.getConfirmed());
            paymentInfo.put("createdAt", payment.getCreatedAt());

            // Información del pagador
            Map<String, Object> fromMemberInfo = new HashMap<>();
            fromMemberInfo.put("id", payment.getFromMember().getId());
            fromMemberInfo.put("name", payment.getFromMember().getName());
            fromMemberInfo.put("isGuest", payment.getFromMember().isGuest());
            paymentInfo.put("fromMember", fromMemberInfo);

            // Información del receptor
            Map<String, Object> toMemberInfo = new HashMap<>();
            toMemberInfo.put("id", payment.getToMember().getId());
            toMemberInfo.put("name", payment.getToMember().getName());
            toMemberInfo.put("isGuest", payment.getToMember().isGuest());
            paymentInfo.put("toMember", toMemberInfo);

            paymentsInfo.add(paymentInfo);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("payments", paymentsInfo);
        response.put("total", paymentsInfo.size());
        response.put("message", "Pagos obtenidos exitosamente");
        return response;
    }

    /**
     * ✅ Confirmar pago como invitado
     */
    public Map<String, Object> confirmPayment(Long paymentId, Long guestMemberId, Long groupId) {
        // Buscar el pago
        Optional<Payment> paymentOpt = paymentRepository.findById(paymentId);
        if (paymentOpt.isEmpty()) {
            throw new RuntimeException("Pago no encontrado");
        }
        
        Payment payment = paymentOpt.get();

        // Validar que el pago pertenece al grupo del invitado
        if (!payment.getGroup().getId().equals(groupId)) {
            throw new RuntimeException("El pago no pertenece a tu grupo");
        }

        // Validar que el invitado puede confirmar este pago
        // Solo el pagador (fromMember) o el receptor (toMember) pueden confirmar
        if (!payment.getFromMember().getId().equals(guestMemberId) && 
            !payment.getToMember().getId().equals(guestMemberId)) {
            throw new RuntimeException("No tienes permisos para confirmar este pago");
        }

        // Verificar si ya está confirmado
        if (payment.getConfirmed() != null && payment.getConfirmed()) {
            throw new RuntimeException("El pago ya está confirmado");
        }

        // Confirmar el pago
        payment.setConfirmed(true);
        payment = paymentRepository.save(payment);

        // Crear respuesta ligera
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("paymentId", payment.getId());
        response.put("message", "Pago confirmado exitosamente");
        
        // Información del pago confirmado
        Map<String, Object> paymentInfo = new HashMap<>();
        paymentInfo.put("id", payment.getId());
        paymentInfo.put("amount", payment.getAmount());
        paymentInfo.put("currency", payment.getCurrency());
        paymentInfo.put("note", payment.getNote());
        paymentInfo.put("confirmed", payment.getConfirmed());
        paymentInfo.put("createdAt", payment.getCreatedAt());
        
        response.put("payment", paymentInfo);
        return response;
    }

    /**
     * �🔐 Verifica permisos para asignar/reasignar gastos
     */
    private boolean canAssignExpense(Long memberId, Long expenseId, Long groupId) {
        try {
            // Si es creador del grupo, tiene permisos completos
            if (isGroupCreator(memberId, groupId)) {
                return true;
            }

            // Si no es creador, solo puede asignar gastos que él mismo creó
            Expense expense = expenseService.findById(expenseId);
            if (expense != null && expense.getPayer() != null) {
                return expense.getPayer().getId().equals(memberId);
            }

            return false;
        } catch (Exception e) {
            return false;
        }
    }
}