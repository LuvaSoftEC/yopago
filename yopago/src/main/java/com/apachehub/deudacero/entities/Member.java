package com.apachehub.deudacero.entities;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;
import java.time.LocalDateTime;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Data
@NoArgsConstructor
@JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
public class Member {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    // Campos para usuarios registrados
    @Column(unique = true, nullable = true)
    private String keycloakUserId; // UUID del usuario en Keycloak

    @Column(unique = true, nullable = true)
    private String email; // Email del usuario registrado

    @Column(unique = true, nullable = true)
    private String username; // Username de Keycloak

    @Column(name = "phone_number", length = 32)
    private String phoneNumber;

    @Column(name = "is_registered")
    private Boolean isRegistered = false; // true si tiene cuenta, false si es solo invitado

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "last_login")
    private LocalDateTime lastLogin;

    @ManyToMany(mappedBy = "members")
    @JsonIgnore
    private List<Group> groups = new java.util.ArrayList<>();

    @OneToMany(mappedBy = "payer", cascade = CascadeType.ALL)
    @JsonIgnore
    private List<Expense> paidExpenses;

    @Column(name = "is_guest")
    private boolean guest = false;

    public boolean isGuest() {
        return guest;
    }

    public void setGuest(boolean guest) {
        this.guest = guest;
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    // Constructor para usuarios registrados
    public Member(String keycloakUserId, String username, String email, String name) {
        this.keycloakUserId = keycloakUserId;
        this.username = username;
        this.email = email;
        this.name = name;
        this.isRegistered = true;
        this.createdAt = LocalDateTime.now();
    }

    // Constructor para invitados (sin cuenta)
    public Member(String name) {
        this.name = name;
        this.isRegistered = false;
        this.createdAt = LocalDateTime.now();
    }

    public void addGroup(Group group) {
        if (group == null) {
            return;
        }

        if (!this.groups.contains(group)) {
            this.groups.add(group);
        }
    }

    public void removeGroup(Group group) {
        if (group == null) {
            return;
        }

        this.groups.remove(group);
    }

    public boolean belongsToGroup(Long groupId) {
        if (groupId == null) {
            return false;
        }

        return this.groups.stream().anyMatch(g -> g != null && groupId.equals(g.getId()));
    }
}
