/**
 * Costo por unidad de un producto: ingredientes, packaging y mano de obra.
 *
 * De donde sale cada parte:
 *   - "masa": las cantidades estan anotadas por tanda, asi que se divide por el
 *     rinde de la receta (126 alfajores, 1 lata, 18 tabletas).
 *   - "unitario" y "packaging": ya vienen por unidad, se suman tal cual.
 *   - "pasta-pistacho" / "praline-pistacho" quedan afuera a proposito: son el
 *     desglose de las filas de "unitario", que ya las tienen sumadas.
 *   - mano de obra: el sueldo (o el valor hora) del legajo asignado dividido lo
 *     que produce, igual que en la tarjeta de Mano de obra de la receta.
 *
 * El precio de cada insumo esta en su unidad de compra (kg, lts, un) y la
 * receta se escribe en gramos, asi que la cantidad se convierte antes de
 * multiplicar. Cuando la conversion necesita una equivalencia que el
 * ingrediente todavia no tiene anotada (aceite en lts contra gramos de receta,
 * sin el "1 lts = 1 kg" escrito en el precio), esa linea no se puede costear:
 * no suma cero por las buenas, queda marcada como incompleta para poder
 * avisarlo en pantalla.
 *
 * Cada linea del costeo se devuelve en `lineas` para poder mostrar de donde
 * sale el numero final (pantalla de detalle de Costos).
 */
import { convertir, equivalenciaDeItem } from "./conversiones.js";
import { valorMensual, valorHora } from "./sueldos.js";

// Lo que ya estaba cargado sin "seccion" pertenece a la masa (misma regla que
// en la receta).
const SECCION_POR_DEFECTO = "masa";

// Las tres secciones que suman al costo, en el orden en que se muestran.
export const SECCIONES_COSTO = [
  { id: "masa", titulo: "Ingredientes de la masa", porTanda: true },
  { id: "unitario", titulo: "Ingredientes por unidad" },
  { id: "packaging", titulo: "Packaging" },
];

/**
 * Las tres partes en las que se abre el costo. Son las cajas del resumen y, en
 * el detalle, lo que se puede mirar por separado: cada una junta las secciones
 * de receta que le corresponden.
 */
export const PARTES_COSTO = [
  {
    id: "ingredientes",
    titulo: "Ingredientes",
    campo: "ingredientes",
    secciones: ["masa", "unitario"],
  },
  { id: "packaging", titulo: "Packaging", campo: "packaging", secciones: ["packaging"] },
  {
    id: "mano-de-obra",
    titulo: "Mano de obra",
    campo: "manoObra",
    secciones: [],
    esManoDeObra: true,
  },
];

// La suma de las tres. No es una parte mas: es el resultado.
export const PARTE_TOTAL = { id: "total", titulo: "Total", campo: "total" };

export const buscarParte = (id) => PARTES_COSTO.find((parte) => parte.id === id) || null;

const normalizar = (texto) =>
  (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

/** La receta de un producto, buscada por slug, id o nombre. */
export const buscarReceta = (recetas, slug) => {
  const buscado = normalizar(slug);
  return (
    (recetas || []).find(
      (r) =>
        normalizar(r.slug) === buscado ||
        normalizar(r.id) === buscado ||
        normalizar(r.nombre) === buscado
    ) || null
  );
};

/** Singular de la unidad del rinde: "alfajores" -> "alfajor", "lata" -> "lata". */
export const unidadSingular = (receta) => {
  const unidad = receta?.unidadRinde || "alfajores";
  if (unidad.endsWith("es")) return unidad.slice(0, -2);
  if (unidad.endsWith("s")) return unidad.slice(0, -1);
  return unidad;
};

/**
 * Una linea de la receta, costeada. `cantidadEnCompra` es la cantidad llevada a
 * la unidad en la que se compra el insumo, que es la que se multiplica por el
 * precio; queda null cuando falta la equivalencia para convertirla.
 *
 * Por defecto cuesta la linea tal como esta escrita. Las secciones anotadas por
 * tanda pasan el rinde para bajarla a la unidad.
 */
export const costearLinea = (linea, catalogo, rinde = 1, porTanda = false) => {
  const insumo = (catalogo || []).find((item) => item.id && item.id === linea.ingredienteId);
  const precio = Number(insumo?.precio) || 0;
  const cantidad = Number(linea.cantidad) || 0;

  const cantidadEnCompra =
    !insumo || cantidad === 0
      ? cantidad
      : linea.unidad === insumo.unidad
        ? cantidad
        : convertir(cantidad, linea.unidad, insumo.unidad, equivalenciaDeItem(insumo));

  const incompleto = !insumo || !precio || cantidadEnCompra === null;
  const costoTanda = incompleto ? 0 : cantidadEnCompra * precio;

  return {
    id: linea.id,
    nombre: linea.nombre,
    cantidad,
    unidad: linea.unidad,
    precio,
    unidadCompra: insumo?.unidad || linea.unidad,
    cantidadEnCompra: incompleto ? null : cantidadEnCompra,
    costoTanda,
    costo: porTanda ? costoTanda / rinde : costoTanda,
    porTanda,
    incompleto,
  };
};

/** Mano de obra por unidad, con los numeros de los que sale. */
const costearManoDeObra = (receta, personal) => {
  const manoDeObra = receta?.manoDeObra || {};
  const persona =
    (personal || []).find((item) => item.id && item.id === manoDeObra.personalId) || null;

  // Las recetas que se miden por hora (el mendiant, en latas por hora) usan el
  // valor hora del legajo; las demas, su sueldo mensual. Si el legajo ya no
  // esta, queda el monto que la receta tenia guardado.
  const porHora = (receta?.unidadRinde || "alfajores") !== "alfajores";
  const mensual = (persona ? valorMensual(persona) : 0) || Number(manoDeObra.mensual) || 0;
  const pago = porHora ? (persona ? valorHora(persona) : 0) : mensual;
  const producidos = Number(manoDeObra.alfajoresProducidos) || 0;

  return {
    persona: persona?.nombre || "",
    porHora,
    pago,
    producidos,
    costo: producidos > 0 ? pago / producidos : 0,
  };
};

const COSTO_VACIO = {
  ingredientes: 0,
  packaging: 0,
  manoObra: 0,
  total: 0,
  incompletos: 0,
  unidad: "alfajor",
  rinde: 1,
  lineas: [],
  detalleManoObra: { persona: "", porHora: false, pago: 0, producidos: 0, costo: 0 },
};

/** Costo por unidad de una receta, abierto en sus tres partes. */
export const costearProducto = (receta, { ingredientes, packaging, personal } = {}) => {
  if (!receta) return COSTO_VACIO;

  const rinde = Number(receta.rinde) || 1;
  const acumulado = { masa: 0, unitario: 0, packaging: 0 };
  const lineas = [];
  let incompletos = 0;

  (receta.ingredientes || []).forEach((linea) => {
    const id = linea.seccion || SECCION_POR_DEFECTO;
    const seccion = SECCIONES_COSTO.find((s) => s.id === id);
    // Cada receta declara en su dato que secciones no lleva (una tableta no
    // tiene ingredientes por unidad).
    if (!seccion || receta.sinSecciones?.includes(id)) return;

    const costeada = costearLinea(
      linea,
      id === "packaging" ? packaging : ingredientes,
      rinde,
      Boolean(seccion.porTanda)
    );

    lineas.push({ ...costeada, seccion: id });
    acumulado[id] += costeada.costo;
    if (costeada.incompleto) incompletos += 1;
  });

  const costoIngredientes = acumulado.masa + acumulado.unitario;
  const detalleManoObra = costearManoDeObra(receta, personal);

  return {
    ingredientes: costoIngredientes,
    packaging: acumulado.packaging,
    manoObra: detalleManoObra.costo,
    total: costoIngredientes + acumulado.packaging + detalleManoObra.costo,
    incompletos,
    unidad: unidadSingular(receta),
    rinde,
    lineas,
    detalleManoObra,
  };
};

/**
 * Promedio de varios costeos, para los productos que agrupan variedades (las
 * tabletas): el producto no tiene receta propia, la tienen sus variedades.
 * Solo promedia las que ya tienen algo cargado.
 */
export const promedioDeCostos = (costos) => {
  const conDatos = (costos || []).filter((costo) => costo.total > 0);
  if (conDatos.length === 0) return { ...COSTO_VACIO, promedioDe: 0 };

  const promedio = (campo) =>
    conDatos.reduce((total, costo) => total + costo[campo], 0) / conDatos.length;

  return {
    ...COSTO_VACIO,
    ingredientes: promedio("ingredientes"),
    packaging: promedio("packaging"),
    manoObra: promedio("manoObra"),
    total: promedio("total"),
    incompletos: conDatos.reduce((total, costo) => total + costo.incompletos, 0),
    unidad: conDatos[0].unidad,
    promedioDe: conDatos.length,
  };
};
