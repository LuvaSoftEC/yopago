package com.apachehub.deudacero.controllers;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import com.apachehub.deudacero.entities.Member;
import com.apachehub.deudacero.services.MemberService;
import jakarta.validation.Valid;
import java.util.List;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/members")
@Tag(name = "Members", description = "API para gestión de miembros")
public class MemberController {

    private final MemberService memberService;

    public MemberController(MemberService memberService) {
        this.memberService = memberService;
    }

    @Operation(summary = "Obtener todos los miembros")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Lista de miembros obtenida exitosamente")
    })
    @GetMapping
    public ResponseEntity<List<Member>> getAllMembers() {
        List<Member> members = memberService.getAllMembers();
        return ResponseEntity.ok(members);
    }

    @Operation(summary = "Obtener miembro por ID")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Miembro encontrado"),
            @ApiResponse(responseCode = "404", description = "Miembro no encontrado")
    })
    @GetMapping("/{id}")
    public ResponseEntity<Member> getMemberById(@PathVariable Long id) {
        return memberService.getMemberById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Operation(summary = "Crear nuevo miembro")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "201", description = "Miembro creado exitosamente"),
            @ApiResponse(responseCode = "400", description = "Datos de entrada inválidos")
    })
    @PostMapping
    public ResponseEntity<Member> createMember(@Valid @RequestBody Member member) {
        Member createdMember = memberService.createMember(member);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdMember);
    }

    @Operation(summary = "Actualizar miembro existente")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Miembro actualizado exitosamente"),
            @ApiResponse(responseCode = "404", description = "Miembro no encontrado"),
            @ApiResponse(responseCode = "400", description = "Datos de entrada inválidos")
    })
    @PutMapping("/{id}")
    public ResponseEntity<Member> updateMember(@PathVariable Long id, @Valid @RequestBody Member member) {
        try {
            Member updatedMember = memberService.updateMember(id, member);
            return ResponseEntity.ok(updatedMember);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @Operation(summary = "Eliminar miembro")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "204", description = "Miembro eliminado exitosamente"),
            @ApiResponse(responseCode = "404", description = "Miembro no encontrado")
    })
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMember(@PathVariable Long id) {
        boolean deleted = memberService.deleteMember(id);
        if (deleted) {
            return ResponseEntity.noContent().build();
        } else {
            return ResponseEntity.notFound().build();
        }
    }

    @Operation(summary = "Obtener solo miembros registrados (autenticados)")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Lista de miembros registrados obtenida exitosamente")
    })
    @GetMapping("/registered")
    public ResponseEntity<List<Member>> getRegisteredMembers() {
        List<Member> registeredMembers = memberService.getRegisteredMembers();
        return ResponseEntity.ok(registeredMembers);
    }

    @Operation(summary = "Obtener solo miembros invitados (no autenticados)")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Lista de miembros invitados obtenida exitosamente")
    })
    @GetMapping("/guests")
    public ResponseEntity<List<Member>> getGuestMembers() {
        List<Member> guestMembers = memberService.getGuestMembers();
        return ResponseEntity.ok(guestMembers);
    }
}
