/**
 * Lo que se vende.
 *
 * La lista sale del alta de Productos, que es la unica fuente: ahi se da de alta
 * cada cosa que se vende, con su presentacion (una unidad o una caja de N) y de
 * que receta sale su costo. Precios y Ventas leen de aca, no de listas propias.
 *
 * La division es esta:
 *   Receta   -> como se hace          (ingredientes, packaging, mano de obra)
 *   Producto -> que se vende          (presentacion, cuantas unidades, su caja)
 *
 * Una caja no es otra receta: es el mismo producto en otra presentacion, y por
 * eso el costo de la caja sale del costo unitario de su receta.
 */
import { buscarReceta, costearProducto } from "./costos.js";
import { variedadesDe } from "../data/productos.js";

// El dinero se cuenta en centavos: si las partes se muestran redondeadas pero el
// total se calcula con todos los decimales, la suma no cierra en pantalla.
export const enCentavos = (valor) => Math.round(valor * 100) / 100;

/**
 * El costo de una unidad de la receta de un producto.
 *
 * Las recetas que agrupan variedades (las tabletas) no tienen ingredientes
 * propios: su costo es el de una de cada variedad, con el packaging y la mano de
 * obra una sola vez.
 */
const costoDeReceta = (slug, recetas, datos) => {
  const receta = buscarReceta(recetas, slug);
  const propio = costearProducto(receta, datos);
  if (propio.total > 0) return { receta, costo: propio };

  const variedades = variedadesDe(slug)
    .map((v) => costearProducto(buscarReceta(recetas, v.slug), datos))
    .filter((c) => c.total > 0);
  if (variedades.length === 0) return { receta, costo: propio };

  const sumaIngredientes = enCentavos(variedades.reduce((s, c) => s + c.ingredientes, 0));
  const pack = enCentavos(variedades[0].packaging);
  const manoObra = enCentavos(variedades[0].manoObra);

  return {
    receta,
    costo: {
      ...variedades[0],
      sumaIngredientes,
      variedades: variedades.length,
      packaging: pack,
      manoObra,
      total: sumaIngredientes + pack + manoObra,
    },
  };
};

/**
 * El catalogo de lo que se vende, con el costo ya resuelto.
 *
 * Devuelve, por cada producto activo del alta:
 *   id, nombre, emoji, categoria     lo cargado en el alta
 *   receta                            de donde sale el costo
 *   porCaja, unidades                 la presentacion
 *   costo                             lo que cuesta lo que se vende
 *   costoUnitario                     lo que cuesta una unidad suelta
 *   detalle                           de donde sale el costo, para mostrarlo
 */
export const articulosDeVenta = (alfajores, recetas, datos) => {
  const precioDeCaja = (id) =>
    Number((datos.packaging || []).find((p) => p.id === id)?.precio) || 0;

  return (alfajores || [])
    .filter((producto) => producto.activo !== false && producto.receta)
    .map((producto) => {
      const { costo: propio } = costoDeReceta(producto.receta, recetas, datos);
      const costoUnitario = enCentavos(propio.total);
      const carton = producto.presentacion === "caja" ? precioDeCaja(producto.carton) : 0;

      // Una caja armada lleva varios productos distintos; una comun, el mismo
      // repetido; una unidad, uno solo.
      const contenido = (producto.composicion || []).map(({ receta, cantidad }) => ({
        receta,
        cantidad,
        costo: enCentavos(costoDeReceta(receta, recetas, datos).costo.total),
      }));

      const costo = contenido.length
        ? contenido.reduce((suma, item) => suma + item.costo * item.cantidad, 0) + carton
        : producto.presentacion === "caja"
          ? costoUnitario * (Number(producto.unidades) || 0) + carton
          : costoUnitario;

      return {
        // El producto entero, para poder guardarle el precio.
        producto,
        precios: producto.precios || {},
        id: producto.id,
        nombre: producto.nombre,
        emoji: producto.emoji || "",
        categoria: producto.categoria,
        receta: producto.receta,
        porCaja: producto.presentacion === "caja",
        unidades: Number(producto.unidades) || 0,
        contenido,
        carton,
        costoUnitario,
        costo: enCentavos(costo),
        // Un producto sin costo todavia no se puede costear (le falta la receta
        // o los precios de sus insumos).
        sinCosto: costo <= 0,
        unidad: propio.unidad,
        sumaIngredientes: propio.sumaIngredientes,
        variedadesDeLaCaja: propio.variedades,
        packaging: propio.packaging,
        manoObra: propio.manoObra,
      };
    });
};
