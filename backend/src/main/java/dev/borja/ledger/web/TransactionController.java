package dev.borja.ledger.web;

import com.fasterxml.jackson.databind.JsonNode;
import dev.borja.ledger.model.Transaction;
import dev.borja.ledger.repo.TransactionRepository;
import dev.borja.ledger.service.EntityPatcher;
import dev.borja.ledger.service.ReceiptService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
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
@RequestMapping("/api/transactions")
public class TransactionController {

    /** Campos que el cliente no puede fijar directamente. */
    private static final String[] SERVER_MANAGED = {"receiptUrl", "receiptPath", "recurringId"};

    private final TransactionRepository repo;
    private final EntityPatcher patcher;
    private final ReceiptService receipts;

    public TransactionController(TransactionRepository repo, EntityPatcher patcher, ReceiptService receipts) {
        this.repo = repo;
        this.patcher = patcher;
        this.receipts = receipts;
    }

    @GetMapping
    public List<TransactionResponse> list(@AuthenticationPrincipal Jwt jwt) {
        return repo.findByUidOrderByDateDesc(jwt.getSubject()).stream()
                .map(t -> TransactionResponse.from(t, receipts))
                .toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TransactionResponse create(@AuthenticationPrincipal Jwt jwt, @RequestBody JsonNode body) {
        String uid = jwt.getSubject();
        Transaction t = patcher.apply(new Transaction(), body, SERVER_MANAGED);
        t.uid = uid;
        t.receiptPath = body.hasNonNull("receiptUrl") ? receipts.pathFromUrl(body.get("receiptUrl").asText(), uid) : null;
        return TransactionResponse.from(repo.save(t), receipts);
    }

    @PatchMapping("/{id}")
    @Transactional
    public TransactionResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestBody JsonNode body) {
        String uid = jwt.getSubject();
        Transaction t = repo.findByIdAndUid(id, uid).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        String oldPath = t.receiptPath;
        patcher.apply(t, body, SERVER_MANAGED);
        if (body.has("receiptUrl")) {
            t.receiptPath = body.get("receiptUrl").isNull() ? null : receipts.pathFromUrl(body.get("receiptUrl").asText(), uid);
        }
        Transaction saved = repo.save(t);
        if (oldPath != null && !oldPath.equals(saved.receiptPath)) {
            receipts.delete(oldPath);
        }
        return TransactionResponse.from(saved, receipts);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        Transaction t = repo.findByIdAndUid(id, jwt.getSubject()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        String path = t.receiptPath;
        repo.delete(t);
        receipts.delete(path);
    }
}
