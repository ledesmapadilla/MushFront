import { Fragment, useMemo } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { useMush } from "../../context/MushContext";
import { productoDeVariedad, productosDeCatalogo, variedadesDe } from "../../data/productos";
import { preparacionesDeReceta } from "../../data/preparaciones";
import { buscarParte, buscarReceta, costearProducto, SECCIONES_COSTO } from "../../utils/costos";
import { formatearCantidad } from "../../utils/conversiones";
import { moneda } from "../../utils/sueldos";
import { numero } from "../../utils/calculos";
import BloquesCosto from "../shared/BloquesCosto.jsx";
import TablaPreparacion from "../shared/TablaPreparacion.jsx";

/**
 * De donde sale el costo de un producto: la misma cuenta de la tarjeta de
 * Costos, pero linea por linea.
 *
 * Cada fila muestra la cantidad como esta cargada en la receta, el precio del
 * insumo en su unidad de compra y la cuenta completa, para poder seguir el
 * numero sin tener que rehacerlo a mano.
 *
 * Cada pagina es una parte sola (/costos/:slug/:parte): ingredientes,
 * packaging o mano de obra, con su propio subtotal al pie. De la lista de
 * Costos se entra directo a la parte que se toca.
 */

// El ancho lo comparten el titulo y la tabla, para que no se desfasen.
const ANCHO_BLOQUE = "1040px";

// "900 gr" cargados de un insumo que se compra por kg se pagan como "0,9 kg":
// la cuenta se muestra en la unidad de compra, que es la del precio. Las
// cantidades de la masa estan por tanda, por eso ademas se dividen por el rinde.
const textoCalculo = (linea, rinde) => {
  const cuenta = `${formatearCantidad(linea.cantidadEnCompra)} ${linea.unidadCompra} × ${moneda(linea.precio)}`;
  return linea.porTanda ? `${cuenta} ÷ ${numero(rinde)}` : cuenta;
};

const CostoDetalle = () => {
  const { slug, parte } = useParams();
  const { alfajores, recetas, ingredientes, packaging, personal } = useMush();

  const producto = useMemo(
    () => productosDeCatalogo(alfajores).find((item) => item.slug === slug) || null,
    [alfajores, slug]
  );

  const receta = useMemo(() => buscarReceta(recetas, slug), [recetas, slug]);

  const costo = useMemo(
    () => costearProducto(receta, { ingredientes, packaging, personal }),
    [receta, ingredientes, packaging, personal]
  );

  const parteActiva = buscarParte(parte);

  // Las secciones de la parte que se esta mirando, con sus lineas y su subtotal.
  const secciones = useMemo(
    () =>
      SECCIONES_COSTO.filter((seccion) => parteActiva?.secciones.includes(seccion.id))
        .map((seccion) => {
          const lineas = costo.lineas.filter((linea) => linea.seccion === seccion.id);
          return {
            ...seccion,
            lineas,
            subtotal: lineas.reduce((total, linea) => total + linea.costo, 0),
          };
        })
        .filter((seccion) => seccion.lineas.length > 0),
    [costo.lineas, parteActiva]
  );

  // Una parte que no existe (o una ruta vieja sin parte) vuelve al listado.
  if (!parteActiva) return <Navigate to="/costos" replace />;

  // Las preparaciones de la casa se calculan aparte, y solo tienen sentido
  // mirando los ingredientes.
  const preparaciones =
    parteActiva.id === "ingredientes" ? preparacionesDeReceta(receta) : [];

  const nombre = producto?.nombre || receta?.nombre || slug;
  const manoObra = costo.detalleManoObra;
  // Las tabletas agrupan variedades y no tienen receta propia: su detalle se
  // arma aparte.
  const agrupaVariedades = variedadesDe(slug).length > 0;
  // Una variedad vuelve a la lista de las suyas, no al listado general.
  const productoPadre = productoDeVariedad(slug);
  const volverA = productoPadre ? `/costos/${productoPadre}` : "/costos";

  // La mano de obra es una parte mas, y los titulos de seccion solo hacen
  // falta cuando la parte junta mas de una (los ingredientes: masa y unitario).
  const mostrarManoObra = parteActiva.esManoDeObra;
  const mostrarTitulosDeSeccion = parteActiva.secciones.length > 1;
  const hayManoDeObra = manoObra.producidos > 0 || manoObra.pago > 0;

  const sinDatos =
    agrupaVariedades ||
    (secciones.length === 0 && !(mostrarManoObra && hayManoDeObra));

  // El pie de la tabla es el subtotal de la parte: el mismo numero de la caja.
  const pie = { titulo: `${parteActiva.titulo} por ${costo.unidad}`, monto: costo[parteActiva.campo] };

  return (
    <div className="container py-4">
      <div
        className="mx-auto"
        style={{ maxWidth: ANCHO_BLOQUE, width: "100%", paddingBottom: "75px" }}
      >
        {/* Encabezado con boton volver */}
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
          <div className="d-flex align-items-center gap-3">
            <Link
              to={volverA}
              className="btn btn-sm btn-outline-secondary py-1 px-2 text-white d-inline-flex align-items-center gap-1 rounded-3"
              title="Volver a Costos"
            >
              <i className="bi bi-arrow-left"></i>
            </Link>
            {/* El titulo dice que parte se esta mirando */}
            <h2 className="mush-display text-white mb-0">{parteActiva.titulo}</h2>
            <span className="mush-display text-secondary fs-2">-</span>
            <span className="mush-display text-dulce fs-2">{nombre}</span>
          </div>
          <Link
            to={`/recetas/${slug}`}
            className="btn-mush-ghost d-inline-flex align-items-center gap-2"
            title={`Ver la receta de ${nombre}`}
          >
            <i className="bi bi-book"></i>
            Ver Receta
          </Link>
        </div>

        {/* La misma tarjeta que en la lista, con la caja de esta parte sola */}
        <div className="mush-card p-3 p-sm-4 mb-3">
          <BloquesCosto costo={costo} parteActiva={parteActiva.id} soloActiva />
        </div>

        {/* El detalle, linea por linea */}
        <div className="mush-card p-3 p-sm-4">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
            <h5 className="text-white mb-0 fw-bold">Composicion del costo</h5>
            <span className="text-secondary" style={{ fontSize: "0.72rem" }}>
              Rinde: {numero(costo.rinde)} {receta?.unidadRinde || "alfajores"}
            </span>
          </div>

          <div
            className="table-responsive mush-scroll-tabla"
            style={{ maxHeight: "calc(100vh - 340px)" }}
          >
            <table className="table mush-tabla mush-tabla-compacta align-middle mb-0 text-nowrap">
              <thead>
                <tr>
                  <th style={{ width: "28%" }}>Concepto</th>
                  <th style={{ width: "13%" }}>Cantidad</th>
                  <th style={{ width: "16%" }}>Precio</th>
                  <th style={{ width: "26%" }}>Cuenta</th>
                  <th className="text-end" style={{ width: "17%" }}>
                    Costo por {costo.unidad}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sinDatos ? (
                  <tr>
                    <td colSpan="5" className="text-center py-4 text-secondary">
                      {agrupaVariedades
                        ? "Este producto agrupa variedades: cada una tiene su propio costo."
                        : `Sin ${parteActiva.titulo.toLowerCase()} en esta receta.`}
                    </td>
                  </tr>
                ) : (
                  <>
                    {secciones.map((seccion) => (
                      <Fragment key={seccion.id}>
                        {/* Titulo de la seccion, con su subtotal a la derecha */}
                        {mostrarTitulosDeSeccion && (
                          <tr>
                            <td colSpan="4">
                              <span className="mush-kicker">{seccion.titulo}</span>
                            </td>
                            {/* El subtotal va del color del titulo: los dos son la seccion */}
                            <td className="text-end">
                              <span
                                className="mush-dato text-dulce"
                                style={{ fontSize: "0.72rem" }}
                              >
                                {moneda(seccion.subtotal, 2)}
                              </span>
                            </td>
                          </tr>
                        )}

                        {seccion.lineas.map((linea) => (
                          <tr key={linea.id}>
                            <td>
                              <span
                                className={`text-secondary text-truncate d-block ${
                                  mostrarTitulosDeSeccion ? "ps-3" : ""
                                }`}
                                style={{ fontSize: "0.72rem", maxWidth: "260px" }}
                                title={linea.nombre}
                              >
                                {linea.nombre}
                              </span>
                            </td>
                            <td>
                              <span className="mush-dato text-white" style={{ fontSize: "0.72rem" }}>
                                {formatearCantidad(linea.cantidad)} {linea.unidad}
                              </span>
                            </td>
                            <td>
                              <span className="mush-dato text-white" style={{ fontSize: "0.72rem" }}>
                                {linea.precio
                                  ? `${moneda(linea.precio)} / ${linea.unidadCompra}`
                                  : "—"}
                              </span>
                            </td>
                            <td>
                              {linea.incompleto ? (
                                <span
                                  className="mush-badge mush-badge-alerta"
                                  title="Falta el precio del insumo, o la equivalencia entre su unidad de compra y la de la receta"
                                >
                                  <i className="bi bi-exclamation-triangle-fill"></i>
                                  Sin precio
                                </span>
                              ) : (
                                <span className="text-secondary" style={{ fontSize: "0.72rem" }}>
                                  {textoCalculo(linea, costo.rinde)}
                                </span>
                              )}
                            </td>
                            <td className="text-end">
                              <span className="mush-dato text-white" style={{ fontSize: "0.72rem" }}>
                                {moneda(linea.costo, 2)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}

                    {/* Mano de obra: no es una lista, es un solo valor */}
                    {mostrarManoObra && hayManoDeObra && (
                      <tr>
                        <td>
                          <span
                            className={`text-secondary text-truncate d-block ${
                              mostrarTitulosDeSeccion ? "ps-3" : ""
                            }`}
                            style={{ fontSize: "0.72rem", maxWidth: "260px" }}
                          >
                            {manoObra.porHora ? "Valor hora" : "Sueldo mensual"}
                            {manoObra.persona
                              ? ` de ${manoObra.persona}`
                              : " (sin legajo asignado)"}
                          </span>
                        </td>
                        <td>
                          <span className="mush-dato text-white" style={{ fontSize: "0.72rem" }}>
                            {numero(manoObra.producidos)}
                            {manoObra.porHora
                              ? " por hora"
                              : ` ${receta?.unidadRinde || "alfajores"}`}
                          </span>
                        </td>
                        <td>
                          <span className="mush-dato text-white" style={{ fontSize: "0.72rem" }}>
                            {moneda(manoObra.pago, manoObra.porHora ? 2 : 0)}
                          </span>
                        </td>
                        <td>
                          <span className="text-secondary" style={{ fontSize: "0.72rem" }}>
                            {manoObra.producidos > 0
                              ? `${moneda(manoObra.pago, manoObra.porHora ? 2 : 0)} ÷ ${numero(manoObra.producidos)}`
                              : "—"}
                          </span>
                        </td>
                        <td className="text-end">
                          <span className="mush-dato text-white" style={{ fontSize: "0.72rem" }}>
                            {moneda(costo.manoObra, 2)}
                          </span>
                        </td>
                      </tr>
                    )}

                    {/* El numero de la caja que se esta mirando */}
                    <tr>
                      <td colSpan="4" className="bg-dulce-suave">
                        <span className="mush-kicker">{pie.titulo}</span>
                      </td>
                      <td className="bg-dulce-suave text-end">
                        <span className="mush-dato text-dulce" style={{ fontSize: "1rem" }}>
                          {moneda(pie.monto, 2)}
                        </span>
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cuentas aparte: las preparaciones de la casa llevadas a la cantidad
            que se quiera. No tocan el costo de arriba. */}
        {preparaciones.length > 0 && (
          <div className="mt-5">
            <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
              <h5 className="text-white mb-0 fw-bold">Calculadora</h5>
              <span className="text-secondary" style={{ fontSize: "0.72rem" }}>
                No entran en el costo de arriba
              </span>
            </div>

            <div className="row g-3">
              {preparaciones.map((preparacion) => (
                <div className="col-12 col-lg-4" key={`${slug}-${preparacion.id}`}>
                  <TablaPreparacion
                    preparacion={preparacion}
                    lineas={(receta?.ingredientes || []).filter(
                      (linea) => linea.seccion === preparacion.id
                    )}
                    ingredientes={ingredientes}
                    slug={slug}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CostoDetalle;
