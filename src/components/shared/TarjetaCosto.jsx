import BloquesCosto from "./BloquesCosto.jsx";

/**
 * La fila de un producto en Costos: que producto es a la izquierda y el costo
 * por unidad abierto en sus partes a la derecha.
 *
 * La usan la lista de productos y la de variedades de un producto que agrupa
 * (las tabletas), para que una variedad se lea y se recorra igual que
 * cualquier otro producto.
 */

// Los dos lados de la tarjeta miden lo mismo, asi todas quedan igual de altas
// sin importar si el producto lleva badge.
const ALTO_CONTENIDO = "72px";

const TarjetaCosto = ({ slug, nombre, categoria, imagen, costo, enlaceDe }) => (
  <div className="mush-card p-3 p-sm-4 mb-3">
    <div className="d-flex flex-column flex-lg-row align-items-lg-center gap-3">
      {/* Que producto es */}
      <div
        className="d-flex align-items-center gap-3 text-start"
        style={{ minWidth: "215px", minHeight: ALTO_CONTENIDO }}
      >
        <span className="fs-2">{imagen}</span>
        <div>
          <strong className="text-white fw-bold d-block" style={{ fontSize: "1rem" }}>
            {nombre}
          </strong>
          <span className="text-secondary" style={{ fontSize: "0.72rem" }}>
            {categoria} · por {costo.unidad}
          </span>
          {costo.incompletos > 0 && (
            <span
              className="mush-badge mush-badge-alerta d-inline-flex mt-1"
              title="Hay insumos sin precio o sin la equivalencia de unidades cargada"
            >
              <i className="bi bi-exclamation-triangle-fill"></i>
              {costo.incompletos} sin precio
            </span>
          )}
        </div>
      </div>

      {/* Cada parte lleva a su detalle; el resultado no, porque no es una
          parte: es lo que sale de las otras. */}
      <BloquesCosto costo={costo} enlaceDe={enlaceDe ? (id) => enlaceDe(id, slug) : null} />
    </div>
  </div>
);

export default TarjetaCosto;
