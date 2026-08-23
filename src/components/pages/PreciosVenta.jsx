import { useState, useEffect, useMemo } from "react";
import { useMush } from "../../context/MushContext";
import { productosDeCatalogo, variedadesDe } from "../../data/productos";
import { buscarReceta, costearProducto } from "../../utils/costos";
import { moneda, fechaLegible } from "../../utils/sueldos";
import {
  anotarPrecios,
  COLUMNAS_HISTORIAL,
  historialDeReceta,
  margenReal,
  precioDesdeMargen,
  preciosDeProducto,
  ultimaActualizacion,
} from "../../utils/precios";

/**
 * Precios de venta: una fila por producto, con el costo al lado de los dos
 * precios y, separados al final, los margenes.
 *
 * El costo se calcula (es el mismo de Costos). Los precios y los margenes se
 * cargan a mano en la tabla y se guardan en la receta, asi que quedan para
 * todos, no solo en este navegador.
 *
 * Las tabletas no tienen precio propio: lo tiene cada variedad, y por eso van
 * como filas debajo de su titulo.
 */

// El ancho lo comparten el titulo y la tabla, para que no se desfasen.
const ANCHO_BLOQUE = "1340px";

// Los precios que se cargan a mano. El id es el campo dentro de `receta.precios`.
// Los precios no se cargan: salen del costo y del margen que se quiere dejar.
const PRECIOS = [
  { id: "publico", titulo: "Precio publico", color: "mush-col-publico", canal: "publico" },
  {
    id: "revendedor",
    titulo: "Precio revendedor",
    color: "mush-col-revendedor",
    canal: "revendedor",
  },
];

// Lo unico que se carga a mano: la ganancia que se quiere dejar, en porcentaje.
// La columna mide lo justo para tres cifras y el signo.
const MARGENES = [
  { id: "margenPublico", titulo: "Gcia. deseada (publico)", color: "mush-col-publico" },
  {
    id: "margenRevendedor",
    titulo: "Gcia. real (revend.)",
    color: "mush-col-revendedor",
    canal: "revendedor",
  },
];

// Lo que deja cada canal en pesos: el precio menos el costo.
const GANANCIAS = [
  {
    id: "gananciaPublico",
    titulo: "Ganancia publico",
    color: "mush-col-publico",
    canal: "publico",
  },
  {
    id: "gananciaRevendedor",
    titulo: "Ganancia revendedor",
    color: "mush-col-revendedor",
    canal: "revendedor",
  },
];

// El descuento que se le hace al revendedor. Va en su propio bloque, entre el
// detalle y los margenes.
const UNIDADES_POR_CAJA = "unidadesPorCaja";

const DESCUENTOS = [
  {
    id: "dtoRevendedor",
    titulo: "Dto. revendedor",
    color: "mush-col-revendedor",
    // Es la columna mas angosta: el titulo entra solo con la letra mas chica.
    letra: "0.62rem",
  },
];

// Lo que se guarda en la receta: la ganancia que se quiere dejar en publico y
// el descuento del revendedor. Todo lo demas sale de ahi.
const EDITABLES = [...DESCUENTOS, { id: "margenPublico" }, { id: UNIDADES_POR_CAJA }];

// Las dos tablas se dibujan aparte, asi que los altos se fijan a mano: si no,
// cada una los calcula por su cuenta y las lineas dejan de coincidir.
const ALTO_CABECERA = "66px";
const ALTO_FILA = "34px";
const ALTO_GRUPO = "34px";

// Una cuenta escrita como se lee: el nombre, y a la derecha el numerador sobre
// el denominador separados por una raya.
const formula = (nombre, arriba, abajo) => (
  <span className="d-inline-flex align-items-center gap-1">
    <span className="text-secondary text-nowrap" style={{ fontSize: "0.72rem" }}>
      {nombre}
    </span>
    <span className="text-center">
      <span className="d-block text-white text-nowrap px-1" style={{ fontSize: "0.72rem" }}>
        {arriba}
      </span>
      <span
        className="d-block text-white text-nowrap px-1 border-top border-secondary"
        style={{ fontSize: "0.72rem" }}
      >
        {abajo}
      </span>
    </span>
  </span>
);

// Un porcentaje, redondeado al entero. Si no esta se lee "-", igual que un
// importe vacio.
const porcentaje = (valor) =>
  valor === null || valor === undefined ? "-" : `${Math.round(valor)} %`;

// Las filas del modal, en el orden en que se leen. Las que llevan campo son
// editables (el margen) o calculadas (el precio y su ganancia).
const FILAS_MODAL = [
  { titulo: "Producto", valor: (fila) => fila.nombre },
  { titulo: "Un.", valor: (fila, porCaja) => (porCaja ? "caja" : fila.costo.unidad) },
  { titulo: "Costo", esCosto: true },
  { titulo: "Gcia. deseada (publico)", campoMargen: "margenPublico", nota: "(Dato)" },
  {
    titulo: "Gcia. real (revendedor)",
    valor: null,
    canalMargen: "revendedor",
    nota: "(de cálculo)",
  },
  { titulo: "Precio publico", canal: "publico" },
  { titulo: "Dto. revendedor", campoMargen: "dtoRevendedor" },
  { titulo: "Precio revendedor", canal: "revendedor" },
];

// El precio del revendedor: el publico con su descuento. Se usa tanto para
// mostrarlo como para anotarlo en el historial.
const precioDeRevendedor = (costo, { margenPublico, dtoRevendedor }) =>
  preciosDeProducto(costo, { margenPublico, dtoRevendedor }).revendedor;

const PreciosVenta = () => {
  const { alfajores, recetas, ingredientes, packaging, personal, guardarReceta } = useMush();

  // Las filas: los productos sueltos y, debajo de su titulo, las variedades de
  // los que agrupan.
  const filas = useMemo(() => {
    const datos = { ingredientes, packaging, personal };

    const armar = (item) => {
      const receta = buscarReceta(recetas, item.slug);
      return {
        slug: item.slug,
        nombre: receta?.nombre || item.nombre,
        imagen: item.imagen,
        // Marca el arranque de otra familia de productos
        corte: item.corte,
        receta,
        costo: costearProducto(receta, datos),
      };
    };

    return productosDeCatalogo(alfajores).flatMap((producto) => {
      const variedades = variedadesDe(producto.slug);
      if (variedades.length === 0) return [armar(producto)];
      // El que agrupa no es una fila: es el titulo de las suyas.
      return [
        { titulo: producto.nombre, imagen: producto.imagen },
        ...variedades.map(armar),
      ];
    });
  }, [alfajores, recetas, ingredientes, packaging, personal]);

  // Los precios se miran por unidad o por caja; la caja multiplica todo por
  // las unidades que entren en ella.
  const [porCaja, setPorCaja] = useState(false);

  // La fila que se esta mirando en el modal de calculo (null = cerrado).
  const [filaModal, setFilaModal] = useState(null);
  // Y aparte se puede ver como fueron cambiando los datos.
  const [verHistorial, setVerHistorial] = useState(false);

  const abrirModal = (fila) => {
    setFilaModal(fila);
    setVerHistorial(false);
  };

  // Borrador local para poder tipear sin guardar en cada tecla.
  const [borrador, setBorrador] = useState({});

  // Lo guardado manda: si cambia la receta (o contesta el backend), se refresca.
  useEffect(() => {
    const guardados = {};
    (recetas || []).forEach((receta) => {
      const precios = receta.precios || {};
      EDITABLES.forEach(({ id }) => {
        if (precios[id] !== undefined && precios[id] !== "") {
          guardados[`${receta.slug}:${id}`] = String(precios[id]);
        }
      });
    });
    setBorrador(guardados);
  }, [recetas]);

  const valorDe = (slug, campo) => borrador[`${slug}:${campo}`] ?? "";

  const escribir = (slug, campo, valor) =>
    setBorrador((prev) => ({ ...prev, [`${slug}:${campo}`]: valor.replace(/[^0-9.,]/g, "") }));

  /**
   * Guarda un valor y anota el cambio.
   *
   * Cada cambio queda en `precios.historial` como una entrada nueva, igual que
   * el historial de precios de un ingrediente: asi se puede ver cuando se movio
   * cada numero, en vez de solo el ultimo.
   */
  const guardar = (fila, campo) => {
    if (!fila.receta) return;

    const anterior = fila.receta.precios || {};
    const escrito = valorDe(fila.slug, campo);
    const numero = escrito === "" ? "" : Number(String(escrito).replace(",", ".")) || 0;
    // Salir del campo sin haberlo tocado no es un cambio.
    if (String(anterior[campo] ?? "") === String(numero)) return;

    // La anotacion es una foto de como quedo el precio, asi que se arma con el
    // dato nuevo ya puesto.
    const cambiado = { ...anterior, [campo]: numero };
    const costo = fila.costo.total;
    const precios = anotarPrecios(cambiado, {
      costo,
      publico: precioDesdeMargen(costo, cambiado.margenPublico),
      revendedor: precioDeRevendedor(costo, cambiado),
    });

    guardarReceta({ ...fila.receta, precios });
  };

  // Lo escrito en un campo, como numero. Se lee del borrador y no de lo
  // guardado, asi las cuentas se mueven mientras se prueba.
  const numeroDe = (fila, id) => Number(String(valorDe(fila.slug, id)).replace(",", ".")) || 0;

  /**
   * El precio de cada canal:
   *   publico    -> del costo y la ganancia que se quiere dejar
   *   revendedor -> el publico menos el descuento que se le hace
   *
   * Los dos se cobran redondeados a la centena de arriba.
   */
  const precioDeCanal = (fila, canal) => {
    const cantidad = multiplicador(fila);
    if (cantidad === null) return null;

    const publico = precioDesdeMargen(fila.costo.total, numeroDe(fila, "margenPublico"));
    if (canal === "publico") return publico === null ? null : publico * cantidad;

    const revendedor = precioDeRevendedor(fila.costo.total, {
      margenPublico: numeroDe(fila, "margenPublico"),
      dtoRevendedor: numeroDe(fila, "dtoRevendedor"),
    });
    return revendedor === null ? null : revendedor * cantidad;
  };

  // Por unidad es uno; por caja, lo que entre en la caja (sin cargar, no hay
  // precio de caja que mostrar).
  const multiplicador = (fila) => (porCaja ? numeroDe(fila, UNIDADES_POR_CAJA) || null : 1);

  const costoDeFila = (fila) => {
    const cantidad = multiplicador(fila);
    return cantidad === null ? null : fila.costo.total * cantidad;
  };

  const gananciaDeCanal = (fila, canal) => {
    const precio = precioDeCanal(fila, canal);
    const costo = costoDeFila(fila);
    return precio === null || costo === null ? null : precio - costo;
  };

  // Lo que queda de ganancia sobre el precio que se termina cobrando. No es el
  // porcentaje que se pidio: el redondeo y el descuento lo mueven.
  // El porcentaje no cambia entre unidad y caja: la caja es la unidad repetida.
  const margenRealDeCanal = (fila, canal) =>
    margenReal(precioDeCanal(fila, canal), costoDeFila(fila));

  const campo = (fila, id, ancho) => (
    <input
      type="text"
      inputMode="decimal"
      className="form-control form-control-sm mush-input mush-dato py-0 px-1 text-center"
      style={{ width: ancho }}
      placeholder="-"
      value={valorDe(fila.slug, id)}
      onChange={(e) => escribir(fila.slug, id, e.target.value)}
      onBlur={() => guardar(fila, id)}
      // Enter cierra la carga: sale del campo, y al salir se guarda.
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      autoComplete="off"
      spellCheck="false"
    />
  );

  // Cada bloque de columnas es una tabla propia, con su marco, despegada de las
  // otras. Comparten los altos de arriba, asi las filas quedan enfrentadas.
  const tablaBloque = (columnas, ancho, celda) => (
    <table
      className="table mush-tabla mush-tabla-compacta mush-tabla-pareja align-middle mb-0 flex-shrink-0"
      style={{ tableLayout: "fixed", width: ancho }}
    >
      <thead>
        <tr className="text-center" style={{ height: ALTO_CABECERA }}>
          {columnas.map(({ id, titulo, color, letra }) => (
            <th key={id} className={color} style={{ width: `${100 / columnas.length}%` }}>
              <span className="mush-th-caja" style={letra ? { fontSize: letra } : undefined}>
                {titulo}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((fila) =>
          // La fila del titulo se repite vacia, para no perder el paso con las
          // otras tablas.
          fila.titulo ? (
            <tr key={fila.titulo} className="mush-fila-grupo" style={{ height: ALTO_GRUPO }}>
              <td colSpan={columnas.length}></td>
            </tr>
          ) : (
            <tr
              key={fila.slug}
              className={fila.corte ? "mush-fila-corte" : ""}
              style={{ height: ALTO_FILA }}
            >
              {columnas.map((columna) => (
                <td key={columna.id} className={columna.color}>
                  {celda(fila, columna)}
                </td>
              ))}
            </tr>
          )
        )}
      </tbody>
    </table>
  );

  return (
    <div className="container py-4">
      <div
        className="mx-auto d-flex flex-column"
        style={{
          maxWidth: ANCHO_BLOQUE,
          width: "100%",
          // Lo que queda de pantalla despues del navbar; el footer es fijo, asi
          // que su alto se descuenta abajo.
          minHeight: "calc(100vh - 130px)",
          paddingBottom: "70px",
        }}
      >
        {/* El titulo queda centrado en la pagina y el switch, centrado en lo que
            sobra a su derecha. */}
        <div className="d-flex align-items-center mb-1">
          <span className="flex-grow-1" style={{ flexBasis: 0 }}></span>
          <h2 className="mush-display text-white mb-0">Lista de Precios</h2>
          <div
            className="flex-grow-1 d-flex align-items-center justify-content-center gap-2"
            style={{ flexBasis: 0 }}
          >
            <span
              className={porCaja ? "text-secondary" : "text-dulce fw-bold"}
              style={{ fontSize: "0.72rem" }}
            >
              por unidad
            </span>
            <div className="form-check form-switch m-0">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                id="switch-por-caja"
                checked={porCaja}
                onChange={(e) => setPorCaja(e.target.checked)}
              />
            </div>
            <label
              className={porCaja ? "text-dulce fw-bold" : "text-secondary"}
              style={{ fontSize: "0.72rem", cursor: "pointer" }}
              htmlFor="switch-por-caja"
            >
              por caja
            </label>
          </div>
        </div>
        <p className="text-center text-secondary mb-4" style={{ fontSize: "0.8rem" }}>
          Precio por {porCaja ? "caja" : "unidad"} de cada producto
        </p>

        <div className="mush-card p-3 p-sm-4 d-flex flex-column flex-grow-1" style={{ minHeight: 0 }}>
          {/* Tres bloques: el producto con sus precios, los margenes y las
              ganancias. Cada uno es una tabla aparte para que se lean como
              bloques independientes y no como columnas de una sola. */}
          <div
            className="mush-scroll-tabla flex-grow-1 d-flex align-items-start gap-3"
            style={{ minHeight: 0, overflowX: "hidden" }}
          >
            {/* Ancho fijo por columna: asi entra todo sin scroll de costado */}
            <table
              className="table mush-tabla mush-tabla-compacta mush-tabla-pareja align-middle mb-0 flex-grow-1"
              style={{ tableLayout: "fixed", width: "100%", minWidth: 0 }}
            >
              <thead>
                <tr className="text-center" style={{ height: ALTO_CABECERA }}>
                  {/* Cuando se actualizo por ultima vez el precio */}
                  <th style={{ width: "96px" }}>
                    {/* El titulo hereda mayusculas y espaciado de los encabezados:
                        con un texto largo eso solo lo agranda. */}
                    <span
                      className="mush-th-caja"
                      style={{ fontSize: "0.56rem", letterSpacing: "normal" }}
                    >
                      Fecha de actualizacion
                    </span>
                  </th>
                  <th>
                    <span className="mush-th-caja">Producto</span>
                  </th>
                  <th style={{ width: "100px" }}>
                    <span className="mush-th-caja">Costo</span>
                  </th>
                  <th style={{ width: "66px" }}>
                    <span className="mush-th-caja" style={{ fontSize: "0.62rem" }}>
                      {porCaja ? "U. x caja" : "Un"}
                    </span>
                  </th>
                  {PRECIOS.map(({ id, titulo, color }, i) => (
                    <th
                      key={id}
                      className={`${color} ${i === 0 ? "mush-col-doble" : ""}`}
                      style={{ width: "128px" }}
                    >
                      <span className="mush-th-caja">{titulo}</span>
                    </th>
                  ))}
                  <th className="mush-col-doble" style={{ width: "70px" }}>
                    {/* La columna es angosta: el titulo entra con la letra mas chica */}
                    <span className="mush-th-caja" style={{ fontSize: "0.62rem" }}>
                      Detalle
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filas.map((fila) =>
                  // El titulo de un producto que agrupa variedades
                  fila.titulo ? (
                    <tr key={fila.titulo} className="mush-fila-grupo" style={{ height: ALTO_GRUPO }}>
                      <td colSpan={PRECIOS.length + 5}>
                        <span className="mush-kicker d-inline-flex align-items-center gap-2">
                          <span style={{ fontSize: "0.85rem" }}>{fila.imagen}</span>
                          {fila.titulo}
                        </span>
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={fila.slug}
                      className={fila.corte ? "mush-fila-corte" : ""}
                      style={{ height: ALTO_FILA }}
                    >
                      {/* La fecha del ultimo cambio de precio, venga de esta
                          pantalla o de un cambio de costo. */}
                      <td className="text-center">
                        <span className="mush-dato text-secondary" style={{ fontSize: "0.6rem" }}>
                          {fechaLegible(ultimaActualizacion(fila.receta)) || "-"}
                        </span>
                      </td>

                      <td>
                        <span className="d-flex align-items-center gap-2">
                          <span style={{ fontSize: "0.85rem" }}>{fila.imagen}</span>
                          <strong
                            className="text-white text-truncate"
                            style={{ fontSize: "0.75rem" }}
                            title={fila.nombre}
                          >
                            {fila.nombre}
                          </strong>
                        </span>
                      </td>

                      {/* El costo es calculado: no se edita */}
                      <td className="text-center">
                        <span className="mush-dato text-secondary" style={{ fontSize: "0.72rem" }}>
                          {moneda(costoDeFila(fila), 2)}
                        </span>
                      </td>

                      <td className="text-center">
                        {porCaja ? (
                          campo(fila, UNIDADES_POR_CAJA, "100%")
                        ) : (
                          <span className="text-secondary" style={{ fontSize: "0.72rem" }}>
                            {fila.costo.unidad}
                          </span>
                        )}
                      </td>

                      {PRECIOS.map(({ id, color, canal }, i) => (
                        <td
                          key={id}
                          className={`${color} text-center ${i === 0 ? "mush-col-doble" : ""}`}
                        >
                          <span className="mush-dato" style={{ fontSize: "0.95rem" }}>
                            {moneda(precioDeCanal(fila, canal), 2)}
                          </span>
                        </td>
                      ))}

                      <td className="text-center mush-col-doble">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary py-0 px-2 text-white d-inline-flex align-items-center"
                          style={{ fontSize: "0.72rem", minHeight: "20px" }}
                          onClick={() => abrirModal(fila)}
                          title={`Calculo de precio de ${fila.nombre}`}
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>

            {tablaBloque(DESCUENTOS, "100px", (fila, { id }) => (
              <span className="d-flex align-items-center justify-content-center gap-1">
                {campo(fila, id, "48px")}
                <span className="text-secondary" style={{ fontSize: "0.72rem" }}>
                  %
                </span>
              </span>
            ))}

            {/* Los margenes van en porcentaje, con el signo al lado */}
            {tablaBloque(MARGENES, "180px", (fila, { id, canal }) =>
              canal ? (
                <span className="mush-dato d-block text-center" style={{ fontSize: "0.8rem" }}>
                  {porcentaje(margenRealDeCanal(fila, canal))}
                </span>
              ) : (
                <span className="d-flex align-items-center justify-content-center gap-1">
                  {campo(fila, id, "48px")}
                  <span className="text-secondary" style={{ fontSize: "0.72rem" }}>
                    %
                  </span>
                </span>
              )
            )}

            {tablaBloque(GANANCIAS, "252px", (fila, { canal }) => (
              <span className="mush-dato d-block text-center" style={{ fontSize: "0.95rem" }}>
                {moneda(gananciaDeCanal(fila, canal), 2)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* MODAL: de donde sale el precio de un producto */}
      {filaModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.75)", zIndex: 1055 }}
          onClick={() => setFilaModal(null)}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            style={{ maxWidth: verHistorial ? "760px" : "460px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content mush-card p-3 p-sm-4 rounded-4 shadow-lg border border-secondary border-opacity-25">
              <div className="d-flex align-items-start mb-3">
                <h5 className="text-white mb-0 fw-bold fs-6 flex-grow-1 text-center">
                  Calculo de precio
                  <span className="text-secondary fw-normal ms-2" style={{ fontSize: "0.8rem" }}>
                    (Gross Margin)
                  </span>
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white flex-shrink-0"
                  onClick={() => setFilaModal(null)}
                  aria-label="Cerrar"
                ></button>
              </div>

              {/* Las dos cuentas del modal, escritas como se leen: el precio
                  sale del costo y la ganancia que se quiere dejar; la ganancia
                  real sale del precio que se termina cobrando. */}
              <div className="mush-card-elevada rounded-3 py-2 px-2 mb-3 d-flex align-items-center justify-content-center gap-3">
                {formula("Precio =", "Costo", "1 - gcia. deseada")}
                <span className="mush-division-vertical"></span>
                {formula("Gcia. real (revend.) =", "Precio rev. - Costo", "Precio rev.")}
              </div>

              {verHistorial ? (
                /* Una fila por fecha con todo lo que hace al precio ese dia:
                   asi se compara un dia contra otro de un vistazo. */
                <div className="mush-scroll-tabla" style={{ maxHeight: "300px" }}>
                  <table className="table mush-tabla mush-tabla-compacta align-middle mb-0">
                    <thead>
                      <tr className="text-center">
                        <th style={{ width: "84px" }}>
                          <span className="mush-th-caja" style={{ fontSize: "0.62rem" }}>
                            Fecha
                          </span>
                        </th>
                        {COLUMNAS_HISTORIAL.map(({ id, titulo }) => (
                          <th key={id}>
                            <span className="mush-th-caja" style={{ fontSize: "0.62rem" }}>
                              {titulo}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {historialDeReceta(filaModal.receta).length === 0 ? (
                        <tr>
                          <td
                            colSpan={COLUMNAS_HISTORIAL.length + 1}
                            className="text-center py-4 text-secondary"
                          >
                            Todavia no hubo cambios de precio.
                          </td>
                        </tr>
                      ) : (
                        historialDeReceta(filaModal.receta).map((dia) => (
                          <tr key={dia.fecha} style={{ height: ALTO_FILA }}>
                            <td className="text-center">
                              <span
                                className="mush-dato text-secondary"
                                style={{ fontSize: "0.72rem" }}
                              >
                                {fechaLegible(dia.fecha)}
                              </span>
                            </td>
                            {COLUMNAS_HISTORIAL.map(({ id, formato }) => (
                              <td key={id} className="text-center">
                                <span
                                  className="mush-dato text-white"
                                  style={{ fontSize: "0.72rem" }}
                                >
                                  {formato === "moneda"
                                    ? moneda(dia[id], 2)
                                    : formato === "porcentaje"
                                      ? porcentaje(dia[id])
                                      : dia[id] || "-"}
                                </span>
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <table className="table mush-tabla mush-tabla-compacta align-middle mb-0">
                  <tbody>
                    {FILAS_MODAL.map(({ titulo, valor, esCosto, campoMargen, canal, canalMargen, nota }) => (
                      <tr key={titulo} style={{ height: ALTO_FILA }}>
                        <td style={{ width: "42%" }}>
                          <span className="text-secondary" style={{ fontSize: "0.75rem" }}>
                            {titulo}
                          </span>
                        </td>
                        {/* El valor va centrado en la celda; lo que lo acompana
                            (la nota) se apoya a la derecha y no lo corre del
                            centro. Los precios no: van con su ganancia al lado. */}
                        <td className="text-center" style={{ position: "relative" }}>
                          {campoMargen ? (
                            <span className="d-flex align-items-center justify-content-center gap-1">
                              {campo(filaModal, campoMargen, "48px")}
                              <span className="text-secondary" style={{ fontSize: "0.72rem" }}>
                                %
                              </span>
                            </span>
                          ) : canal ? (
                            <span className="d-flex align-items-center justify-content-start gap-3 ps-2">
                              <span className="mush-dato text-white" style={{ fontSize: "0.8rem" }}>
                                {moneda(precioDeCanal(filaModal, canal), 2)}
                              </span>
                              <span className="text-secondary" style={{ fontSize: "0.72rem" }}>
                                ganancia:{" "}
                                <span className="mush-dato text-ok">
                                  {moneda(gananciaDeCanal(filaModal, canal), 2)}
                                </span>
                              </span>
                            </span>
                          ) : canalMargen ? (
                            <span className="mush-dato text-white" style={{ fontSize: "0.8rem" }}>
                              {porcentaje(margenRealDeCanal(filaModal, canalMargen))}
                            </span>
                          ) : (
                            <span className="mush-dato text-white" style={{ fontSize: "0.8rem" }}>
                              {esCosto
                                ? moneda(costoDeFila(filaModal), 2)
                                : valor(filaModal, porCaja)}
                            </span>
                          )}

                          {nota && (
                            <span
                              className="mush-celda-nota text-secondary fst-italic"
                              style={{ fontSize: "0.72rem" }}
                            >
                              {nota}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Como fueron cambiando los datos que se cargan */}
              <div className="d-flex justify-content-end gap-2 mt-3">
                <button
                  type="button"
                  className="btn-mush-ghost"
                  onClick={() => setVerHistorial((previo) => !previo)}
                >
                  {verHistorial ? "Volver" : "Historial"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreciosVenta;
