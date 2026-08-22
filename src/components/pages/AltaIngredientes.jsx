import { useState } from "react";
import { useMush } from "../../context/MushContext";
import BuscadorFiltro from "../shared/BuscadorFiltro.jsx";
import Swal from "sweetalert2";

const UNIDADES_DISPONIBLES = ["kg", "gr", "lts", "ml", "un", "otras"];

const FORM_INICIAL = {
  id: "",
  nombre: "",
  unidad: "kg",
  observaciones: "",
};

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

const AltaIngredientes = () => {
  const { ingredientes, guardarIngrediente, eliminarIngrediente } = useMush();

  const [form, setForm] = useState(FORM_INICIAL);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [errorNombre, setErrorNombre] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === "nombre") {
      setErrorNombre("");
    }
  };

  const handleAbrirNuevo = () => {
    setForm(FORM_INICIAL);
    setModoEdicion(false);
    setErrorNombre("");
    setMostrarModal(true);
  };

  const handleEditar = (item) => {
    setForm({
      id: item.id,
      nombre: item.nombre || "",
      unidad: item.unidad || "kg",
      observaciones: item.observaciones || "",
    });
    setModoEdicion(true);
    setErrorNombre("");
    setMostrarModal(true);
  };

  const handleCerrarModal = () => {
    setForm(FORM_INICIAL);
    setModoEdicion(false);
    setErrorNombre("");
    setMostrarModal(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorNombre("");

    const nombreLimpio = (form.nombre || "").trim();
    if (!nombreLimpio) {
      setErrorNombre("El nombre del ingrediente es obligatorio.");
      return;
    }
    if (nombreLimpio.length < 2) {
      setErrorNombre("El nombre debe tener al menos 2 caracteres.");
      return;
    }

    // Normalización de singular/plural para validación previa instantánea
    const normalizar = (txt) =>
      txt
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "")
        .replace(/ces$/, "z")
        .replace(/es$/, "")
        .replace(/s$/, "");

    const canonicoNuevo = normalizar(nombreLimpio);
    const duplicado = ingredientes.find(
      (item) => item.id !== form.id && normalizar(item.nombre || "") === canonicoNuevo
    );

    if (duplicado) {
      setErrorNombre(`Ya existe un ingrediente registrado como "${duplicado.nombre}".`);
      return;
    }

    let idFinal = form.id;
    if (!idFinal && nombreLimpio) {
      const baseSlug = nombreLimpio
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "_")
        .replace(/_+/g, "_")
        .slice(0, 20);
      const randomSuffix = Math.random().toString(36).substring(2, 6);
      idFinal = `${baseSlug}_${randomSuffix}`;
    }

    const itemPrevio = ingredientes.find((i) => i.id === form.id) || {};

    const ingredienteAGuardar = {
      ...itemPrevio,
      id: idFinal || "",
      nombre: nombreLimpio,
      unidad: form.unidad || "kg",
      observaciones: form.observaciones ? form.observaciones.trim() : "",
    };

    try {
      await guardarIngrediente(ingredienteAGuardar);

      Swal.fire({
        ...swalConfig,
        title: "Ingrediente guardado",
        icon: "success",
        timer: 1400,
        showConfirmButton: false,
      });

      handleCerrarModal();
    } catch (error) {
      const mensaje = error.message || "Error al validar los datos.";
      setErrorNombre(mensaje);
    }
  };

  const handleEliminar = (item) => {
    Swal.fire({
      ...swalConfig,
      title: `¿Eliminar ${item.nombre}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      customClass: {
        popup: "rounded-4 border border-secondary border-opacity-25 shadow-lg",
        confirmButton: "btn btn-danger px-3 py-1 rounded-3 me-2 fw-bold",
        cancelButton: "btn btn-outline-secondary px-3 py-1 rounded-3 text-dark",
      },
    }).then((result) => {
      if (result.isConfirmed) {
        eliminarIngrediente(item.id);
        if (form.id === item.id) {
          handleCerrarModal();
        }
      }
    });
  };

  const ingredientesFiltrados = (ingredientes || [])
    .filter((item) => {
      const texto = busqueda.toLowerCase();
      const nombre = (item.nombre || "").toLowerCase();
      const obs = (item.observaciones || "").toLowerCase();
      return nombre.includes(texto) || obs.includes(texto);
    })
    .sort((a, b) =>
      (a.nombre || "").localeCompare(b.nombre || "", "es", { sensitivity: "base" })
    );

  return (
    <div className="container py-4">
      {/* Contenedor ensanchado y centrado */}
      <div className="mx-auto" style={{ maxWidth: "920px", width: "100%", paddingBottom: "75px" }}>
        {/* Encabezado con Botón Nuevo Ingrediente (sin signo +) */}
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-3">
          <h2 className="mush-display text-white mb-0">Ingredientes</h2>

        </div>

        {/* Tabla de Listado de Ingredientes con scroll interno y fila única estricta */}
        <div className="mush-card p-3 p-sm-4">
          <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
            <h5 className="text-white mb-0 fw-bold">Listado de Ingredientes</h5>
            <div className="d-flex align-items-center gap-2">
              {ingredientes.length > 0 && (
                <div style={{ width: "240px", maxWidth: "100%" }}>
                  <BuscadorFiltro
                    valor={busqueda}
                    alCambiar={setBusqueda}
                    placeholder="Buscar ingrediente..."
                  />
                </div>
              )}
              <button type="button" className="btn-mush text-nowrap" onClick={handleAbrirNuevo}>
                Nuevo Ingrediente
              </button>
            </div>
          </div>

          <div className="table-responsive mush-scroll-tabla" style={{ maxHeight: "calc(100vh - 280px)" }}>
            <table className="table mush-tabla align-middle mb-0 text-nowrap">
              <thead>
                <tr>
                  <th style={{ width: "28%" }}>Ingrediente</th>
                  <th style={{ width: "12%" }}>Unidad</th>
                  <th style={{ width: "42%" }}>Observaciones</th>
                  <th className="text-end" style={{ width: "18%" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ingredientesFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-4 text-secondary">
                      No hay ingredientes cargados.
                    </td>
                  </tr>
                ) : (
                  ingredientesFiltrados.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong
                          className="text-white text-truncate d-block"
                          style={{ fontSize: "0.82rem", maxWidth: "260px" }}
                          title={item.nombre}
                        >
                          {item.nombre}
                        </strong>
                      </td>
                      <td>
                        <span
                          className="badge bg-secondary bg-opacity-25 text-white border border-secondary border-opacity-25 px-2 py-1"
                          style={{ fontSize: "0.72rem" }}
                        >
                          {item.unidad || "kg"}
                        </span>
                      </td>
                      <td>
                        <span
                          className="text-secondary text-truncate d-block"
                          style={{ fontSize: "0.8rem", maxWidth: "390px" }}
                          title={item.observaciones}
                        >
                          {item.observaciones || "—"}
                        </span>
                      </td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-1">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary py-0 px-2 text-white d-inline-flex align-items-center gap-1"
                            style={{ fontSize: "0.72rem", minHeight: "24px" }}
                            onClick={() => handleEditar(item)}
                            title="Editar ingrediente"
                          >
                            <i className="bi bi-pencil"></i> Editar
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger py-0 px-2 d-inline-flex align-items-center gap-1"
                            style={{ fontSize: "0.72rem", minHeight: "24px" }}
                            onClick={() => handleEliminar(item)}
                            title="Eliminar ingrediente"
                          >
                            <i className="bi bi-trash"></i> Borrar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL para Nuevo / Editar Ingrediente con validación bajo la caja */}
      {mostrarModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.75)", zIndex: 1055 }}
          onClick={handleCerrarModal}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            style={{ maxWidth: "460px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content mush-card p-3 p-sm-4 rounded-4 shadow-lg border border-secondary border-opacity-25">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="text-white mb-0 fw-bold fs-6">
                  <i className={`bi ${modoEdicion ? "bi-pencil-square" : "bi-box-seam"} text-dulce me-2`}></i>
                  {modoEdicion ? "Editar Ingrediente" : "Nuevo Ingrediente"}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={handleCerrarModal}
                  aria-label="Cerrar"
                ></button>
              </div>

              <form onSubmit={handleSubmit} noValidate autoComplete="off">
                {/* Ingrediente y Unidad en la misma fila con cajas más chicas */}
                <div className="row g-2 mb-2">
                  <div className="col-8">
                    <label className="form-label text-secondary fw-semibold mb-1" style={{ fontSize: "0.78rem" }}>
                      Ingrediente <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      name="nombre"
                      className={`form-control form-control-sm mush-input py-1 px-2 ${errorNombre ? "border-danger is-invalid" : ""}`}
                      style={{ fontSize: "0.85rem" }}
                      placeholder="Nombre del ingrediente"
                      value={form.nombre}
                      onChange={handleChange}
                      autoComplete="off"
                      spellCheck="false"
                      autoFocus
                    />
                    {/* Mensaje de validación en letras rojas bajo la caja */}
                    {errorNombre && (
                      <div
                        className="text-danger mt-1 fw-semibold d-flex align-items-center gap-1"
                        style={{ fontSize: "0.74rem" }}
                      >
                        <i className="bi bi-exclamation-circle-fill"></i> {errorNombre}
                      </div>
                    )}
                  </div>

                  <div className="col-4">
                    <label className="form-label text-secondary fw-semibold mb-1" style={{ fontSize: "0.78rem" }}>
                      Unidad
                    </label>
                    <select
                      name="unidad"
                      className="form-select form-select-sm mush-input py-1 px-2"
                      style={{ fontSize: "0.85rem" }}
                      value={form.unidad}
                      onChange={handleChange}
                    >
                      {UNIDADES_DISPONIBLES.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label text-secondary fw-semibold mb-1" style={{ fontSize: "0.78rem" }}>
                    Observaciones
                  </label>
                  <input
                    type="text"
                    name="observaciones"
                    className="form-control form-control-sm mush-input py-1 px-2"
                    style={{ fontSize: "0.85rem" }}
                    placeholder="Notas u observaciones"
                    value={form.observaciones}
                    onChange={handleChange}
                    autoComplete="off"
                    spellCheck="false"
                  />
                </div>

                <div className="d-flex justify-content-end gap-2 pt-1">
                  <button
                    type="button"
                    className="btn-mush-ghost py-1 px-3"
                    style={{ fontSize: "0.82rem" }}
                    onClick={handleCerrarModal}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-mush px-3 py-1"
                    style={{ fontSize: "0.82rem" }}
                  >
                    {modoEdicion ? "Actualizar" : "Guardar"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AltaIngredientes;
