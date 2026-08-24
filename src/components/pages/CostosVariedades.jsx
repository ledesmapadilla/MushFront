import { useMemo } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { useMush } from "../../context/MushContext";
import { productosDeCatalogo, variedadesDe } from "../../data/productos";
import { buscarReceta, costearProducto, PARTES_COSTO } from "../../utils/costos";

// El packaging y la mano de obra son los mismos en todas las variedades: se ven
// una sola vez, en la tarjeta del producto que las agrupa. Lo propio de cada una
// son sus ingredientes.
const PARTES = PARTES_COSTO.filter((parte) => parte.id === "ingredientes");
import TarjetaCosto from "../shared/TarjetaCosto.jsx";

/**
 * Los costos de las variedades de un producto que agrupa (las tabletas).
 *
 * El producto no tiene receta propia: la tiene cada variedad, y cada una cuesta
 * lo suyo. Asi que esta pantalla es la misma lista de Costos, una fila por
 * variedad, y desde ahi se sigue al detalle de cada parte igual que con
 * cualquier otro producto.
 */

// Mas angosto que la lista de Costos: cada variedad muestra una sola caja, y
// con el ancho completo quedaba media tarjeta vacia.
const ANCHO_BLOQUE = "600px";

const CostosVariedades = () => {
  const { slug } = useParams();
  const { alfajores, recetas, ingredientes, packaging, personal } = useMush();

  const variedades = variedadesDe(slug);

  const listaCostos = useMemo(() => {
    const datos = { ingredientes, packaging, personal };

    return variedades.map((variedad) => {
      const receta = buscarReceta(recetas, variedad.slug);
      return {
        ...variedad,
        // La variedad no declara categoria: la hereda del producto que agrupa.
        categoria: receta?.categoria || "Tableta",
        nombre: receta?.nombre || variedad.nombre,
        costo: costearProducto(receta, datos),
      };
    });
  }, [variedades, recetas, ingredientes, packaging, personal]);

  // Un producto que no agrupa variedades no tiene esta pantalla: su costo esta
  // en la lista.
  if (variedades.length === 0) return <Navigate to="/costos" replace />;

  const producto =
    productosDeCatalogo(alfajores).find((item) => item.slug === slug) || null;
  const nombre = producto?.nombre || slug;

  return (
    <div className="container py-4">
      <div
        className="mx-auto"
        style={{ maxWidth: ANCHO_BLOQUE, width: "100%", paddingBottom: "75px" }}
      >
        {/* Encabezado con boton volver */}
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
          <div className="d-flex align-items-center gap-3">
            <Link
              to="/costos"
              className="btn btn-sm btn-outline-secondary py-1 px-2 text-white d-inline-flex align-items-center gap-1 rounded-3"
              title="Volver a Costos"
            >
              <i className="bi bi-arrow-left"></i>
            </Link>
            <h2 className="mush-display text-white mb-0">Costos</h2>
            <span className="mush-display text-secondary fs-2">-</span>
            <span className="mush-display text-dulce fs-2">{nombre}</span>
          </div>
          <span className="text-secondary" style={{ fontSize: "0.8rem" }}>
            Costo por unidad de cada variedad
          </span>
        </div>

        {/* Una tarjeta por variedad, igual que en la lista de productos */}
        {listaCostos.map((variedad) => (
          <TarjetaCosto
            key={variedad.slug}
            {...variedad}
            partes={PARTES}
            conTotal={false}
            subtitulo={`por ${variedad.costo.unidad}`}
            enlaceDe={(parte, slug) => `/costos/${slug}/${parte}`}
          />
        ))}
      </div>
    </div>
  );
};

export default CostosVariedades;
