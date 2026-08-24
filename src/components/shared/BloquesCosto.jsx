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
 * detalle desde la lista. Las cajas que no tienen a donde ir (el total) quedan
 * como cajas comunes.
 *
 * Con `soloActiva` queda solo la parte que se esta mirando: la misma caja de
 * siempre, del mismo tamano, sola y centrada.
 *
 * El alto de las cajas es fijo y los importes no cortan a dos renglones: si no,
 * una tarjeta con un total largo (el mendiant) queda mas alta que las demas.
 */
const ALTO_BLOQUE = "72px";
const ANCHO_CAJA_SOLA = "168px";

const BloquesCosto = ({
  costo,
  partes = PARTES_COSTO,
  conTotal = true,
  parteActiva = null,
  soloActiva = false,
  enlaceDe = null,
}) => {
  // Sin parte elegida el destacado es el total, que es lo que se esta mirando.
  const activa = parteActiva || PARTE_TOTAL.id;
  const bloques = conTotal ? [...partes, PARTE_TOTAL] : partes;
  const visibles = soloActiva ? bloques.filter(({ id }) => id === activa) : bloques;
  // Una caja sola no se reparte en cuartos: mide lo suyo y se apoya a la derecha.
  // Pocas cajas no se reparten en cuartos: miden lo suyo y se apoyan a la
  // derecha, para no dejar la mitad de la tarjeta vacia.
  const sola = !soloActiva && visibles.length <= 2;

  return (
    <div
      className={`row g-2 w-100 m-0 ${
        soloActiva
          ? "justify-content-center"
          : // Con una sola caja no se deja el hueco a la derecha: se apoya donde
            // esta el total en las demas tarjetas.
            sola
            ? "justify-content-end"
            : ""
      }`}
    >
      {visibles.map(({ id, titulo, campo }) => {
        const destino = enlaceDe ? enlaceDe(id) : null;
        const esTotal = id === PARTE_TOTAL.id;
        const esActiva = !soloActiva && id === activa && !esTotal;

        const clases = [
          "mush-card-elevada h-100 rounded-3 px-2 py-2 text-center",
          "d-flex flex-column justify-content-center text-decoration-none",
          // El total lleva su color; una parte elegida, el tinte de la pantalla.
          esTotal ? "mush-caja-resultado" : "",
          esActiva ? "bg-dulce-suave border-dulce" : "",
          destino ? "mush-card-hover" : "",
        ]
          .filter(Boolean)
          .join(" ");

        const contenido = (
          <>
            <span className="mush-kicker d-block mb-1 text-truncate">{titulo}</span>
            {/* Las partes se leen mas apagadas que el total: el que interesa de
                un vistazo es el total, las otras tres son el desglose. */}
            <span
              className={`mush-dato d-block text-nowrap ${esTotal ? "" : "text-secondary"}`}
              style={{ fontSize: "1rem" }}
            >
              {moneda(costo[campo], 2)}
            </span>
          </>
        );

        return (
          <div
            className={sola ? "col-auto" : "col-6 col-md-3"}
            style={sola ? { width: ANCHO_CAJA_SOLA } : undefined}
            key={id}
          >
            {destino ? (
              <Link
                to={destino}
                className={clases}
                style={{ height: ALTO_BLOQUE }}
                title={`Ver de donde sale ${titulo.toLowerCase()}`}
              >
                {contenido}
              </Link>
            ) : (
              <div className={clases} style={{ height: ALTO_BLOQUE }}>
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
