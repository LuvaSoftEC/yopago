package com.apachehub.deudacero.services;

import com.apachehub.deudacero.entities.Expense;
import com.apachehub.deudacero.entities.Member;
import com.apachehub.deudacero.repositories.ExpenseRepository;
import com.apachehub.deudacero.repositories.MemberRepository;
import com.apachehub.deudacero.utils.MathUtils;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class SettlementService {

    private final ExpenseRepository expenseRepository;
    private final MemberRepository memberRepository;

    public SettlementService(ExpenseRepository expenseRepository, MemberRepository memberRepository) {
        this.expenseRepository = expenseRepository;
        this.memberRepository = memberRepository;
    }

    public Map<String, Object> calculateSettlement(Long groupId) {
        List<Member> members = memberRepository.findByGroupId(groupId);
        List<Expense> expenses = expenseRepository.findByGroupId(groupId);

        Map<Long, Double> balances = new HashMap<>();
        for (Member m : members) {
            balances.put(m.getId(), 0.0);
        }

        for (Expense expense : expenses) {
            // Primero, sumar el monto pagado al pagador
            Long payerId = expense.getPayerId();
            if (payerId != null && balances.containsKey(payerId)) {
                double payerBalance = balances.get(payerId);
                balances.put(payerId, MathUtils.roundToTwoDecimals(payerBalance + expense.getAmount()));
            }

            // Luego, restar a cada miembro su parte del gasto (incluyendo el pagador)
            if (expense.getShares() != null && !expense.getShares().isEmpty()) {
                // Si hay shares personalizados, usar esos montos
                for (Expense.ExpenseShareDTO share : expense.getShares()) {
                    Long memberId = share.member.getId();
                    double amount = share.amount != null ? share.amount : 0.0;
                    if (memberId != null && balances.containsKey(memberId)) {
                        double currentBalance = balances.get(memberId);
                        balances.put(memberId, MathUtils.roundToTwoDecimals(currentBalance - amount));
                    }
                }
            } else {
                // División igualitaria entre todos los miembros del grupo
                List<Member> groupMembers = expense.getGroup().getMembers();
                double split = MathUtils.roundToTwoDecimals(expense.getAmount() / groupMembers.size());
                for (Member member : groupMembers) {
                    Long memberId = member.getId();
                    if (memberId != null && balances.containsKey(memberId)) {
                        double currentBalance = balances.get(memberId);
                        balances.put(memberId, MathUtils.roundToTwoDecimals(currentBalance - split));
                    }
                }
            }
        }

        // Generar pagos mínimos (simplificado)
        List<Map<String, Object>> payments = new ArrayList<>();
        Map<Long, Double> debtors = new HashMap<>();
        Map<Long, Double> creditors = new HashMap<>();
        for (Map.Entry<Long, Double> entry : balances.entrySet()) {
            if (entry.getValue() < 0)
                debtors.put(entry.getKey(), MathUtils.roundToTwoDecimals(-entry.getValue()));
            else if (entry.getValue() > 0)
                creditors.put(entry.getKey(), MathUtils.roundToTwoDecimals(entry.getValue()));
        }

        for (Map.Entry<Long, Double> debtor : debtors.entrySet()) {
            double amountOwed = debtor.getValue();
            Iterator<Map.Entry<Long, Double>> creditorIt = creditors.entrySet().iterator();
            while (amountOwed > 0 && creditorIt.hasNext()) {
                Map.Entry<Long, Double> creditor = creditorIt.next();
                double pay = MathUtils.roundToTwoDecimals(Math.min(amountOwed, creditor.getValue()));
                if (pay > 0) {
                    payments.add(Map.of(
                            "from", debtor.getKey(),
                            "to", creditor.getKey(),
                            "amount", pay));
                    creditor.setValue(MathUtils.roundToTwoDecimals(creditor.getValue() - pay));
                    amountOwed = MathUtils.roundToTwoDecimals(amountOwed - pay);
                }
            }
        }

        return Map.of(
                "balances", balances,
                "payments", payments);
    }
}