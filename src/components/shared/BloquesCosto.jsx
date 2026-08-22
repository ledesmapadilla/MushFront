import { Link } from "react-router-dom";
import { PARTES_COSTO, PARTE_TOTAL } from "../../utils/costos";
import { moneda } from "../../utils/sueldos";

/**
 * Las tres partes del costo de un producto y el total, en cuatro cajas.
 *
 * Lo usan la lista de Costos y el detalle de cada producto, para que el mismo
 * numero se lea igual en las dos pantallas.
 *
 * Con `enlaceDe` cada caja se vuelve un link a su parte: es como se entra al
 * detalle desde la lista. Las cajas que no tienen a donde ir (el total, o un
 * producto que agrupa variedades) quedan como cajas comunes.
 *
 * Con `soloActiva` queda solo la parte que se esta mirando: la misma caja de
 * siempre, del mismo tamano, sola y centrada.
 *
 * El alto de las cajas es fijo y los importes no cortan a dos renglones: si no,
 * una tarjeta con un total largo (el mendiant) queda mas alta que las demas.
 */
const ALTO_BLOQUE = "72px";

const BLOQUES = [...PARTES_COSTO, PARTE_TOTAL];

const BloquesCosto = ({ costo, parteActiva = null, soloActiva = false, enlaceDe = null }) => {
  // Sin parte elegida el destacado es el total, que es lo que se esta mirando.
  const activa = parteActiva || PARTE_TOTAL.id;

  // La caja de una parte es la misma que en la lista de Costos: mismo tamano y
  // mismo formato, solo que va sola y queda centrada.
  const bloques = soloActiva ? BLOQUES.filter(({ id }) => id === activa) : BLOQUES;

  return (
    <div className={`row g-2 w-100 m-0 ${soloActiva ? "justify-content-center" : ""}`}>
      {bloques.map(({ id, titulo, campo }) => {
        const destino = enlaceDe ? enlaceDe(id) : null;
        const esActiva = !soloActiva && id === activa;
        const acentuada = esActiva || id === PARTE_TOTAL.id;

        const clases = [
          "mush-card-elevada h-100 rounded-3 px-2 py-2 text-center",
          "d-flex flex-column justify-content-center text-decoration-none",
          acentuada ? "bg-dulce-suave" : "",
          esActiva ? "border-dulce" : "",
          destino ? "mush-card-hover" : "",
        ]
          .filter(Boolean)
          .join(" ");

        const contenido = (
          <>
            <span className="mush-kicker d-block mb-1 text-truncate">{titulo}</span>
            <span
              className={`mush-dato d-block text-nowrap ${acentuada ? "text-dulce" : "text-white"}`}
              style={{ fontSize: "1rem" }}
            >
              {moneda(costo[campo], 2)}
            </span>
          </>
        );

        return (
          <div className="col-6 col-md-3" key={id}>
            {destino ? (
              <Link
                to={destino}
                className={clases}
                style={{ minHeight: ALTO_BLOQUE }}
                title={`Ver de donde sale ${titulo.toLowerCase()}`}
              >
                {contenido}
              </Link>
            ) : (
              <div className={clases} style={{ minHeight: ALTO_BLOQUE }}>
                {contenido}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default BloquesCosto;
