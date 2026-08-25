import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useMush } from "../../context/MushContext";
import { buscarReceta, costearProducto, PARTES_COSTO, PARTE_TOTAL } from "../../utils/costos";
import { productosDeCatalogo, variedadesDe } from "../../data/productos";
import TarjetaCosto from "../shared/TarjetaCosto.jsx";
import BotonExcel from "../shared/BotonExcel.jsx";

/**
 * Costos por producto: las mismas tarjetas que Recetas, una debajo de la otra,
 * con el costo por unidad abierto en ingredientes, packaging y mano de obra, y
 * el total al final. Cuales son sale del alta de Productos.
 *
 * A diferencia de Recetas, aca no es una grilla de tarjetas: cada tarjeta ya
 * muestra el dato, asi que ocupa el ancho completo y se lee de corrido. Cada
 * parte se toca y abre su detalle (/costos/:slug/:parte) con la tabla de donde
 * sale ese numero.
 *
 * Las tabletas no tienen un costo propio: el costo lo tiene cada variedad. Su
 * tarjeta tiene la misma forma que las demas y sus cajas quedan vacias hasta
 * que se defina de donde sale ese numero.
 */

// El ancho lo comparten el titulo y la lista, para que no se desfasen.
const ANCHO_BLOQUE = "920px";

const Costos = () => {
  const { alfajores, recetas, ingredientes, packaging, personal } = useMush();

  const listaCostos = useMemo(() => {
    const datos = { ingredientes, packaging, personal };

    return productosDeCatalogo(alfajores).map((producto) => {
      const variedades = variedadesDe(producto.slug);
      // El que agrupa no tiene receta propia. El packaging y la mano de obra son
      // los mismos en todas sus variedades, asi que se muestran los de la
      // primera y desde ahi se sigue al detalle.
      const referencia = variedades[0]?.slug || producto.slug;

      return {
        ...producto,
        variedades: variedades.length,
        costo: costearProducto(buscarReceta(recetas, referencia), datos),
      };
    });
  }, [alfajores, recetas, ingredientes, packaging, personal]);

  const filasDePlanilla = () =>
    listaCostos.map(({ nombre, categoria, costo }) => [
      nombre,
      categoria,
      costo.unidad,
      costo.ingredientes,
      costo.packaging,
      costo.manoObra,
      costo.total,
    ]);

  return (
    <div className="container py-4">
      <div
        className="mx-auto"
        style={{ maxWidth: ANCHO_BLOQUE, width: "100%", paddingBottom: "75px" }}
      >
        {/* Header */}
        <div className="d-flex align-items-center mb-1">
          <span className="flex-grow-1" style={{ flexBasis: 0 }}></span>
          <h2 className="mush-display text-white mb-0">Costos</h2>
          <span className="flex-grow-1 d-flex justify-content-center" style={{ flexBasis: 0 }}>
            <BotonExcel
              titulo="Costos"
              columnas={[
                "Producto",
                "Categoria",
                "Unidad",
                { titulo: "Ingredientes", formato: "moneda" },
                { titulo: "Packaging", formato: "moneda" },
                { titulo: "Mano de obra", formato: "moneda" },
                { titulo: "Total", formato: "moneda" },
              ]}
              filas={filasDePlanilla}
            />
          </span>
        </div>
        <p className="text-center text-secondary mb-4" style={{ fontSize: "0.8rem" }}>
          Costo por unidad de cada producto
        </p>

        {/* Una tarjeta por producto, una debajo de la otra. La de las tabletas
            tiene la misma forma que las demas: como no tiene costo propio, sus
            cajas se ven vacias hasta que se defina de donde salen. */}
        {listaCostos.map((producto) => (
          <TarjetaCosto
            key={producto.slug}
            {...producto}
            // El que agrupa variedades no tiene ingredientes propios: los tiene
            // cada tableta, y a eso lleva la caja del final.
            subtitulo={producto.variedades > 0 ? `${producto.variedades} variedades` : undefined}
            partes={
              producto.variedades > 0
                ? PARTES_COSTO.filter((parte) => parte.id !== "ingredientes")
                : undefined
            }
            conTotal={producto.variedades === 0}
            // El acceso a las variedades no es un costo: va afuera de la tarjeta
            alLado={
              producto.variedades > 0 ? (
                <Link
                  to={`/costos/${producto.slug}`}
                  className="mush-card mush-card-hover bg-ok-suave border-ok text-decoration-none d-flex flex-column justify-content-center text-center px-3"
                  style={{ width: "190px" }}
                  title={`Ver los ingredientes de cada ${producto.nombre.toLowerCase()}`}
                >
                  <span
                    className="mush-kicker text-ok d-block mb-1"
                    style={{ fontSize: "0.62rem", letterSpacing: "0.06em" }}
                  >
                    Ir a ingredientes por tableta
                  </span>
                  <i className="bi bi-arrow-right text-ok"></i>
                </Link>
              ) : undefined
            }
            enlaceDe={(parte, slug) =>
              parte === PARTE_TOTAL.id ? null : `/costos/${slug}/${parte}`
            }
          />
        ))}
      </div>
    </div>
  );
};

export default Costos;
