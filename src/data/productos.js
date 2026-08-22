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
  { slug: "maicena", nombre: "Maicena", categoria: "Alfajor", imagen: "🥥" },
  { slug: "alfajor-de-nuez", nombre: "Alfajor de Nuez", categoria: "Alfajor", imagen: "🌰" },
  { slug: "alfajor-de-pistacho", nombre: "Alfajor de Pistacho", categoria: "Alfajor", imagen: "🟢" },
  { slug: "mini-semi", nombre: "Mini Semi", categoria: "Mini", imagen: "🍫" },
  { slug: "mini-blanco", nombre: "Mini Blanco", categoria: "Mini", imagen: "🥛" },
  { slug: "mendiant", nombre: "Mendiant", categoria: "Mendiant", imagen: "🍫✨" },
  { slug: "tabletas-chocolate", nombre: "Tabletas Chocolate", categoria: "Tableta", imagen: "🍫" },
];

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
