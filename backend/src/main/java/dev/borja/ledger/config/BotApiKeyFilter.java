package dev.borja.ledger.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.List;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Autentica al bot de Telegram en /api/bot/** con una clave compartida (cabecera X-Bot-Key).
 * Si la clave es correcta, la peticion actua como el usuario BOT_UID con el rol ROLE_BOT.
 * Si BOT_API_KEY (minimo 32 caracteres) o BOT_UID no estan configurados, el bot queda desactivado.
 *
 * No es un @Component a proposito: asi Spring Boot no lo registra tambien como filtro de servlet.
 */
public class BotApiKeyFilter extends OncePerRequestFilter {

    private static final String HEADER = "X-Bot-Key";

    private final byte[] key;
    private final String uid;

    public BotApiKeyFilter(String apiKey, String uid) {
        this.key = apiKey == null ? new byte[0] : apiKey.getBytes(StandardCharsets.UTF_8);
        this.uid = uid == null ? "" : uid.trim();
    }

    private boolean enabled() {
        return key.length >= 32 && !uid.isEmpty();
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/bot/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String provided = request.getHeader(HEADER);
        if (enabled() && provided != null
                && MessageDigest.isEqual(provided.getBytes(StandardCharsets.UTF_8), key)) {
            Instant now = Instant.now();
            Jwt jwt = Jwt.withTokenValue("bot")
                    .header("alg", "none")
                    .subject(uid)
                    .issuedAt(now)
                    .expiresAt(now.plusSeconds(60))
                    .build();
            SecurityContextHolder.getContext()
                    .setAuthentication(new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority("ROLE_BOT"))));
        }
        chain.doFilter(request, response);
    }
}
