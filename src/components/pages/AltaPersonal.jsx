import { useState } from "react";
import BotonExcel from "../shared/BotonExcel.jsx";
import { useMush } from "../../context/MushContext";
import BuscadorFiltro from "../shared/BuscadorFiltro.jsx";
import {
  mensualVigente,
  valorMensual,
  valorSemanal,
  valorJornal,
  valorHora,
  moneda,
  monedaInput,
  fechaLegible,
  fechaHoy,
} from "../../utils/sueldos.js";
import Swal from "sweetalert2";

const FORM_INICIAL = {
  id: "",
  nombre: "",
  fechaAlta: "",
  mensual: "",
  jornalesPorSemana: "",
  horasPorDia: "",
  observaciones: "",
};

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

const normalizar = (txt) =>
  (txt || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

const AltaPersonal = () => {
  const { personal, guardarPersonal, eliminarPersonal } = useMush();

  const [form, setForm] = useState(FORM_INICIAL);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [personaVer, setPersonaVer] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [errorNombre, setErrorNombre] = useState("");
  const [errorMensual, setErrorMensual] = useState("");
  // Mientras el campo de moneda tiene el foco se muestra el numero pelado
  const [editandoMensual, setEditandoMensual] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === "nombre") setErrorNombre("");
    if (name === "mensual") setErrorMensual("");
  };

  const handleAbrirNuevo = () => {
    setForm({ ...FORM_INICIAL, fechaAlta: fechaHoy(), jornalesPorSemana: "5", horasPorDia: "8" });
    setModoEdicion(false);
    setErrorNombre("");
    setErrorMensual("");
    setMostrarModal(true);
  };

  const handleEditar = (persona) => {
    setForm({
      id: persona.id,
      nombre: persona.nombre || "",
      fechaAlta: persona.fechaAlta || "",
      // En edicion el mensual arranca vacio: solo se completa si hay un cambio
      // que registrar en el historial.
      mensual: "",
      jornalesPorSemana: String(persona.jornalesPorSemana || ""),
      horasPorDia: String(persona.horasPorDia || ""),
      observaciones: persona.observaciones || "",
    });
    setModoEdicion(true);
    setErrorNombre("");
    setErrorMensual("");
    setMostrarModal(true);
  };

  const handleCerrarModal = () => {
    setForm(FORM_INICIAL);
    setModoEdicion(false);
    setErrorNombre("");
    setErrorMensual("");
    setEditandoMensual(false);
    setMostrarModal(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorNombre("");
    setErrorMensual("");

    const nombreLimpio = (form.nombre || "").trim();
    if (!nombreLimpio) {
      setErrorNombre("El nombre es obligatorio.");
      return;
    }
    if (nombreLimpio.length < 2) {
      setErrorNombre("El nombre debe tener al menos 2 caracteres.");
      return;
    }

    const duplicado = (personal || []).find(
      (p) => p.id !== form.id && normalizar(p.nombre) === normalizar(nombreLimpio)
    );
    if (duplicado) {
      setErrorNombre(`Ya existe personal registrado como "${duplicado.nombre}".`);
      return;
    }

    const mensualNum = Number(form.mensual);
    if (!modoEdicion && (!form.mensual || isNaN(mensualNum) || mensualNum <= 0)) {
      setErrorMensual("El sueldo mensual es obligatorio.");
      return;
    }
    if (modoEdicion && form.mensual && (isNaN(mensualNum) || mensualNum <= 0)) {
      setErrorMensual("Ingresa un sueldo mensual válido.");
      return;
    }

    const previo = (personal || []).find((p) => p.id === form.id);
    const historial = [...((previo && previo.mensual) || [])];

    // Cada sueldo nuevo se agrega al historial en vez de reemplazar al anterior.
    if (form.mensual && mensualNum > 0) {
      const vigente = mensualVigente(historial);
      if (!vigente || Number(vigente.valor) !== mensualNum) {
        historial.push({
          valor: mensualNum,
          fecha: modoEdicion ? fechaHoy() : form.fechaAlta || fechaHoy(),
        });
      }
    }

    const aGuardar = {
      ...(previo || {}),
      id: form.id || "",
      nombre: nombreLimpio,
      fechaAlta: form.fechaAlta || fechaHoy(),
      jornalesPorSemana: Number(form.jornalesPorSemana) || 0,
      horasPorDia: Number(form.horasPorDia) || 0,
      observaciones: form.observaciones ? form.observaciones.trim() : "",
      mensual: historial,
    };

    try {
      await guardarPersonal(aGuardar);
      Swal.fire({
        ...swalConfig,
        title: modoEdicion ? "Personal actualizado" : "Personal guardado",
        icon: "success",
        timer: 1400,
        showConfirmButton: false,
      });
      handleCerrarModal();
    } catch (error) {
      setErrorNombre(error.message || "Error al validar los datos.");
    }
  };

  const handleEliminar = (persona) => {
    Swal.fire({
      ...swalConfig,
      title: `¿Eliminar ${persona.nombre}?`,
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
      if (!result.isConfirmed) return;
      eliminarPersonal(persona.id);
      if (personaVer?.id === persona.id) setPersonaVer(null);
    });
  };

  const personalFiltrado = (personal || [])
    .filter((item) => {
      const texto = busqueda.toLowerCase();
      const nombre = (item.nombre || "").toLowerCase();
      const obs = (item.observaciones || "").toLowerCase();
      return nombre.includes(texto) || obs.includes(texto);
    })
    .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es", { sensitivity: "base" }));

  return (
    <div className="container py-4">
      <div className="mx-auto" style={{ maxWidth: "920px", width: "100%", paddingBottom: "75px" }}>
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-3">
          <h2 className="mush-display text-white mb-0">Personal</h2>

        </div>

        <div className="mush-card p-3 p-sm-4">
          <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
            <h5 className="text-white mb-0 fw-bold">Personal</h5>
            <div className="d-flex align-items-center gap-2">
              {personal.length > 0 && (
                <div style={{ width: "240px", maxWidth: "100%" }}>
                  <BuscadorFiltro
                    valor={busqueda}
                    alCambiar={setBusqueda}
                    placeholder="Buscar personal..."
                  />
                </div>
              )}
              <BotonExcel
                titulo="Personal"
                columnas={[
                  "Nombre",
                  "Fecha",
                  { titulo: "Mensual", formato: "moneda" },
                  { titulo: "Semanal", formato: "moneda" },
                  { titulo: "Hora", formato: "moneda" },
                  "Observaciones",
                ]}
                filas={() =>
                  personalFiltrado.map((persona) => [
                    persona.nombre,
                    fechaLegible(mensualVigente(persona.mensual)?.fecha),
                    valorMensual(persona),
                    valorSemanal(persona),
                    valorHora(persona),
                    persona.observaciones,
                  ])
                }
              />
              <button type="button" className="btn-mush text-nowrap" onClick={handleAbrirNuevo}>
                Nuevo Personal
              </button>
            </div>
          </div>

          <div
            className="table-responsive mush-scroll-tabla"
            style={{ maxHeight: "calc(100vh - 280px)" }}
          >
            <table className="table mush-tabla align-middle mb-0 text-nowrap">
              <thead>
                <tr>
                  <th style={{ width: "11%" }}>Fecha</th>
                  <th style={{ width: "20%" }}>Nombre</th>
                  <th className="text-end" style={{ width: "13%" }}>Mensual</th>
                  <th className="text-end" style={{ width: "12%" }}>Semanal</th>
                  <th className="text-end" style={{ width: "11%" }}>Hora</th>
                  <th style={{ width: "16%" }}>Observaciones</th>
                  <th className="text-end" style={{ width: "17%" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {personalFiltrado.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-4 text-secondary">
                      {busqueda ? "Sin resultados para la busqueda." : "No hay personal cargado."}
                    </td>
                  </tr>
                ) : (
                  personalFiltrado.map((persona) => (
                    <tr key={persona.id}>
                      <td>
                        <span className="text-secondary" style={{ fontSize: "0.8rem" }}>
                          {fechaLegible(persona.fechaAlta)}
                        </span>
                      </td>
                      <td>
                        <strong
                          className="text-white text-truncate d-block"
                          style={{ fontSize: "0.82rem", maxWidth: "190px" }}
                          title={persona.nombre}
                        >
                          {persona.nombre}
                        </strong>
                      </td>
                      <td className="text-end text-white mush-dato" style={{ fontSize: "0.82rem" }}>
                        {moneda(valorMensual(persona))}
                      </td>
                      <td className="text-end text-secondary mush-dato" style={{ fontSize: "0.82rem" }}>
                        {moneda(valorSemanal(persona))}
                      </td>
                      <td className="text-end text-secondary mush-dato" style={{ fontSize: "0.82rem" }}>
                        {moneda(valorHora(persona))}
                      </td>
                      <td>
                        <span
                          className="text-secondary text-truncate d-block"
                          style={{ fontSize: "0.8rem", maxWidth: "160px" }}
                          title={persona.observaciones}
                        >
                          {persona.observaciones || "—"}
                        </span>
                      </td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-1">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success py-0 px-2 d-inline-flex align-items-center gap-1"
                            style={{ fontSize: "0.72rem", minHeight: "24px" }}
                            onClick={() => setPersonaVer(persona)}
                            title="Ver detalle e historial"
                          >
                            Ver
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary py-0 px-2 text-white d-inline-flex align-items-center gap-1"
                            style={{ fontSize: "0.72rem", minHeight: "24px" }}
                            onClick={() => handleEditar(persona)}
                            title="Editar personal"
                          >
                            <i className="bi bi-pencil"></i> Editar
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger py-0 px-2 d-inline-flex align-items-center gap-1"
                            style={{ fontSize: "0.72rem", minHeight: "24px" }}
                            onClick={() => handleEliminar(persona)}
                            title="Eliminar personal"
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

      {/* MODAL VER: resumen de valores + historial de sueldos */}
      {personaVer && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.75)", zIndex: 1055 }}
          onClick={() => setPersonaVer(null)}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            style={{ maxWidth: "460px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content mush-card p-3 p-sm-4 rounded-4 shadow-lg border border-secondary border-opacity-25">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="text-white mb-0 fw-bold fs-6">
                  {personaVer.nombre}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setPersonaVer(null)}
                  aria-label="Cerrar"
                ></button>
              </div>

              <table className="table mush-tabla align-middle mb-4">
                <tbody>
                  <tr>
                    <td className="text-secondary">Mensual</td>
                    <td className="text-center text-white mush-dato" style={{ fontSize: "0.82rem" }}>
                      {moneda(valorMensual(personaVer))}
                    </td>
                  </tr>
                  <tr>
                    <td className="text-secondary">Semanal</td>
                    <td className="text-center text-white mush-dato" style={{ fontSize: "0.82rem" }}>
                      {moneda(valorSemanal(personaVer))}
                    </td>
                  </tr>
                  <tr>
                    <td className="text-secondary">Jornal</td>
                    <td className="text-center text-white mush-dato" style={{ fontSize: "0.82rem" }}>
                      {moneda(valorJornal(personaVer))}
                    </td>
                  </tr>
                  <tr>
                    <td className="text-secondary">Hora</td>
                    <td className="text-center text-white mush-dato" style={{ fontSize: "0.82rem" }}>
                      {moneda(valorHora(personaVer))}
                    </td>
                  </tr>
                  <tr>
                    <td className="text-secondary">Cant. jornales semanales</td>
                    <td className="text-center text-white mush-dato" style={{ fontSize: "0.82rem" }}>
                      {personaVer.jornalesPorSemana || "-"}
                    </td>
                  </tr>
                </tbody>
              </table>

              <h6 className="text-white fw-bold fs-6 mb-2">Historial</h6>
              <table className="table mush-tabla align-middle mb-0">
                <thead>
                  <tr>
                    <th className="text-center">Mensual</th>
                    <th className="text-center">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {(personaVer.mensual || []).length === 0 ? (
                    <tr>
                      <td colSpan="2" className="text-center py-3 text-secondary">
                        Sin historial.
                      </td>
                    </tr>
                  ) : (
                    [...personaVer.mensual]
                      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
                      .map((item, i) => (
                        <tr key={i}>
                          <td className="text-center text-white mush-dato" style={{ fontSize: "0.82rem" }}>
                            {moneda(item.valor)}
                          </td>
                          <td className="text-center text-secondary" style={{ fontSize: "0.82rem" }}>
                            {fechaLegible(item.fecha)}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>

              <div className="d-flex justify-content-end pt-3">
                <button
                  type="button"
                  className="btn-mush-ghost py-1 px-3"
                  style={{ fontSize: "0.82rem" }}
                  onClick={() => setPersonaVer(null)}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ALTA / EDICION */}
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
                  <i
                    className={`bi ${modoEdicion ? "bi-pencil-square" : "bi-person-plus"} text-dulce me-2`}
                  ></i>
                  {modoEdicion ? "Editar Personal" : "Nuevo Personal"}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={handleCerrarModal}
                  aria-label="Cerrar"
                ></button>
              </div>

              <form onSubmit={handleSubmit} noValidate autoComplete="off">
                <div className="row g-2 mb-2">
                  <div className="col-8">
                    <label
                      className="form-label text-secondary fw-semibold mb-1"
                      style={{ fontSize: "0.78rem" }}
                    >
                      Nombre <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      name="nombre"
                      className={`form-control form-control-sm mush-input py-1 px-2 ${errorNombre ? "border-danger is-invalid" : ""}`}
                      style={{ fontSize: "0.85rem" }}
                      placeholder="Nombre y apellido"
                      value={form.nombre}
                      onChange={handleChange}
                      autoComplete="off"
                      spellCheck="false"
                      autoFocus
                    />
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
                    <label
                      className="form-label text-secondary fw-semibold mb-1"
                      style={{ fontSize: "0.78rem" }}
                    >
                      Fecha
                    </label>
                    <input
                      type="date"
                      name="fechaAlta"
                      className="form-control form-control-sm mush-input py-1 px-2"
                      style={{ fontSize: "0.85rem" }}
                      value={form.fechaAlta}
                      max={fechaHoy()}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="mb-2">
                  <label
                    className="form-label text-secondary fw-semibold mb-1"
                    style={{ fontSize: "0.78rem" }}
                  >
                    Mensual {!modoEdicion && <span className="text-danger">*</span>}
                  </label>
                  <input
                    type="text"
                    name="mensual"
                    inputMode="decimal"
                    className={`form-control form-control-sm mush-input py-1 px-2 ${errorMensual ? "border-danger is-invalid" : ""}`}
                    style={{ fontSize: "0.85rem", maxWidth: "170px" }}
                    placeholder="$ 0"
                    value={editandoMensual ? form.mensual : monedaInput(form.mensual)}
                    onFocus={(e) => {
                      setEditandoMensual(true);
                      const el = e.target;
                      setTimeout(() => el.select(), 0);
                    }}
                    onBlur={() => setEditandoMensual(false)}
                    onChange={(e) => {
                      // Se guarda el numero pelado; el formato de moneda es solo visual
                      const limpio = e.target.value.replace(/[^\d.]/g, "");
                      setForm((prev) => ({ ...prev, mensual: limpio }));
                      setErrorMensual("");
                    }}
                    autoComplete="off"
                  />
                  {modoEdicion && (
                    <div className="text-secondary mt-1" style={{ fontSize: "0.74rem" }}>
                      Dejalo vacío si el sueldo no cambia. Si cargás un valor nuevo, queda anotado en
                      el historial.
                    </div>
                  )}
                  {errorMensual && (
                    <div
                      className="text-danger mt-1 fw-semibold d-flex align-items-center gap-1"
                      style={{ fontSize: "0.74rem" }}
                    >
                      <i className="bi bi-exclamation-circle-fill"></i> {errorMensual}
                    </div>
                  )}
                </div>

                <div className="row g-2 mb-2">
                  <div className="col-6">
                    <label
                      className="form-label text-secondary fw-semibold mb-1"
                      style={{ fontSize: "0.78rem" }}
                    >
                      Jornales por semana
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      name="jornalesPorSemana"
                      className="form-control form-control-sm mush-input py-1 px-2"
                      style={{ fontSize: "0.85rem", maxWidth: "110px" }}
                      placeholder="5"
                      value={form.jornalesPorSemana}
                      onChange={handleChange}
                      autoComplete="off"
                    />
                  </div>

                  <div className="col-6">
                    <label
                      className="form-label text-secondary fw-semibold mb-1"
                      style={{ fontSize: "0.78rem" }}
                    >
                      Horas por día
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      name="horasPorDia"
                      className="form-control form-control-sm mush-input py-1 px-2"
                      style={{ fontSize: "0.85rem", maxWidth: "110px" }}
                      placeholder="8"
                      value={form.horasPorDia}
                      onChange={handleChange}
                      autoComplete="off"
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <label
                    className="form-label text-secondary fw-semibold mb-1"
                    style={{ fontSize: "0.78rem" }}
                  >
                    Observaciones
                  </label>
                  <input
                    type="text"
                    name="observaciones"
                    className="form-control form-control-sm mush-input py-1 px-2"
                    style={{ fontSize: "0.85rem" }}
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
                  <button type="submit" className="btn-mush py-1 px-3" style={{ fontSize: "0.82rem" }}>
                    Guardar
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

export default AltaPersonal;
