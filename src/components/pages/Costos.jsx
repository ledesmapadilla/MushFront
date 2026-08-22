import { useMemo } from "react";
import { useMush } from "../../context/MushContext";
import { productosDeCatalogo, variedadesDe } from "../../data/productos";
import {
  buscarReceta,
  costearProducto,
  PARTE_TOTAL,
  promedioDeCostos,
} from "../../utils/costos";
import BloquesCosto from "../shared/BloquesCosto.jsx";

/**
 * Costos por producto: los mismos 9 productos del catalogo, uno debajo del
 * otro, con el costo por unidad abierto en ingredientes, packaging y mano de
 * obra, y el total al final.
 *
 * A diferencia de Recetas, aca no es una grilla de tarjetas: cada tarjeta ya
 * muestra el dato, asi que ocupa el ancho completo y se lee de corrido. Cada
 * parte se toca y abre su detalle (/costos/:slug/:parte) con la tabla de donde
 * sale ese numero.
 */

// El ancho lo comparten el titulo y la lista, para que no se desfasen.
const ANCHO_BLOQUE = "920px";

// Los dos lados de la tarjeta miden lo mismo, asi todas quedan igual de altas
// sin importar si el producto lleva badge.
const ALTO_CONTENIDO = "72px";

const Costos = () => {
  const { alfajores, recetas, ingredientes, packaging, personal } = useMush();

  const listaCostos = useMemo(() => {
    const datos = { ingredientes, packaging, personal };

    return productosDeCatalogo(alfajores).map((producto) => {
      const receta = buscarReceta(recetas, producto.slug);
      const costo = costearProducto(receta, datos);

      // Las tabletas no tienen receta propia: el costo sale del promedio de
      // sus variedades, y por eso todavia no tienen detalle propio.
      const variedades = variedadesDe(producto.slug);
      if (costo.total === 0 && variedades.length > 0) {
        return {
          ...producto,
          agrupa: true,
          costo: promedioDeCostos(
            variedades.map((variedad) =>
              costearProducto(buscarReceta(recetas, variedad.slug), datos)
            )
          ),
        };
      }

      return { ...producto, agrupa: false, costo };
    });
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
        {listaCostos.map(({ slug, nombre, categoria, imagen, costo, agrupa }) => (
          <div className="mush-card p-3 p-sm-4 mb-3" key={slug}>
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
                  {costo.promedioDe > 0 && (
                    <span className="mush-badge mush-badge-info d-inline-flex mt-1">
                      Promedio de {costo.promedioDe}
                    </span>
                  )}
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

              {/* Cada parte lleva a su detalle; el total no, porque no es una
                  parte: es la suma de las otras tres. Las tabletas agrupan
                  variedades y su detalle se arma aparte, asi que no llevan a
                  ningun lado. */}
              <BloquesCosto
                costo={costo}
                enlaceDe={
                  agrupa ? null : (id) => (id === PARTE_TOTAL.id ? null : `/costos/${slug}/${id}`)
                }
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Costos;
