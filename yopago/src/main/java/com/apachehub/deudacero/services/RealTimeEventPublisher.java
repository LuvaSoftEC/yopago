package com.apachehub.deudacero.services;

import java.util.HashMap;
import java.util.Map;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class RealTimeEventPublisher {

    private final SimpMessagingTemplate messagingTemplate;

    public RealTimeEventPublisher(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void publishGroupEvent(Long groupId, String eventType, Object payload) {
        if (groupId == null) {
            return;
        }
        Map<String, Object> event = buildEventPayload(eventType, payload, Map.of("groupId", groupId));
        messagingTemplate.convertAndSend("/topic/groups/" + groupId, event);
    }

    public void publishUserEvent(Long memberId, String eventType, Object payload) {
        if (memberId == null) {
            return;
        }
        Map<String, Object> event = buildEventPayload(eventType, payload, Map.of("memberId", memberId));
        messagingTemplate.convertAndSend("/topic/users/" + memberId + "/events", event);
    }

    private Map<String, Object> buildEventPayload(String eventType, Object payload, Map<String, Object> context) {
        Map<String, Object> event = new HashMap<>();
        event.put("type", eventType);
        if (payload != null) {
            event.put("payload", payload);
        }
        if (context != null && !context.isEmpty()) {
            event.putAll(context);
        }
        event.putIfAbsent("timestamp", java.time.Instant.now().toString());
        return event;
    }
}
