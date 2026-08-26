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

  // La receta puede declarar que no lleva esta parte: ahi el cero es el numero
  // correcto y no hay nada que avisar.
  const noUtilizaParte = ({ secciones }) =>
    (secciones || []).length > 0 && secciones.every((s) => (costo.sinUso || []).includes(s));

  // Un cero sin esa declaracion es otra cosa: que en la receta no se cargo nada.
  const sinCompletarParte = (parte) =>
    !noUtilizaParte(parte) && !(Number(costo[parte.campo]) > 0);

  // Si a alguna de las partes que lo componen le falta cargar algo, el total no
  // es un total: seria la suma de lo que hay tomando lo que falta como cero, y
  // se lee como si estuviera completo. Se dice que no esta disponible en vez de
  // mostrar un numero que no es.
  const partesFaltantes = partes.filter(sinCompletarParte);
  const faltanDatos = partesFaltantes.length > 0;

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
      {visibles.map((parte) => {
        const { id, titulo, campo } = parte;
        const destino = enlaceDe ? enlaceDe(id) : null;
        const esTotal = id === PARTE_TOTAL.id;
        const esActiva = !soloActiva && id === activa && !esTotal;
        const noUtiliza = !esTotal && noUtilizaParte(parte);

        // El aviso de la parte se da en su caja, que es donde se lo puede
        // corregir; el del total, en la del total.
        const sinCompletar = !esTotal && sinCompletarParte(parte);
        const totalIncompleto = esTotal && faltanDatos;

        const clases = [
          "mush-card-elevada h-100 rounded-3 px-2 py-2 text-center",
          "d-flex flex-column justify-content-center text-decoration-none",
          // El total lleva su color; una parte elegida, el tinte de la pantalla.
          esTotal && !totalIncompleto ? "mush-caja-resultado" : "",
          esActiva ? "bg-dulce-suave border-dulce" : "",
          sinCompletar || totalIncompleto ? "mush-caja-sin-completar" : "",
          destino ? "mush-card-hover" : "",
        ]
          .filter(Boolean)
          .join(" ");

        // Lo que falta, listado, para el cartelito del total.
        const queFalta = partesFaltantes.map((p) => p.titulo.toLowerCase()).join(", ");
        const ayuda = totalIncompleto
          ? `No se puede calcular el total: falta cargar ${queFalta} en la receta`
          : sinCompletar
            ? `Falta cargar ${titulo.toLowerCase()} en la receta`
            : `Ver de donde sale ${titulo.toLowerCase()}`;

        const contenido = (
          <>
            <span className="mush-kicker d-block mb-1 text-truncate">{titulo}</span>
            {/* Las partes se leen mas apagadas que el total: el que interesa de
                un vistazo es el total, las otras tres son el desglose. */}
            {noUtiliza ? (
              <span className="text-secondary d-block lh-sm" style={{ fontSize: "0.75rem" }}>
                no utiliza
              </span>
            ) : sinCompletar ? (
              <span
                className="text-danger fw-normal d-block lh-sm"
                style={{ fontSize: "0.72rem" }}
              >
                <i className="bi bi-exclamation-triangle-fill"></i> sin completar
                <br />
                en la receta
              </span>
            ) : totalIncompleto ? (
              <span
                className="text-danger fw-normal d-block lh-sm"
                style={{ fontSize: "0.72rem" }}
              >
                <i className="bi bi-exclamation-triangle-fill"></i> no disponible
                <br />
                faltan datos
              </span>
            ) : (
              <span
                className={`mush-dato d-block text-nowrap ${esTotal ? "" : "text-secondary"}`}
                style={{ fontSize: "1rem" }}
              >
                {moneda(costo[campo], 2)}
              </span>
            )}
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
                title={ayuda}
              >
                {contenido}
              </Link>
            ) : (
              <div
                className={clases}
                style={{ height: ALTO_BLOQUE }}
                title={totalIncompleto ? ayuda : undefined}
              >
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
