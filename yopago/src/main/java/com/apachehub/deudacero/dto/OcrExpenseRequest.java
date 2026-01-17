package com.apachehub.deudacero.dto;

import java.util.List;
import lombok.Data;

@Data
public class OcrExpenseRequest {
    private String fileBase64;
    private Long payerId;
    private Long groupId;
    private String currency;
    private String note;
    private List<ExpenseDTO.ShareDTO> shares;
}
