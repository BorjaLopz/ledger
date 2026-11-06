package dev.borja.ledger.web;

import com.fasterxml.jackson.databind.JsonNode;
import dev.borja.ledger.model.Category;
import dev.borja.ledger.model.RecurringPayment;
import dev.borja.ledger.repo.CategoryRepository;
import dev.borja.ledger.repo.RecurringRepository;
import dev.borja.ledger.service.RecurringService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
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

/** Pagos recurrentes para el bot de Telegram (mismo acceso que BotController: clave del bot, rol BOT). */
@RestController
@RequestMapping("/api/bot/recurring")
public class BotRecurringController {

    public record RecurringInput(String type, BigDecimal amount, String categoryId, String frequency,
                                 LocalDate nextDate, String note) {}

    private final RecurringRepository recurring;
    private final CategoryRepository categories;
    private final RecurringService service;
    private final ZoneId zone;

    public BotRecurringController(RecurringRepository recurring, CategoryRepository categories,
                                  RecurringService service, @Value("${app.timezone}") String timezone) {
        this.recurring = recurring;
        this.categories = categories;
        this.service = service;
        this.zone = ZoneId.of(timezone);
    }

    private static BigDecimal checkAmount(BigDecimal amount) {
        if (amount == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "amount obligatorio");
        }
        BigDecimal a = amount.setScale(2, RoundingMode.HALF_UP);
        if (a.signum() <= 0 || a.compareTo(new BigDecimal("999999999999")) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Importe no valido");
        }
        return a;
    }

    /** Primero los activos, luego por proxima fecha. */
    @GetMapping
    public List<RecurringPayment> list(@AuthenticationPrincipal Jwt jwt) {
        return recurring.findByUid(jwt.getSubject()).stream()
                .sorted(Comparator.comparing((RecurringPayment r) -> !r.active).thenComparing(r -> r.nextDate))
                .toList();
    }

    /** Crea el pago. nextDate = proximo cobro (hoy o futuro; por defecto hoy). Si toca hoy se registra al momento. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public RecurringPayment create(@AuthenticationPrincipal Jwt jwt, @RequestBody RecurringInput in) {
        String uid = jwt.getSubject();
        if (in == null || in.type() == null || !(in.type().equals("expense") || in.type().equals("income"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "type debe ser expense o income");
        }
        if (in.frequency() == null || !List.of("weekly", "monthly", "yearly").contains(in.frequency())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "frequency debe ser weekly, monthly o yearly");
        }
        Category c = categories.findByIdAndUid(in.categoryId() == null ? "" : in.categoryId(), uid)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Categoria no valida"));
        if (!c.type.equals(in.type())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La categoria no es del mismo tipo");
        }
        LocalDate today = LocalDate.now(zone);
        LocalDate next = in.nextDate() == null ? today : in.nextDate();
        if (next.isBefore(today)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El primer cobro no puede estar en el pasado");
        }
        String note = in.note() == null ? "" : in.note().trim();
        if (note.length() > 500) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La nota es demasiado larga");
        }
        RecurringPayment r = new RecurringPayment();
        r.uid = uid;
        r.type = in.type();
        r.amount = checkAmount(in.amount());
        r.categoryId = c.id;
        r.frequency = in.frequency();
        r.nextDate = next;
        r.active = true;
        r.note = note;
        RecurringPayment saved = recurring.saveAndFlush(r);
        if (!next.isAfter(today)) {
            service.sync(uid); // registra ya el cobro de hoy
            return recurring.findById(saved.id).orElse(saved);
        }
        return saved;
    }

    /** Pausa/reanuda ("active") y/o cambia el importe. */
    @PatchMapping("/{id}")
    @Transactional
    public RecurringPayment update(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestBody JsonNode body) {
        RecurringPayment r = recurring.findByIdAndUid(id, jwt.getSubject())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (body == null || !body.isObject()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Se esperaba un objeto JSON");
        }
        if (body.hasNonNull("active")) {
            if (!body.get("active").isBoolean()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "active debe ser true o false");
            }
            r.active = body.get("active").asBoolean();
            if (r.active && r.nextDate.isBefore(LocalDate.now(zone))) {
                // al reanudar no se cobran de golpe los periodos en que estuvo pausado
                LocalDate today = LocalDate.now(zone);
                LocalDate next = r.nextDate;
                while (next.isBefore(today)) {
                    next = switch (r.frequency) {
                        case "weekly" -> next.plusWeeks(1);
                        case "monthly" -> next.plusMonths(1);
                        default -> next.plusYears(1);
                    };
                }
                r.nextDate = next;
            }
        }
        if (body.hasNonNull("amount")) {
            r.amount = checkAmount(body.get("amount").decimalValue());
        }
        return recurring.save(r);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        RecurringPayment r = recurring.findByIdAndUid(id, jwt.getSubject())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        recurring.delete(r);
    }

    /** Registra los cobros vencidos (lo hace el bot cada dia, para no depender de abrir la web). */
    @PostMapping("/sync")
    public Map<String, Integer> sync(@AuthenticationPrincipal Jwt jwt) {
        return Map.of("created", service.sync(jwt.getSubject()));
    }
}
