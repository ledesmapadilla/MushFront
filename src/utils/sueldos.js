// Cálculo de sueldos de Personal.
//
// El campo `mensual` es un historial `[{ valor, fecha }]`: cada cambio aplicado
// desde "Editar" agrega una entrada en vez de pisar la anterior, así queda el
// registro de los aumentos. El valor vigente es el de la última fecha.
//
// De ahí bajan el resto de los valores:
//   semanal = mensual / SEMANAS_POR_MES
//   jornal  = semanal / jornales por semana
//   hora    = jornal  / horas por día

// 12 sueldos al año repartidos en 52 semanas.
export const SEMANAS_POR_MES = 52 / 12;

/** Última entrada del historial (la vigente), o null si no hay ninguna. */
export const mensualVigente = (mensual) => {
  if (!Array.isArray(mensual) || mensual.length === 0) return null;
  const ordenado = [...mensual].sort((a, b) =>
    String(a.fecha || "").localeCompare(String(b.fecha || ""))
  );
  return ordenado[ordenado.length - 1];
};

/** Valor mensual vigente en pesos. 0 si no hay dato. */
export const valorMensual = (persona) => Number(mensualVigente(persona?.mensual)?.valor || 0);

export const valorSemanal = (persona) => valorMensual(persona) / SEMANAS_POR_MES;

export const valorJornal = (persona) => {
  const jornales = Number(persona?.jornalesPorSemana) || 0;
  if (jornales <= 0) return 0;
  return valorSemanal(persona) / jornales;
};

export const valorHora = (persona) => {
  const horas = Number(persona?.horasPorDia) || 0;
  if (horas <= 0) return 0;
  return valorJornal(persona) / horas;
};

/**
 * Formato de moneda del proyecto. Devuelve "-" cuando no hay valor.
 *
 * `decimales` importa en los valores unitarios: un costo por alfajor redondeado
 * a pesos enteros no se mueve al cambiar la cantidad producida de a uno, y
 * parece que el calculo estuviera congelado.
 */
export const moneda = (valor, decimales = 0) => {
  if (valor === undefined || valor === null || valor === "" || Number(valor) === 0) {
    return "-";
  }
  return `$ ${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor)}`;
};

/** Lo que se muestra mientras se escribe en un campo de moneda. */
export const monedaInput = (valor) => {
  if (valor === undefined || valor === null || valor === "") return "";
  const numero = Number(valor);
  if (isNaN(numero)) return String(valor);
  return `$ ${new Intl.NumberFormat("es-AR").format(numero)}`;
};

/** "2026-08-20" -> "20-08-2026". Devuelve "-" si no hay fecha. */
export const fechaLegible = (fecha) => {
  if (!fecha || fecha === "-") return "-";
  const partes = String(fecha).split("-");
  return partes.length === 3 ? `${partes[2]}-${partes[1]}-${partes[0]}` : fecha;
};

/** Fecha de hoy en formato "YYYY-MM-DD" (el que usan los <input type="date">). */
export const fechaHoy = () => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(
    hoy.getDate()
  ).padStart(2, "0")}`;
};
