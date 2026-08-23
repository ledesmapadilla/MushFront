/**
 * Precio de venta de un producto y el registro de como fue cambiando.
 *
 * De un producto se cargan a mano dos numeros: la ganancia que se quiere dejar
 * vendiendo al publico y el descuento que se le hace al revendedor. Todo lo
 * demas sale de ahi y del costo:
 *
 *   precio publico    = costo / (1 - gcia. deseada)     redondeado a la centena
 *   precio revendedor = precio publico - su descuento   redondeado a la centena
 *   gcia. real        = (precio - costo) / precio       (gross margin)
 *
 * El precio tambien se mueve solo cuando cambia el costo, y el costo cambia
 * cuando se toca el precio de un ingrediente, del packaging o un sueldo. Por eso
 * el historial no se anota solo al editar esta pantalla: se anota en el momento
 * en que ocurre el cambio, venga de donde venga (ver `anotarPrecios` y su uso en
 * MushContext).
 */
import { fechaHoy } from "./sueldos.js";

// El precio de lista se cobra redondeado a la centena de arriba: 3458,20 se
// cobra 3500. Lo que se gana de mas queda a favor.
export const redondearACentena = (valor) => Math.ceil(valor / 100) * 100;

/**
 * Precio que sale de un costo y la ganancia que se quiere dejar. Con 100 o mas
 * no hay precio posible (no se puede dejar de ganancia todo el precio), asi que
 * devuelve null.
 */
export const precioDesdeMargen = (costo, margen) => {
  const deseada = Number(margen) / 100;
  if (!costo || !deseada || deseada >= 1) return null;
  return redondearACentena(costo / (1 - deseada));
};

/** Los dos precios de un producto. Cualquiera puede ser null si falta el dato. */
export const preciosDeProducto = (costo, { margenPublico, dtoRevendedor } = {}) => {
  const publico = precioDesdeMargen(costo, margenPublico);
  if (publico === null) return { publico: null, revendedor: null };

  const descuento = (Number(dtoRevendedor) || 0) / 100;
  return {
    publico,
    revendedor: descuento >= 1 ? null : redondearACentena(publico * (1 - descuento)),
  };
};

/** Lo que queda de ganancia sobre el precio que se cobra (gross margin). */
export const margenReal = (precio, costo) =>
  precio ? ((precio - costo) / precio) * 100 : null;

/**
 * Cada anotacion del historial es una foto completa: todo lo que hace al precio
 * en ese momento, no solo lo que se toco. Asi se lee una fila por fecha con
 * todas las columnas, y se puede comparar un dia contra otro.
 */
export const COLUMNAS_HISTORIAL = [
  { id: "margenPublico", titulo: "Gcia. deseada", formato: "porcentaje" },
  { id: "dtoRevendedor", titulo: "Dto. revend.", formato: "porcentaje" },
  { id: "unidadesPorCaja", titulo: "U. x caja", formato: "numero" },
  { id: "costo", titulo: "Costo", formato: "moneda" },
  { id: "publico", titulo: "Precio publico", formato: "moneda" },
  { id: "revendedor", titulo: "Precio revend.", formato: "moneda" },
];

const mismaFoto = (a, b) =>
  Boolean(a) && COLUMNAS_HISTORIAL.every(({ id }) => a[id] === b[id]);

/**
 * Anota como quedo el precio de una receta despues de un cambio y devuelve el
 * objeto `precios` nuevo.
 *
 * Hay una sola fila por fecha: varios cambios del mismo dia se van pisando, y
 * queda como quedo al final. Si nada cambio respecto de la ultima anotacion no
 * se agrega nada: el historial guarda cambios, no visitas.
 */
export const anotarPrecios = (precios = {}, { costo, publico, revendedor }) => {
  const historial = Array.isArray(precios.historial) ? precios.historial : [];
  const ultima = historial[historial.length - 1];

  const foto = {
    fecha: fechaHoy(),
    margenPublico: Number(precios.margenPublico) || 0,
    dtoRevendedor: Number(precios.dtoRevendedor) || 0,
    unidadesPorCaja: Number(precios.unidadesPorCaja) || 0,
    costo,
    publico,
    revendedor,
  };

  if (mismaFoto(ultima, foto)) return precios;

  // Del mismo dia queda una sola: la ultima pisa a la anterior.
  const previas = ultima?.fecha === foto.fecha ? historial.slice(0, -1) : historial;

  return { ...precios, historial: [...previas, foto] };
};

/**
 * Los cambios de una receta, del mas nuevo al mas viejo.
 *
 * Se saltean las anotaciones que no son una foto completa: quedaron de una
 * version anterior del historial y no tienen que mostrar la mitad de una fila.
 */
export const historialDeReceta = (receta) =>
  [...(receta?.precios?.historial || [])]
    .filter((dia) => dia && dia.publico !== undefined)
    .reverse();

/** Cuando se actualizo por ultima vez el precio de una receta. */
export const ultimaActualizacion = (receta) => historialDeReceta(receta)[0]?.fecha || "";
