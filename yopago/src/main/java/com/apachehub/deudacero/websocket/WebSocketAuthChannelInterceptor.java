package com.apachehub.deudacero.websocket;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.stereotype.Component;

@Component
public class WebSocketAuthChannelInterceptor implements ChannelInterceptor {

    private static final String AUTHORIZATION_HEADER = "Authorization";

    private final JwtDecoder jwtDecoder;
    private final JwtAuthenticationConverter jwtAuthenticationConverter;

    public WebSocketAuthChannelInterceptor(JwtDecoder jwtDecoder,
            JwtAuthenticationConverter jwtAuthenticationConverter) {
        this.jwtDecoder = jwtDecoder;
        this.jwtAuthenticationConverter = jwtAuthenticationConverter;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) {
            return message;
        }

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            String authHeader = accessor.getFirstNativeHeader(AUTHORIZATION_HEADER);
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                throw new IllegalArgumentException("Token JWT requerido para la conexión WebSocket");
            }

            String token = authHeader.substring(7);
            Jwt jwt = jwtDecoder.decode(token);

            AbstractAuthenticationToken authentication = (AbstractAuthenticationToken) jwtAuthenticationConverter
                    .convert(jwt);
            if (authentication == null) {
                throw new IllegalArgumentException("Token inválido");
            }

            accessor.setUser(authentication);
        }

        return message;
    }
}
