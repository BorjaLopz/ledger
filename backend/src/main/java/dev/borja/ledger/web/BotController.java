package dev.borja.ledger.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import dev.borja.ledger.model.Category;
import dev.borja.ledger.model.Transaction;
import dev.borja.ledger.repo.CategoryRepository;
import dev.borja.ledger.repo.RecurringRepository;
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
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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
    private final RecurringRepository recurring;
    private final ZoneId zone;

    public BotController(TransactionRepository transactions, CategoryRepository categories, EntityPatcher patcher,
                         ReceiptService receipts, RecurringRepository recurring,
                         @Value("${app.timezone}") String timezone) {
        this.transactions = transactions;
        this.categories = categories;
        this.patcher = patcher;
        this.receipts = receipts;
        this.recurring = recurring;
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

    // ---- Gestion de categorias ----

    public record CategoryUsage(String id, String name, String type, String icon, String color,
                                long transactions, long recurring) {}

    public record CategoryInput(String name, String type, String icon, String color) {}

    private static final Set<String> COLORS = Set.of("#f97316", "#eab308", "#84cc16", "#22c55e", "#14b8a6",
            "#06b6d4", "#3b82f6", "#a855f7", "#ec4899", "#f43f5e", "#6b7280");

    private boolean nameTaken(String uid, String type, String name, String exceptId) {
        String wanted = normalize(name.trim());
        return categories.findByUid(uid).stream()
                .anyMatch(c -> c.type.equals(type) && !c.id.equals(exceptId) && normalize(c.name).equals(wanted));
    }

    private static String cleanName(String raw) {
        String name = raw == null ? "" : raw.trim();
        if (name.isEmpty() || name.length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El nombre debe tener entre 1 y 100 caracteres");
        }
        return name;
    }

    private static void checkColor(String color) {
        if (!COLORS.contains(color)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Color no valido");
        }
    }

    /** Categorias con el numero de movimientos y pagos recurrentes que las usan. */
    @GetMapping("/categories/usage")
    public List<CategoryUsage> categoryUsage(@AuthenticationPrincipal Jwt jwt) {
        String uid = jwt.getSubject();
        return categories.findByUid(uid).stream()
                .map(c -> new CategoryUsage(c.id, c.name, c.type, c.icon, c.color,
                        transactions.countByUidAndCategoryId(uid, c.id),
                        recurring.countByUidAndCategoryId(uid, c.id)))
                .toList();
    }

    @PostMapping("/categories")
    @ResponseStatus(HttpStatus.CREATED)
    public Category createCategory(@AuthenticationPrincipal Jwt jwt, @RequestBody CategoryInput in) {
        String uid = jwt.getSubject();
        if (in == null || in.type() == null || !(in.type().equals("expense") || in.type().equals("income"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "type debe ser expense o income");
        }
        String name = cleanName(in.name());
        if (in.icon() == null || in.icon().isBlank() || in.icon().length() > 60) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Icono no valido");
        }
        checkColor(in.color());
        if (nameTaken(uid, in.type(), name, null)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una categoria con ese nombre");
        }
        Category c = new Category();
        c.uid = uid;
        c.name = name;
        c.type = in.type();
        c.icon = in.icon();
        c.color = in.color();
        return categories.save(c);
    }

    /** Cambia nombre, icono y/o color. El tipo no se puede cambiar. */
    @PatchMapping("/categories/{id}")
    @Transactional
    public Category updateCategory(@AuthenticationPrincipal Jwt jwt, @PathVariable String id,
                                   @RequestBody CategoryInput in) {
        String uid = jwt.getSubject();
        Category c = categories.findByIdAndUid(id, uid)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (in.name() != null) {
            String name = cleanName(in.name());
            if (nameTaken(uid, c.type, name, c.id)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una categoria con ese nombre");
            }
            c.name = name;
        }
        if (in.icon() != null) {
            if (in.icon().isBlank() || in.icon().length() > 60) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Icono no valido");
            }
            c.icon = in.icon();
        }
        if (in.color() != null) {
            checkColor(in.color());
            c.color = in.color();
        }
        return categories.save(c);
    }

    /**
     * Borra una categoria. Si tiene movimientos o recurrentes hay que indicar "moveTo" (otra categoria
     * del mismo tipo) y se reasignan antes de borrar; sin "moveTo" responde 409.
     */
    @DeleteMapping("/categories/{id}")
    @Transactional
    public Map<String, Object> deleteCategory(@AuthenticationPrincipal Jwt jwt, @PathVariable String id,
                                              @RequestParam(required = false) String moveTo) {
        String uid = jwt.getSubject();
        Category c = categories.findByIdAndUid(id, uid)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        List<Transaction> txs = transactions.findByUidAndCategoryId(uid, c.id);
        var recs = recurring.findByUidAndCategoryId(uid, c.id);
        if (!txs.isEmpty() || !recs.isEmpty()) {
            if (moveTo == null || moveTo.isBlank()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "La categoria tiene " + txs.size() + " movimientos y " + recs.size() + " recurrentes");
            }
            Category target = categories.findByIdAndUid(moveTo, uid)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Categoria destino no existe"));
            if (target.id.equals(c.id) || !target.type.equals(c.type)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Destino invalido (mismo tipo y distinta)");
            }
            txs.forEach(t -> t.categoryId = target.id);
            recs.forEach(r -> r.categoryId = target.id);
            transactions.saveAll(txs);
            recurring.saveAll(recs);
        }
        categories.delete(c);
        return Map.of("deleted", c.id, "moved", txs.size() + recs.size());
    }

    // ---- Graficos y exportacion ----

    public record MonthTotal(String month, BigDecimal income, BigDecimal expense) {}

    /** Ingresos y gastos por mes de los ultimos N meses (1-36), del mas antiguo al actual; incluye meses vacios. */
    @GetMapping("/monthly")
    public List<MonthTotal> monthly(@AuthenticationPrincipal Jwt jwt, @RequestParam(defaultValue = "12") int months) {
        if (months < 1 || months > 36) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "months debe estar entre 1 y 36");
        }
        YearMonth last = YearMonth.now(zone);
        YearMonth first = last.minusMonths(months - 1L);
        Map<YearMonth, BigDecimal[]> acc = new LinkedHashMap<>();
        for (int i = 0; i < months; i++) {
            acc.put(first.plusMonths(i), new BigDecimal[] {BigDecimal.ZERO, BigDecimal.ZERO});
        }
        for (Transaction t : transactions.findByUidOrderByDateDesc(jwt.getSubject())) {
            BigDecimal[] slot = acc.get(YearMonth.from(t.date));
            if (slot == null) {
                continue;
            }
            int i = "income".equals(t.type) ? 0 : 1;
            slot[i] = slot[i].add(t.amount);
        }
        return acc.entrySet().stream()
                .map(e -> new MonthTotal(e.getKey().toString(), e.getValue()[0], e.getValue()[1]))
                .toList();
    }

    /** CSV (separador ";", decimales con coma, UTF-8 con BOM para Excel) de un mes, un ano o un rango. */
    @GetMapping("/export")
    public ResponseEntity<String> export(@AuthenticationPrincipal Jwt jwt,
                                         @RequestParam(required = false) String month,
                                         @RequestParam(required = false) String year,
                                         @RequestParam(required = false) String from,
                                         @RequestParam(required = false) String to) {
        LocalDate start = null;
        LocalDate end = null;
        String label = "todo";
        try {
            if (from != null && to != null) {
                start = LocalDate.parse(from);
                end = LocalDate.parse(to);
                label = start + "_" + end;
            } else if (month != null && !month.isBlank()) {
                YearMonth ym = YearMonth.parse(month);
                start = ym.atDay(1);
                end = ym.atEndOfMonth();
                label = ym.toString();
            } else if (year != null && !year.isBlank()) {
                int y = Integer.parseInt(year);
                start = LocalDate.of(y, 1, 1);
                end = LocalDate.of(y, 12, 31);
                label = year;
            }
        } catch (DateTimeParseException | NumberFormatException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Usa month=YYYY-MM, year=YYYY o from/to");
        }
        if (start != null && start.isAfter(end)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "from debe ser anterior o igual a to");
        }
        String uid = jwt.getSubject();
        Map<String, String> names = new HashMap<>();
        for (Category c : categories.findByUid(uid)) {
            names.put(c.id, c.name);
        }
        StringBuilder csv = new StringBuilder("\uFEFFfecha;tipo;categoria;importe;nota;ticket\n");
        List<Transaction> all = transactions.findByUidOrderByDateDesc(uid);
        for (int i = all.size() - 1; i >= 0; i--) { // cronologico
            Transaction t = all.get(i);
            if (start != null && (t.date.isBefore(start) || t.date.isAfter(end))) {
                continue;
            }
            csv.append(t.date).append(';')
                    .append("income".equals(t.type) ? "ingreso" : "gasto").append(';')
                    .append(csvText(names.getOrDefault(t.categoryId, "Sin categoria"))).append(';')
                    .append(t.amount.toPlainString().replace('.', ',')).append(';')
                    .append(csvText(t.note)).append(';')
                    .append(t.receiptPath != null ? "si" : "no").append('\n');
        }
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv", java.nio.charset.StandardCharsets.UTF_8))
                .header("X-Export-Name", "ledger-" + label + ".csv")
                .body(csv.toString());
    }

    /** Escapa para CSV y neutraliza formulas (=, +, -, @) que Excel ejecutaria. */
    private static String csvText(String raw) {
        String v = raw == null ? "" : raw.replace("\r", " ").replace("\n", " ");
        if (!v.isEmpty() && "=+-@\t".indexOf(v.charAt(0)) >= 0) {
            v = "'" + v;
        }
        return "\"" + v.replace("\"", "\"\"") + "\"";
    }
}
