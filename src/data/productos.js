/**
 * Las variedades, y el catalogo de lo que se hace.
 *
 * Las tarjetas de Recetas y de Costos ya no estan escritas aca: salen del alta
 * de Productos, que es la unica lista. Cada producto declara con que receta se
 * costea, y esa receta es la tarjeta. Dos presentaciones de lo mismo (la unidad
 * y su caja de 6) comparten receta, asi que son una sola tarjeta.
 */

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

/**
 * Una tarjeta por receta usada en el alta de Productos.
 *
 * El nombre, la categoria y el emoji salen del producto que la usa. Cuando son
 * varios manda el que se vende suelto: la tarjeta se llama "Clasico Semiamargo"
 * y no "Clasico semiamargo (CAJA x 6)".
 *
 * El orden es el del alta, asi que un producto nuevo aparece sin tocar codigo.
 */
export const productosDeCatalogo = (alfajores) => {
  const porReceta = new Map();

  (alfajores || [])
    .filter((producto) => producto.activo !== false && producto.receta)
    .forEach((producto) => {
      const anterior = porReceta.get(producto.receta);
      const manda =
        !anterior || (anterior.presentacion === "caja" && producto.presentacion !== "caja");
      if (manda) porReceta.set(producto.receta, producto);
    });

  return [...porReceta].map(([slug, producto]) => ({
    slug,
    nombre: producto.nombre,
    categoria: producto.categoria || "Alfajor",
    imagen: producto.emoji || "\u{1F36A}",
  }));
};
