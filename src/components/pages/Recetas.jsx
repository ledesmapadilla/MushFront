import { Link } from "react-router-dom";
import { useMush } from "../../context/MushContext";
import { productosDeCatalogo } from "../../data/productos";

const Recetas = () => {
  const { alfajores } = useMush();

  const listaBotones = productosDeCatalogo(alfajores);

  return (
    <div className="container py-4">
      <div className="mx-auto" style={{ maxWidth: "650px", width: "100%" }}>
        {/* Header */}
        <h2 className="mush-display text-white text-center mb-3">Recetas</h2>

        {/* Grid de 9 Tarjetas (3x3 fija y proporcionada) */}
        <div className="row g-2 g-sm-3">
          {listaBotones.map((r) => (
            <div className="col-4" key={r.slug}>
              <Link
                to={`/recetas/${r.slug}`}
                className="mush-card mush-card-hover text-decoration-none p-2 p-sm-3 d-flex flex-column align-items-center justify-content-center text-center border border-secondary border-opacity-25 rounded-4 w-100 shadow-sm"
                style={{ minHeight: "135px", height: "100%" }}
                title={`Ver receta de ${r.nombre}`}
              >
                <span className="fs-2 mb-2">{r.imagen}</span>
                <strong
                  className="text-white fw-bold text-truncate w-100 mb-2"
                  style={{ fontSize: "0.8rem" }}
                >
                  {r.nombre}
                </strong>
                <span
                  className="badge bg-secondary bg-opacity-25 text-secondary border border-secondary border-opacity-25"
                  style={{ fontSize: "0.68rem", padding: "0.16rem 0.45rem" }}
                >
                  {r.categoria}
                </span>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Recetas;
