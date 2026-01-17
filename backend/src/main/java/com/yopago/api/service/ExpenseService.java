package com.yopago.api.service;

import com.yopago.api.model.Expense;
import com.yopago.api.repository.ExpenseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ExpenseService {
    
    private final ExpenseRepository expenseRepository;
    
    public List<Expense> getAllExpenses() {
        return expenseRepository.findAll();
    }
    
    public Optional<Expense> getExpenseById(Long id) {
        return expenseRepository.findById(id);
    }
    
    public List<Expense> getExpensesByGroupId(Long groupId) {
        return expenseRepository.findByGroupId(groupId);
    }
    
    public List<Expense> getExpensesByUser(String username) {
        return expenseRepository.findByPaidBy(username);
    }
    
    @Transactional
    public Expense createExpense(Expense expense) {
        return expenseRepository.save(expense);
    }
    
    @Transactional
    public Optional<Expense> updateExpense(Long id, Expense expenseDetails) {
        return expenseRepository.findById(id)
            .map(expense -> {
                expense.setDescription(expenseDetails.getDescription());
                expense.setAmount(expenseDetails.getAmount());
                expense.setCategory(expenseDetails.getCategory());
                return expenseRepository.save(expense);
            });
    }
    
    @Transactional
    public boolean deleteExpense(Long id) {
        if (expenseRepository.existsById(id)) {
            expenseRepository.deleteById(id);
            return true;
        }
        return false;
    }
}
