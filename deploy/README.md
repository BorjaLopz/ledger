# Ledger en el NUC (Postgres + Spring Boot + nginx, privado por Tailscale)

## 1. Subir el código
Copia al repo (mismas rutas): `backend/`, `deploy/`, `migration/`, `Dockerfile`, `.dockerignore`, y los ficheros de `src/` y `vite.config.ts` modificados. Commit + push, y `git pull` en el NUC.

## 2. Migrar los datos de Firestore (una vez, desde tu PC)
1. Firebase Console → Configuración del proyecto → Cuentas de servicio → "Generar nueva clave privada" (NO la subas al repo).
2. `cd migration && npm install && node firestore-to-sql.mjs clave.json <bucket> out`
3. Genera `out/import.sql` y `out/receipts/`. Copia ambos al NUC (scp o Termius/SFTP).
4. Después de importar, borra la clave privada.

## 3. Arrancar en el NUC
```bash
cd ~/ledger/deploy
cp .env.example .env && chmod 600 .env && nano .env     # rellena contraseña, projectId, VITE_FIREBASE_*, secreto (openssl rand -hex 32)
# crea la BD/usuario si no existe (con tu contraseña):
docker exec -it postgres psql -U postgres -c "CREATE USER ledger_user PASSWORD '...';" -c "CREATE DATABASE ledger OWNER ledger_user;"
docker compose --env-file .env up -d --build
docker logs -f ledger-api    # Flyway crea las tablas al primer arranque
```
Importar datos (después de que la API haya arrancado una vez):
```bash
docker exec -i postgres psql -U ledger_user -d ledger < import.sql
docker run --rm -v ledger_receipts:/data -v "$PWD/out/receipts":/src alpine sh -c "cp -r /src/. /data/ && chown -R 999:999 /data" 
```
(Comprueba el uid del usuario `ledger` del contenedor con `docker exec ledger-api id` y ajusta el chown.)

## 4. Exponerlo solo en tu tailnet
```bash
sudo tailscale serve --bg https / http://127.0.0.1:8081
tailscale serve status    # te da https://nuc.<tailnet>.ts.net
```
En Firebase Console → Authentication → Settings → Authorized domains: añade `nuc.<tailnet>.ts.net`.

## 5. Backups
Añade el volumen de tickets a tu cron: `docker run --rm -v ledger_receipts:/d -v ~/backups:/b alpine tar czf /b/receipts-$(date +%F).tgz -C /d .` y copia los backups fuera del NUC de vez en cuando.

## 6. Bot de Telegram para gastos
Escribes `12,50 café` al bot, eliges la categoría con un botón y queda guardado en el Ledger. Si luego le mandas una foto, la guarda como ticket del último movimiento.

1. **Crea un bot nuevo** en @BotFather (distinto del de avisos), con nombre e icono propios. Guarda el token.
2. **Rellena en `deploy/.env`** las variables nuevas (ver `.env.example`): `TELEGRAM_BOT_TOKEN`, `ALLOWED_TELEGRAM_ID` (tu ID de Telegram), `BOT_API_KEY` (`openssl rand -hex 32`) y `BOT_UID`:
   ```bash
   docker exec postgres psql -U ledger_user -d ledger -t -A -c "SELECT DISTINCT uid FROM categories;"
   ```
   Debe salir una sola línea (tu uid). Si salen varias, hay datos de otros usuarios: elige el tuyo.
3. **Despliega:**
   ```bash
   cd ~/ledger && git pull
   cd deploy && docker compose --env-file .env up -d --build
   docker logs -f ledger-bot     # "Bot @... escuchando"
   ```
4. **Prueba** en Telegram: `/start`, luego `12,50 café`.

Ejemplos de mensajes: `12,50 café` · `café 12,50` · `45€ gasolina ayer` · `+1200 nómina` (ingreso) · `ingreso 1200 nómina`.
Comandos: `/resumen` (mes actual), `/resumen 2026-10` (un mes), `/resumen 2026` (año completo), `/ultimo`, `/ayuda`.

**Sugerencias:** si ya has guardado antes un movimiento con la misma nota (sin importar mayúsculas ni tildes), el bot pone arriba un botón ⭐ con la categoría que más has usado para ella, a un toque. Usa tu historial de la base de datos, así que funciona desde el primer día con lo migrado de Firestore.

**Informes automáticos** (hora de Madrid): resumen semanal los **domingos a las 20:00** (lunes a domingo) y resumen del mes anterior el **día 1 a las 09:00**. El bot se comprueba cada minuto dentro de esa hora; si estaba apagado en esa franja, ese informe se pierde, y si se reinicia dentro de ella puede repetirse una vez.

Seguridad: el bot solo responde a tu ID de Telegram y en chat privado; la API del bot (`/api/bot/*`) solo acepta la clave `BOT_API_KEY`, y nginx la bloquea desde fuera, así que solo es alcanzable dentro de la red de Docker. Trata `BOT_API_KEY` y el token como contraseñas.
