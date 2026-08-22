/**
 * Conversion de unidades de un ingrediente.
 *
 * Dentro de una misma familia (peso, volumen, unidad) la conversion es fija.
 * Para cruzar de una familia a otra (kg -> lts, kg -> un) hace falta saber
 * cuanto pesa un litro o cuanto pesa una unidad, y eso es justo lo que se anota
 * a mano en las observaciones del ingrediente: "1lts de miel pesa 1,4 kg",
 * "Un huevo, pesa 50 gr". De ahi salen las equivalencias.
 */

// Cada unidad se expresa en la base de su familia (gr para peso, ml para
// volumen, un para unidad).
const UNIDADES = {
  kg: { familia: "peso", base: 1000 },
  gr: { familia: "peso", base: 1 },
  lts: { familia: "volumen", base: 1000 },
  ml: { familia: "volumen", base: 1 },
  un: { familia: "unidad", base: 1 },
};

export const UNIDADES_CONVERTIBLES = ["kg", "gr", "lts", "ml", "un"];

const SINONIMOS = [
  { unidad: "kg", palabras: ["kg", "kgs", "kilo", "kilos", "kilogramo", "kilogramos"] },
  { unidad: "gr", palabras: ["gr", "grs", "g", "gramo", "gramos"] },
  { unidad: "lts", palabras: ["lts", "lt", "l", "litro", "litros"] },
  { unidad: "ml", palabras: ["ml", "cc", "mililitro", "mililitros"] },
  { unidad: "un", palabras: ["un", "u", "unidad", "unidades"] },
];

const normalizar = (texto) =>
  String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** "kilos" -> "kg". Devuelve null si la palabra no es una unidad conocida. */
const unidadDePalabra = (palabra) => {
  const limpia = normalizar(palabra);
  const encontrada = SINONIMOS.find((s) => s.palabras.includes(limpia));
  return encontrada ? encontrada.unidad : null;
};

/** Singular aproximado, para emparejar "limones" con "Limón". */
const singular = (palabra) => {
  if (palabra.length <= 3) return palabra;
  if (palabra.endsWith("ces")) return `${palabra.slice(0, -3)}z`;
  if (palabra.endsWith("es")) return palabra.slice(0, -2);
  if (palabra.endsWith("s")) return palabra.slice(0, -1);
  return palabra;
};

// "8 limones" cuenta como 8 unidades del ingrediente Limon. Se exige que la
// palabra sea el nombre del ingrediente: si no, un texto como "10 kg a 1500
// pesos" leeria "pesos" como si fuera una unidad.
const esElIngrediente = (palabra, nombre) => {
  const candidata = singular(normalizar(palabra));
  if (candidata.length < 3) return false;

  return normalizar(nombre)
    .split(/\s+/)
    .filter((p) => p.length >= 3)
    .some((p) => singular(p) === candidata);
};

/**
 * Magnitudes del texto, en el orden en que aparecen:
 *  - "1,4 kg" / "50 gr"      -> numero + unidad
 *  - "8 limones" / "un huevo" -> numero + el nombre del ingrediente = unidades
 *  - "por kilo"               -> unidad sin numero = 1 de esa unidad
 */
const magnitudesDeTexto = (texto, nombre) => {
  const encontradas = [];
  const expresion = /(\d+(?:[.,]\d+)?|\b(?:un|una)\b)?\s*([a-zñáéíóúü]+)/gi;

  let coincidencia = expresion.exec(texto);
  while (coincidencia) {
    const [, numeroCrudo, palabra] = coincidencia;
    const numero = numeroCrudo
      ? Number(normalizar(numeroCrudo).replace(",", ".")) || 1
      : null;
    const unidad = unidadDePalabra(palabra);

    if (unidad && numero !== null) {
      encontradas.push({ cantidad: numero, unidad });
    } else if (unidad && normalizar(palabra).length >= 2) {
      // Unidad suelta ("por kilo"): vale por una
      encontradas.push({ cantidad: 1, unidad });
    } else if (numero !== null && nombre && esElIngrediente(palabra, nombre)) {
      encontradas.push({ cantidad: numero, unidad: "un" });
    }

    coincidencia = expresion.exec(texto);
  }

  return encontradas;
};

/**
 * Lee una equivalencia escrita a mano: "1lts de miel pesa 1,4 kg",
 * "Un huevo, pesa 50 gr", "8 limones por kilo". Devuelve los dos lados de la
 * igualdad, o null si el texto no dice nada convertible.
 */
export const equivalenciaDeTexto = (texto, nombre = "") => {
  if (!texto) return null;

  const magnitudes = magnitudesDeTexto(texto, nombre);
  if (magnitudes.length < 2) return null;

  return { a: magnitudes[0], b: magnitudes[1], texto: String(texto).trim() };
};

// Solo sirve la equivalencia que une dos familias distintas: "1 kg son 1000 gr"
// es cierto pero no aporta nada que no sepamos.
const esCruzada = (equivalencia) =>
  UNIDADES[equivalencia.a.unidad].familia !== UNIDADES[equivalencia.b.unidad].familia;

/**
 * Busca la equivalencia del ingrediente en lo anotado en Precios (la
 * observacion del precio vigente y las del historial) y en las observaciones
 * del alta. Gana la primera que diga algo convertible.
 */
export const equivalenciaDeItem = (item) => {
  if (!item) return null;

  const textos = [
    item.observacionesPrecio,
    item.observaciones,
    ...(Array.isArray(item.historialPrecios)
      ? item.historialPrecios.map((registro) => registro?.observaciones)
      : []),
  ];

  for (const texto of textos) {
    const equivalencia = equivalenciaDeTexto(texto, item.nombre);
    if (equivalencia && esCruzada(equivalencia)) return equivalencia;
  }

  return null;
};

const enBase = (magnitud) => magnitud.cantidad * UNIDADES[magnitud.unidad].base;

// Cuantas unidades base de la familia destino equivale una unidad base de la
// familia origen, segun la equivalencia anotada.
const factorEntreFamilias = (equivalencia, familiaDesde, familiaHasta) => {
  if (!equivalencia) return null;

  const familiaA = UNIDADES[equivalencia.a.unidad].familia;
  const familiaB = UNIDADES[equivalencia.b.unidad].familia;
  const baseA = enBase(equivalencia.a);
  const baseB = enBase(equivalencia.b);
  if (!baseA || !baseB) return null;

  if (familiaA === familiaDesde && familiaB === familiaHasta) return baseB / baseA;
  if (familiaB === familiaDesde && familiaA === familiaHasta) return baseA / baseB;
  return null;
};

/**
 * Convierte una cantidad entre dos unidades. Devuelve null cuando el cruce de
 * familias necesita una equivalencia que el ingrediente todavia no tiene
 * anotada.
 */
export const convertir = (cantidad, desde, hasta, equivalencia) => {
  const unidadDesde = UNIDADES[desde];
  const unidadHasta = UNIDADES[hasta];
  if (!unidadDesde || !unidadHasta || !Number.isFinite(cantidad)) return null;

  const valorEnBase = cantidad * unidadDesde.base;

  if (unidadDesde.familia === unidadHasta.familia) {
    return valorEnBase / unidadHasta.base;
  }

  const factor = factorEntreFamilias(equivalencia, unidadDesde.familia, unidadHasta.familia);
  if (factor === null) return null;

  return (valorEnBase * factor) / unidadHasta.base;
};

/** true si las dos unidades pertenecen a la misma familia. */
export const mismaFamilia = (desde, hasta) =>
  Boolean(UNIDADES[desde] && UNIDADES[hasta]) &&
  UNIDADES[desde].familia === UNIDADES[hasta].familia;

const formateadorCantidad = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 });

export const formatearCantidad = (valor) => formateadorCantidad.format(valor || 0);

/** "1 un = 50 gr", para mostrar de donde sale la conversion. */
export const textoEquivalencia = (equivalencia) =>
  equivalencia
    ? `${formatearCantidad(equivalencia.a.cantidad)} ${equivalencia.a.unidad} = ` +
      `${formatearCantidad(equivalencia.b.cantidad)} ${equivalencia.b.unidad}`
    : "";
