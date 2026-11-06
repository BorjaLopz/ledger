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

### Menú de comandos y categorías (v1.2)

- Al arrancar, el bot registra el menú `/` de Telegram (resumen, ultimo, categorias, nuevacategoria, cancelar, ayuda).
- `/categorias`: lista agrupada con uso; tocar una permite renombrar, cambiar icono o eliminar. Si tiene movimientos/recurrentes, pregunta a qué categoría pasarlos.
- `/nuevacategoria`: tipo → nombre → icono; el color se elige solo (el menos usado).
- No hay variables nuevas: `docker compose --env-file .env up -d --build`.

### Gráficos y exportación (v1.3)

- `/grafico [YYYY-MM|YYYY]`: donut de gastos por categoría (usa los colores de tus categorías).
- `/balance [meses]`: barras de ingresos y gastos por mes (12 por defecto, 2–36).
- `/exportar [YYYY-MM|YYYY]`: CSV (`;` y decimales con coma, UTF-8 con BOM) como archivo del chat.
- Los informes semanal y mensual automáticos adjuntan ahora el donut.
- Los PNG se dibujan en el propio bot (SVG → `@resvg/resvg-js`); la imagen Docker instala `ttf-dejavu`.

### Garantías y edición de movimientos (v1.4)

- `/nuevagarantia`: producto → fecha de compra (hoy/ayer/otra) → duración (1, 2, 3, 5 años o meses a medida). Después puedes enviar la foto del ticket y se guarda con la garantía.
- `/garantias`: lista ordenada por caducidad (❌ caducada, ⚠️ ≤30 días, ✅), con detalle, ver ticket, adjuntar ticket y eliminar.
- Aviso diario a las 10:00 (hora de `TZ`) si alguna garantía caduca en 30, 7 o 1 días, o hoy.
- `/buscar <texto>`: busca en nota, categoría o importe exacto; desde el resultado se edita importe, categoría, fecha y nota, se ve el ticket o se borra. `/ultimo` también permite editar.
- Nueva migración Flyway `V2__warranties.sql` (se aplica sola al arrancar `ledger-api`; las copias de seguridad de Postgres ya la incluyen).

### Recurrentes, comparativa y recordatorio (v1.5)

- `/recurrentes`: lista de pagos recurrentes (🔁 activo, ⏸ pausado); pausar/reanudar, cambiar importe, eliminar. Al reanudar no se cobran de golpe los periodos en que estuvo pausado.
- `/nuevorecurrente`: «12,99 Netflix» (o «+1200 nómina» para ingresos) → categoría → semanal/mensual/anual → primer cobro (hoy, mañana u otra fecha). Si el primer cobro es hoy, se registra al momento.
- Cada día a las 06:00 el bot registra los recurrentes vencidos (ya no hace falta abrir la web) y avisa si hubo alguno.
- `/resumen` y los informes semanal/mensual comparan con el periodo anterior (variación total y las 3 categorías que más cambian).
- Recordatorio a las 19:00 si llevas 7, 14, 21… días sin apuntar nada a mano (los recurrentes no cuentan).
