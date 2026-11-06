/** Menu de comandos que Telegram muestra al escribir "/". */
export const COMMANDS = [
  { command: "resumen", description: "Resumen del mes (o /resumen 2026-10, /resumen 2026)" },
  { command: "grafico", description: "Gráfico de gastos por categoría (o /grafico 2026-10)" },
  { command: "balance", description: "Gráfico de ingresos y gastos por mes (o /balance 6)" },
  { command: "exportar", description: "Descargar movimientos en CSV (o /exportar 2026)" },
  { command: "recurrentes", description: "Ver, pausar o borrar pagos recurrentes" },
  { command: "nuevorecurrente", description: "Crear un pago recurrente (suscripción, nómina…)" },
  { command: "buscar", description: "Buscar movimientos por nota, categoría o importe" },
  { command: "ultimo", description: "Ver, editar o borrar el último movimiento" },
  { command: "garantias", description: "Ver tus garantías y cuándo caducan" },
  { command: "nuevagarantia", description: "Guardar una garantía nueva (con ticket)" },
  { command: "categorias", description: "Ver, editar y borrar categorías" },
  { command: "nuevacategoria", description: "Crear una categoría nueva" },
  { command: "cancelar", description: "Cancelar lo que estaba haciendo" },
  { command: "ayuda", description: "Cómo funciona el bot" },
] as const;
