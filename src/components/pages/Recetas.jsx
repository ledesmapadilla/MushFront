import { useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import { useMush } from "../../context/MushContext";
import { productosDeCatalogo } from "../../data/productos";

/**
 * Las recetas, una tarjeta cada una.
 *
 * Cuando son muchas y se parecen entre si -los diez sabores de tableta- se las
 * puede juntar bajo una sola tarjeta: se le pone un nombre al grupo y se elige
 * que recetas entran. El grupo se guarda en cada receta, asi que se ve igual
 * desde cualquier navegador, y no toca ningun numero: es solo como se ven.
 */

// Configuración base de SweetAlert en tema claro y formato compacto
const swalConfig = {
  background: "#ffffff",
  color: "#1c1917",
  customClass: {
    popup: "rounded-4 border border-secondary border-opacity-25 shadow-lg",
    confirmButton: "btn-mush px-3 py-1",
    cancelButton: "btn-mush-ghost px-3 py-1 text-dark",
  },
  buttonsStyling: false,
};

// Un grupo no es un producto: no tiene emoji propio como los demas.
const EMOJI_GRUPO = "🗂️";

const Recetas = () => {
  const { alfajores, recetas, guardarReceta } = useMush();

  // El grupo que se esta mirando por dentro. Vacio = la lista de siempre.
  const [grupoAbierto, setGrupoAbierto] = useState("");

  // El modal de armar un grupo. "editando" es el nombre del grupo que se abrio
  // a modificar, para saber a quien hay que sacarle las que se destildaron.
  const [mostrarModal, setMostrarModal] = useState(false);
  const [editando, setEditando] = useState("");
  const [nombre, setNombre] = useState("");
  const [elegidas, setElegidas] = useState([]);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const tarjetas = productosDeCatalogo(alfajores);

  const recetaDe = (slug) => (recetas || []).find((r) => r.slug === slug || r.id === slug);

  // Con que otras se muestra junta. Es lo que se escribio al agruparla.
  const grupoDe = (slug) => (recetaDe(slug)?.grupo || "").trim();

  const mismoGrupo = (a, b) =>
    a.localeCompare(b, "es", { sensitivity: "base" }) === 0;

  /**
   * Lo que se ve en la grilla: las recetas sueltas tal cual, y una sola tarjeta
   * por grupo, en el lugar donde caia la primera de las suyas.
   */
  const listaBotones = (() => {
    const filas = [];
    const porGrupo = new Map();

    tarjetas.forEach((tarjeta) => {
      const grupo = grupoDe(tarjeta.slug);
      if (!grupo) {
        filas.push({ tipo: "receta", ...tarjeta });
        return;
      }
      if (!porGrupo.has(grupo)) {
        const fila = { tipo: "grupo", nombre: grupo, miembros: [] };
        porGrupo.set(grupo, fila);
        filas.push(fila);
      }
      porGrupo.get(grupo).miembros.push(tarjeta);
    });

    return filas;
  })();

  // Las de adentro del grupo que se esta mirando.
  const miembrosAbiertos = grupoAbierto
    ? tarjetas.filter((t) => mismoGrupo(grupoDe(t.slug), grupoAbierto))
    : [];

  const abrirModal = (grupo = "") => {
    setEditando(grupo);
    setNombre(grupo);
    setElegidas(
      grupo ? tarjetas.filter((t) => mismoGrupo(grupoDe(t.slug), grupo)).map((t) => t.slug) : []
    );
    setError("");
    setMostrarModal(true);
  };

  const cerrarModal = () => {
    setMostrarModal(false);
    setEditando("");
    setNombre("");
    setElegidas([]);
    setError("");
  };

  const alternar = (slug) =>
    setElegidas((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );

  /**
   * Guardar el grupo: se le escribe el nombre a cada receta elegida, y se les
   * borra a las que salieron. Cada una se guarda por separado, con un guardado
   * parcial que no toca sus ingredientes ni su mano de obra.
   */
  const guardarGrupo = async () => {
    const limpio = nombre.trim();
    if (!limpio) {
      setError("Falta ponerle nombre al grupo.");
      return;
    }
    if (elegidas.length < 2) {
      setError("Un grupo junta al menos dos recetas.");
      return;
    }

    // Salvo cuando se lo esta editando, un nombre que ya existe seria un
    // segundo grupo con el mismo titulo: se juntarian sin querer.
    const yaExiste = listaBotones.some(
      (fila) =>
        fila.tipo === "grupo" &&
        mismoGrupo(fila.nombre, limpio) &&
        !(editando && mismoGrupo(fila.nombre, editando))
    );
    if (yaExiste) {
      setError(`Ya hay un grupo llamado "${limpio}".`);
      return;
    }

    const salieron = editando
      ? tarjetas
          .filter((t) => mismoGrupo(grupoDe(t.slug), editando) && !elegidas.includes(t.slug))
          .map((t) => t.slug)
      : [];

    setGuardando(true);
    await Promise.all([
      ...elegidas.map((slug) => guardarUna(slug, limpio)),
      ...salieron.map((slug) => guardarUna(slug, "")),
    ]);
    setGuardando(false);

    cerrarModal();
    Swal.fire({
      ...swalConfig,
      title: editando ? `Se guardó el grupo ${limpio}` : `Se agrupó en ${limpio}`,
      text: `${elegidas.length} recetas en una sola tarjeta.`,
      icon: "success",
      timer: 1600,
      showConfirmButton: false,
    });
  };

  const guardarUna = (slug, grupo) => {
    const receta = recetaDe(slug);
    if (!receta) return Promise.resolve();
    return guardarReceta({ id: receta.id, slug: receta.slug, grupo });
  };

  /** Deshacer el grupo: cada receta vuelve a tener su tarjeta. */
  const desagrupar = async (grupo) => {
    const suyas = tarjetas.filter((t) => mismoGrupo(grupoDe(t.slug), grupo));

    const respuesta = await Swal.fire({
      ...swalConfig,
      title: `¿Deshacer el grupo ${grupo}?`,
      text: `Sus ${suyas.length} recetas vuelven a verse cada una con su tarjeta. No se borra ninguna.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, deshacer",
      cancelButtonText: "Cancelar",
    });
    if (!respuesta.isConfirmed) return;

    await Promise.all(suyas.map((t) => guardarUna(t.slug, "")));
    setGrupoAbierto("");
  };

  // La tarjeta de una receta, que es la misma adentro y afuera de un grupo.
  const tarjetaDeReceta = (r) => (
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
  );

  return (
    <div className="container py-4">
      {/* El pie de pagina es fixed-bottom y flota sobre el contenido: sin este
          hueco, la ultima fila de tarjetas queda tapada y no hay scroll que la
          alcance. */}
      <div className="mx-auto" style={{ maxWidth: "650px", width: "100%", paddingBottom: "75px" }}>
        {/* Header */}
        <h2 className="mush-display text-white text-center mb-3">Recetas</h2>

        {grupoAbierto ? (
          /* Adentro de un grupo: sus recetas, y de donde volver. */
          <>
            <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
              <button
                type="button"
                className="btn-mush-ghost py-1 px-3"
                style={{ fontSize: "0.78rem" }}
                onClick={() => setGrupoAbierto("")}
              >
                <i className="bi bi-arrow-left me-1"></i>
                Volver
              </button>
              {/* El nombre del grupo es el titulo de lo que se esta mirando: se lee
                  como el de la pantalla, no como un dato mas de la fila. */}
              <h3
                className="mush-display text-white mb-0 text-truncate"
                style={{ fontSize: "1.35rem" }}
              >
                {EMOJI_GRUPO} {grupoAbierto}
              </h3>
              <span className="d-flex gap-2">
                <button
                  type="button"
                  className="btn-mush-outline py-1 px-3"
                  style={{ fontSize: "0.78rem" }}
                  onClick={() => abrirModal(grupoAbierto)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger py-1 px-3"
                  style={{ fontSize: "0.78rem" }}
                  onClick={() => desagrupar(grupoAbierto)}
                >
                  Deshacer
                </button>
              </span>
            </div>

            <div className="row g-2 g-sm-3">{miembrosAbiertos.map(tarjetaDeReceta)}</div>
          </>
        ) : (
          <>
            {/* Juntar varias recetas bajo una tarjeta sola. */}
            <div className="d-flex justify-content-end mb-3">
              <button
                type="button"
                className="btn-mush-outline py-1 px-3"
                style={{ fontSize: "0.78rem" }}
                onClick={() => abrirModal("")}
                title="Juntar varias recetas bajo una sola tarjeta"
              >
                <i className="bi bi-folder-plus me-1"></i>
                Agrupar productos
              </button>
            </div>

            {/* Una tarjeta por receta, de a tres por fila. Cuantas son lo dice el
                alta de Productos, asi que la grilla crece sola. */}
            <div className="row g-2 g-sm-3">
              {listaBotones.map((fila) =>
                fila.tipo === "receta" ? (
                  tarjetaDeReceta(fila)
                ) : (
                  <div className="col-4" key={`grupo-${fila.nombre}`}>
                    {/* El grupo no lleva a una receta: se abre acá mismo y
                        muestra las suyas. */}
                    <button
                      type="button"
                      className="mush-card mush-card-hover p-2 p-sm-3 d-flex flex-column align-items-center justify-content-center text-center border border-dulce rounded-4 w-100 shadow-sm"
                      style={{ minHeight: "135px", height: "100%" }}
                      onClick={() => setGrupoAbierto(fila.nombre)}
                      title={`Ver las ${fila.miembros.length} recetas de ${fila.nombre}`}
                    >
                      <span className="fs-2 mb-2">{EMOJI_GRUPO}</span>
                      <strong
                        className="text-white fw-bold text-truncate w-100 mb-2"
                        style={{ fontSize: "0.8rem" }}
                      >
                        {fila.nombre}
                      </strong>
                      <span
                        className="badge bg-dulce-suave text-dulce border border-dulce"
                        style={{ fontSize: "0.68rem", padding: "0.16rem 0.45rem" }}
                      >
                        {fila.miembros.length} recetas
                      </span>
                    </button>
                  </div>
                )
              )}
            </div>
          </>
        )}
      </div>

      {/* MODAL: armar el grupo */}
      {mostrarModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.75)", zIndex: 1055 }}
          onClick={cerrarModal}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            style={{ maxWidth: "480px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content mush-card p-3 p-sm-4 rounded-4 shadow-lg border border-secondary border-opacity-25">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="text-white mb-0 fw-bold fs-6">
                  <i className="bi bi-folder-plus text-dulce me-2"></i>
                  {editando ? "Editar grupo" : "Agrupar productos"}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={cerrarModal}
                  aria-label="Cerrar"
                ></button>
              </div>

              <label
                className="form-label text-secondary fw-semibold mb-1 d-block"
                style={{ fontSize: "0.78rem" }}
              >
                Nombre del grupo <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                className="form-control form-control-sm mush-input py-1 px-2 mb-3"
                style={{ fontSize: "0.85rem" }}
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value);
                  setError("");
                }}
                autoComplete="off"
                autoFocus
              />

              <label
                className="form-label text-secondary fw-semibold mb-1 d-block"
                style={{ fontSize: "0.78rem" }}
              >
                Qué recetas van adentro <span className="text-danger">*</span>
              </label>

              {/* Una receta esta en un grupo o en ninguno: tildarla acá la
                  saca del que tenia. */}
              <div
                className="mush-card-elevada rounded-3 p-2 mush-scroll-tabla"
                style={{ maxHeight: "300px" }}
              >
                {tarjetas.map((t) => {
                  const suGrupo = grupoDe(t.slug);
                  const ajena = suGrupo && !mismoGrupo(suGrupo, nombre.trim() || editando);
                  return (
                    <div className="form-check mb-1" key={t.slug}>
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`grupo-${t.slug}`}
                        checked={elegidas.includes(t.slug)}
                        onChange={() => {
                          alternar(t.slug);
                          setError("");
                        }}
                      />
                      <label
                        className="form-check-label text-white d-flex align-items-center gap-2 w-100"
                        htmlFor={`grupo-${t.slug}`}
                        style={{ fontSize: "0.8rem", cursor: "pointer" }}
                      >
                        <span>{t.imagen}</span>
                        <span className="text-truncate">{t.nombre}</span>
                        {ajena && (
                          <span
                            className="badge bg-secondary bg-opacity-25 text-secondary border border-secondary border-opacity-25 ms-auto flex-shrink-0"
                            style={{ fontSize: "0.62rem" }}
                            title={`Hoy está en el grupo ${suGrupo}`}
                          >
                            en {suGrupo}
                          </span>
                        )}
                      </label>
                    </div>
                  );
                })}
              </div>

              <p className="text-secondary mb-0 mt-2" style={{ fontSize: "0.72rem" }}>
                Las elegidas dejan de tener tarjeta propia: se ven al abrir el grupo. No se toca
                ninguna receta ni ningún costo.
              </p>

              {error && (
                <p className="text-alerta mb-0 mt-2" style={{ fontSize: "0.78rem" }}>
                  <i className="bi bi-exclamation-triangle-fill me-1"></i>
                  {error}
                </p>
              )}

              <div className="d-flex justify-content-end gap-2 mt-3">
                <button
                  type="button"
                  className="btn-mush-ghost py-1 px-3"
                  style={{ fontSize: "0.8rem" }}
                  onClick={cerrarModal}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-mush py-1 px-3"
                  style={{ fontSize: "0.8rem" }}
                  onClick={guardarGrupo}
                  disabled={guardando}
                >
                  {guardando ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Recetas;
