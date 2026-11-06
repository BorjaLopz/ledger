package dev.borja.ledger.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import dev.borja.ledger.model.Category;
import dev.borja.ledger.model.Transaction;
import dev.borja.ledger.repo.CategoryRepository;
import dev.borja.ledger.repo.TransactionRepository;
import dev.borja.ledger.service.EntityPatcher;
import dev.borja.ledger.service.ReceiptService;
import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
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

/**
 * API para el bot de Telegram. Solo accesible con la clave del bot (rol BOT, ver SecurityConfig).
 * Siempre opera sobre el usuario configurado en BOT_UID.
 */
@RestController
@RequestMapping("/api/bot")
public class BotController {

    /** Campos que el bot no puede fijar directamente. */
    private static final String[] SERVER_MANAGED = {"receiptUrl", "receiptPath", "recurringId"};

    private final TransactionRepository transactions;
    private final CategoryRepository categories;
    private final EntityPatcher patcher;
    private final ReceiptService receipts;
    private final ZoneId zone;

    public BotController(TransactionRepository transactions, CategoryRepository categories, EntityPatcher patcher,
                         ReceiptService receipts, @Value("${app.timezone}") String timezone) {
        this.transactions = transactions;
        this.categories = categories;
        this.patcher = patcher;
        this.receipts = receipts;
        this.zone = ZoneId.of(timezone);
    }

    @GetMapping("/categories")
    public List<Category> categories(@AuthenticationPrincipal Jwt jwt) {
        return categories.findByUid(jwt.getSubject());
    }

    /** Crea un gasto o ingreso. Si no llega "date", se usa hoy (zona horaria de la app). */
    @PostMapping("/transactions")
    @ResponseStatus(HttpStatus.CREATED)
    public TransactionResponse create(@AuthenticationPrincipal Jwt jwt, @RequestBody JsonNode body) {
        String uid = jwt.getSubject();
        if (body == null || !body.isObject()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Se esperaba un objeto JSON");
        }
        ObjectNode copy = ((ObjectNode) body).deepCopy();
        if (!copy.hasNonNull("date")) {
            copy.put("date", LocalDate.now(zone).toString());
        }
        Transaction t = patcher.apply(new Transaction(), copy, SERVER_MANAGED);
        Category category = categories.findByIdAndUid(t.categoryId, uid)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Categoria no valida"));
        if (!category.type.equals(t.type)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La categoria no es del mismo tipo");
        }
        t.uid = uid;
        t.receiptPath = null;
        return TransactionResponse.from(transactions.save(t), receipts);
    }

    /** Ultima transaccion creada (para asociarle un ticket o deshacerla). */
    @GetMapping("/transactions/last")
    public TransactionResponse last(@AuthenticationPrincipal Jwt jwt) {
        Transaction t = transactions.findFirstByUidOrderByCreatedAtDesc(jwt.getSubject())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return TransactionResponse.from(t, receipts);
    }

    /** Adjunta (o reemplaza) el ticket de una transaccion. */
    @PostMapping("/transactions/{id}/receipt")
    @Transactional
    public TransactionResponse attachReceipt(@AuthenticationPrincipal Jwt jwt, @PathVariable String id,
                                             @RequestParam("file") MultipartFile file) {
        String uid = jwt.getSubject();
        Transaction t = transactions.findByIdAndUid(id, uid)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        String oldPath = t.receiptPath;
        t.receiptPath = receipts.store(uid, file);
        Transaction saved = transactions.save(t);
        if (oldPath != null) {
            receipts.delete(oldPath);
        }
        return TransactionResponse.from(saved, receipts);
    }

    @DeleteMapping("/transactions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        Transaction t = transactions.findByIdAndUid(id, jwt.getSubject())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        String path = t.receiptPath;
        transactions.delete(t);
        receipts.delete(path);
    }

    public record CategoryTotal(String category, BigDecimal total) {}

    public record Summary(String period, BigDecimal income, BigDecimal expense, BigDecimal balance,
                          List<CategoryTotal> expenseByCategory) {}

    /**
     * Resumen de un periodo: un mes (month=YYYY-MM, por defecto el actual) o un rango inclusivo
     * (from=YYYY-MM-DD&to=YYYY-MM-DD).
     */
    @GetMapping("/summary")
    public Summary summary(@AuthenticationPrincipal Jwt jwt,
                           @RequestParam(required = false) String month,
                           @RequestParam(required = false) String from,
                           @RequestParam(required = false) String to) {
        String uid = jwt.getSubject();
        LocalDate start;
        LocalDate end;
        String period;
        try {
            if (from != null && to != null) {
                start = LocalDate.parse(from);
                end = LocalDate.parse(to);
                if (start.isAfter(end)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "from debe ser anterior o igual a to");
                }
                period = start + "/" + end;
            } else {
                YearMonth ym = (month == null || month.isBlank()) ? YearMonth.now(zone) : YearMonth.parse(month);
                start = ym.atDay(1);
                end = ym.atEndOfMonth();
                period = ym.toString();
            }
        } catch (DateTimeParseException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Usa month=YYYY-MM o from/to con formato YYYY-MM-DD");
        }
        Map<String, String> names = new HashMap<>();
        for (Category c : categories.findByUid(uid)) {
            names.put(c.id, c.name);
        }
        BigDecimal income = BigDecimal.ZERO;
        BigDecimal expense = BigDecimal.ZERO;
        Map<String, BigDecimal> byCategory = new HashMap<>();
        for (Transaction t : transactions.findByUidOrderByDateDesc(uid)) {
            if (t.date.isBefore(start) || t.date.isAfter(end)) {
                continue;
            }
            if ("income".equals(t.type)) {
                income = income.add(t.amount);
            } else {
                expense = expense.add(t.amount);
                byCategory.merge(names.getOrDefault(t.categoryId, "Sin categoria"), t.amount, BigDecimal::add);
            }
        }
        List<CategoryTotal> top = byCategory.entrySet().stream()
                .sorted((a, b) -> b.getValue().compareTo(a.getValue()))
                .map(e -> new CategoryTotal(e.getKey(), e.getValue()))
                .toList();
        return new Summary(period, income, expense, income.subtract(expense), top);
    }

    public record Suggestion(String categoryId, long count) {}

    /**
     * Categoria que mas has usado para esa misma nota (sin distinguir mayusculas ni tildes).
     * En caso de empate gana la mas reciente. 404 si no hay historial.
     */
    @GetMapping("/suggest")
    public Suggestion suggest(@AuthenticationPrincipal Jwt jwt, @RequestParam String note, @RequestParam String type) {
        if (!"expense".equals(type) && !"income".equals(type)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "type debe ser expense o income");
        }
        String uid = jwt.getSubject();
        String wanted = normalize(note);
        if (wanted.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        Set<String> valid = new HashSet<>();
        for (Category c : categories.findByUid(uid)) {
            if (c.type.equals(type)) {
                valid.add(c.id);
            }
        }
        // findByUidOrderByDateDesc devuelve lo mas reciente primero; LinkedHashMap conserva ese orden
        Map<String, Long> counts = new LinkedHashMap<>();
        for (Transaction t : transactions.findByUidOrderByDateDesc(uid)) {
            if (type.equals(t.type) && valid.contains(t.categoryId) && normalize(t.note).equals(wanted)) {
                counts.merge(t.categoryId, 1L, Long::sum);
            }
        }
        return counts.entrySet().stream()
                .max((a, b) -> Long.compare(a.getValue(), b.getValue()))
                .map(e -> new Suggestion(e.getKey(), e.getValue()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private static String normalize(String text) {
        if (text == null) {
            return "";
        }
        return Normalizer.normalize(text, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .trim();
    }
}
