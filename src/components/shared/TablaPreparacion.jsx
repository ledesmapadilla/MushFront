import { useState } from "react";
import { costearLinea } from "../../utils/costos";
import { moneda } from "../../utils/sueldos";
import { numero } from "../../utils/calculos";

/**
 * Lo que cuesta una preparacion de la casa (la pasta, el praline, el bano de
 * chocolate) para la cantidad que se quiera.
 *
 * La receta esta escrita para una base: 740 gr de pasta, 240 de praline, una
 * tanda de 20 alfajores de bano. Se escribe otra cantidad en la celda de arriba
 * y todas las filas se llevan a esa proporcion, cantidades y costos.
 *
 * Es una cuenta aparte: no toca la receta ni el costo del producto, es para
 * mirar. Pero la cantidad que se escribe no se pierde al refrescar: queda
 * guardada en este navegador, aparte de los datos del sistema.
 */

// Todas las cantidades escritas viven en una sola entrada: { "slug:id": "740" }.
const CLAVE = "mush_sistema_alfajores_v4_calculos";

const leerCantidades = () => {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) || "{}");
  } catch {
    return {};
  }
};

const guardarCantidad = (clave, valor) => {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ ...leerCantidades(), [clave]: valor }));
  } catch {
    // En modo privado no se puede guardar: la cuenta anda igual, solo que la
    // proxima vez arranca de la base.
  }
};

const TablaPreparacion = ({ preparacion, lineas, ingredientes, slug }) => {
  const enGramos = Boolean(preparacion.gramosBase);
  const base = Number(preparacion.gramosBase || preparacion.alfajoresBase) || 0;
  const unidadBase = enGramos ? "gr" : "alfajores";

  // La ultima cantidad escrita para esta preparacion de este producto; la
  // primera vez, la base, asi la tabla muestra la receta tal como esta escrita.
  const clave = `${slug}:${preparacion.id}`;
  const [objetivo, setObjetivo] = useState(() => leerCantidades()[clave] ?? String(base));

  const cambiarObjetivo = (valor) => {
    const limpio = valor.replace(/[^0-9.,]/g, "");
    setObjetivo(limpio);
    guardarCantidad(clave, limpio);
  };

  const cantidadObjetivo = Number(String(objetivo).replace(",", ".")) || 0;
  const factor = base > 0 && cantidadObjetivo > 0 ? cantidadObjetivo / base : null;

  const filas = lineas.map((linea) => {
    const costeo = costearLinea(linea, ingredientes);
    return {
      linea,
      incompleto: costeo.incompleto,
      cantidad: factor === null ? null : (Number(linea.cantidad) || 0) * factor,
      costo: factor === null ? null : costeo.costo * factor,
    };
  });

  const total = filas.reduce((suma, fila) => suma + (fila.costo || 0), 0);

  return (
    <div className="mush-card mush-card-anidada p-3 h-100">
      {/* Titulo y la celda que cambia la cantidad */}
      <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
        <h5
          className="text-white fw-bold mb-0 text-truncate"
          style={{ fontSize: "0.9rem" }}
          title={preparacion.titulo}
        >
          {preparacion.titulo}
        </h5>
        <div className="d-flex align-items-center gap-1 flex-shrink-0">
          <input
            type="text"
            inputMode="decimal"
            className="form-control form-control-sm mush-input mush-dato py-1 px-2 text-center"
            style={{ width: "80px", fontSize: "0.85rem" }}
            placeholder="0"
            value={objetivo}
            onChange={(e) => cambiarObjetivo(e.target.value)}
            aria-label={`Cantidad de ${preparacion.titulo} en ${unidadBase}`}
            autoComplete="off"
            spellCheck="false"
          />
          <span className="text-secondary" style={{ fontSize: "0.72rem" }}>
            {enGramos ? "gr" : "alf"}
          </span>
        </div>
      </div>

      <div className="table-responsive mush-scroll-tabla" style={{ maxHeight: "300px" }}>
        <table className="table mush-tabla mush-tabla-compacta align-middle mb-0 text-nowrap">
          <thead>
            <tr>
              <th style={{ width: "46%" }}>Ingrediente</th>
              <th className="text-end" style={{ width: "24%" }}>Cant</th>
              <th className="text-end" style={{ width: "30%" }}>Costo</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td colSpan="3" className="text-center py-4 text-secondary">
                  No hay ingredientes cargados.
                </td>
              </tr>
            ) : (
              <>
                {filas.map(({ linea, cantidad, costo, incompleto }) => (
                  <tr key={linea.id}>
                    <td>
                      <span
                        className="text-secondary text-truncate d-block"
                        style={{ fontSize: "0.72rem", maxWidth: "130px" }}
                        title={linea.nombre}
                      >
                        {linea.nombre}
                      </span>
                    </td>
                    <td className="text-end">
                      <span className="mush-dato text-white" style={{ fontSize: "0.72rem" }}>
                        {cantidad === null ? "—" : `${numero(cantidad)} ${linea.unidad}`}
                      </span>
                    </td>
                    <td className="text-end">
                      {incompleto ? (
                        <span
                          className="text-alerta"
                          style={{ fontSize: "0.72rem" }}
                          title="Falta el precio del insumo, o la equivalencia entre su unidad de compra y la de la receta"
                        >
                          <i className="bi bi-exclamation-triangle-fill"></i> s/precio
                        </span>
                      ) : (
                        <span className="mush-dato text-white" style={{ fontSize: "0.72rem" }}>
                          {costo === null ? "—" : moneda(costo, 2)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}

                <tr>
                  <td colSpan="2">
                    <span className="mush-kicker">Total</span>
                  </td>
                  <td className="text-end">
                    <span className="mush-dato text-dulce" style={{ fontSize: "0.82rem" }}>
                      {moneda(total, 2)}
                    </span>
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TablaPreparacion;
