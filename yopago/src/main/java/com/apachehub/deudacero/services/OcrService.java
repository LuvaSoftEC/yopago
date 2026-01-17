
package com.apachehub.deudacero.services;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class OcrService {
    private final WebClient webClient;

    public OcrService(WebClient.Builder webClientBuilder,
            @Value("${vision-ia.service.base-url:http://vision-ia:8001}") String baseUrl) {
        this.webClient = webClientBuilder.baseUrl(baseUrl).build();
        System.out.println("[OcrService] Base URL: " + baseUrl);
    }

    public OcrResult analyzeImageBase64(String fileBase64) throws Exception {
        // Enviar la imagen como base64 al microservicio OCR
        Mono<String> responseMono = webClient.post()
                .uri("/vision-ia/base64")
                .contentType(MediaType.APPLICATION_JSON)
                .body(BodyInserters.fromValue(java.util.Map.of("fileBase64", fileBase64)))
                .retrieve()
                .bodyToMono(String.class);
        String response = responseMono.block();
        if (response == null)
            throw new Exception("No se obtuvo respuesta del OCR");
        ObjectMapper mapper = new ObjectMapper();
        JsonNode root = mapper.readTree(response);
        String text = root.has("text") ? root.get("text").asText() : null;
        Object structured = root.has("structured") ? mapper.convertValue(root.get("structured"), Object.class) : null;
        return new OcrResult(text, structured);
    }

    public OcrResult analyzeImage(MultipartFile imageFile) throws Exception {
        MultipartBodyBuilder builder = new MultipartBodyBuilder();
        builder.part("file", imageFile.getResource());
        Mono<String> responseMono = webClient.post()
                .uri("/vision-ia")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(BodyInserters.fromMultipartData(builder.build()))
                .retrieve()
                .bodyToMono(String.class);
        String response = responseMono.block();
        if (response == null)
            throw new Exception("No se obtuvo respuesta del OCR");
        // Parsear el JSON y extraer los campos
        ObjectMapper mapper = new ObjectMapper();
        JsonNode root = mapper.readTree(response);
        String text = root.has("text") ? root.get("text").asText() : null;
        Object structured = root.has("structured") ? mapper.convertValue(root.get("structured"), Object.class) : null;
        return new OcrResult(text, structured);
    }

    public static class OcrResult {
        public String text;
        public Object structured;

        public OcrResult() {
        }

        public OcrResult(String text, Object structured) {
            this.text = text;
            this.structured = structured;
        }
    }
}
