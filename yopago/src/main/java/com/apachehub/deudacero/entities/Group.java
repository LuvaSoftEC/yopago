
package com.apachehub.deudacero.entities;

import jakarta.persistence.*;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.time.LocalDateTime;
import com.apachehub.deudacero.entities.Member;
import com.apachehub.deudacero.entities.Expense;
import lombok.Data;
import lombok.NoArgsConstructor;

@JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
@Entity
@Data
@NoArgsConstructor
@Table(name = "groups")
public class Group {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String name;
    private String code;
    private String description;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "is_active")
    private Boolean isActive = true;

    // 👑 CREADOR DEL GRUPO - Tiene permisos especiales
    @ManyToOne
    @JoinColumn(name = "created_by")
    private Member createdBy;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "group_members",
        joinColumns = @JoinColumn(name = "group_id"),
        inverseJoinColumns = @JoinColumn(name = "member_id"))
    private List<Member> members = new java.util.ArrayList<>();

    @OneToMany(mappedBy = "group", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Expense> expenses = new java.util.ArrayList<>();

    // Campo transiente para el QR code en base64 (no se persiste en BD)
    @Transient
    private String qrCodeBase64;

    // Campo calculado para contar miembros
    @JsonProperty("totalMembers")
    public int getTotalMembers() {
        return members != null ? members.size() : 0;
    }

    // Campo calculado para contar gastos
    @JsonProperty("totalExpenses")
    public int getTotalExpenses() {
        return expenses != null ? expenses.size() : 0;
    }

    public void addMember(Member member) {
        if (member == null) {
            return;
        }

        if (!this.members.contains(member)) {
            this.members.add(member);
        }

        member.addGroup(this);
    }

    public void removeMember(Member member) {
        if (member == null) {
            return;
        }

        if (this.members.remove(member)) {
            member.removeGroup(this);
        }
    }

    public boolean hasMember(Long memberId) {
        if (memberId == null) {
            return false;
        }

        return this.members.stream().anyMatch(m -> m != null && memberId.equals(m.getId()));
    }
}