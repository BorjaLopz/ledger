package dev.borja.ledger.web;

import com.fasterxml.jackson.databind.JsonNode;
import dev.borja.ledger.model.NetWorthEntry;
import dev.borja.ledger.repo.NetWorthRepository;
import dev.borja.ledger.service.EntityPatcher;
import java.util.List;
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
@RequestMapping("/api/networth")
public class NetWorthController {

    private final NetWorthRepository repo;
    private final EntityPatcher patcher;

    public NetWorthController(NetWorthRepository repo, EntityPatcher patcher) {
        this.repo = repo;
        this.patcher = patcher;
    }

    @GetMapping
    public List<NetWorthEntry> list(@AuthenticationPrincipal Jwt jwt) {
        return repo.findByUidOrderByDateAsc(jwt.getSubject());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public NetWorthEntry create(@AuthenticationPrincipal Jwt jwt, @RequestBody JsonNode body) {
        NetWorthEntry e = patcher.apply(new NetWorthEntry(), body);
        e.uid = jwt.getSubject();
        return repo.save(e);
    }

    @PatchMapping("/{id}")
    public NetWorthEntry update(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestBody JsonNode body) {
        NetWorthEntry e = repo.findByIdAndUid(id, jwt.getSubject()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        patcher.apply(e, body);
        return repo.save(e);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        NetWorthEntry e = repo.findByIdAndUid(id, jwt.getSubject()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        repo.delete(e);
    }
}
