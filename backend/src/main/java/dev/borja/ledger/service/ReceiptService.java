package dev.borja.ledger.service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/**
 * Almacen de tickets en disco. En BD solo se guarda la ruta relativa "{uid}/{fichero}".
 * Hacia el cliente se entrega una URL firmada (HMAC) y temporal, porque <img> y <a> no pueden enviar el token.
 */
@Service
public class ReceiptService {

    private static final String URL_PREFIX = "/api/receipts/";
    /** SVG queda fuera a proposito: servido en el mismo origen permitiria XSS. */
    private static final Map<String, String> EXT_BY_TYPE = Map.of(
            "image/jpeg", "jpg",
            "image/png", "png",
            "image/webp", "webp",
            "image/gif", "gif",
            "image/heic", "heic",
            "image/heif", "heif");
    private static final Map<String, String> TYPE_BY_EXT = Map.of(
            "jpg", "image/jpeg",
            "png", "image/png",
            "webp", "image/webp",
            "gif", "image/gif",
            "heic", "image/heic",
            "heif", "image/heif");

    private final Path baseDir;
    private final byte[] secret;
    private final long ttlSeconds;

    public ReceiptService(
            @Value("${app.receipts.dir}") String dir,
            @Value("${app.receipts.signing-secret}") String secret,
            @Value("${app.receipts.url-ttl-seconds}") long ttlSeconds) {
        if (secret == null || secret.length() < 32) {
            throw new IllegalStateException("RECEIPTS_SIGNING_SECRET debe tener al menos 32 caracteres");
        }
        this.baseDir = Path.of(dir).toAbsolutePath().normalize();
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.ttlSeconds = ttlSeconds;
    }

    /** Guarda el fichero y devuelve la ruta relativa "{uid}/{fichero}". */
    public String store(String uid, MultipartFile file) {
        String ext = EXT_BY_TYPE.get(file.getContentType() == null ? "" : file.getContentType().toLowerCase());
        if (ext == null) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Solo se admiten imagenes (jpg, png, webp, gif, heic)");
        }
        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fichero vacio");
        }
        String original = file.getOriginalFilename() == null ? "ticket" : file.getOriginalFilename();
        String stem = original.replaceAll("\\.[^.]*$", "").replaceAll("[^A-Za-z0-9_-]", "_");
        if (stem.length() > 40) stem = stem.substring(0, 40);
        if (stem.isBlank()) stem = "ticket";
        String fileName = System.currentTimeMillis() + "-" + stem + "." + ext;
        String relative = uid + "/" + fileName;

        Path target = resolve(relative);
        try {
            Files.createDirectories(target.getParent());
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "No se pudo guardar el ticket");
        }
        return relative;
    }

    public String signedUrl(String relativePath) {
        if (relativePath == null) return null;
        long exp = Instant.now().getEpochSecond() + ttlSeconds;
        return URL_PREFIX + relativePath + "?exp=" + exp + "&sig=" + sign(relativePath, exp);
    }

    /**
     * Convierte la URL que devolvio esta API de vuelta a ruta relativa.
     * Comprueba que pertenece al usuario autenticado.
     */
    public String pathFromUrl(String url, String uid) {
        if (url == null || url.isBlank()) return null;
        int q = url.indexOf('?');
        String clean = q >= 0 ? url.substring(0, q) : url;
        if (!clean.startsWith(URL_PREFIX)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "receiptUrl no valida");
        }
        String relative = clean.substring(URL_PREFIX.length());
        if (!relative.startsWith(uid + "/") || relative.indexOf('/', uid.length() + 1) >= 0) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "El ticket no te pertenece");
        }
        resolve(relative);
        return relative;
    }

    /** Devuelve el recurso si la firma es valida y no ha caducado. */
    public Resource load(String uid, String file, long exp, String sig) {
        String relative = uid + "/" + file;
        if (exp < Instant.now().getEpochSecond()
                || !MessageDigest.isEqual(sign(relative, exp).getBytes(StandardCharsets.UTF_8),
                        sig == null ? new byte[0] : sig.getBytes(StandardCharsets.UTF_8))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Enlace no valido o caducado");
        }
        Path path = resolve(relative);
        if (!Files.isRegularFile(path)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        return new FileSystemResource(path);
    }

    public String contentTypeOf(String fileName) {
        int dot = fileName.lastIndexOf('.');
        String ext = dot < 0 ? "" : fileName.substring(dot + 1).toLowerCase();
        return TYPE_BY_EXT.getOrDefault(ext, "application/octet-stream");
    }

    public void delete(String relativePath) {
        if (relativePath == null) return;
        try {
            Files.deleteIfExists(resolve(relativePath));
        } catch (IOException ignored) {
            // si no se puede borrar, no bloqueamos la operacion principal
        }
    }

    private Path resolve(String relative) {
        Path p = baseDir.resolve(relative).normalize();
        if (!p.startsWith(baseDir) || p.equals(baseDir)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ruta no valida");
        }
        return p;
    }

    private String sign(String relative, long exp) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            byte[] raw = mac.doFinal((relative + ":" + exp).getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
