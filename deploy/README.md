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
