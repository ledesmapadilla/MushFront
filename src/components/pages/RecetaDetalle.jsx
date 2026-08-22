import { useState, useMemo, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useMush } from "../../context/MushContext";
import BuscadorFiltro from "../shared/BuscadorFiltro.jsx";
import ConversorUnidades from "../shared/ConversorUnidades.jsx";
import { moneda, fechaHoy, valorMensual } from "../../utils/sueldos.js";
import { formatearCantidad } from "../../utils/conversiones.js";
import Swal from "sweetalert2";

const UNIDADES_INGREDIENTE = ["kg", "gr", "un", "lts", "ml", "otras"];
const UNIDADES_PACKAGING = ["un", "pack", "caja", "rollo", "kg", "gr", "otras"];

// Referencia estable para las secciones sin catalogo (si no, el useMemo
// del catalogo se recalcularia en cada render).
const SIN_CATALOGO = [];

// Las tarjetas de una receta. Cada item guardado lleva su "seccion" para saber
// a cual pertenece. Las que llevan "soloEn" aparecen unicamente en esas recetas.
const SECCIONES = [
  {
    id: "masa",
    emoji: "🥣",
    escala: "amplia",
    columnaGrid: "col-4",
    titulo: "Masa",
    detalle: (receta) => `${receta.rinde || 60} alfajores`,
    // Se carga en la unidad que venga anotada, asi que lleva el conversor
    conversor: true,
    columna: "Ingrediente",
    catalogo: "ingredientes",
    unidades: UNIDADES_INGREDIENTE,
    unidadPorDefecto: "kg",
    textoBoton: "Nuevo Ingrediente",
    vacio: "No hay ingredientes cargados.",
  },
  {
    id: "unitario",
    emoji: "🥄",
    escala: "amplia",
    columnaGrid: "col-4",
    titulo: "Ingredientes por alfajor",
    conversor: true,
    // Cada fila se puede desglosar en varios componentes; la cantidad que se ve
    // en la tabla es la suma de ellos.
    conComponentes: true,
    columna: "Ingrediente",
    catalogo: "ingredientes",
    unidades: UNIDADES_INGREDIENTE,
    unidadPorDefecto: "un",
    textoBoton: "Nuevo Ingrediente",
    vacio: "No hay ingredientes cargados.",
  },
  {
    id: "packaging",
    emoji: "📦",
    escala: "amplia",
    columnaGrid: "col-4",
    titulo: "Packaging por alfajor",
    columna: "Packaging",
    catalogo: "packaging",
    unidades: UNIDADES_PACKAGING,
    unidadPorDefecto: "un",
    textoBoton: "Nuevo Packaging",
    vacio: "No hay packaging cargado.",
  },
  {
    id: "pasta-pistacho",
    titulo: "Pasta de Pistacho",
    gramosBase: 740,
    // No es una tarjeta propia: es una tabla mas dentro de otra seccion, y solo
    // en las recetas que la lleven.
    dentroDe: "unitario",
    soloEn: ["alfajor-de-pistacho"],
    columna: "Ingrediente",
    catalogo: "ingredientes",
    unidades: UNIDADES_INGREDIENTE,
    unidadPorDefecto: "gr",
    textoBoton: "Nuevo Ingrediente",
    vacio: "No hay ingredientes cargados.",
  },
  {
    id: "praline-pistacho",
    titulo: "Praliné de Pistacho",
    gramosBase: 240,
    dentroDe: "unitario",
    soloEn: ["alfajor-de-pistacho"],
    columna: "Ingrediente",
    catalogo: "ingredientes",
    unidades: UNIDADES_INGREDIENTE,
    unidadPorDefecto: "gr",
    textoBoton: "Nuevo Ingrediente",
    vacio: "No hay ingredientes cargados.",
  },
  {
    id: "mano-de-obra",
    emoji: "🧑‍🍳",
    escala: "densa",
    columnaGrid: "col-4",
    titulo: "Mano de obra",
    // Esta seccion no usa la tabla generica: tiene columnas propias.
    esManoDeObra: true,
    columna: "Mano de obra",
    textoBoton: "Nueva Fila",
    vacio: "No hay mano de obra cargada.",
  },
];

// El detalle del titulo de una seccion con gramos de referencia sale de ese
// mismo numero, para no escribirlo dos veces.
SECCIONES.forEach((s) => {
  if (s.gramosBase && !s.detalle) s.detalle = () => `${s.gramosBase} gr`;
});

// El ancho del bloque lo comparten el titulo y la grilla, para que no se desfasen.
const ANCHO_BLOQUE = "820px";

// Las dos escalas de tarjeta de la guia de estilos.
const ESCALAS = {
  amplia: { alto: "190px", padding: "p-3 p-sm-4", emoji: "fs-1 mb-3", texto: "1rem" },
  densa: { alto: "135px", padding: "p-2 p-sm-3", emoji: "fs-2 mb-2", texto: "0.8rem" },
};

// Lo que ya estaba cargado (sin "seccion") pertenece a la masa.
const SECCION_POR_DEFECTO = "masa";
const buscarSeccion = (id) => SECCIONES.find((s) => s.id === id) || SECCIONES[0];

// Las secciones propias de una receta se declaran con "soloEn"; el resto las
// tienen todas.
const esDeLaReceta = (seccion, receta) =>
  !seccion.soloEn ||
  seccion.soloEn.some((slug) => normalizar(slug) === normalizar(receta?.slug || receta?.id));

// Las tarjetas de la portada: las que llevan "dentroDe" no son tarjetas, se
// dibujan como una tabla mas dentro de su seccion.
const seccionesDeReceta = (receta) =>
  SECCIONES.filter((s) => !s.dentroDe && esDeLaReceta(s, receta));

const subSeccionesDe = (seccion, receta) =>
  SECCIONES.filter((s) => s.dentroDe === seccion?.id && esDeLaReceta(s, receta));

// Una tarjeta que queda sola en la ultima fila se centra en vez de quedar
// pegada a la izquierda.
const claseColumna = (seccion, indice, total) =>
  indice === total - 1 && indice % 3 === 0 ? `${seccion.columnaGrid} offset-4` : seccion.columnaGrid;

// Texto plano del titulo, con el detalle entre parentesis si lo tiene.
const tituloCompleto = (seccion, receta) =>
  seccion.detalle ? `${seccion.titulo} (${seccion.detalle(receta)})` : seccion.titulo;

const FORM_INICIAL = {
  seccion: SECCION_POR_DEFECTO,
  ingredienteId: "",
  nombre: "",
  unidad: "kg",
  cantidad: "",
  observaciones: "",
  // Solo para la seccion de mano de obra
  mensual: "",
  alfajoresProducidos: "",
};

const swalConfig = {
  background: "#18181b",
  color: "#f4f4f5",
  confirmButtonColor: "#c59a68",
};

const normalizar = (txt) =>
  (txt || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

const RecetaDetalle = () => {
  const { slug, seccion: seccionParam } = useParams();
  const { recetas, ingredientes, packaging, personal, guardarReceta } = useMush();

  const slugActual = slug || "clasico-semiamargo";

  // Buscar la receta por slug o id de forma robusta
  const receta = useMemo(() => {
    const cleanSlug = normalizar(slugActual);
    const encontrada = (recetas || []).find(
      (r) =>
        normalizar(r.slug) === cleanSlug ||
        normalizar(r.id) === cleanSlug ||
        normalizar(r.nombre) === cleanSlug
    );

    if (encontrada) return encontrada;

    // Si no existe aun en el estado, inicializar estructura limpia para el slug
    const nombreFormateado = slugActual
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    return {
      id: slugActual,
      slug: slugActual,
      nombre: nombreFormateado,
      categoria: "Alfajor",
      rinde: 60,
      observaciones: "",
      ingredientes: [],
    };
  }, [recetas, slugActual]);

  const seccionesVisibles = useMemo(() => seccionesDeReceta(receta), [receta]);

  // Sin parametro de seccion se muestran las tarjetas; con el, la tabla. Una
  // seccion que no es de esta receta se ignora y se vuelve a las tarjetas.
  const seccionActiva = seccionParam
    ? seccionesVisibles.find((s) => s.id === seccionParam) || null
    : null;

  const [form, setForm] = useState(FORM_INICIAL);
  // Referencia al item que se esta editando (null = alta nueva).
  const [itemEditando, setItemEditando] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [mostrarModal, setMostrarModal] = useState(false);
  const [errorIngrediente, setErrorIngrediente] = useState("");
  const [errorCantidad, setErrorCantidad] = useState("");

  const seccionForm = buscarSeccion(form.seccion);
  const catalogo =
    seccionForm.catalogo === "packaging"
      ? packaging
      : seccionForm.catalogo === "ingredientes"
        ? ingredientes
        : SIN_CATALOGO;

  const catalogoOrdenado = useMemo(
    () =>
      [...(catalogo || [])].sort((a, b) =>
        (a.nombre || "").localeCompare(b.nombre || "", "es", { sensitivity: "base" })
      ),
    [catalogo]
  );

  // --- Mano de obra: un unico valor por receta, no una lista ---
  const manoDeObra = receta.manoDeObra || {};
  // Borrador local para que se pueda tipear sin guardar en cada tecla.
  const [moBorrador, setMoBorrador] = useState({
    fecha: "",
    personalId: "",
    mensual: "",
    alfajoresProducidos: "",
    observaciones: "",
  });

  useEffect(() => {
    setMoBorrador({
      fecha: manoDeObra.fecha || "",
      personalId: manoDeObra.personalId || "",
      mensual: manoDeObra.mensual !== undefined ? String(manoDeObra.mensual) : "",
      alfajoresProducidos:
        manoDeObra.alfajoresProducidos !== undefined ? String(manoDeObra.alfajoresProducidos) : "",
      observaciones: manoDeObra.observaciones || "",
    });
  }, [
    manoDeObra.fecha,
    manoDeObra.personalId,
    manoDeObra.mensual,
    manoDeObra.alfajoresProducidos,
    manoDeObra.observaciones,
  ]);

  // El mensual no se tipea: sale del legajo de Personal elegido. Si ese legajo
  // no esta disponible se conserva el monto ya guardado en la receta.
  // Importante: se lee de `manoDeObra`, no del borrador. El borrador arranca
  // vacio antes de que llegue la receta, y leerlo de ahi guardaba 0 encima del
  // valor real, dejando el costo en "-" para siempre.
  const personaMO = (personal || []).find((x) => x.id === moBorrador.personalId) || null;
  const mensualGuardado = Number(manoDeObra.mensual) || 0;
  // Si el legajo existe pero todavia no tiene sueldo cargado, no se pierde el
  // monto que ya tenia la receta.
  const mensualMO = (personaMO ? valorMensual(personaMO) : 0) || mensualGuardado;

  const guardarManoDeObra = (cambios) => {
    const proximo = {
      fecha: moBorrador.fecha || fechaHoy(),
      personalId: moBorrador.personalId || "",
      // Se guarda tambien el monto por si mas adelante se borra ese legajo.
      mensual: mensualMO,
      alfajoresProducidos: Number(moBorrador.alfajoresProducidos) || 0,
      observaciones: (moBorrador.observaciones || "").trim(),
      ...cambios,
    };
    setMoBorrador({
      fecha: proximo.fecha,
      personalId: proximo.personalId,
      mensual: String(proximo.mensual),
      alfajoresProducidos: String(proximo.alfajoresProducidos),
      observaciones: proximo.observaciones,
    });
    guardarReceta({ ...receta, manoDeObra: proximo });
  };

  const cambiarProducidos = (delta) => {
    const actual = Number(moBorrador.alfajoresProducidos) || 0;
    const nuevo = Math.max(0, actual + delta);
    if (nuevo === actual) return;
    guardarManoDeObra({ alfajoresProducidos: nuevo });
  };

  const costoManoObra = (() => {
    const producidos = Number(moBorrador.alfajoresProducidos) || 0;
    if (producidos <= 0) return 0;
    return mensualMO / producidos;
  })();

  // Filas de una seccion, filtradas y ordenadas. Se usa tanto para la tabla
  // principal como para las tablas anidadas.
  const filasDe = (seccion) => {
    if (!seccion) return [];
    const texto = busqueda.toLowerCase();

    return (receta.ingredientes || [])
      .filter((item) => buscarSeccion(item.seccion).id === seccion.id)
      .filter((item) => {
        const nombre = (item.nombre || "").toLowerCase();
        const unidad = (item.unidad || "").toLowerCase();
        const obs = (item.observaciones || "").toLowerCase();
        return nombre.includes(texto) || unidad.includes(texto) || obs.includes(texto);
      })
      .sort((a, b) =>
        (a.nombre || "").localeCompare(b.nombre || "", "es", { sensitivity: "base" })
      );
  };

  const totalDe = (seccion) =>
    seccion
      ? (receta.ingredientes || []).filter(
          (item) => buscarSeccion(item.seccion).id === seccion.id
        ).length
      : 0;


  const handleChangeCatalogo = (e) => {
    const valor = e.target.value;
    const encontrado = (catalogo || []).find((i) => i.id === valor);

    setForm((prev) => ({
      ...prev,
      ingredienteId: encontrado ? encontrado.id : "",
      nombre: encontrado ? encontrado.nombre : "",
      unidad: encontrado ? encontrado.unidad || prev.unidad : prev.unidad,
    }));

    if (errorIngrediente) setErrorIngrediente("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === "nombre" && errorIngrediente) setErrorIngrediente("");
    if (name === "cantidad" && errorCantidad) setErrorCantidad("");
  };

  const handleAbrirNuevo = (seccion) => {
    const s = seccion || seccionActiva || SECCIONES[0];
    setForm({ ...FORM_INICIAL, seccion: s.id, unidad: s.unidadPorDefecto });
    setItemEditando(null);
    setErrorIngrediente("");
    setErrorCantidad("");
    setMostrarModal(true);
  };

  const handleEditar = (item) => {
    const s = buscarSeccion(item.seccion);
    setForm({
      seccion: s.id,
      ingredienteId: item.ingredienteId || "",
      nombre: item.nombre || "",
      unidad: item.unidad || s.unidadPorDefecto,
      // Una cantidad en 0 es una fila todavia sin cargar: la caja arranca vacia
      // para poder escribir el valor sin tener que borrar el 0 antes.
      cantidad: Number(item.cantidad) ? String(item.cantidad) : "",
      observaciones: item.observaciones || "",
      mensual: item.mensual !== undefined ? String(item.mensual) : "",
      alfajoresProducidos:
        item.alfajoresProducidos !== undefined ? String(item.alfajoresProducidos) : "",
    });
    setItemEditando(item);
    setErrorIngrediente("");
    setErrorCantidad("");
    setMostrarModal(true);
  };

  const handleCerrarModal = () => {
    setForm(FORM_INICIAL);
    setItemEditando(null);
    setErrorIngrediente("");
    setErrorCantidad("");
    setMostrarModal(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorIngrediente("");
    setErrorCantidad("");

    const lista = [...(receta.ingredientes || [])];

    // La mano de obra tiene sus propios campos: mensual y alfajores producidos.
    if (seccionForm.esManoDeObra) {
      const mensualNum = Number(form.mensual);
      if (!form.mensual || isNaN(mensualNum) || mensualNum <= 0) {
        setErrorIngrediente("El mensual es obligatorio.");
        return;
      }

      const nuevoItem = {
        id: itemEditando?.id || `item_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        seccion: form.seccion,
        mensual: mensualNum,
        alfajoresProducidos: Math.max(0, parseInt(form.alfajoresProducidos, 10) || 0),
        observaciones: form.observaciones ? form.observaciones.trim() : "",
      };

      const indiceMO = itemEditando ? lista.indexOf(itemEditando) : -1;
      if (indiceMO !== -1) lista[indiceMO] = nuevoItem;
      else lista.push(nuevoItem);

      guardarReceta({ ...receta, ingredientes: lista });

      Swal.fire({
        ...swalConfig,
        title: itemEditando ? "Cambios guardados" : "Agregado a la receta",
        icon: "success",
        timer: 1400,
        showConfirmButton: false,
      });

      handleCerrarModal();
      return;
    }

    const nombreLimpio = (form.nombre || "").trim();
    if (!nombreLimpio) {
      setErrorIngrediente(`El nombre del ${seccionForm.columna.toLowerCase()} es obligatorio.`);
      return;
    }

    const cantNum = parseFloat(form.cantidad);
    if (isNaN(cantNum) || cantNum <= 0) {
      setErrorCantidad("Ingresa una cantidad valida mayor a 0.");
      return;
    }

    // El duplicado se mide dentro de la misma tarjeta: un mismo insumo puede
    // estar en la masa y ademas aparecer por alfajor.
    const duplicado = lista.some(
      (item) =>
        item !== itemEditando &&
        buscarSeccion(item.seccion).id === form.seccion &&
        normalizar(item.nombre) === normalizar(nombreLimpio)
    );

    if (duplicado) {
      setErrorIngrediente(`"${nombreLimpio}" ya esta en esta tarjeta.`);
      return;
    }

    const nuevoItem = {
      id: itemEditando?.id || `item_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      seccion: form.seccion,
      ingredienteId: form.ingredienteId || "",
      nombre: nombreLimpio,
      unidad: form.unidad || seccionForm.unidadPorDefecto,
      cantidad: cantNum,
      observaciones: form.observaciones ? form.observaciones.trim() : "",
    };

    const indice = itemEditando ? lista.indexOf(itemEditando) : -1;
    if (indice !== -1) {
      lista[indice] = nuevoItem;
    } else {
      lista.push(nuevoItem);
    }

    guardarReceta({ ...receta, ingredientes: lista });

    Swal.fire({
      ...swalConfig,
      title: itemEditando ? "Cambios guardados" : "Agregado a la receta",
      icon: "success",
      timer: 1400,
      showConfirmButton: false,
    });

    handleCerrarModal();
  };

  const handleEliminar = (item) => {
    Swal.fire({
      ...swalConfig,
      title: `¿Eliminar ${item.nombre}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Si, eliminar",
      cancelButtonText: "Cancelar",
      customClass: {
        popup: "rounded-4 border border-secondary border-opacity-25 shadow-lg",
        confirmButton: "btn btn-danger px-3 py-1 rounded-3 me-2 fw-bold",
        cancelButton: "btn btn-outline-secondary px-3 py-1 rounded-3 text-dark",
      },
    }).then((result) => {
      if (!result.isConfirmed) return;

      const lista = (receta.ingredientes || []).filter((x) => x !== item);
      guardarReceta({ ...receta, ingredientes: lista });

      if (itemEditando === item) handleCerrarModal();
    });
  };

  const subSecciones = subSeccionesDe(seccionActiva, receta);

  // Gramos anotados al lado de cada tabla anidada. Igual que la mano de obra:
  // se tipea sobre un borrador local y se guarda en el mismo momento.
  const [gramosBorrador, setGramosBorrador] = useState({});

  // Se sincroniza solo al cambiar de receta. Si dependiera de receta.gramos se
  // rearmaria en cada tecla (guardar devuelve un objeto nuevo) y pisaria lo que
  // se esta escribiendo: un "12," volvia a "12" y no se podia borrar el 0.
  const idReceta = receta.id;
  useEffect(() => {
    setGramosBorrador(
      Object.fromEntries(
        Object.entries(receta.gramos || {}).map(([clave, valor]) => [clave, String(valor ?? "")])
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idReceta]);

  const cambiarGramos = (seccionId, valor) => {
    const limpio = valor.replace(/[^0-9.,]/g, "").replace(",", ".");
    const proximo = { ...gramosBorrador, [seccionId]: limpio };
    setGramosBorrador(proximo);

    const gramos = Object.fromEntries(
      Object.entries(proximo).map(([clave, v]) => [clave, Number(v) || 0])
    );
    guardarReceta({ ...receta, gramos });
  };

  // --- Componentes de una fila -------------------------------------------
  // Una fila se puede desglosar en varios componentes. La cantidad que muestra
  // la tabla es la suma de ellos, asi que deja de escribirse a mano.
  const [itemComponentes, setItemComponentes] = useState(null);
  const [componentesBorrador, setComponentesBorrador] = useState([]);

  const COMPONENTE_VACIO = { componente: "", cantidad: "", unidad: "", observaciones: "" };

  // Una fila sin nombre esta a medio escribir: no cuenta para el total ni se
  // guarda, asi el numero que se ve es el mismo que queda en la tabla.
  const componentesValidos = (lista) =>
    (lista || []).filter((c) => (c.componente || "").trim());

  const totalComponentes = (lista) =>
    componentesValidos(lista).reduce(
      (suma, c) => suma + (Number(String(c.cantidad).replace(",", ".")) || 0),
      0
    );

  const handleAbrirComponentes = (item) => {
    const previos = Array.isArray(item.componentes) ? item.componentes : [];
    setComponentesBorrador(
      previos.length > 0
        ? previos.map((c) => ({
            componente: c.componente || "",
            cantidad: c.cantidad !== undefined ? String(c.cantidad) : "",
            unidad: c.unidad || item.unidad || "gr",
            observaciones: c.observaciones || "",
          }))
        : [{ ...COMPONENTE_VACIO, unidad: item.unidad || "gr" }]
    );
    setItemComponentes(item);
  };

  const handleCerrarComponentes = () => {
    setItemComponentes(null);
    setComponentesBorrador([]);
  };

  const cambiarComponente = (indice, campo, valor) => {
    setComponentesBorrador((prev) =>
      prev.map((c, i) =>
        i === indice
          ? { ...c, [campo]: campo === "cantidad" ? valor.replace(/[^0-9.,]/g, "") : valor }
          : c
      )
    );
  };

  const agregarComponente = () =>
    setComponentesBorrador((prev) => [
      ...prev,
      { ...COMPONENTE_VACIO, unidad: itemComponentes?.unidad || "gr" },
    ]);

  const quitarComponente = (indice) =>
    setComponentesBorrador((prev) => prev.filter((_, i) => i !== indice));

  const handleGuardarComponentes = () => {
    const componentes = componentesValidos(componentesBorrador)
      .map((c) => ({
        componente: c.componente.trim(),
        cantidad: Number(String(c.cantidad).replace(",", ".")) || 0,
        unidad: c.unidad || itemComponentes.unidad || "gr",
        observaciones: (c.observaciones || "").trim(),
      }));

    const total = totalComponentes(componentes);
    const lista = (receta.ingredientes || []).map((x) =>
      x === itemComponentes
        ? { ...x, componentes, ...(componentes.length > 0 && { cantidad: total }) }
        : x
    );

    guardarReceta({ ...receta, ingredientes: lista });
    handleCerrarComponentes();
  };

  /**
   * Tabla de solo lectura: las mismas filas con las cantidades llevadas a los
   * gramos escritos en la caja. Sin observaciones, ni acciones, ni alta.
   */
  const tablaProporcional = (seccion) => {
    const filasSeccion = filasDe(seccion);
    // La tabla de la izquierda esta escrita para los gramos de referencia de la
    // seccion (740 gr la pasta, 240 gr el praline): esa es la base.
    const base = Number(seccion.gramosBase) || 0;
    const objetivo = Number(gramosBorrador[seccion.id]) || 0;
    const factor = base > 0 && objetivo > 0 ? objetivo / base : null;

    return (
      <div className="mush-card mush-card-anidada p-3">
        <h5 className="text-white fw-bold mb-3" style={{ fontSize: "0.9rem" }}>
          {seccion.titulo}
          <span className="text-secondary fw-normal ms-2" style={{ fontSize: "0.8rem" }}>
            ({objetivo > 0 ? `${formatearCantidad(objetivo)} gr` : "— gr"})
          </span>
        </h5>

        <div className="table-responsive mush-scroll-tabla" style={{ maxHeight: "300px" }}>
          <table className="table mush-tabla align-middle mb-0 text-nowrap">
            <thead>
              <tr>
                <th style={{ width: "52%" }}>{seccion.columna}</th>
                <th className="text-end" style={{ width: "28%" }}>Cantidad</th>
                <th style={{ width: "20%" }}>Un</th>
              </tr>
            </thead>
            <tbody>
              {filasSeccion.length === 0 ? (
                <tr>
                  <td colSpan="3" className="text-center py-4 text-secondary">
                    {seccion.vacio}
                  </td>
                </tr>
              ) : (
                filasSeccion.map((item, idx) => (
                  <tr key={item.id || idx}>
                    <td>
                      <strong
                        className="text-white text-truncate d-block"
                        style={{ fontSize: "0.82rem", maxWidth: "150px" }}
                        title={item.nombre}
                      >
                        {item.nombre}
                      </strong>
                    </td>
                    <td className="text-end">
                      <span className="text-white mush-dato" style={{ fontSize: "0.82rem" }}>
                        {factor ? formatearCantidad((Number(item.cantidad) || 0) * factor) : "—"}
                      </span>
                    </td>
                    <td>
                      <span
                        className="badge bg-secondary bg-opacity-25 text-white border border-secondary border-opacity-25 px-2 py-1"
                        style={{ fontSize: "0.72rem" }}
                      >
                        {item.unidad || seccion.unidadPorDefecto}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  /**
   * Tarjeta con la tabla de una seccion. La principal muestra el buscador y no
   * lleva titulo (ya esta en el encabezado de la pantalla); las anidadas llevan
   * su titulo y su propio boton de alta.
   */
  const tarjetaDeTabla = (
    seccion,
    // claseBoton: las tablas anidadas usan la variante con borde para que el
    // alta acompane el tono mas suave de su tarjeta.
    { conBuscador = false, conTitulo = false, claseExtra = "", claseBoton = "btn-mush" } = {}
  ) => {
    const filasSeccion = filasDe(seccion);
    const total = totalDe(seccion);

    return (
      <div className={`mush-card p-3 p-sm-4 ${claseExtra}`.trim()} key={seccion.id}>
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
          {conTitulo ? (
            <h5 className="text-white mb-0 fw-bold">
              {seccion.titulo}
              {seccion.detalle && (
                <span className="text-secondary fw-normal ms-2" style={{ fontSize: "1rem" }}>
                  ({seccion.detalle(receta)})
                </span>
              )}
            </h5>
          ) : (
            <span></span>
          )}

          <div className="d-flex align-items-center gap-2 ms-auto">
            {conBuscador && total > 0 && (
              <div style={{ width: "240px", maxWidth: "100%" }}>
                <BuscadorFiltro valor={busqueda} alCambiar={setBusqueda} placeholder="Buscar..." />
              </div>
            )}
            <button
              type="button"
              className={`${claseBoton} text-nowrap`}
              onClick={() => handleAbrirNuevo(seccion)}
            >
              {seccion.textoBoton}
            </button>
          </div>
        </div>

        <div
          className="table-responsive mush-scroll-tabla"
          style={{ maxHeight: conTitulo ? "300px" : "calc(100vh - 280px)" }}
        >
          <table className="table mush-tabla align-middle mb-0 text-nowrap">
            <thead>
              <tr>
                <th style={{ width: "30%" }}>{seccion.columna}</th>
                <th style={{ width: "14%" }}>Cantidad</th>
                <th style={{ width: "12%" }}>Un</th>
                <th style={{ width: "22%" }}>Observaciones</th>
                <th className="text-end" style={{ width: seccion.conComponentes ? "28%" : "18%" }}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {filasSeccion.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-4 text-secondary">
                    {busqueda ? "Sin resultados para la busqueda." : seccion.vacio}
                  </td>
                </tr>
              ) : (
                filasSeccion.map((item, idx) => (
                  <tr key={item.id || idx}>
                    <td>
                      <strong
                        className="text-white text-truncate d-block"
                        style={{ fontSize: "0.82rem", maxWidth: "250px" }}
                        title={item.nombre}
                      >
                        {item.nombre}
                      </strong>
                    </td>
                    <td>
                      <span className="text-white fw-bold small">{item.cantidad}</span>
                    </td>
                    <td>
                      <span
                        className="badge bg-secondary bg-opacity-25 text-white border border-secondary border-opacity-25 px-2 py-1"
                        style={{ fontSize: "0.72rem" }}
                      >
                        {item.unidad || seccion.unidadPorDefecto}
                      </span>
                    </td>
                    <td>
                      <span
                        className="text-secondary text-truncate d-block"
                        style={{ fontSize: "0.8rem", maxWidth: "260px" }}
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
                          title="Editar"
                        >
                          <i className="bi bi-pencil"></i> Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger py-0 px-2 d-inline-flex align-items-center gap-1"
                          style={{ fontSize: "0.72rem", minHeight: "24px" }}
                          onClick={() => handleEliminar(item)}
                          title="Quitar"
                        >
                          <i className="bi bi-trash"></i> Borrar
                        </button>
                        {seccion.conComponentes && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary py-0 px-2 text-white d-inline-flex align-items-center gap-1"
                            style={{ fontSize: "0.72rem", minHeight: "24px" }}
                            onClick={() => handleAbrirComponentes(item)}
                            title="Desglosar en varios componentes"
                          >
                            <i className="bi bi-list-ul"></i> Varios
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------
  // Vista 1: las tres tarjetas de la receta
  // ---------------------------------------------------------------------
  if (!seccionActiva) {
    // El titulo queda arriba y las tarjetas se centran en el alto restante
    // (mismo alto util que Error404).
    return (
      <div
        className="container py-4 d-flex flex-column"
        style={{ minHeight: "calc(100vh - 170px)" }}
      >
        {/* Titulo arriba. El boton volver se posiciona aparte para que el
            titulo quede centrado de verdad. */}
        <div className="mx-auto w-100 position-relative mb-4" style={{ maxWidth: ANCHO_BLOQUE }}>
          <Link
            to="/recetas"
            className="btn btn-sm btn-outline-secondary py-1 px-2 text-white d-inline-flex align-items-center gap-1 rounded-3 position-absolute start-0 top-50 translate-middle-y"
            title="Volver al listado de recetas"
          >
            <i className="bi bi-arrow-left"></i>
          </Link>
          <h2 className="mush-display text-white text-center mb-0">{receta.nombre}</h2>
        </div>


        {/* Tarjetas centradas en el espacio que queda.
            Mismo ancho y grilla que el listado de productos (Recetas.jsx) */}
        <div
          className="mx-auto w-100 d-flex flex-column justify-content-center flex-grow-1"
          style={{ maxWidth: ANCHO_BLOQUE }}
        >
          <div className="row g-2 g-sm-3">
            {seccionesVisibles.map((s, indice) => (
              <div className={claseColumna(s, indice, seccionesVisibles.length)} key={s.id}>
                <Link
                  to={`/recetas/${slugActual}/${s.id}`}
                  className={`mush-card mush-card-hover text-decoration-none ${ESCALAS[s.escala].padding} d-flex flex-column align-items-center justify-content-center text-center border border-secondary border-opacity-25 rounded-4 w-100 shadow-sm`}
                  style={{ minHeight: ESCALAS[s.escala].alto, height: "100%" }}
                  title={tituloCompleto(s, receta)}
                >
                  <span className={ESCALAS[s.escala].emoji}>{s.emoji}</span>
                  <strong className="text-white fw-bold w-100 lh-sm" style={{ fontSize: ESCALAS[s.escala].texto }}>
                    {s.titulo}
                    {s.detalle && <span className="fw-normal"> ({s.detalle(receta)})</span>}
                  </strong>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // Vista 2a: mano de obra. Es un valor unico, asi que va en una sola
  // tarjeta dividida en secciones, no en una tabla de filas.
  // ---------------------------------------------------------------------
  if (seccionActiva.esManoDeObra) {
    // Cada division lleva un solo control, todos con la misma altura, para que
    // queden alineados entre si.
    const divisiones = [
      {
        etiqueta: "Fecha",
        contenido: (
          <input
            type="date"
            className="form-control form-control-sm mush-input py-1 px-2 text-center"
            style={{ fontSize: "0.85rem" }}
            value={moBorrador.fecha}
            max={fechaHoy()}
            onChange={(e) => guardarManoDeObra({ fecha: e.target.value })}
          />
        ),
      },
      {
        etiqueta: "Personal",
        crecer: 1.6,
        contenido: (
          <select
            className="form-select form-select-sm mush-input py-1 px-2 text-center"
            style={{ fontSize: "0.85rem" }}
            value={moBorrador.personalId}
            onChange={(e) => guardarManoDeObra({ personalId: e.target.value })}
          >
            <option value="">-- Elegir --</option>
            {[...(personal || [])]
              .sort((a, b) =>
                (a.nombre || "").localeCompare(b.nombre || "", "es", { sensitivity: "base" })
              )
              .map((per) => (
                <option key={per.id} value={per.id}>
                  {per.nombre}
                </option>
              ))}
          </select>
        ),
      },
      {
        etiqueta: "Mensual",
        crecer: 1.2,
        // Sale del legajo elegido en Personal, no se escribe a mano.
        contenido: (
          <div
            className="form-control form-control-sm mush-input py-1 px-2 text-center fw-bold mush-dato d-flex align-items-center justify-content-center"
            style={{ fontSize: "0.85rem" }}
          >
            {moneda(mensualMO)}
          </div>
        ),
      },
      {
        etiqueta: "Alfajores producidos",
        crecer: 1.6,
        contenido: (
          <div className="d-flex align-items-center justify-content-center gap-1">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary text-white px-2 d-flex align-items-center"
              style={{ height: "31px" }}
              onClick={() => cambiarProducidos(-1)}
              disabled={(Number(moBorrador.alfajoresProducidos) || 0) <= 0}
              title="Bajar"
            >
              −
            </button>
            <input
              type="number"
              min="0"
              className="form-control form-control-sm mush-input mush-sin-spinner py-1 px-1 text-center fw-bold"
              style={{ width: "72px", fontSize: "0.85rem" }}
              value={moBorrador.alfajoresProducidos}
              onChange={(e) =>
                setMoBorrador((prev) => ({ ...prev, alfajoresProducidos: e.target.value }))
              }
              onBlur={() =>
                guardarManoDeObra({
                  alfajoresProducidos: Math.max(0, parseInt(moBorrador.alfajoresProducidos, 10) || 0),
                })
              }
            />
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary text-white px-2 d-flex align-items-center"
              style={{ height: "31px" }}
              onClick={() => cambiarProducidos(1)}
              title="Subir"
            >
              +
            </button>
          </div>
        ),
      },
      {
        etiqueta: "Observaciones",
        crecer: 2,
        contenido: (
          <input
            type="text"
            className="form-control form-control-sm mush-input py-1 px-2 text-center"
            style={{ fontSize: "0.85rem" }}
            value={moBorrador.observaciones}
            onChange={(e) => setMoBorrador((prev) => ({ ...prev, observaciones: e.target.value }))}
            onBlur={() => guardarManoDeObra({ observaciones: (moBorrador.observaciones || "").trim() })}
            autoComplete="off"
            spellCheck="false"
          />
        ),
      },
      {
        etiqueta: "Costo M.O por alfajor",
        crecer: 1.7,
        // Valor calculado: va en verde para distinguirlo de los cargados.
        contenido: (
          <span className="text-ok fw-bold mush-dato" style={{ fontSize: "1.6rem" }}>
            {moneda(costoManoObra, 2)}
          </span>
        ),
      },
    ];

    return (
      <div
        className="container py-4 d-flex flex-column"
        style={{ minHeight: "calc(100vh - 170px)" }}
      >
        {/* Titulo arriba de la hoja */}
        <div className="mx-auto w-100" style={{ maxWidth: "1040px" }}>
          <div className="d-flex align-items-center gap-3 mb-3">
            <Link
              to={`/recetas/${slugActual}`}
              className="btn btn-sm btn-outline-secondary py-1 px-2 text-white d-inline-flex align-items-center gap-1 rounded-3"
              title={`Volver a ${receta.nombre}`}
            >
              <i className="bi bi-arrow-left"></i>
            </Link>
            <h2 className="mush-display text-white mb-0">{seccionActiva.titulo}</h2>
          </div>
        </div>

        {/* La tarjeta se centra en el alto restante */}
        <div
          className="mx-auto w-100 d-flex flex-column justify-content-center flex-grow-1"
          style={{ maxWidth: "1040px" }}
        >
          <div className="mush-card p-3 p-sm-4">
            <div className="d-flex flex-column flex-md-row align-items-stretch text-center">
              {divisiones.map((division, i) => {
                const esResultado = i === divisiones.length - 1;
                return (
                  <div
                    key={division.etiqueta}
                    style={{ flex: `${division.crecer || 1} 1 0%` }}
                    className={[
                      "px-2 py-2",
                      // El separador va entre los datos cargados, no antes del resultado
                      !esResultado && i < divisiones.length - 2 ? "mush-division" : "",
                      // El resultado se despega y lleva fondo propio
                      esResultado ? "mush-division-resultado ms-md-3 mt-3 mt-md-0 px-md-3" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {/* Los titulos arrancan arriba, contra el borde del recuadro.
                        El alto reservado se mantiene para que los controles de
                        todas las divisiones queden a la misma altura. */}
                    <span
                      className="mush-kicker d-flex align-items-start justify-content-center text-center mb-2"
                      style={{ minHeight: "2.4em", lineHeight: 1.2 }}
                    >
                      {division.etiqueta}
                    </span>
                    <div
                      className="d-flex align-items-center justify-content-center"
                      style={{ height: esResultado ? "38px" : "31px" }}
                    >
                      {division.contenido}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // Vista 2: la tabla de la tarjeta abierta
  // ---------------------------------------------------------------------
  return (
    <div className="container py-4">
      <div
        className="mx-auto"
        style={{
          // Cada pieza extra al costado de la tabla necesita mas ancho: con las
          // tablas anidadas se usa todo el contenedor.
          maxWidth: subSecciones.length > 0 ? "100%" : seccionActiva.conversor ? "1240px" : "920px",
          width: "100%",
          paddingBottom: "75px",
        }}
      >
        {/* Encabezado con Boton Volver y Titulo de la tarjeta */}
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-3">
          <div className="d-flex align-items-center gap-3">
            <Link
              to={`/recetas/${slugActual}`}
              className="btn btn-sm btn-outline-secondary py-1 px-2 text-white d-inline-flex align-items-center gap-1 rounded-3"
              title={`Volver a ${receta.nombre}`}
            >
              <i className="bi bi-arrow-left"></i>
            </Link>
            <h2 className="mush-display text-white mb-0">
              {seccionActiva.titulo}
              {seccionActiva.detalle && (
                <span className="text-secondary fw-normal ms-2 text-lowercase" style={{ fontSize: "1rem" }}>
                  ({seccionActiva.detalle(receta)})
                </span>
              )}
            </h2>
            <span className="mush-display text-dulce fs-2 ms-4">{receta.nombre}</span>
          </div>
        </div>

        <div className="d-flex flex-column flex-lg-row align-items-start gap-3">
          <div className="flex-grow-1 w-100 d-flex flex-column gap-3" style={{ minWidth: 0 }}>
            {/* Tabla principal de la seccion */}
            {tarjetaDeTabla(seccionActiva, { conBuscador: true })}

            {/* Tablas anidadas: parte de esta seccion, una debajo de la otra y
                un poco mas angostas que la principal */}
            {/* La caja de gramos se centra contra el alto de su tabla */}
            {subSecciones.map((s) => (
              <div className="d-flex align-items-start gap-3" key={s.id}>
                <div className="flex-grow-1" style={{ minWidth: 0 }}>
                  {tarjetaDeTabla(s, {
                    conTitulo: true,
                    claseExtra: "mush-card-anidada",
                    claseBoton: "btn-mush-outline",
                  })}
                </div>
                <div className="align-self-center" style={{ width: "110px", flexShrink: 0 }}>
                  <label
                    className="form-label text-secondary fw-semibold mb-1 d-block text-center"
                    style={{ fontSize: "0.78rem" }}
                    htmlFor={`gramos-${s.id}`}
                  >
                    Grs
                  </label>
                  <input
                    id={`gramos-${s.id}`}
                    type="text"
                    inputMode="decimal"
                    className="form-control form-control-sm mush-input mush-dato py-1 px-2 text-center"
                    style={{ fontSize: "0.85rem" }}
                    placeholder="0"
                    value={gramosBorrador[s.id] ?? ""}
                    onChange={(e) => cambiarGramos(s.id, e.target.value)}
                    autoComplete="off"
                    spellCheck="false"
                  />
                </div>

                <div style={{ width: "330px", flexShrink: 0 }}>{tablaProporcional(s)}</div>
              </div>
            ))}
          </div>

          {/* Tablita de calculos al costado, para que no interfiera con la tabla */}
          {seccionActiva.conversor && (
            <div className="w-100" style={{ maxWidth: "300px", flexShrink: 0 }}>
              <ConversorUnidades ingredientes={ingredientes} />
            </div>
          )}
        </div>
      </div>

      {/* MODAL de componentes: desglosa una fila en varios y suma sus cantidades */}
      {itemComponentes && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.75)", zIndex: 1055 }}
          onClick={handleCerrarComponentes}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            style={{ maxWidth: "720px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content mush-card p-3 p-sm-4 rounded-4 shadow-lg border border-secondary border-opacity-25">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="text-white mb-0 fw-bold fs-6">
                  <i className="bi bi-list-ul text-dulce me-2"></i>
                  {itemComponentes.nombre}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={handleCerrarComponentes}
                  aria-label="Cerrar"
                ></button>
              </div>

              <div className="table-responsive mush-scroll-tabla" style={{ maxHeight: "320px" }}>
                <table className="table mush-tabla align-middle mb-0 text-nowrap">
                  <thead>
                    <tr>
                      <th style={{ width: "30%" }}>Componente</th>
                      <th style={{ width: "16%" }}>Cantidad</th>
                      <th style={{ width: "14%" }}>Unidad</th>
                      <th style={{ width: "30%" }}>Observaciones</th>
                      <th className="text-end" style={{ width: "10%" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {componentesBorrador.map((c, indice) => (
                      <tr key={indice}>
                        <td>
                          <input
                            type="text"
                            className="form-control form-control-sm mush-input py-1 px-2"
                            style={{ fontSize: "0.85rem" }}
                            placeholder="Componente"
                            value={c.componente}
                            onChange={(e) => cambiarComponente(indice, "componente", e.target.value)}
                            autoComplete="off"
                            spellCheck="false"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            inputMode="decimal"
                            className="form-control form-control-sm mush-input mush-dato py-1 px-2 text-center"
                            style={{ fontSize: "0.85rem" }}
                            placeholder="0"
                            value={c.cantidad}
                            onChange={(e) => cambiarComponente(indice, "cantidad", e.target.value)}
                            autoComplete="off"
                          />
                        </td>
                        <td>
                          <select
                            className="form-select form-select-sm mush-input py-1 px-2"
                            style={{ fontSize: "0.85rem" }}
                            value={c.unidad}
                            onChange={(e) => cambiarComponente(indice, "unidad", e.target.value)}
                          >
                            {UNIDADES_INGREDIENTE.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-control form-control-sm mush-input py-1 px-2"
                            style={{ fontSize: "0.85rem" }}
                            placeholder="Notas"
                            value={c.observaciones}
                            onChange={(e) =>
                              cambiarComponente(indice, "observaciones", e.target.value)
                            }
                            autoComplete="off"
                            spellCheck="false"
                          />
                        </td>
                        <td className="text-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger py-0 px-2 d-inline-flex align-items-center"
                            style={{ fontSize: "0.72rem", minHeight: "24px" }}
                            onClick={() => quitarComponente(indice)}
                            title="Quitar componente"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </td>
                      </tr>
                    ))}

                    {/* Total: es la cantidad que va a mostrar la tabla */}
                    <tr>
                      <td className="text-secondary fw-bold" style={{ fontSize: "0.8rem" }}>
                        Total
                      </td>
                      <td className="text-center">
                        <span className="text-white mush-dato fw-bold" style={{ fontSize: "0.85rem" }}>
                          {formatearCantidad(totalComponentes(componentesBorrador))}
                        </span>
                      </td>
                      <td>
                        <span
                          className="badge bg-secondary bg-opacity-25 text-white border border-secondary border-opacity-25 px-2 py-1"
                          style={{ fontSize: "0.72rem" }}
                        >
                          {itemComponentes.unidad || "gr"}
                        </span>
                      </td>
                      <td colSpan="2" className="text-secondary" style={{ fontSize: "0.78rem" }}>
                        Es la cantidad que se ve en la tabla
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="d-flex justify-content-between align-items-center gap-2 pt-3">
                <button
                  type="button"
                  className="btn-mush-outline"
                  style={{ fontSize: "0.82rem" }}
                  onClick={agregarComponente}
                >
                  Agregar Componente
                </button>

                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn-mush-ghost py-1 px-3"
                    style={{ fontSize: "0.82rem" }}
                    onClick={handleCerrarComponentes}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn-mush px-3 py-1"
                    style={{ fontSize: "0.82rem" }}
                    onClick={handleGuardarComponentes}
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL para Agregar / Editar */}
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
                    className={`bi ${itemEditando ? "bi-pencil-square" : "bi-plus-circle"} text-dulce me-2`}
                  ></i>
                  {itemEditando ? "Editar" : "Nuevo"} {seccionForm.columna}
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
                      {seccionForm.columna} <span className="text-danger">*</span>
                    </label>

                    {catalogoOrdenado.length > 0 ? (
                      <select
                        name="ingredienteSelect"
                        className={`form-select form-select-sm mush-input py-1 px-2 ${errorIngrediente ? "border-danger is-invalid" : ""}`}
                        style={{ fontSize: "0.85rem" }}
                        value={form.ingredienteId || ""}
                        onChange={handleChangeCatalogo}
                        autoFocus
                      >
                        <option value="">-- Seleccionar --</option>
                        {catalogoOrdenado.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.nombre} ({item.unidad || seccionForm.unidadPorDefecto})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        name="nombre"
                        className={`form-control form-control-sm mush-input py-1 px-2 ${errorIngrediente ? "border-danger is-invalid" : ""}`}
                        style={{ fontSize: "0.85rem" }}
                        placeholder={`Nombre del ${seccionForm.columna.toLowerCase()}`}
                        value={form.nombre}
                        onChange={handleChange}
                        autoComplete="off"
                        spellCheck="false"
                        autoFocus
                      />
                    )}

                    {errorIngrediente && (
                      <div
                        className="text-danger mt-1 fw-semibold d-flex align-items-center gap-1"
                        style={{ fontSize: "0.74rem" }}
                      >
                        <i className="bi bi-exclamation-circle-fill"></i> {errorIngrediente}
                      </div>
                    )}
                  </div>

                  <div className="col-4">
                    <label
                      className="form-label text-secondary fw-semibold mb-1"
                      style={{ fontSize: "0.78rem" }}
                    >
                      Un
                    </label>
                    <select
                      name="unidad"
                      className="form-select form-select-sm mush-input py-1 px-2"
                      style={{ fontSize: "0.85rem" }}
                      value={form.unidad}
                      onChange={handleChange}
                    >
                      {seccionForm.unidades.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-4">
                    <label
                      className="form-label text-secondary fw-semibold mb-1"
                      style={{ fontSize: "0.78rem" }}
                    >
                      Cantidad <span className="text-danger">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      name="cantidad"
                      className={`form-control form-control-sm mush-input py-1 px-2 ${errorCantidad ? "border-danger is-invalid" : ""}`}
                      style={{ fontSize: "0.85rem" }}
                      placeholder="0.00"
                      value={form.cantidad}
                      onChange={handleChange}
                      autoComplete="off"
                    />
                    {errorCantidad && (
                      <div
                        className="text-danger mt-1 fw-semibold d-flex align-items-center gap-1"
                        style={{ fontSize: "0.74rem" }}
                      >
                        <i className="bi bi-exclamation-circle-fill"></i> {errorCantidad}
                      </div>
                    )}
                  </div>

                  <div className="col-8">
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
                      placeholder="Notas (ej: para masa, relleno...)"
                      value={form.observaciones}
                      onChange={handleChange}
                      autoComplete="off"
                      spellCheck="false"
                    />
                  </div>
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
                    {itemEditando ? "Guardar Cambios" : "Guardar"}
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

export default RecetaDetalle;
