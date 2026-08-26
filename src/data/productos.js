/**
 * Las variedades, y el catalogo de lo que se hace.
 *
 * Las tarjetas de Recetas y de Costos ya no estan escritas aca: salen del alta
 * de Productos, que es la unica lista.
 */

/**
 * Lo que se da de alta es de uno de dos tipos, y de eso depende todo lo demas.
 *
 *   Producto     se hace con una receta y se vende por unidad.
 *                (Clasico Semiamargo, Mendiant, Tabletas)
 *
 *   Subproducto  no se hace: se arma con productos ya dados de alta.
 *                (Clasico Semiamargo CAJA x 6, Alfajores Surtidos x 12)
 *
 * Un subproducto no elige receta: su costo es el de lo que lleva adentro mas su
 * caja de carton. Lo normal es que lleve un solo producto repetido; si lleva
 * mas de uno, es un surtido.
 */
export const PRODUCTO = "producto";
export const SUBPRODUCTO = "subproducto";

// Lo dado de alta antes de que existieran los tipos no trae el campo: se deduce
// de como se vendia.
export const tipoDe = (item) =>
  item?.tipo || (item?.presentacion === "caja" ? SUBPRODUCTO : PRODUCTO);

export const esSubproducto = (item) => tipoDe(item) === SUBPRODUCTO;

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
 * Una tarjeta por producto dado de alta.
 *
 * Los subproductos no tienen tarjeta propia: una caja de 6 no se hace aparte,
 * se arma con el producto que ya la tiene. Por eso Recetas y Costos muestran
 * nueve tarjetas y no veintisiete.
 *
 * El orden es el del alta, asi que un producto nuevo aparece sin tocar codigo.
 */
export const productosDeCatalogo = (alfajores) => {
  const porReceta = new Map();

  (alfajores || [])
    .filter((producto) => producto.activo !== false && !esSubproducto(producto) && producto.receta)
    .forEach((producto) => {
      // Si dos productos apuntaran a la misma receta, manda el primero: la
      // tarjeta es de la receta, y es una sola.
      if (!porReceta.has(producto.receta)) porReceta.set(producto.receta, producto);
    });

  return [...porReceta].map(([slug, producto]) => ({
    slug,
    nombre: producto.nombre,
    categoria: producto.categoria || "Alfajor",
    imagen: producto.emoji || "\u{1F36A}",
  }));
};
