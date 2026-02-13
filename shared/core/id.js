export function generateId(prefix = "id") {
  // Se o navegador suportar
  if (crypto && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  // Fallback universal (mobile safe)
  const rand = Math.floor(Math.random() * 1000);
  const time = Date.now();

  return `${prefix}-${time}-${rand}`;
}
