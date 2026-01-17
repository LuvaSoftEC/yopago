package com.apachehub.deudacero.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class ApiResponseDto {

    @JsonProperty("success")
    private boolean success;

    @JsonProperty("message")
    private String message;

    @JsonProperty("data")
    private Object data;

    @JsonProperty("timestamp")
    private long timestamp;

    // Constructores
    public ApiResponseDto() {
        this.timestamp = System.currentTimeMillis();
    }

    public ApiResponseDto(boolean success, String message) {
        this();
        this.success = success;
        this.message = message;
    }

    public ApiResponseDto(boolean success, String message, Object data) {
        this();
        this.success = success;
        this.message = message;
        this.data = data;
    }

    // Getters y Setters
    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public Object getData() {
        return data;
    }

    public void setData(Object data) {
        this.data = data;
    }

    public long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(long timestamp) {
        this.timestamp = timestamp;
    }
}