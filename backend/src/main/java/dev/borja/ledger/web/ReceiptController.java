package dev.borja.ledger.web;

import dev.borja.ledger.service.ReceiptService;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/receipts")
public class ReceiptController {

    private final ReceiptService receipts;

    public ReceiptController(ReceiptService receipts) {
        this.receipts = receipts;
    }

    /** Sube un ticket. Devuelve la URL firmada que luego se guarda en la transaccion. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, String> upload(@AuthenticationPrincipal Jwt jwt, @RequestParam("file") MultipartFile file) {
        String relative = receipts.store(jwt.getSubject(), file);
        return Map.of("url", receipts.signedUrl(relative));
    }

    /** Publico a nivel de Spring Security: la autorizacion es la firma HMAC de la URL. */
    @GetMapping("/{uid}/{file}")
    public ResponseEntity<Resource> download(@PathVariable String uid, @PathVariable String file,
                                             @RequestParam long exp, @RequestParam String sig) {
        Resource resource = receipts.load(uid, file, exp, sig);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(receipts.contentTypeOf(file)))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .cacheControl(CacheControl.maxAge(30, TimeUnit.MINUTES).cachePrivate())
                .body(resource);
    }
}
