package dev.borja.ledger.web;

import com.fasterxml.jackson.databind.JsonNode;
import dev.borja.ledger.model.Category;
import dev.borja.ledger.repo.CategoryRepository;
import dev.borja.ledger.service.EntityPatcher;
import java.util.ArrayList;
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
@RequestMapping("/api/categories")
public class CategoryController {

    private final CategoryRepository repo;
    private final EntityPatcher patcher;

    public CategoryController(CategoryRepository repo, EntityPatcher patcher) {
        this.repo = repo;
        this.patcher = patcher;
    }

    @GetMapping
    public List<Category> list(@AuthenticationPrincipal Jwt jwt) {
        return repo.findByUid(jwt.getSubject());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Category create(@AuthenticationPrincipal Jwt jwt, @RequestBody JsonNode body) {
        Category c = patcher.apply(new Category(), body);
        c.uid = jwt.getSubject();
        return repo.save(c);
    }

    /** Siembra las categorias por defecto. Solo actua si el usuario no tiene ninguna (idempotente). */
    @PostMapping("/bulk")
    @Transactional
    public List<Category> bulk(@AuthenticationPrincipal Jwt jwt, @RequestBody List<JsonNode> body) {
        String uid = jwt.getSubject();
        if (repo.countByUid(uid) > 0) return repo.findByUid(uid);
        if (body.size() > 50) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Demasiadas categorias");
        List<Category> created = new ArrayList<>();
        for (JsonNode node : body) {
            Category c = patcher.apply(new Category(), node);
            c.uid = uid;
            created.add(c);
        }
        return repo.saveAll(created);
    }

    @PatchMapping("/{id}")
    public Category update(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestBody JsonNode body) {
        Category c = repo.findByIdAndUid(id, jwt.getSubject()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        patcher.apply(c, body);
        return repo.save(c);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        Category c = repo.findByIdAndUid(id, jwt.getSubject()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        repo.delete(c);
    }
}
