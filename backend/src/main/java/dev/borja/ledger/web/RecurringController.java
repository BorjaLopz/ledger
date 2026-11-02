package dev.borja.ledger.web;

import com.fasterxml.jackson.databind.JsonNode;
import dev.borja.ledger.model.RecurringPayment;
import dev.borja.ledger.repo.RecurringRepository;
import dev.borja.ledger.service.EntityPatcher;
import dev.borja.ledger.service.RecurringService;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/recurring")
public class RecurringController {

    private final RecurringRepository repo;
    private final EntityPatcher patcher;
    private final RecurringService service;

    public RecurringController(RecurringRepository repo, EntityPatcher patcher, RecurringService service) {
        this.repo = repo;
        this.patcher = patcher;
        this.service = service;
    }

    @GetMapping
    public List<RecurringPayment> list(@AuthenticationPrincipal Jwt jwt) {
        return repo.findByUid(jwt.getSubject());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RecurringPayment create(@AuthenticationPrincipal Jwt jwt, @RequestBody JsonNode body) {
        RecurringPayment r = patcher.apply(new RecurringPayment(), body);
        r.uid = jwt.getSubject();
        return repo.save(r);
    }

    @PatchMapping("/{id}")
    public RecurringPayment update(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestBody JsonNode body) {
        RecurringPayment r = repo.findByIdAndUid(id, jwt.getSubject()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        patcher.apply(r, body);
        return repo.save(r);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        RecurringPayment r = repo.findByIdAndUid(id, jwt.getSubject()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        repo.delete(r);
    }

    /** Materializa los recurrentes vencidos como transacciones. Devuelve cuantas se crearon. */
    @PostMapping("/sync")
    public Map<String, Integer> sync(@AuthenticationPrincipal Jwt jwt) {
        return Map.of("created", service.sync(jwt.getSubject()));
    }
}
