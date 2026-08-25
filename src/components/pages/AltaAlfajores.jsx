import { useState } from "react";
import BotonExcel from "../shared/BotonExcel.jsx";
import { useMush } from "../../context/MushContext";
import BuscadorFiltro from "../shared/BuscadorFiltro.jsx";
import Swal from "sweetalert2";

const CATEGORIAS_DISPONIBLES = [
  "Alfajor",
  "Mini",
  "Mendiant",
  "Tableta",
  "Caja",
  "Lata",
  "Pack",
];

const FORM_INICIAL = {
  id: "",
  nombre: "",
  categoria: "Alfajor",
  observaciones: "",
  emoji: "",
  // De que receta sale el costo.
  receta: "",
  // Para cuantas unidades es una tanda de masa. Solo se pregunta cuando la
  // receta se crea aca.
  rinde: "",
  // "unidad" o "caja".
  presentacion: "unidad",
  unidades: "",
  carton: "",
  // Las cajas que llevan productos distintos declaran su contenido.
  armada: false,
  composicion: [],
  activo: true,
};

const COMPONENTE_VACIO = { receta: "", cantidad: "" };

// La opcion de "Se costea con" que no elige una receta existente sino que pide
// una nueva, en blanco, para este producto.
const RECETA_NUEVA = "__nueva__";

/**
 * En que se cuenta el rinde de una receta, segun la categoria del producto.
 *
 * Casi todo se cuenta en alfajores, pero una tableta rinde tabletas y el
 * mendiant una lata. No es un detalle de texto: la mano de obra de lo que no se
 * cuenta en alfajores se paga por hora y no por sueldo mensual.
 */
const UNIDAD_DE_RINDE = { Tableta: "tableta", Lata: "lata", Mendiant: "lata" };

const unidadDeRinde = (categoria) => UNIDAD_DE_RINDE[categoria] || "alfajores";

const unidadDeRindeEnPlural = (categoria) => {
  const unidad = unidadDeRinde(categoria);
  return unidad.endsWith("s") ? unidad : `${unidad}s`;
};

// Un nombre sin mayusculas, tildes, signos ni plurales: sirve para comparar
// "Nuez" con "Nueces" y "Clasico" con "Clasico".
const normalizar = (txt) =>
  String(txt)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .replace(/ces$/, "z")
    .replace(/es$/, "")
    .replace(/s$/, "");

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

const AltaAlfajores = () => {
  const { alfajores, recetas, packaging, guardarAlfajor, eliminarAlfajor, guardarReceta } =
    useMush();

  // Lo que se puede elegir en el alta: las recetas cargadas y las cajas de
  // carton del packaging.
  const recetasOrdenadas = [...(recetas || [])].sort((a, b) =>
    (a.nombre || "").localeCompare(b.nombre || "", "es", { sensitivity: "base" })
  );

  const cartones = (packaging || []).filter((item) => /caja/i.test(item.nombre || ""));

  const nombreDeReceta = (slug) =>
    (recetas || []).find((r) => r.slug === slug)?.nombre || slug;

  const [form, setForm] = useState(FORM_INICIAL);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [errorNombre, setErrorNombre] = useState("");
  // Mientras la receta no se haya tocado a mano, se sigue proponiendo sola al
  // escribir el nombre.
  const [recetaAMano, setRecetaAMano] = useState(false);

  // Una fila sin producto elegido esta a medio cargar: no cuenta.
  const componentesValidos = (lista) =>
    (lista || []).filter((c) => c.receta && Number(c.cantidad) > 0);

  const cambiarComponente = (indice, campo, valor) =>
    setForm((prev) => ({
      ...prev,
      composicion: prev.composicion.map((c, i) => (i === indice ? { ...c, [campo]: valor } : c)),
    }));

  const agregarComponente = () =>
    setForm((prev) => ({ ...prev, composicion: [...prev.composicion, { ...COMPONENTE_VACIO }] }));

  const quitarComponente = (indice) =>
    setForm((prev) => ({
      ...prev,
      composicion: prev.composicion.filter((_, i) => i !== indice),
    }));

  /**
   * La receta que corresponde a un nombre de producto.
   *
   * "Clasico Semiamargo (CAJA x 6)" sale de la receta "Clasico Semiamargo": se
   * ignora lo que va entre parentesis y se busca la que mas se parece. Es una
   * ayuda para no tener que elegirla a mano, no una regla: el campo queda a la
   * vista y se puede cambiar.
   */
  const recetaQueSugiere = (nombre) => {
    const limpio = normalizar(String(nombre).replace(/\([^)]*\)/g, ""));
    if (limpio.length < 3) return "";

    // Gana la de nombre mas largo que este contenida: asi "Mini Semi" no le
    // gana a "Mini Semiamargo".
    return (recetasOrdenadas
      .map((receta) => ({ receta, clave: normalizar(receta.nombre || "") }))
      .filter(({ clave }) => clave && (limpio.includes(clave) || clave.includes(limpio)))
      .sort((a, b) => b.clave.length - a.clave.length)[0] || {}
    ).receta?.slug || "";
  };

  /**
   * El slug de la receta nueva sale del nombre del producto. Si ya hay una
   * receta con ese slug se le agrega un numero: dos productos distintos no
   * pueden terminar escribiendo sobre la misma receta.
   */
  const slugLibre = (nombre) => {
    const base =
      nombre
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "receta";

    const ocupado = (slug) => (recetas || []).some((r) => r.slug === slug || r.id === slug);
    if (!ocupado(base)) return base;

    let n = 2;
    while (ocupado(`${base}-${n}`)) n += 1;
    return `${base}-${n}`;
  };

  /**
   * Una receta vacia, con la forma que espera la pantalla de Recetas: con su
   * rinde, pero sin ingredientes y sin mano de obra. El producto va a costar
   * cero hasta que se le carguen, y Costos y Lista de Precios lo avisan.
   */
  const recetaEnBlanco = (slug, nombre, categoria, rinde) => ({
    id: slug,
    slug,
    nombre,
    categoria,
    rinde,
    unidadRinde: unidadDeRinde(categoria),
    observaciones: "",
    ingredientes: [],
    sinSecciones: [],
    gramos: {},
    manoDeObra: {},
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => {
      const proximo = { ...prev, [name]: type === "checkbox" ? checked : value };
      // Al escribir el nombre se propone la receta, mientras no se haya elegido
      // una a mano. Si el nombre no se parece a ninguna, lo que se propone es
      // crear una: un producto que no existia todavia trae su propia receta.
      if (name === "nombre" && !recetaAMano) {
        proximo.receta = recetaQueSugiere(value) || (value.trim() ? RECETA_NUEVA : "");
      }
      // Una caja no se hace aparte: sale de la receta de lo que lleva adentro.
      // Si lo propuesto era crear una, se pide elegirla.
      if (
        name === "presentacion" &&
        value === "caja" &&
        !recetaAMano &&
        prev.receta === RECETA_NUEVA
      ) {
        proximo.receta = "";
      }
      return proximo;
    });
    if (name === "receta") {
      setRecetaAMano(true);
    }
    if (name === "nombre") {
      setErrorNombre("");
    }
  };

  const handleAbrirNuevo = () => {
    setForm(FORM_INICIAL);
    setModoEdicion(false);
    setErrorNombre("");
    setRecetaAMano(false);
    setMostrarModal(true);
  };

  const handleEditar = (item) => {
    setForm({
      ...FORM_INICIAL,
      id: item.id,
      nombre: item.nombre || "",
      categoria: item.categoria || "Alfajor",
      observaciones: item.observaciones || "",
      emoji: item.emoji || "",
      receta: item.receta || "",
      presentacion: item.presentacion || "unidad",
      unidades: item.unidades ? String(item.unidades) : "",
      carton: item.carton || "",
      armada: (item.composicion || []).length > 0,
      composicion: (item.composicion || []).map((c) => ({
        receta: c.receta || "",
        cantidad: c.cantidad !== undefined ? String(c.cantidad) : "",
      })),
      activo: item.activo !== false,
    });
    setModoEdicion(true);
    setErrorNombre("");
    // Un producto que ya existe tiene su receta elegida: renombrarlo no se la
    // cambia.
    setRecetaAMano(true);
    setMostrarModal(true);
  };

  const handleCerrarModal = () => {
    setForm(FORM_INICIAL);
    setModoEdicion(false);
    setErrorNombre("");
    setRecetaAMano(false);
    setMostrarModal(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorNombre("");

    const nombreLimpio = (form.nombre || "").trim();
    if (!nombreLimpio) {
      setErrorNombre("El nombre del producto es obligatorio.");
      return;
    }
    if (nombreLimpio.length < 2) {
      setErrorNombre("El nombre debe tener al menos 2 caracteres.");
      return;
    }

    const canonicoNuevo = normalizar(nombreLimpio);
    const duplicado = (alfajores || []).find(
      (item) => item.id !== form.id && normalizar(item.nombre || "") === canonicoNuevo
    );

    if (duplicado) {
      setErrorNombre(`Ya existe un producto registrado como "${duplicado.nombre}".`);
      return;
    }

    if (!form.receta) {
      setErrorNombre("Falta elegir de que receta sale el costo.");
      return;
    }

    // Sin el rinde no se puede costear nada: los ingredientes de la masa se
    // anotan por tanda y se dividen por este numero.
    if (form.receta === RECETA_NUEVA && !(Number(form.rinde) > 0)) {
      setErrorNombre(
        `Falta decir para cuantos ${unidadDeRindeEnPlural(form.categoria)} es la masa.`
      );
      return;
    }

    const esCaja = form.presentacion === "caja";
    const componentes = componentesValidos(form.composicion);

    if (esCaja && !form.armada && !(Number(form.unidades) > 0)) {
      setErrorNombre("Una caja necesita cuantas unidades entran.");
      return;
    }

    if (form.armada && componentes.length === 0) {
      setErrorNombre("Una caja armada necesita al menos un producto adentro.");
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
      idFinal = `prod_${baseSlug}_${randomSuffix}`;
    }

    const itemPrevio = alfajores.find((a) => a.id === form.id) || {};

    // Un producto que no sale de ninguna receta cargada trae la suya, vacia:
    // queda su tarjeta en Recetas y en Costos para ir a llenarla.
    const recetaCreada =
      form.receta === RECETA_NUEVA
        ? recetaEnBlanco(
            slugLibre(nombreLimpio),
            nombreLimpio,
            form.categoria || "Alfajor",
            Number(form.rinde)
          )
        : null;

    if (recetaCreada) guardarReceta(recetaCreada);

    const productoAGuardar = {
      ...itemPrevio,
      id: idFinal || "",
      nombre: nombreLimpio,
      categoria: form.categoria || "Alfajor",
      observaciones: form.observaciones ? form.observaciones.trim() : "",
      emoji: (form.emoji || "").trim(),
      receta: recetaCreada ? recetaCreada.slug : form.receta,
      presentacion: form.presentacion,
      // Una caja armada cuenta lo que lleva adentro; el total de unidades sale
      // de sumar esas cantidades.
      unidades: esCaja
        ? form.armada
          ? componentes.reduce((suma, c) => suma + Number(c.cantidad), 0)
          : Number(form.unidades) || 0
        : 0,
      carton: esCaja ? form.carton : "",
      composicion: form.armada
        ? componentes.map((c) => ({ receta: c.receta, cantidad: Number(c.cantidad) }))
        : [],
      activo: form.activo !== false,
    };

    try {
      await guardarAlfajor(productoAGuardar);

      Swal.fire({
        ...swalConfig,
        title: "Producto guardado",
        text: recetaCreada
          ? `Se creo la receta "${recetaCreada.nombre}", vacia. Cargale los ingredientes en Recetas para que tenga costo.`
          : undefined,
        icon: "success",
        timer: recetaCreada ? 3200 : 1400,
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
        eliminarAlfajor(item.id);
        if (form.id === item.id) {
          handleCerrarModal();
        }
      }
    });
  };

  const productosFiltrados = (alfajores || [])
    .filter((item) => {
      const texto = busqueda.toLowerCase();
      const nombre = (item.nombre || "").toLowerCase();
      const cat = (item.categoria || "").toLowerCase();
      const obs = (item.observaciones || "").toLowerCase();
      return nombre.includes(texto) || cat.includes(texto) || obs.includes(texto);
    })
    .sort((a, b) =>
      (a.nombre || "").localeCompare(b.nombre || "", "es", { sensitivity: "base" })
    );

  return (
    <div className="container py-4">
      {/* Contenedor ensanchado y centrado */}
      <div className="mx-auto" style={{ maxWidth: "920px", width: "100%", paddingBottom: "75px" }}>
        {/* Encabezado con Botón Nuevo Producto (sin signo +) */}
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-3">
          <h2 className="mush-display text-white mb-0">Productos</h2>

        </div>

        {/* Tabla de Listado de Productos con scroll interno y fila única estricta */}
        <div className="mush-card p-3 p-sm-4">
          <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
            <h5 className="text-white mb-0 fw-bold">Productos</h5>
            <div className="d-flex align-items-center gap-2">
              {alfajores.length > 0 && (
                <div style={{ width: "240px", maxWidth: "100%" }}>
                  <BuscadorFiltro
                    valor={busqueda}
                    alCambiar={setBusqueda}
                    placeholder="Buscar producto..."
                  />
                </div>
              )}
              <BotonExcel
                titulo="Productos"
                columnas={["Producto", "Categoria", "Se vende", "Receta", "Observaciones"]}
                filas={() =>
                  productosFiltrados.map((item) => [
                    item.nombre,
                    item.categoria,
                    item.presentacion === "caja" ? `Caja x ${item.unidades}` : "Por unidad",
                    item.receta ? nombreDeReceta(item.receta) : "",
                    item.observaciones,
                  ])
                }
              />
              <button type="button" className="btn-mush text-nowrap" onClick={handleAbrirNuevo}>
                Nuevo Producto
              </button>
            </div>
          </div>

          <div className="table-responsive mush-scroll-tabla" style={{ maxHeight: "calc(100vh - 280px)" }}>
            <table className="table mush-tabla align-middle mb-0 text-nowrap">
              <thead>
                <tr>
                  <th style={{ width: "26%" }}>Producto</th>
                  <th style={{ width: "12%" }}>Categoría</th>
                  <th style={{ width: "22%" }}>Se vende</th>
                  <th style={{ width: "22%" }}>Observaciones</th>
                  <th className="text-end" style={{ width: "18%" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {productosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-4 text-secondary">
                      No hay productos cargados.
                    </td>
                  </tr>
                ) : (
                  productosFiltrados.map((item) => (
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
                          {item.categoria || "Alfajor"}
                        </span>
                      </td>
                      {/* De donde sale su costo y en que presentacion se vende */}
                      <td>
                        <span
                          className="text-secondary text-truncate d-block"
                          style={{ fontSize: "0.8rem", maxWidth: "250px" }}
                          title={item.receta ? nombreDeReceta(item.receta) : ""}
                        >
                          {item.receta ? (
                            <>
                              {item.presentacion === "caja" ? `Caja x ${item.unidades}` : "Por unidad"}
                              <span className="ms-1" style={{ fontSize: "0.72rem" }}>
                                de {nombreDeReceta(item.receta)}
                              </span>
                            </>
                          ) : (
                            <span className="text-alerta">
                              <i className="bi bi-exclamation-triangle-fill"></i> sin receta
                            </span>
                          )}
                        </span>
                      </td>
                      <td>
                        <span
                          className="text-secondary text-truncate d-block"
                          style={{ fontSize: "0.8rem", maxWidth: "250px" }}
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
                            title="Editar producto"
                          >
                            <i className="bi bi-pencil"></i> Editar
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger py-0 px-2 d-inline-flex align-items-center gap-1"
                            style={{ fontSize: "0.72rem", minHeight: "24px" }}
                            onClick={() => handleEliminar(item)}
                            title="Eliminar producto"
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

      {/* MODAL para Nuevo / Editar Producto con validación bajo la caja */}
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
                  {modoEdicion ? "Editar Producto" : "Nuevo Producto"}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={handleCerrarModal}
                  aria-label="Cerrar"
                ></button>
              </div>

              <form onSubmit={handleSubmit} noValidate autoComplete="off">
                {/* Producto y Categoría en la misma fila */}
                <div className="row g-2 mb-2">
                  <div className="col-8">
                    <label className="form-label text-secondary fw-semibold mb-1" style={{ fontSize: "0.78rem" }}>
                      Producto <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      name="nombre"
                      className={`form-control form-control-sm mush-input py-1 px-2 ${errorNombre ? "border-danger is-invalid" : ""}`}
                      style={{ fontSize: "0.85rem" }}
                      placeholder="Nombre del producto"
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
                      Categoría
                    </label>
                    <select
                      name="categoria"
                      className="form-select form-select-sm mush-input py-1 px-2"
                      style={{ fontSize: "0.85rem" }}
                      value={form.categoria}
                      onChange={handleChange}
                    >
                      {CATEGORIAS_DISPONIBLES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* De donde sale el costo y como se vende: sin esto el producto
                    no puede aparecer en Lista de Precios. */}
                <div className="row g-2 mb-2">
                  <div className="col-8">
                    <label className="form-label text-secondary fw-semibold mb-1" style={{ fontSize: "0.78rem" }}>
                      Se costea con <span className="text-danger">*</span>
                    </label>
                    <select
                      name="receta"
                      className="form-select form-select-sm mush-input py-1 px-2"
                      style={{ fontSize: "0.85rem" }}
                      value={form.receta}
                      onChange={handleChange}
                    >
                      <option value="">-- Elegir receta --</option>
                      <option value={RECETA_NUEVA}>+ Crear la receta de este producto</option>
                      {recetasOrdenadas.map((receta) => (
                        <option key={receta.slug} value={receta.slug}>
                          {receta.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-4">
                    <label className="form-label text-secondary fw-semibold mb-1" style={{ fontSize: "0.78rem" }}>
                      Emoji
                    </label>
                    <input
                      type="text"
                      name="emoji"
                      className="form-control form-control-sm mush-input py-1 px-2 text-center"
                      style={{ fontSize: "0.85rem" }}
                      placeholder="🍫"
                      value={form.emoji}
                      onChange={handleChange}
                      autoComplete="off"
                    />
                  </div>
                </div>

                {/* La receta nueva necesita su rinde antes de existir: los
                    ingredientes de la masa se anotan por tanda, asi que sin
                    este numero no hay costo por unidad. Es lo unico que se
                    pregunta aca; el resto se carga despues, en Recetas. */}
                {form.receta === RECETA_NUEVA && (
                  <div className="bg-ok-suave border-ok border rounded-3 p-2 mb-2">
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <span className="text-white fw-semibold" style={{ fontSize: "0.82rem" }}>
                        Una tanda de masa rinde <span className="text-danger">*</span>
                      </span>
                      <input
                        type="number"
                        name="rinde"
                        min="1"
                        step="1"
                        className="form-control form-control-sm mush-input py-1 px-2 text-center"
                        style={{ fontSize: "0.85rem", width: "95px" }}
                        placeholder="126"
                        value={form.rinde}
                        onChange={handleChange}
                        autoComplete="off"
                      />
                      <span className="text-white" style={{ fontSize: "0.82rem" }}>
                        {unidadDeRindeEnPlural(form.categoria)}
                      </span>
                    </div>
                    <p className="text-ok mb-0 mt-1" style={{ fontSize: "0.72rem" }}>
                      La receta se crea vacia, con su tarjeta en Recetas y en Costos para
                      cargarle los ingredientes.
                    </p>
                  </div>
                )}

                <div className="mb-2">
                  <label className="form-label text-secondary fw-semibold mb-1 d-block" style={{ fontSize: "0.78rem" }}>
                    Se vende
                  </label>
                  <div className="d-flex gap-3">
                    {[
                      { valor: "unidad", texto: "Por unidad" },
                      { valor: "caja", texto: "Por caja" },
                    ].map(({ valor, texto }) => (
                      <label
                        key={valor}
                        className="d-flex align-items-center gap-1 text-white"
                        style={{ fontSize: "0.82rem", cursor: "pointer" }}
                      >
                        <input
                          type="radio"
                          name="presentacion"
                          className="form-check-input m-0"
                          value={valor}
                          checked={form.presentacion === valor}
                          onChange={handleChange}
                        />
                        {texto}
                      </label>
                    ))}
                  </div>
                </div>

                {form.presentacion === "caja" && (
                  <>
                    <div className="row g-2 mb-2">
                      <div className="col-4">
                        <label className="form-label text-secondary fw-semibold mb-1" style={{ fontSize: "0.78rem" }}>
                          Unidades
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          name="unidades"
                          className="form-control form-control-sm mush-input mush-dato py-1 px-2 text-center"
                          style={{ fontSize: "0.85rem" }}
                          placeholder="0"
                          value={
                            form.armada
                              ? componentesValidos(form.composicion).reduce(
                                  (suma, c) => suma + Number(c.cantidad),
                                  0
                                ) || ""
                              : form.unidades
                          }
                          onChange={handleChange}
                          disabled={form.armada}
                          autoComplete="off"
                        />
                      </div>

                      <div className="col-8">
                        <label className="form-label text-secondary fw-semibold mb-1" style={{ fontSize: "0.78rem" }}>
                          Caja de carton
                        </label>
                        <select
                          name="carton"
                          className="form-select form-select-sm mush-input py-1 px-2"
                          style={{ fontSize: "0.85rem" }}
                          value={form.carton}
                          onChange={handleChange}
                        >
                          <option value="">-- Sin caja --</option>
                          {cartones.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mb-2">
                      <label
                        className="d-flex align-items-center gap-2 text-white"
                        style={{ fontSize: "0.82rem", cursor: "pointer" }}
                      >
                        <input
                          type="checkbox"
                          name="armada"
                          className="form-check-input m-0"
                          checked={form.armada}
                          onChange={handleChange}
                        />
                        La caja lleva productos distintos
                      </label>
                    </div>

                    {form.armada && (
                      <div className="mush-card-elevada rounded-3 p-2 mb-2">
                        {form.composicion.map((componente, indice) => (
                          <div className="row g-2 mb-2" key={indice}>
                            <div className="col-7">
                              <select
                                className="form-select form-select-sm mush-input py-1 px-2"
                                style={{ fontSize: "0.85rem" }}
                                value={componente.receta}
                                onChange={(e) => cambiarComponente(indice, "receta", e.target.value)}
                              >
                                <option value="">-- Elegir --</option>
                                {recetasOrdenadas.map((receta) => (
                                  <option key={receta.slug} value={receta.slug}>
                                    {receta.nombre}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="col-3">
                              <input
                                type="text"
                                inputMode="numeric"
                                className="form-control form-control-sm mush-input mush-dato py-1 px-2 text-center"
                                style={{ fontSize: "0.85rem" }}
                                placeholder="0"
                                value={componente.cantidad}
                                onChange={(e) =>
                                  cambiarComponente(indice, "cantidad", e.target.value.replace(/[^0-9]/g, ""))
                                }
                                autoComplete="off"
                              />
                            </div>
                            <div className="col-2 d-flex align-items-center">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger py-0 px-2 d-inline-flex align-items-center"
                                style={{ fontSize: "0.72rem", minHeight: "24px" }}
                                onClick={() => quitarComponente(indice)}
                                title="Quitar"
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </div>
                          </div>
                        ))}

                        <button
                          type="button"
                          className="btn-mush-outline py-1 px-3"
                          style={{ fontSize: "0.78rem" }}
                          onClick={agregarComponente}
                        >
                          Agregar producto
                        </button>
                      </div>
                    )}
                  </>
                )}

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
                    className="btn-mush py-1 px-3"
                    style={{ fontSize: "0.82rem" }}
                  >
                    {modoEdicion ? "Guardar Cambios" : "Guardar Producto"}
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

export default AltaAlfajores;
