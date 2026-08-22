import { useState } from "react";
import { useMush } from "../../context/MushContext";
import BuscadorFiltro from "../shared/BuscadorFiltro.jsx";
import Swal from "sweetalert2";

const UNIDADES_INGREDIENTES = ["kg", "gr", "lts", "ml", "un", "otras"];
const UNIDADES_PACKAGING = ["un", "kg", "gr", "lts", "ml", "pack", "caja", "rollo", "otras"];

// Los precios se cargan con centavos (un sticker puede costar $ 45,50), asi que
// aca no sirve el formateador de `calculos.js`, que redondea a pesos enteros.
const formateadorPrecio = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const precioARS = (valor) => formateadorPrecio.format(Number(valor) || 0);

// El precio se escribe con formato de moneda argentina: puntos de miles y coma
// decimal. El formulario guarda el texto tal como lo ve el usuario y recien al
// validar se convierte a numero.
const formatearEntradaPrecio = (texto) => {
  const limpio = String(texto).replace(/[^\d,]/g, "");
  if (!limpio) return "";

  const [entero, ...resto] = limpio.split(",");
  const enteroFormateado = entero ? Number(entero).toLocaleString("es-AR") : "0";
  if (!limpio.includes(",")) return `$ ${enteroFormateado}`;
  return `$ ${enteroFormateado},${resto.join("").slice(0, 2)}`;
};

const precioAEntrada = (valor) =>
  Number(valor) > 0
    ? formatearEntradaPrecio(
        Number(valor).toLocaleString("es-AR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      )
    : "";

// Los puntos son separadores de miles y la coma es el decimal: se descarta todo
// lo demas (el signo, los espacios) antes de leer el numero.
const precioANumero = (texto) => {
  const limpio = String(texto).replace(/[^\d,]/g, "").replace(",", ".");
  return limpio ? Number(limpio) : NaN;
};

const hoyISO = () => new Date().toISOString().split("T")[0];

const formatearFecha = (valor) => {
  if (!valor) return "—";
  const [anio, mes, dia] = String(valor).split("T")[0].split("-");
  if (!anio || !mes || !dia) return String(valor);
  return `${dia}/${mes}/${anio}`;
};

const tienePrecio = (item) => Number(item?.precio) > 0;

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

const FORM_INICIAL = {
  id: "",
  nombre: "",
  fecha: "",
  precio: "",
  unidad: "",
  observaciones: "",
};

/**
 * Tarjeta con la tabla de precios de un catalogo (ingredientes o packaging).
 *
 * Las filas son los items del catalogo: el precio se coloca sobre un item que ya
 * existe, desde aca no se dan de alta items nuevos. Cada precio cargado queda
 * anotado en el historial del item; la tabla principal muestra el ultimo.
 */
const TarjetaPrecios = ({
  titulo,
  icono,
  etiquetaColumna,
  items,
  unidades,
  unidadPorDefecto,
  alGuardar,
  placeholderBusqueda,
  textoVacio,
}) => {
  const [busqueda, setBusqueda] = useState("");
  const [form, setForm] = useState(FORM_INICIAL);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [errorPrecio, setErrorPrecio] = useState("");
  const [errorUnidad, setErrorUnidad] = useState("");
  const [errorFecha, setErrorFecha] = useState("");
  const [itemHistorial, setItemHistorial] = useState(null);

  // Todo aviso al usuario sale por SweetAlert. El campo ademas queda marcado en
  // rojo para que se vea cual es el que falla.
  const avisarError = (marcar, mensaje) => {
    marcar(mensaje);
    Swal.fire({
      ...swalConfig,
      title: mensaje,
      icon: "error",
      confirmButtonText: "Entendido",
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "precio" ? formatearEntradaPrecio(value) : value,
    }));
    if (name === "precio") setErrorPrecio("");
    if (name === "unidad") setErrorUnidad("");
    if (name === "fecha") setErrorFecha("");
  };

  const handleEditar = (item) => {
    setForm({
      id: item.id,
      nombre: item.nombre || "",
      fecha: item.fechaPrecio ? String(item.fechaPrecio).split("T")[0] : hoyISO(),
      precio: precioAEntrada(item.precio),
      unidad: item.unidad || unidadPorDefecto,
      observaciones: item.observacionesPrecio || "",
    });
    setErrorPrecio("");
    setErrorUnidad("");
    setErrorFecha("");
    setMostrarModal(true);
  };

  const handleCerrarModal = () => {
    setForm(FORM_INICIAL);
    setErrorPrecio("");
    setErrorUnidad("");
    setErrorFecha("");
    setMostrarModal(false);
  };

  // El historial guarda todas las entradas de precio del item, de la mas nueva
  // a la mas vieja. La primera es la que se muestra en la tabla principal.
  const ordenarHistorial = (registros) =>
    [...registros].sort(
      (a, b) =>
        String(b.fecha || "").localeCompare(String(a.fecha || "")) ||
        String(b.registradoEn || "").localeCompare(String(a.registradoEn || ""))
    );

  // Un precio cargado antes de que existiera el historial se incorpora como una
  // entrada mas, para que el seguimiento no arranque con un hueco.
  const historialCompleto = (item) => {
    const registros = Array.isArray(item.historialPrecios) ? item.historialPrecios : [];
    if (!tienePrecio(item)) return ordenarHistorial(registros);

    const yaRegistrado = registros.some(
      (registro) => String(registro.fecha || "") === String(item.fechaPrecio || "")
    );
    if (yaRegistrado) return ordenarHistorial(registros);

    return ordenarHistorial([
      ...registros,
      {
        fecha: item.fechaPrecio || "",
        precio: Number(item.precio),
        unidad: item.unidad || unidadPorDefecto,
        observaciones: item.observacionesPrecio || "",
        registradoEn: item.actualizadoEn || item.creadoEn || new Date().toISOString(),
      },
    ]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorPrecio("");
    setErrorFecha("");
    setErrorUnidad("");

    if (!String(form.precio).trim()) {
      avisarError(setErrorPrecio, "El precio es obligatorio.");
      return;
    }

    const precioNumero = precioANumero(form.precio);
    if (Number.isNaN(precioNumero) || precioNumero <= 0) {
      avisarError(setErrorPrecio, "El precio debe ser un número mayor a cero.");
      return;
    }
    if (!form.unidad) {
      avisarError(setErrorUnidad, "La unidad es obligatoria.");
      return;
    }
    if (!form.fecha) {
      avisarError(setErrorFecha, "La fecha del precio es obligatoria.");
      return;
    }
    // Un precio es algo que ya se pagó: no se cargan fechas futuras
    if (form.fecha > hoyISO()) {
      avisarError(setErrorFecha, "La fecha no puede ser posterior a hoy.");
      return;
    }

    const itemPrevio = (items || []).find((i) => i.id === form.id);
    if (!itemPrevio) {
      avisarError(setErrorPrecio, "El registro ya no está disponible.");
      return;
    }

    // Cada carga suma una entrada: el valor que se edita no se pisa, queda
    // anotado. Asi figuran todos los precios que pasaron por el item, incluso
    // dos del mismo dia (gana el ultimo cargado).
    const registro = {
      fecha: form.fecha,
      precio: precioNumero,
      unidad: form.unidad,
      observaciones: form.observaciones ? form.observaciones.trim() : "",
      registradoEn: new Date().toISOString(),
    };
    const historial = ordenarHistorial([registro, ...historialCompleto(itemPrevio)]);
    const vigente = historial[0];

    try {
      await alGuardar({
        ...itemPrevio,
        unidad: vigente.unidad || unidadPorDefecto,
        precio: vigente.precio,
        fechaPrecio: vigente.fecha,
        observacionesPrecio: vigente.observaciones,
        historialPrecios: historial,
      });

      Swal.fire({
        ...swalConfig,
        title: "Precio guardado",
        icon: "success",
        timer: 1400,
        showConfirmButton: false,
      });

      handleCerrarModal();
    } catch (error) {
      avisarError(setErrorPrecio, error.message || "No se pudo guardar el precio.");
    }
  };

  const itemsFiltrados = (items || [])
    .filter((item) => {
      const texto = busqueda.toLowerCase();
      const nombre = (item.nombre || "").toLowerCase();
      const obs = (item.observacionesPrecio || "").toLowerCase();
      return nombre.includes(texto) || obs.includes(texto);
    })
    .sort((a, b) =>
      (a.nombre || "").localeCompare(b.nombre || "", "es", { sensitivity: "base" })
    );

  const conPrecio = (items || []).filter(tienePrecio).length;
  // El historial lista todas las entradas, incluida la que hoy esta vigente
  const historialDelItem = itemHistorial ? historialCompleto(itemHistorial) : [];

  // Al borrar una entrada, el precio de la tabla principal pasa a ser el mas
  // reciente de los que quedan. Si no queda ninguno, el item se queda sin precio.
  const handleBorrarEntrada = (indice) => {
    const registro = historialDelItem[indice];

    Swal.fire({
      ...swalConfig,
      title: `¿Borrar el precio del ${formatearFecha(registro.fecha)}?`,
      text: `${itemHistorial.nombre} · ${precioARS(registro.precio)}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
      customClass: {
        popup: "rounded-4 border border-secondary border-opacity-25 shadow-lg",
        confirmButton: "btn btn-danger px-3 py-1 rounded-3 me-2 fw-bold",
        cancelButton: "btn btn-outline-secondary px-3 py-1 rounded-3 text-dark",
      },
    }).then(async (resultado) => {
      if (!resultado.isConfirmed) return;

      const historial = historialDelItem.filter((_, i) => i !== indice);
      const vigente = historial[0];

      const itemActualizado = {
        ...itemHistorial,
        unidad: vigente ? vigente.unidad || unidadPorDefecto : itemHistorial.unidad,
        precio: vigente ? vigente.precio : 0,
        fechaPrecio: vigente ? vigente.fecha : "",
        observacionesPrecio: vigente ? vigente.observaciones : "",
        historialPrecios: historial,
      };

      await alGuardar(itemActualizado);
      // El modal trabaja sobre una copia del item: se refresca para que la fila
      // borrada desaparezca sin tener que cerrarlo y volver a abrirlo.
      setItemHistorial(itemActualizado);
    });
  };

  return (
    <>
      <div className="mush-card p-3 p-sm-4 mb-3">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
          <h5 className="text-white mb-0 fw-bold d-flex align-items-center gap-2">
            <i className={`bi ${icono} text-dulce`}></i>
            {titulo}
            <span className="text-secondary fw-normal" style={{ fontSize: "0.72rem" }}>
              {conPrecio} de {(items || []).length} con precio
            </span>
          </h5>
          {(items || []).length > 0 && (
            <div style={{ maxWidth: "240px", width: "100%" }}>
              <BuscadorFiltro
                valor={busqueda}
                alCambiar={setBusqueda}
                placeholder={placeholderBusqueda}
              />
            </div>
          )}
        </div>

        {/* Las dos tablas comparten la pantalla: cada una lleva su scroll interno */}
        <div className="table-responsive mush-scroll-tabla" style={{ maxHeight: "320px" }}>
          <table className="table mush-tabla align-middle mb-0 text-nowrap">
            <thead>
              <tr>
                <th style={{ width: "25%" }}>{etiquetaColumna}</th>
                <th style={{ width: "11%" }}>Fecha</th>
                <th className="text-end" style={{ width: "14%" }}>Precio</th>
                <th style={{ width: "9%" }}>Unidad</th>
                <th style={{ width: "21%" }}>Observaciones</th>
                <th className="text-end" style={{ width: "20%" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {itemsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-4 text-secondary">
                    {textoVacio}
                  </td>
                </tr>
              ) : (
                itemsFiltrados.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong
                        className="text-white text-truncate d-block"
                        style={{ fontSize: "0.82rem", maxWidth: "200px" }}
                        title={item.nombre}
                      >
                        {item.nombre}
                      </strong>
                    </td>
                    <td>
                      <span className="text-secondary mush-dato" style={{ fontSize: "0.8rem" }}>
                        {formatearFecha(item.fechaPrecio)}
                      </span>
                    </td>
                    <td className="text-end">
                      {tienePrecio(item) ? (
                        <span className="text-white mush-dato" style={{ fontSize: "0.82rem" }}>
                          {precioARS(item.precio)}
                        </span>
                      ) : (
                        <span className="text-secondary" style={{ fontSize: "0.8rem" }}>
                          —
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        className="badge bg-secondary bg-opacity-25 text-white border border-secondary border-opacity-25 px-2 py-1"
                        style={{ fontSize: "0.72rem" }}
                      >
                        {item.unidad || unidadPorDefecto}
                      </span>
                    </td>
                    <td>
                      <span
                        className="text-secondary text-truncate d-block"
                        style={{ fontSize: "0.8rem", maxWidth: "150px" }}
                        title={item.observacionesPrecio}
                      >
                        {item.observacionesPrecio || "—"}
                      </span>
                    </td>
                    <td className="text-end">
                      <div className="d-flex justify-content-end gap-1">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary py-0 px-2 text-white d-inline-flex align-items-center gap-1"
                          style={{ fontSize: "0.72rem", minHeight: "24px" }}
                          onClick={() => handleEditar(item)}
                          title={tienePrecio(item) ? "Editar precio" : "Cargar precio"}
                        >
                          <i className="bi bi-pencil"></i> Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary py-0 px-2 text-white d-inline-flex align-items-center gap-1"
                          style={{ fontSize: "0.72rem", minHeight: "24px" }}
                          onClick={() => setItemHistorial(item)}
                          title="Ver historial de precios"
                        >
                          <i className="bi bi-clock-history"></i> Historial
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

      {/* MODAL para cargar o editar el precio */}
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
                  <i className="bi bi-cash-coin text-dulce me-2"></i>
                  Precio de {form.nombre}
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
                    <label className="form-label text-secondary fw-semibold mb-1" style={{ fontSize: "0.78rem" }}>
                      Precio <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      name="precio"
                      inputMode="decimal"
                      className={`form-control form-control-sm mush-input mush-dato py-1 px-2 ${errorPrecio ? "border-danger is-invalid" : ""}`}
                      style={{ fontSize: "0.85rem" }}
                      placeholder="$ 0,00"
                      value={form.precio}
                      onChange={handleChange}
                      autoComplete="off"
                      spellCheck="false"
                      autoFocus
                    />
                  </div>

                  <div className="col-4">
                    <label className="form-label text-secondary fw-semibold mb-1" style={{ fontSize: "0.78rem" }}>
                      Unidad <span className="text-danger">*</span>
                    </label>
                    <select
                      name="unidad"
                      className={`form-select form-select-sm mush-input py-1 px-2 ${errorUnidad ? "border-danger is-invalid" : ""}`}
                      style={{ fontSize: "0.85rem" }}
                      value={form.unidad}
                      onChange={handleChange}
                    >
                      <option value="">-- Seleccionar --</option>
                      {unidades.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="row g-2 mb-2">
                  <div className="col-5">
                    <label className="form-label text-secondary fw-semibold mb-1" style={{ fontSize: "0.78rem" }}>
                      Fecha <span className="text-danger">*</span>
                    </label>
                    <input
                      type="date"
                      name="fecha"
                      max={hoyISO()}
                      className={`form-control form-control-sm mush-input py-1 px-2 ${errorFecha ? "border-danger is-invalid" : ""}`}
                      style={{ fontSize: "0.85rem" }}
                      value={form.fecha}
                      onChange={handleChange}
                    />
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
                    placeholder="Proveedor, promoción, notas"
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
                  <button type="submit" className="btn-mush px-3 py-1" style={{ fontSize: "0.82rem" }}>
                    Guardar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL con el historial de precios del item */}
      {itemHistorial && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.75)", zIndex: 1055 }}
          onClick={() => setItemHistorial(null)}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            style={{ maxWidth: "640px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content mush-card p-3 p-sm-4 rounded-4 shadow-lg border border-secondary border-opacity-25">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="text-white mb-0 fw-bold fs-6">
                  <i className="bi bi-clock-history text-dulce me-2"></i>
                  Historial de {itemHistorial.nombre}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setItemHistorial(null)}
                  aria-label="Cerrar"
                ></button>
              </div>

              {tienePrecio(itemHistorial) && (
                <div className="mush-card-elevada p-2 px-3 mb-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <span className="mush-kicker">Precio vigente</span>
                  <span className="text-white mush-dato" style={{ fontSize: "0.82rem" }}>
                    {precioARS(itemHistorial.precio)} / {itemHistorial.unidad || unidadPorDefecto} ·{" "}
                    {formatearFecha(itemHistorial.fechaPrecio)}
                  </span>
                </div>
              )}

              <div className="table-responsive mush-scroll-tabla" style={{ maxHeight: "280px" }}>
                <table className="table mush-tabla align-middle mb-0 text-nowrap">
                  <thead>
                    <tr>
                      <th style={{ width: "18%" }}>Fecha</th>
                      <th className="text-end" style={{ width: "20%" }}>Precio</th>
                      <th style={{ width: "12%" }}>Unidad</th>
                      <th style={{ width: "32%" }}>Observaciones</th>
                      <th className="text-end" style={{ width: "18%" }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historialDelItem.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center py-4 text-secondary">
                          Todavía no hay precios cargados.
                        </td>
                      </tr>
                    ) : (
                      historialDelItem.map((registro, indice) => (
                        <tr key={`${registro.registradoEn || registro.fecha}-${indice}`}>
                          <td>
                            <span className="text-secondary mush-dato" style={{ fontSize: "0.8rem" }}>
                              {formatearFecha(registro.fecha)}
                            </span>
                          </td>
                          <td className="text-end">
                            <span className="text-white mush-dato" style={{ fontSize: "0.82rem" }}>
                              {precioARS(registro.precio)}
                            </span>
                          </td>
                          <td>
                            <span
                              className="badge bg-secondary bg-opacity-25 text-white border border-secondary border-opacity-25 px-2 py-1"
                              style={{ fontSize: "0.72rem" }}
                            >
                              {registro.unidad || unidadPorDefecto}
                            </span>
                          </td>
                          <td>
                            <span
                              className="text-secondary text-truncate d-block"
                              style={{ fontSize: "0.8rem", maxWidth: "180px" }}
                              title={registro.observaciones}
                            >
                              {registro.observaciones || "—"}
                            </span>
                          </td>
                          <td className="text-end">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger py-0 px-2 d-inline-flex align-items-center gap-1"
                              style={{ fontSize: "0.72rem", minHeight: "24px" }}
                              onClick={() => handleBorrarEntrada(indice)}
                              title="Borrar esta entrada del historial"
                            >
                              <i className="bi bi-trash"></i> Borrar
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="d-flex justify-content-end pt-3">
                <button
                  type="button"
                  className="btn-mush-ghost py-1 px-3"
                  style={{ fontSize: "0.82rem" }}
                  onClick={() => setItemHistorial(null)}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const Precios = () => {
  const { ingredientes, guardarIngrediente, packaging, guardarPackaging } = useMush();

  return (
    <div className="container py-4">
      <div className="mx-auto" style={{ maxWidth: "920px", width: "100%", paddingBottom: "75px" }}>
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-3">
          <h2 className="mush-display text-white mb-0">Precios</h2>
        </div>

        <TarjetaPrecios
          titulo="Ingredientes"
          icono="bi-basket"
          etiquetaColumna="Ingrediente"
          items={ingredientes}
          unidades={UNIDADES_INGREDIENTES}
          unidadPorDefecto="kg"
          alGuardar={guardarIngrediente}
          placeholderBusqueda="Buscar ingrediente..."
          textoVacio="No hay ingredientes cargados."
        />

        <TarjetaPrecios
          titulo="Packaging"
          icono="bi-box-seam"
          etiquetaColumna="Packaging"
          items={packaging}
          unidades={UNIDADES_PACKAGING}
          unidadPorDefecto="un"
          alGuardar={guardarPackaging}
          placeholderBusqueda="Buscar packaging..."
          textoVacio="No hay packaging cargado."
        />
      </div>
    </div>
  );
};

export default Precios;
