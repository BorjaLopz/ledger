package dev.borja.ledger.web;

import dev.borja.ledger.model.Warranty;
import dev.borja.ledger.repo.WarrantyRepository;
import dev.borja.ledger.service.ReceiptService;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/** Garantias para el bot de Telegram (mismo acceso que BotController: clave del bot, rol BOT). */
@RestController
@RequestMapping("/api/bot/warranties")
public class BotWarrantyController {

    public record WarrantyInput(String name, LocalDate purchaseDate, Integer months, String note) {}

    public record WarrantyResponse(String id, String name, LocalDate purchaseDate, int months, LocalDate expiresOn,
                                   long daysLeft, String note, String receiptUrl) {}

    private final WarrantyRepository warranties;
    private final ReceiptService receipts;
    private final ZoneId zone;

    public BotWarrantyController(WarrantyRepository warranties, ReceiptService receipts,
                                 @Value("${app.timezone}") String timezone) {
        this.warranties = warranties;
        this.receipts = receipts;
        this.zone = ZoneId.of(timezone);
    }

    private WarrantyResponse toResponse(Warranty w) {
        LocalDate expires = w.expiresOn();
        long left = ChronoUnit.DAYS.between(LocalDate.now(zone), expires);
        return new WarrantyResponse(w.id, w.name, w.purchaseDate, w.months, expires, left, w.note,
                receipts.signedUrl(w.receiptPath));
    }

    /** Ordenadas por fecha de caducidad (las que antes caducan, primero; las ya caducadas al principio). */
    @GetMapping
    public List<WarrantyResponse> list(@AuthenticationPrincipal Jwt jwt) {
        return warranties.findByUid(jwt.getSubject()).stream()
                .sorted(Comparator.comparing(Warranty::expiresOn))
                .map(this::toResponse)
                .toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WarrantyResponse create(@AuthenticationPrincipal Jwt jwt, @RequestBody WarrantyInput in) {
        String name = in == null || in.name() == null ? "" : in.name().trim();
        if (name.isEmpty() || name.length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El nombre debe tener entre 1 y 100 caracteres");
        }
        if (in.months() == null || in.months() < 1 || in.months() > 120) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "months debe estar entre 1 y 120");
        }
        String note = in.note() == null ? "" : in.note().trim();
        if (note.length() > 500) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La nota es demasiado larga");
        }
        Warranty w = new Warranty();
        w.uid = jwt.getSubject();
        w.name = name;
        w.purchaseDate = in.purchaseDate() != null ? in.purchaseDate() : LocalDate.now(zone);
        w.months = in.months();
        w.note = note;
        return toResponse(warranties.save(w));
    }

    @PostMapping("/{id}/receipt")
    @Transactional
    public WarrantyResponse attachReceipt(@AuthenticationPrincipal Jwt jwt, @PathVariable String id,
                                          @RequestParam("file") MultipartFile file) {
        String uid = jwt.getSubject();
        Warranty w = warranties.findByIdAndUid(id, uid)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        String old = w.receiptPath;
        w.receiptPath = receipts.store(uid, file);
        Warranty saved = warranties.save(w);
        receipts.delete(old);
        return toResponse(saved);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        Warranty w = warranties.findByIdAndUid(id, jwt.getSubject())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        String path = w.receiptPath;
        warranties.delete(w);
        receipts.delete(path);
    }
}
