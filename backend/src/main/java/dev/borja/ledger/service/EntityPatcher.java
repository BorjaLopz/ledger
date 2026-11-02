package dev.borja.ledger.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Aplica un cuerpo JSON (completo o parcial) sobre una entidad y la valida.
 * Solo se tocan los campos presentes en el JSON; un null explicito pone el campo a null.
 * Equivale al updateDoc() parcial de Firestore que usaba el frontend.
 */
@Component
public class EntityPatcher {

    private static final List<String> ALWAYS_IGNORED = List.of("id", "uid", "createdAt");

    private final ObjectMapper mapper;
    private final Validator validator;

    public EntityPatcher(ObjectMapper mapper, Validator validator) {
        this.mapper = mapper;
        this.validator = validator;
    }

    public <T> T apply(T target, JsonNode body, String... extraIgnored) {
        if (body == null || !body.isObject()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Se esperaba un objeto JSON");
        }
        ObjectNode copy = ((ObjectNode) body).deepCopy();
        copy.remove(ALWAYS_IGNORED);
        copy.remove(Arrays.asList(extraIgnored));
        try {
            mapper.readerForUpdating(target).readValue(copy);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "JSON no valido");
        }
        Set<ConstraintViolation<T>> violations = validator.validate(target);
        if (!violations.isEmpty()) {
            String detail = violations.stream()
                    .map(v -> v.getPropertyPath() + " " + v.getMessage())
                    .sorted()
                    .collect(Collectors.joining("; "));
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, detail);
        }
        return target;
    }
}
