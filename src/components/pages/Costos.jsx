import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useMush } from "../../context/MushContext";
import { productosDeCatalogo, variedadesDe } from "../../data/productos";
import { buscarReceta, costearProducto, PARTE_TOTAL } from "../../utils/costos";
import TarjetaCosto from "../shared/TarjetaCosto.jsx";

/**
 * Costos por producto: los mismos 9 productos del catalogo, uno debajo del
 * otro, con el costo por unidad abierto en ingredientes, packaging y mano de
 * obra, y el total al final.
 *
 * A diferencia de Recetas, aca no es una grilla de tarjetas: cada tarjeta ya
 * muestra el dato, asi que ocupa el ancho completo y se lee de corrido. Cada
 * parte se toca y abre su detalle (/costos/:slug/:parte) con la tabla de donde
 * sale ese numero.
 *
 * Los productos que agrupan variedades (las tabletas) no tienen un costo
 * propio que mostrar: el costo lo tiene cada variedad. Por eso su tarjeta es
 * solo el nombre y lleva al listado de las suyas (/costos/:slug).
 */

// El ancho lo comparten el titulo y la lista, para que no se desfasen.
const ANCHO_BLOQUE = "920px";

const Costos = () => {
  const { alfajores, recetas, ingredientes, packaging, personal } = useMush();

  const listaCostos = useMemo(() => {
    const datos = { ingredientes, packaging, personal };

    return productosDeCatalogo(alfajores).map((producto) => ({
      ...producto,
      variedades: variedadesDe(producto.slug).length,
      costo: costearProducto(buscarReceta(recetas, producto.slug), datos),
    }));
  }, [alfajores, recetas, ingredientes, packaging, personal]);

  return (
    <div className="container py-4">
      <div
        className="mx-auto"
        style={{ maxWidth: ANCHO_BLOQUE, width: "100%", paddingBottom: "75px" }}
      >
        {/* Header */}
        <h2 className="mush-display text-white text-center mb-1">Costos</h2>
        <p className="text-center text-secondary mb-4" style={{ fontSize: "0.8rem" }}>
          Costo por unidad de cada producto
        </p>

        {/* Una tarjeta por producto, una debajo de la otra */}
        {listaCostos.map((producto) =>
          producto.variedades > 0 ? (
            // El que agrupa: tarjeta chica, centrada y sin numeros
            <div className="text-center mb-3" key={producto.slug}>
              <Link
                to={`/costos/${producto.slug}`}
                className="mush-card mush-card-hover text-decoration-none d-inline-flex align-items-center gap-3 px-4 py-3"
                title={`Ver el costo de cada ${producto.nombre.toLowerCase()}`}
              >
                <span className="fs-2">{producto.imagen}</span>
                <span className="text-start">
                  <strong className="text-white fw-bold d-block" style={{ fontSize: "1rem" }}>
                    {producto.nombre}
                  </strong>
                  <span className="text-secondary" style={{ fontSize: "0.72rem" }}>
                    {producto.variedades} variedades
                  </span>
                </span>
                <i className="bi bi-chevron-right text-dulce"></i>
              </Link>
            </div>
          ) : (
            <TarjetaCosto
              key={producto.slug}
              {...producto}
              enlaceDe={(parte, slug) =>
                parte === PARTE_TOTAL.id ? null : `/costos/${slug}/${parte}`
              }
            />
          )
        )}
      </div>
    </div>
  );
};

export default Costos;
