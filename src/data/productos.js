/**
 * Catalogo de productos de MUSH.
 *
 * Es la unica lista: las pantallas que muestran la grilla de tarjetas de
 * productos (Recetas, Costos) la importan de aca para que siempre sean
 * exactamente las mismas tarjetas.
 */
export const PRODUCTOS_BASE = [
  { slug: "clasico-semiamargo", nombre: "Clasico Semiamargo", categoria: "Alfajor", imagen: "🍫" },
  { slug: "clasico-blanco", nombre: "Clasico Blanco", categoria: "Alfajor", imagen: "🥛" },
  { slug: "maicena", nombre: "Maicena", categoria: "Alfajor", imagen: "🌽" },
  { slug: "alfajor-de-nuez", nombre: "Alfajor de Nuez", categoria: "Alfajor", imagen: "🌰" },
  { slug: "alfajor-de-pistacho", nombre: "Alfajor de Pistacho", categoria: "Alfajor", imagen: "🟢" },
  { slug: "mini-semi", nombre: "Mini Semiamargo", categoria: "Mini", imagen: "🍪" },
  { slug: "mini-blanco", nombre: "Mini Blanco", categoria: "Mini", imagen: "🤍" },
  // Arranca otra familia de productos: las listas lo marcan con una linea.
  { slug: "mendiant", nombre: "Mendiant", categoria: "Mendiant", imagen: "🙇", corte: true },
  { slug: "tabletas-chocolate", nombre: "Tabletas de Chocolate", categoria: "Tableta", imagen: "🟫" },
];

/**
 * Productos que en vez de una receta propia agrupan variedades. Al abrirlos se
 * muestran estas tarjetas, y cada una es una receta como cualquier otra.
 */
export const VARIEDADES = {
  "tabletas-chocolate": [
    { slug: "tableta-con-leche-krispi", nombre: "Tableta con leche Krispi", imagen: "🌾" },
    { slug: "tableta-con-leche-avellana", nombre: "Tableta con leche Avellana", imagen: "🌰" },
    { slug: "tableta-con-leche-marroc", nombre: "Tableta con leche Marroc", imagen: "🍬" },
    { slug: "tableta-con-leche-garrapinada", nombre: "Tableta con leche Garrapiñada", imagen: "🥜" },
    { slug: "tableta-blanco-castana", nombre: "Tableta blanco Castaña", imagen: "🤎" },
    { slug: "tableta-blanco-pistacho", nombre: "Tableta blanco Pistacho", imagen: "🟢" },
    { slug: "tableta-blanco-coco", nombre: "Tableta blanco Coco", imagen: "🥥" },
    { slug: "tableta-blanco-frutos", nombre: "Tableta blanco Frutos", imagen: "🍓" },
    { slug: "tableta-semiamargo-almendras", nombre: "Tableta semiamargo Almendras", imagen: "🫒" },
    { slug: "tableta-semiamargo-cacao", nombre: "Tableta semiamargo Cacao", imagen: "🍩" },
  ],
};

export const variedadesDe = (slug) => VARIEDADES[slug] || [];

/** El producto que agrupa a una variedad, para poder volver a el. */
export const productoDeVariedad = (slug) =>
  Object.keys(VARIEDADES).find((padre) =>
    VARIEDADES[padre].some((v) => v.slug === slug)
  ) || null;

const canonico = (texto) => (texto || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Combina el catalogo base con los productos dados de alta: si el alfajor ya
 * existe en el sistema manda su nombre y su categoria.
 */
export const productosDeCatalogo = (alfajores) =>
  PRODUCTOS_BASE.map((base) => {
    const coincidencia = (alfajores || []).find(
      (a) => canonico(a.nombre) === canonico(base.nombre)
    );
    return {
      ...base,
      nombre: coincidencia ? coincidencia.nombre : base.nombre,
      categoria: coincidencia?.categoria || base.categoria,
    };
  });
