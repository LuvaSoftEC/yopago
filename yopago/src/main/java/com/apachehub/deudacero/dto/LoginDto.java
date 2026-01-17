package com.apachehub.deudacero.dto;

import jakarta.validation.constraints.NotBlank;
import com.fasterxml.jackson.annotation.JsonProperty;

public class LoginDto {

    @NotBlank(message = "El correo o usuario es requerido")
    @JsonProperty("username")
    private String username;

    @NotBlank(message = "La contraseña es requerida")
    @JsonProperty("password")
    private String password;

    // Constructores
    public LoginDto() {
    }

    public LoginDto(String username, String password) {
        this.username = username;
        this.password = password;
    }

    // Getters y Setters
    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    @Override
    public String toString() {
        return "LoginDto{" +
                "username='" + username + '\'' +
                '}';
    }
}