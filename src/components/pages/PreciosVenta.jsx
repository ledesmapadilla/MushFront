import { useState, useEffect, useMemo } from "react";
import { useMush } from "../../context/MushContext";
import { articulosDeVenta } from "../../utils/articulos";
import { moneda, fechaLegible } from "../../utils/sueldos";
import { numero } from "../../utils/calculos";
import BotonExcel from "../shared/BotonExcel.jsx";
import {
  anotarPrecios,
  COLUMNAS_HISTORIAL,
  historialDeReceta,
  margenReal,
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
const ANCHO_BLOQUE = "1380px";

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
  {
    id: "margenPublico",
    titulo: "Gcia. deseada (publico)",
    color: "mush-col-publico",
    letra: "0.58rem",
  },
  {
    id: "margenRevendedor",
    titulo: "Gcia. real (revend.)",
    color: "mush-col-revendedor",
    canal: "revendedor",
    letra: "0.58rem",
  },
];

// Lo que deja cada canal en pesos: el precio menos el costo.
const GANANCIAS = [
  {
    id: "gananciaPublico",
    titulo: "Ganancia publico",
    color: "mush-col-publico",
    canal: "publico",
    letra: "0.58rem",
  },
  {
    id: "gananciaRevendedor",
    titulo: "Ganancia revendedor",
    color: "mush-col-revendedor",
    canal: "revendedor",
    letra: "0.58rem",
  },
];

// El descuento que se le hace al revendedor. Va en su propio bloque, entre el
// detalle y los margenes.
const DESCUENTOS = [
  {
    id: "dtoRevendedor",
    titulo: "Dto. revendedor",
    color: "mush-col-revendedor",
    // Es la columna mas angosta: el titulo entra solo con la letra mas chica.
    letra: "0.58rem",
  },
];

// Lo que se guarda en el producto: la ganancia que se quiere dejar en publico
// y el descuento del revendedor. Todo lo demas sale de ahi.
const EDITABLES = [...DESCUENTOS, { id: "margenPublico" }];

// Los bloques se dibujan como tablas aparte, asi que los altos se fijan a mano:
// si no, cada una los calcula por su cuenta y las lineas dejan de coincidir.
const ALTO_CABECERA = "66px";
const ALTO_FILA = "34px";

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
  { titulo: "Un.", esUnidad: true },
  { titulo: "Costos", esCosto: true },
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

const PreciosVenta = () => {
  const { alfajores, recetas, ingredientes, packaging, personal, guardarAlfajor } = useMush();

  // Se vende por unidad o por cantidad; cada producto del alta declara cual es
  // su presentacion.
  const [porCaja, setPorCaja] = useState(false);

  // Las filas son los productos dados de alta. No hay una lista aparte: si se da
  // de alta un producto nuevo, aparece aca solo.
  const filas = useMemo(() => {
    const articulos = articulosDeVenta(alfajores, recetas, { ingredientes, packaging, personal });
    return articulos.filter((articulo) => articulo.porCaja === porCaja);
  }, [alfajores, recetas, ingredientes, packaging, personal, porCaja]);

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

  // Lo guardado manda: si cambia el producto (o contesta el backend), se refresca.
  useEffect(() => {
    const guardados = {};
    (alfajores || []).forEach((producto) => {
      const precios = producto.precios || {};
      EDITABLES.forEach(({ id }) => {
        if (precios[id] !== undefined && precios[id] !== "") {
          guardados[`${producto.id}:${id}`] = String(precios[id]);
        }
      });
    });
    setBorrador(guardados);
  }, [alfajores]);

  const valorDe = (id, campo) => borrador[`${id}:${campo}`] ?? "";

  const escribir = (id, campo, valor) =>
    setBorrador((prev) => ({ ...prev, [`${id}:${campo}`]: valor.replace(/[^0-9.,]/g, "") }));

  /**
   * Guarda un valor en el producto y anota como quedo el precio.
   *
   * El precio vive en el producto, que es lo que se vende. La receta solo dice
   * como se hace.
   */
  const guardar = (fila, campo) => {
    const anterior = fila.precios || {};
    const escrito = valorDe(fila.id, campo);
    const numero = escrito === "" ? "" : Number(String(escrito).replace(",", ".")) || 0;
    // Salir del campo sin haberlo tocado no es un cambio.
    if (String(anterior[campo] ?? "") === String(numero)) return;

    // La anotacion es una foto de como quedo el precio, asi que se arma con el
    // dato nuevo ya puesto.
    const cambiado = { ...anterior, [campo]: numero };
    const { publico, revendedor } = preciosDeProducto(fila.costo, cambiado);
    const precios = anotarPrecios(cambiado, { costo: fila.costo, publico, revendedor });

    guardarAlfajor({ ...fila.producto, precios });
  };

  // Lo escrito en un campo, como numero. Se lee del borrador y no de lo
  // guardado, asi las cuentas se mueven mientras se prueba.
  const numeroDe = (fila, id) => Number(String(valorDe(fila.id, id)).replace(",", ".")) || 0;

  /**
   * El precio de cada canal, sobre lo que se vende:
   *   publico    -> del costo y la ganancia que se quiere dejar
   *   revendedor -> el publico menos el descuento que se le hace
   *
   * El costo es el de lo que se vende: una unidad, o la caja entera con su
   * carton, asi que el redondeo a la centena cae sobre el precio de la caja.
   */
  const precioDeCanal = (fila, canal) =>
    preciosDeProducto(fila.costo, {
      margenPublico: numeroDe(fila, "margenPublico"),
      dtoRevendedor: numeroDe(fila, "dtoRevendedor"),
    })[canal];

  const gananciaDeCanal = (fila, canal) => {
    const precio = precioDeCanal(fila, canal);
    return precio === null ? null : precio - fila.costo;
  };

  // Lo que queda de ganancia sobre el precio que se termina cobrando. No es el
  // porcentaje que se pidio: el redondeo y el descuento lo mueven.
  const margenRealDeCanal = (fila, canal) => margenReal(precioDeCanal(fila, canal), fila.costo);

  // El costo de la fila ya viene resuelto por el catalogo.
  const costoDeFila = (fila) => fila.costo;

  // Como se lee la unidad de una fila: por cantidad dice de que caja se trata.
  const unidadDeFila = (fila) =>
    fila.porCaja ? (fila.unidades ? `caja x ${numero(fila.unidades)}` : "caja") : fila.unidad;

  /**
   * De donde sale el costo de la fila, escrito como se lee.
   *
   * Un subproducto es la suma de los productos que lleva adentro mas su caja de
   * carton, sean varios (un surtido) o uno solo repetido (una caja de 6). El que
   * agrupa variedades, en cambio, suma todos los ingredientes juntos con el
   * packaging y la mano de obra una sola vez.
   *
   * Los importes van con centavos: redondeados a pesos, las partes no suman el
   * total y la cuenta parece mal hecha.
   */
  const detalleDeCosto = (fila) => {
    if (fila.sumaIngredientes) {
      return (
        `${moneda(fila.sumaIngredientes, 2)} de ingredientes (${fila.variedadesDeLaCaja} variedades) + ` +
        `${moneda(fila.packaging, 2)} de packaging + ${moneda(fila.manoObra, 2)} de mano de obra`
      );
    }

    if (fila.contenido.length) {
      const partes = fila.contenido.map(({ cantidad, costo }) =>
        cantidad === 1 ? moneda(costo, 2) : `${cantidad} x ${moneda(costo, 2)}`
      );
      return `${partes.join(" + ")}${fila.carton ? ` + ${moneda(fila.carton, 2)} de caja` : ""}`;
    }

    if (!fila.porCaja || !fila.unidades) return null;

    const contenido = `${moneda(fila.costoUnitario, 2)} x ${numero(fila.unidades)}`;
    return fila.carton ? `${contenido} + ${moneda(fila.carton, 2)} de caja` : contenido;
  };

  // Cuando se actualizo el precio de esta fila.
  const fechaDeFila = (fila) => ultimaActualizacion({ precios: fila.precios });

  // Lo que se ve en la tabla, para bajarlo a una planilla.
  const COLUMNAS_PLANILLA = [
    "Fecha de actualizacion",
    "Producto",
    { titulo: "Costos", formato: "moneda" },
    porCaja ? "Un. x caja" : "Un",
    { titulo: "Precio publico", formato: "moneda" },
    { titulo: "Precio revendedor", formato: "moneda" },
    { titulo: "Dto. revendedor", formato: "porcentaje" },
    { titulo: "Gcia. deseada", formato: "porcentaje" },
    { titulo: "Gcia. real revendedor", formato: "porcentaje" },
    { titulo: "Ganancia publico", formato: "moneda" },
    { titulo: "Ganancia revendedor", formato: "moneda" },
  ];

  const filasDePlanilla = () =>
    filas.map((fila) => [
      fechaLegible(fechaDeFila(fila)),
      fila.nombre,
      fila.costo,
      porCaja ? fila.unidades : fila.unidad,
      precioDeCanal(fila, "publico"),
      precioDeCanal(fila, "revendedor"),
      numeroDe(fila, "dtoRevendedor"),
      numeroDe(fila, "margenPublico"),
      margenRealDeCanal(fila, "revendedor"),
      gananciaDeCanal(fila, "publico"),
      gananciaDeCanal(fila, "revendedor"),
    ]);

  const campo = (fila, id, ancho) => (
    <input
      type="text"
      inputMode="decimal"
      className="form-control form-control-sm mush-input mush-dato py-0 px-1 text-center"
      style={{ width: ancho }}
      placeholder="-"
      value={valorDe(fila.id, id)}
      onChange={(e) => escribir(fila.id, id, e.target.value)}
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
              <span
                className="mush-th-caja"
                style={letra ? { fontSize: letra, letterSpacing: "normal" } : undefined}
              >
                {titulo}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((fila) => (
            <tr
              key={fila.id}
                            style={{ height: ALTO_FILA }}
            >
              {columnas.map((columna) => (
                <td key={columna.id} className={columna.color}>
                  {celda(fila, columna)}
                </td>
              ))}
            </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="container py-4" style={{ paddingBottom: "75px" }}>
      <div
        className="mx-auto d-flex flex-column"
        style={{
          maxWidth: ANCHO_BLOQUE,
          width: "100%",
          // Alto fijo, no minimo: con minimo la hoja crece con el contenido y
          // termina scrolleando la ventana entera, la tabla nunca scrollea por
          // dentro y el encabezado pegajoso no tiene contra que pegarse.
          //
          // Lo que se descuenta es el navbar arriba (~86px), el padding de la
          // pagina (48px) y el footer fijo (~56px): la tarjeta llega justo hasta
          // donde arranca el footer.
          height: "calc(100vh - 190px)",
          overflow: "hidden",
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
              por cantidad
            </label>

            <BotonExcel
              titulo="Lista de Precios"
              columnas={COLUMNAS_PLANILLA}
              filas={filasDePlanilla}
              className="ms-3"
            />
          </div>
        </div>
        <p className="text-center text-secondary mb-4" style={{ fontSize: "0.8rem" }}>
          Precio por {porCaja ? "cantidad" : "unidad"} de cada producto
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
                  <th style={{ width: "82px" }}>
                    {/* El titulo hereda mayusculas y espaciado de los encabezados:
                        con un texto largo eso solo lo agranda. */}
                    <span
                      className="mush-th-caja"
                      style={{ fontSize: "0.52rem", letterSpacing: "normal" }}
                    >
                      Fecha de actualizacion
                    </span>
                  </th>
                  <th>
                    <span className="mush-th-caja">Producto</span>
                  </th>
                  <th style={{ width: "84px" }}>
                    <span className="mush-th-caja">Costos</span>
                  </th>
                  <th style={{ width: "68px" }}>
                    <span
                      className="mush-th-caja"
                      style={{ fontSize: "0.62rem", letterSpacing: "normal" }}
                    >
                      {porCaja ? (
                        /* Los dos renglones van dentro de un mismo span: la caja
                           del titulo es flex y ahi el salto de linea suelto no
                           corta nada, deja los pedazos uno al lado del otro. */
                        <span>
                          {/* Los encabezados van en mayusculas por CSS: la x se
                              excluye para que no se convierta en X. */}
                          Un.
                          <br />
                          <span style={{ textTransform: "none" }}>x</span> caja
                        </span>
                      ) : (
                        "Un"
                      )}
                    </span>
                  </th>
                  {PRECIOS.map(({ id, titulo, color }, i) => (
                    <th
                      key={id}
                      className={`${color} ${i === 0 ? "mush-col-doble" : ""}`}
                      style={{ width: "110px" }}
                    >
                      <span className="mush-th-caja">{titulo}</span>
                    </th>
                  ))}
                  <th className="mush-col-doble" style={{ width: "66px" }}>
                    {/* La columna es angosta: el titulo entra con la letra mas chica */}
                    <span
                      className="mush-th-caja"
                      style={{ fontSize: "0.6rem", letterSpacing: "normal" }}
                    >
                      Detalle
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filas.map((fila) => (
                    <tr
                      key={fila.id}
                                            style={{ height: ALTO_FILA }}
                    >
                      {/* La fecha del ultimo cambio de precio, venga de esta
                          pantalla o de un cambio de costo. */}
                      <td className="text-center">
                        <span className="mush-dato text-secondary" style={{ fontSize: "0.6rem" }}>
                          {fechaLegible(fechaDeFila(fila)) || "-"}
                        </span>
                      </td>

                      <td>
                        {/* Sin el emoji adelante: le comia ancho al nombre, que es
                           lo que hay que poder leer entero. */}
                        <strong
                          className="text-white d-block text-truncate"
                          style={{ fontSize: "0.75rem", lineHeight: 1.15 }}
                          title={fila.nombre}
                        >
                          {fila.nombre}
                        </strong>
                      </td>

                      {/* El costo es calculado: no se edita */}
                      <td className="text-center">
                        <span className="mush-dato text-secondary" style={{ fontSize: "0.72rem" }}>
                          {moneda(costoDeFila(fila), 2)}
                        </span>
                      </td>

                      <td className="text-center">
                        {/* La presentacion la define el alta del producto: aca
                            se muestra, no se carga. */}
                        <span className="text-secondary" style={{ fontSize: "0.72rem" }}>
                          {porCaja ? numero(fila.unidades) : fila.unidad}
                        </span>
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
                ))}
              </tbody>
            </table>

            {tablaBloque(DESCUENTOS, "84px", (fila, { id }) => (
              <span className="d-flex align-items-center justify-content-center gap-1">
                {campo(fila, id, "48px")}
                <span className="text-secondary" style={{ fontSize: "0.72rem" }}>
                  %
                </span>
              </span>
            ))}

            {/* Los margenes van en porcentaje, con el signo al lado */}
            {tablaBloque(MARGENES, "160px", (fila, { id, canal }) =>
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

            {tablaBloque(GANANCIAS, "216px", (fila, { canal }) => (
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
            style={{ maxWidth: verHistorial ? "940px" : "460px" }}
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
                  <table
                    className="table mush-tabla mush-tabla-compacta mush-tabla-pareja align-middle mb-0"
                    style={{ tableLayout: "fixed", width: "898px" }}
                  >
                    <thead>
                      <tr className="text-center">
                        <th style={{ width: "84px" }}>
                          <span className="mush-th-caja" style={{ fontSize: "0.62rem" }}>
                            Fecha
                          </span>
                        </th>
                        {COLUMNAS_HISTORIAL.map(({ id, titulo, ancho }) => (
                          <th key={id} style={{ width: ancho }}>
                            <span className="mush-th-caja" style={{ fontSize: "0.62rem" }}>
                              {titulo}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {historialDeReceta({ precios: filaModal.precios }).length === 0 ? (
                        <tr>
                          <td
                            colSpan={COLUMNAS_HISTORIAL.length + 1}
                            className="text-center py-4 text-secondary"
                          >
                            Todavia no hubo cambios de precio.
                          </td>
                        </tr>
                      ) : (
                        historialDeReceta({ precios: filaModal.precios }).map((dia) => (
                          <tr key={dia.fecha} style={{ height: ALTO_FILA }}>
                            <td className="text-center">
                              <span
                                className="mush-dato text-secondary"
                                style={{ fontSize: "0.72rem" }}
                              >
                                {fechaLegible(dia.fecha)}
                              </span>
                            </td>
                            {COLUMNAS_HISTORIAL.map(({ id, formato, valor }) => {
                              const dato = valor ? valor(dia) : dia[id];
                              return (
                              <td key={id} className="text-center">
                                <span
                                  className="mush-dato text-white"
                                  style={{ fontSize: "0.72rem" }}
                                >
                                  {formato === "moneda"
                                    ? moneda(dato, 2)
                                    : formato === "porcentaje"
                                      ? porcentaje(dato)
                                      : dato || "-"}
                                </span>
                              </td>
                              );
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <table className="table mush-tabla mush-tabla-compacta align-middle mb-0">
                  <tbody>
                    {FILAS_MODAL.map(
                    ({ titulo, valor, esCosto, esUnidad, campoMargen, canal, canalMargen, nota }) => (
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
                            <span className="d-block">
                              <span
                                className="mush-dato text-white d-block"
                                style={{ fontSize: "0.8rem" }}
                              >
                                {esCosto
                                  ? moneda(costoDeFila(filaModal), 2)
                                  : esUnidad
                                    ? unidadDeFila(filaModal)
                                    : valor(filaModal, porCaja)}
                              </span>
                              {/* De donde sale el costo de una caja */}
                              {esCosto && detalleDeCosto(filaModal) && (
                                <span
                                  className="text-secondary d-block"
                                  style={{ fontSize: "0.62rem" }}
                                >
                                  {detalleDeCosto(filaModal)}
                                </span>
                              )}
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
                      )
                    )}
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
