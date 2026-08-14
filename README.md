<div align="center">

# 📒 Ledger

**Control de finanzas personales — gastos, ingresos, recurrentes y patrimonio, mes a mes.**

Side project construido con React 19, TypeScript, Firebase y Tailwind CSS v4.
Sin backend propio: Firebase (Auth + Firestore + Storage) hace de servidor.

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore%20%7C%20Storage-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

</div>

---

## Capturas

<!--
TODO: sustituir por capturas reales en docs/screenshots/.
Sugerencia de tamaño: 1280px de ancho para desktop, 390px para móvil.
-->

| Resumen | Dashboard |
|---|---|
| ![Resumen](docs/screenshots/resumen.png) | ![Dashboard](docs/screenshots/dashboard.png) |

| Transacciones | Patrimonio |
|---|---|
| ![Transacciones](docs/screenshots/transacciones.png) | ![Patrimonio](docs/screenshots/patrimonio.png) |

| Móvil |
|---|
| ![Móvil](docs/screenshots/mobile.png) |

## Qué hace

- **Resumen del mes activo** — balance, gasto por categoría, % de ahorro y aviso de recurrentes pendientes de este mes.
- **Transacciones** — alta de gastos/ingresos con foto del ticket, filtros (texto, tipo, categoría, rango de fechas), selección múltiple y borrado masivo, modal de detalle con edición.
- **Recurrentes** — pagos e ingresos periódicos (semanal/mensual/anual) que se generan solos como transacciones reales al abrir la app, sin meterlos a mano cada mes.
- **Dashboard** — conmuta entre vista mensual, anual y calendario (mes/semana/año), y entre gráfico de barras o de tarta. Calendario con puntos de color por categoría y desglose al hover.
- **Patrimonio** — snapshots periódicos de activos y deudas; cada registro nuevo hereda el anterior para que solo haga falta ajustar lo que cambió. Progresión con % de variación.
- **Categorías** — totalmente personalizables (nombre, icono, color, tipo), con las básicas creadas por defecto.
- **Auth** — Google o email/contraseña, datos aislados por usuario vía reglas de seguridad de Firestore/Storage.
- **Responsive** — pensado mobile-first: nav con menú hamburguesa, formularios siempre accesibles arriba (no enterrados bajo listas largas), sin scroll horizontal.

## Stack

| Capa | Tecnología |
|---|---|
| UI | React 19, TypeScript, Tailwind CSS v4 |
| Routing | React Router 7 |
| Datos remotos | Firebase (Auth, Firestore, Storage) vía TanStack Query |
| Estado global | Zustand (sesión, modal de confirmación) |
| Formularios | React Hook Form + Zod |
| Gráficas | Recharts |
| Animación | Framer Motion |
| Iconos | Lucide |
| Build | Vite |

No hay servidor propio: toda la lógica corre en el cliente y Firebase Firestore/Storage,
con reglas de seguridad que limitan cada documento al `uid` del usuario autenticado.

## Arranque en local

```bash
npm install
cp .env.example .env   # rellena con la config de tu proyecto Firebase
npm run dev
```

Necesitas un proyecto de Firebase con **Authentication** (Email/Password y/o Google),
**Firestore** y **Storage** activados. Las reglas de seguridad están en `firestore.rules`
y `storage.rules` — publícalas desde la consola de Firebase o con `firebase deploy`.

## Despliegue

Configurado para Netlify (`netlify.toml`, incluye el redirect necesario para las rutas
de React Router). Variables de entorno (`VITE_FIREBASE_*`) se configuran en el panel de
Netlify, no se suben en `.env`. Recuerda añadir el dominio de producción en
**Firebase → Authentication → Settings → Authorized domains** para que el login con
Google funcione ahí.

## Estructura

```
src/
  features/        # un directorio por dominio (transactions, recurring, networth...)
  routes/           # layout, rutas protegidas, listener de auth
  store/            # estado global (zustand)
  lib/              # cliente de Firebase, query client
  types/            # modelo de datos compartido
```

---

<div align="center">

Hecho por [Borja López Díaz](https://github.com/BorjaLopz) · proyecto personal de aprendizaje

</div>
