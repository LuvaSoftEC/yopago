package com.apachehub.deudacero.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class ChangePasswordDTO {
    
    @NotBlank(message = "La contraseña actual es requerida")
    private String currentPassword;
    
    @NotBlank(message = "La nueva contraseña es requerida")
    @Size(min = 8, max = 100, message = "La nueva contraseña debe tener entre 8 y 100 caracteres")
    private String newPassword;
    
    @NotBlank(message = "La confirmación de la nueva contraseña es requerida")
    private String confirmNewPassword;
    
    // Constructors
    public ChangePasswordDTO() {}
    
    public ChangePasswordDTO(String currentPassword, String newPassword, String confirmNewPassword) {
        this.currentPassword = currentPassword;
        this.newPassword = newPassword;
        this.confirmNewPassword = confirmNewPassword;
    }
    
    // Getters and Setters
    public String getCurrentPassword() {
        return currentPassword;
    }
    
    public void setCurrentPassword(String currentPassword) {
        this.currentPassword = currentPassword;
    }
    
    public String getNewPassword() {
        return newPassword;
    }
    
    public void setNewPassword(String newPassword) {
        this.newPassword = newPassword;
    }
    
    public String getConfirmNewPassword() {
        return confirmNewPassword;
    }
    
    public void setConfirmNewPassword(String confirmNewPassword) {
        this.confirmNewPassword = confirmNewPassword;
    }
    
    // Validation methods
    public boolean newPasswordsMatch() {
        return newPassword != null && newPassword.equals(confirmNewPassword);
    }
    
    public boolean isCurrentPasswordDifferentFromNew() {
        return currentPassword != null && !currentPassword.equals(newPassword);
    }
    
    @Override
    public String toString() {
        return "ChangePasswordDTO{" +
                "currentPassword='[HIDDEN]'" +
                ", newPassword='[HIDDEN]'" +
                ", confirmNewPassword='[HIDDEN]'" +
                '}';
    }
}