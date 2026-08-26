import { useState, useMemo, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useMush } from "../../context/MushContext";
import BuscadorFiltro from "../shared/BuscadorFiltro.jsx";
import ConversorUnidades from "../shared/ConversorUnidades.jsx";
import { moneda, fechaHoy, valorMensual, valorHora } from "../../utils/sueldos.js";
import { numero } from "../../utils/calculos.js";
import { variedadesDe, productoDeVariedad } from "../../data/productos.js";
import { PREPARACIONES } from "../../data/preparaciones.js";
import { unidadSingular } from "../../utils/costos.js";
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
    detalle: (receta) => rindeDeReceta(receta),
    // Se carga en la unidad que venga anotada, asi que lleva el conversor
    conversor: true,
    columna: "Ingrediente",
    catalogo: "ingredientes",
    unidades: UNIDADES_INGREDIENTE,
    unidadPorDefecto: "gr",
    textoBoton: "Nuevo Ingrediente",
    vacio: "No hay ingredientes cargados.",
  },
  {
    id: "unitario",
    emoji: "🥄",
    escala: "amplia",
    columnaGrid: "col-4",
    titulo: "Ingredientes",
    porUnidad: true,
    // Hay recetas que no llevan ingredientes por producto: el mendiant se arma
    // con la masa y nada mas. Poder declararlo distingue "no va nada aca" de
    // "falta cargarlo", que es lo que avisa Costos.
    etiquetaSinUso: "No utiliza ingredientes por producto",
    conversor: true,
    // Cada fila se puede desglosar en varios componentes; la cantidad que se ve
    // en la tabla es la suma de ellos.
    conComponentes: true,
    columna: "Ingrediente",
    catalogo: "ingredientes",
    unidades: UNIDADES_INGREDIENTE,
    unidadPorDefecto: "gr",
    textoBoton: "Nuevo Ingrediente",
    vacio: "No hay ingredientes cargados.",
  },
  {
    id: "packaging",
    emoji: "📦",
    escala: "amplia",
    columnaGrid: "col-4",
    titulo: "Packaging",
    porUnidad: true,
    etiquetaSinUso: "No utiliza packaging",
    columna: "Packaging",
    catalogo: "packaging",
    unidades: UNIDADES_PACKAGING,
    unidadPorDefecto: "un",
    textoBoton: "Nuevo Packaging",
    vacio: "No hay packaging cargado.",
  },
  // Las preparaciones de la casa (pasta, praline, bano de chocolate). No son
  // tarjetas propias: son tablas mas dentro de otra seccion, y solo en las
  // recetas que las lleven. Lo suyo (titulo y base) sale de data/preparaciones,
  // que es lo mismo que usa Costos para sus tablas de calculo.
  ...PREPARACIONES.map((preparacion) => ({
    dentroDe: "unitario",
    columna: "Ingrediente",
    catalogo: "ingredientes",
    unidades: UNIDADES_INGREDIENTE,
    unidadPorDefecto: "gr",
    textoBoton: "Nuevo Ingrediente",
    vacio: "No hay ingredientes cargados.",
    ...preparacion,
  })),
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

// El detalle del titulo de una seccion sale del mismo numero con el que esta
// escrita, para no anotarlo dos veces.
SECCIONES.forEach((s) => {
  if (s.detalle) return;
  if (s.gramosBase) s.detalle = () => `${s.gramosBase} gr`;
  if (s.alfajoresBase) s.detalle = (receta) => `${s.alfajoresBase} ${unidadPlural(receta)}`;
});

// Las secciones "por unidad" cierran su titulo con "por producto".
//
// Antes cerraban con la unidad de cada receta ("por alfajor", "por lata"), y
// entonces la misma tarjeta se llamaba distinto segun donde se la abriera. Se
// dice "producto" para que todas las recetas muestren lo mismo.
const tituloDeSeccion = (seccion) =>
  seccion.porUnidad ? `${seccion.titulo} por producto` : seccion.titulo;

const conMayuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

// Plural de la unidad del rinde: "lata" -> "latas", "alfajores" -> "alfajores".
const unidadPlural = (receta) => {
  const unidad = receta?.unidadRinde || "alfajores";
  return unidad.endsWith("s") ? unidad : `${unidad}s`;
};

const etiquetaProducidos = (receta) =>
  (receta?.unidadRinde || "alfajores") === "alfajores"
    ? "Alfajores producidos"
    : `${conMayuscula(unidadPlural(receta))} por hora`;

const etiquetaCostoMO = (receta) => `Costo M.O por ${unidadSingular(receta)}`;

// El rinde se expresa en la unidad de la receta: casi siempre alfajores, pero
// el mendiant, por ejemplo, rinde una lata.
const rindeDeReceta = (receta) => {
  const cantidad = Number(receta?.rinde) || 0;
  // Una receta sin rinde no rinde 60: no se sabe. Decirlo es lo unico honesto,
  // porque de ese numero sale el costo de cada unidad.
  if (!cantidad) return "sin rinde cargado";
  const unidad = receta?.unidadRinde || "alfajores";
  const enPlural = cantidad === 1 || unidad.endsWith("s") ? unidad : `${unidad}s`;
  return `${cantidad} ${enPlural}`;
};

// El ancho del bloque lo comparten el titulo y la grilla, para que no se desfasen.
const ANCHO_BLOQUE = "820px";

// Las dos escalas de tarjeta de la guia de estilos.
const ESCALAS = {
  amplia: { alto: "190px", padding: "p-3 p-sm-4", emoji: "fs-1 mb-3", texto: "1rem" },
  densa: { alto: "135px", padding: "p-2 p-sm-3", emoji: "fs-2 mb-2", texto: "0.8rem" },
};

/**
 * Si dos referencias son la misma fila de la receta.
 *
 * No alcanza con comparar los objetos: cada vez que el backend contesta un
 * guardado, el estado se rearma con las filas que devuelve, que son objetos
 * nuevos. Una referencia guardada de antes (la fila que se esta editando, o la
 * que abrio el modal de componentes) deja de ser identica a la del estado, y la
 * modificacion se perdia sin avisar. El id sobrevive a ese viaje.
 */
const mismaFila = (a, b) => {
  if (!a || !b) return false;
  return a.id && b.id ? a.id === b.id : a === b;
};

// Lo que ya estaba cargado (sin "seccion") pertenece a la masa.
const SECCION_POR_DEFECTO = "masa";
const buscarSeccion = (id) => SECCIONES.find((s) => s.id === id) || SECCIONES[0];

// Las secciones propias de una receta se declaran con "soloEn"; el resto las
// tienen todas.
const esDeLaReceta = (seccion, receta) => {
  const slug = normalizar(receta?.slug || receta?.id);
  // Cada receta declara en su dato que tarjetas no lleva (una tableta no tiene
  // ingredientes por unidad).
  if (receta?.sinSecciones?.includes(seccion.id)) return false;
  return !seccion.soloEn || seccion.soloEn.some((s) => normalizar(s) === slug);
};

/**
 * Las tarjetas de la portada: las que llevan "dentroDe" no son tarjetas, se
 * dibujan como una tabla mas dentro de su seccion.
 *
 * Son las mismas en todas las recetas. Una que no aplique -el mendiant no lleva
 * ingredientes por producto- queda vacia, que se lee mejor que una grilla
 * distinta en cada receta: si falta una tarjeta no se sabe si es que no
 * corresponde o si es que no se cargo.
 */
const seccionesDeReceta = () => SECCIONES.filter((s) => !s.dentroDe);

const subSeccionesDe = (seccion, receta) =>
  SECCIONES.filter((s) => s.dentroDe === seccion?.id && esDeLaReceta(s, receta));

// Una tarjeta que queda sola en la ultima fila se centra en vez de quedar
// pegada a la izquierda.
const claseColumna = (seccion, indice, total) =>
  indice === total - 1 && indice % 3 === 0 ? `${seccion.columnaGrid} offset-4` : seccion.columnaGrid;

// Texto plano del titulo, con el detalle entre parentesis si lo tiene.
const tituloCompleto = (seccion, receta) =>
  seccion.detalle
    ? `${tituloDeSeccion(seccion)} (${seccion.detalle(receta)})`
    : tituloDeSeccion(seccion);

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
      rinde: 0,
      observaciones: "",
      ingredientes: [],
    };
  }, [recetas, slugActual]);

  const seccionesVisibles = useMemo(() => seccionesDeReceta(), []);

  // Un producto puede agrupar variedades (las tabletas): en ese caso al abrirlo
  // se ven esas tarjetas y no las secciones. Y una variedad vuelve a su
  // producto, no al listado general.
  const variedades = variedadesDe(slugActual);
  const anchoPortada = variedades.length > 0 ? "1100px" : ANCHO_BLOQUE;
  const productoPadre = productoDeVariedad(slugActual);
  const volverA = productoPadre ? `/recetas/${productoPadre}` : "/recetas";

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

  // Las recetas que se miden por hora (el mendiant, en latas por hora) usan el
  // valor hora del legajo asignado; las demas, su sueldo mensual. El valor hora
  // baja del mismo mensual: mensual -> semanal -> jornal -> hora.
  const porHora = (receta.unidadRinde || "alfajores") !== "alfajores";
  const pagoMO = porHora ? (personaMO ? valorHora(personaMO) : 0) : mensualMO;

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

  const normalizarProducidos = (valor) => {
    const numero = parseFloat(String(valor).replace(",", ".")) || 0;
    const factor = porHora ? 10 : 1;
    return Math.max(0, Math.round(numero * factor) / factor);
  };

  const cambiarProducidos = (delta) => {
    const actual = Number(moBorrador.alfajoresProducidos) || 0;
    const nuevo = normalizarProducidos(actual + delta);
    if (nuevo === actual) return;
    guardarManoDeObra({ alfajoresProducidos: nuevo });
  };

  const costoManoObra = (() => {
    const producidos = Number(moBorrador.alfajoresProducidos) || 0;
    if (producidos <= 0) return 0;
    // Por hora: valor hora / unidades por hora. Por mes: sueldo / produccion.
    return pagoMO / producidos;
  })();

  // Lo cargado en esta pantalla. Sirve para no ofrecer borrar lo que no existe.
  const hayManoDeObraCargada =
    Boolean(moBorrador.fecha) ||
    Boolean(moBorrador.personalId) ||
    Number(moBorrador.mensual) > 0 ||
    Number(moBorrador.alfajoresProducidos) > 0 ||
    Boolean((moBorrador.observaciones || "").trim());

  // Empezar de cero: la mano de obra queda sin cargar, como recien dada de alta.
  // No es borrar una fila -aca no hay filas, hay un unico valor por receta-, asi
  // que se avisa que el costo cambia: sin produccion anotada deja de sumar, y en
  // Costos su caja pasa a decir "sin completar en la receta".
  const borrarManoDeObra = () => {
    Swal.fire({
      ...swalConfig,
      title: "¿Borrar los valores?",
      text: "La mano de obra de esta receta queda sin cargar y deja de sumar al costo.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Si, borrar",
      cancelButtonText: "Cancelar",
      customClass: {
        popup: "rounded-4 border border-secondary border-opacity-25 shadow-lg",
        confirmButton: "btn btn-danger px-3 py-1 rounded-3 me-2 fw-bold",
        cancelButton: "btn btn-outline-secondary px-3 py-1 rounded-3 text-dark",
      },
    }).then((result) => {
      if (!result.isConfirmed) return;

      setMoBorrador({
        fecha: "",
        personalId: "",
        mensual: "",
        alfajoresProducidos: "",
        observaciones: "",
      });
      guardarReceta({ ...receta, manoDeObra: {} });

      // La pantalla queda vacia igual que si nunca se hubiera cargado, asi que
      // el aviso es lo que confirma que se borro y no que se perdio.
      Swal.fire({
        ...swalConfig,
        title: "Se han borrado los valores de mano de obra",
        icon: "success",
        timer: 1600,
        showConfirmButton: false,
      });
    });
  };

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
      // La unidad del alta es la de compra (casi siempre kg) y la receta se
      // escribe en gramos, asi que no se pisa. En packaging si conviene traerla
      // ("rollo", "caja"), que ahi es la misma con la que se usa.
      unidad:
        seccionForm.catalogo === "packaging" && encontrado?.unidad
          ? encontrado.unidad
          : prev.unidad,
    }));

    if (errorIngrediente) setErrorIngrediente("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === "nombre" && errorIngrediente) setErrorIngrediente("");
    if (name === "cantidad" && errorCantidad) setErrorCantidad("");
  };

  // Lo que la receta declara que no lleva. Vive en la receta, no en el codigo:
  // dos recetas de la misma categoria pueden diferir.
  const sinUso = receta.sinSecciones || [];

  const declaraSinUso = (seccion) => sinUso.includes(seccion.id);

  // Una tabla vacia no dice lo mismo si esta declarada sin uso: ahi no falta
  // nada. Se dice en el lugar donde se lo va a leer, que es el cuerpo.
  const textoVacioDe = (seccion) =>
    declaraSinUso(seccion) ? seccion.etiquetaSinUso : seccion.vacio;

  /**
   * Guarda que esta seccion no va en esta receta.
   *
   * Es un guardado parcial: se manda solo esta lista, asi que no toca los
   * ingredientes ni la mano de obra.
   */
  const cambiarUso = (seccion, usa) => {
    const proxima = usa
      ? sinUso.filter((id) => id !== seccion.id)
      : [...new Set([...sinUso, seccion.id])];

    if (proxima.length === sinUso.length && usa) return;
    guardarReceta({ id: receta.id, slug: receta.slug, sinSecciones: proxima });
  };

  const handleAbrirNuevo = (seccion) => {
    const s = seccion || seccionActiva || SECCIONES[0];
    // Cargar algo aca es decir que la seccion si va: se vuelve atras sola.
    if (declaraSinUso(s)) cambiarUso(s, true);
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

      const indiceMO = itemEditando ? lista.findIndex((x) => mismaFila(x, itemEditando)) : -1;
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
        !mismaFila(item, itemEditando) &&
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

    const indice = itemEditando ? lista.findIndex((x) => mismaFila(x, itemEditando)) : -1;
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

      const lista = (receta.ingredientes || []).filter((x) => !mismaFila(x, item));
      guardarReceta({ ...receta, ingredientes: lista });

      if (mismaFila(itemEditando, item)) handleCerrarModal();
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

    // El total que pasa a ser la cantidad de la fila se redondea a dos
    // decimales: es lo mismo que se ve en la tabla.
    const total = Math.round(totalComponentes(componentes) * 100) / 100;
    const lista = (receta.ingredientes || []).map((x) =>
      mismaFila(x, itemComponentes)
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
    // La tabla de la izquierda esta escrita para una base: los gramos de
    // referencia de la seccion (740 gr la pasta, 240 gr el praline) o los
    // alfajores que salen de esa tanda (20 el bano de chocolate blanco).
    const porAlfajores = Number(seccion.alfajoresBase) || 0;
    const base = porAlfajores || Number(seccion.gramosBase) || 0;
    // Escrita por alfajor no hay objetivo que elegir: es siempre uno.
    const objetivo = porAlfajores ? 1 : Number(gramosBorrador[seccion.id]) || 0;
    const factor = base > 0 && objetivo > 0 ? objetivo / base : null;
    const detalle = porAlfajores
      ? `1 ${unidadSingular(receta)}`
      : objetivo > 0
        ? `${numero(objetivo)} gr`
        : "— gr";

    return (
      <div className="mush-card mush-card-anidada p-3">
        <h5 className="text-white fw-bold mb-3" style={{ fontSize: "0.9rem" }}>
          {seccion.titulo}
          <span className="text-secondary fw-normal ms-2" style={{ fontSize: "0.8rem" }}>
            ({detalle})
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
                    {textoVacioDe(seccion)}
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
                        {factor ? numero((Number(item.cantidad) || 0) * factor) : "—"}
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
            {/* Declarar que no va nada aca. Se vuelve atras con el boton de al
                lado: cargar una linea es decir que si va. */}
            {seccion.etiquetaSinUso &&
              (declaraSinUso(seccion) ? (
                <span
                  className="mush-badge mush-badge-alerta d-inline-flex text-nowrap"
                  title="Se vuelve atras cargando una linea"
                >
                  <i className="bi bi-slash-circle"></i>
                  {seccion.etiquetaSinUso}
                </span>
              ) : (
                <button
                  type="button"
                  className="btn-mush-ghost text-nowrap"
                  style={{ fontSize: "0.78rem" }}
                  onClick={() => cambiarUso(seccion, false)}
                  title="En Costos deja de figurar como un dato que falta"
                >
                  {seccion.etiquetaSinUso}
                </button>
              ))}
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
                    {busqueda ? "Sin resultados para la busqueda." : textoVacioDe(seccion)}
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
                      <span className="text-white fw-bold small">{numero(item.cantidad)}</span>
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
        <div className="mx-auto w-100 position-relative mb-4" style={{ maxWidth: anchoPortada }}>
          <Link
            to={volverA}
            className="btn btn-sm btn-outline-secondary py-1 px-2 text-white d-inline-flex align-items-center gap-1 rounded-3 position-absolute start-0 top-50 translate-middle-y"
            title="Volver"
          >
            <i className="bi bi-arrow-left"></i>
          </Link>
          <h2 className="mush-display text-white text-center mb-0">{receta.nombre}</h2>
        </div>


        {/* Tarjetas centradas en el espacio que queda.
            Mismo ancho y grilla que el listado de productos (Recetas.jsx) */}
        <div
          className="mx-auto w-100 d-flex flex-column justify-content-center flex-grow-1"
          style={{ maxWidth: anchoPortada }}
        >
          {/* Un producto con variedades muestra esas tarjetas: cada una es una
              receta con sus propias secciones. */}
          {variedades.length > 0 ? (
            <div className="row row-cols-2 row-cols-sm-3 row-cols-lg-5 g-2 g-sm-3">
              {variedades.map((v) => (
                <div className="col" key={v.slug}>
                  <Link
                    to={`/recetas/${v.slug}`}
                    className={`mush-card mush-card-hover text-decoration-none ${ESCALAS.densa.padding} d-flex flex-column align-items-center justify-content-center text-center border border-secondary border-opacity-25 rounded-4 w-100 shadow-sm`}
                    style={{ minHeight: ESCALAS.densa.alto, height: "100%" }}
                    title={v.nombre}
                  >
                    <span className={ESCALAS.densa.emoji}>{v.imagen}</span>
                    <strong
                      className="text-white fw-bold w-100 lh-sm"
                      style={{ fontSize: ESCALAS.densa.texto }}
                    >
                      {v.nombre}
                    </strong>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
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
                    {tituloDeSeccion(s)}
                    {s.detalle && <span className="fw-normal"> ({s.detalle(receta)})</span>}
                    {/* La tarjeta dice que esta declarada sin uso: si no, se
                        entra a una tabla vacia sin saber si falta cargarla. */}
                    {declaraSinUso(s) && (
                      <span
                        className="d-block fw-normal text-secondary mt-1"
                        style={{ fontSize: "0.68rem" }}
                      >
                        no utiliza
                      </span>
                    )}
                  </strong>
                </Link>
              </div>
            ))}
          </div>
          )}
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
        etiqueta: porHora ? "Hora" : "Mensual",
        crecer: 1.2,
        // Sale del legajo elegido en Personal, no se escribe a mano.
        contenido: (
          <div
            className="form-control form-control-sm mush-input py-1 px-2 text-center fw-bold mush-dato d-flex align-items-center justify-content-center"
            style={{ fontSize: "0.85rem" }}
          >
            {moneda(pagoMO, porHora ? 2 : 0)}
          </div>
        ),
      },
      {
        etiqueta: etiquetaProducidos(receta),
        crecer: 1.6,
        contenido: (
          <div className="d-flex align-items-center justify-content-center gap-1">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary text-white px-2 d-flex align-items-center"
              style={{ height: "31px" }}
              onClick={() => cambiarProducidos(porHora ? -0.5 : -1)}
              disabled={(Number(moBorrador.alfajoresProducidos) || 0) <= 0}
              title="Bajar"
            >
              −
            </button>
            <input
              type="number"
              min="0"
              step={porHora ? "0.1" : "1"}
              className="form-control form-control-sm mush-input mush-sin-spinner py-1 px-1 text-center fw-bold"
              style={{ width: "72px", fontSize: "0.85rem" }}
              value={moBorrador.alfajoresProducidos}
              onChange={(e) =>
                setMoBorrador((prev) => ({ ...prev, alfajoresProducidos: e.target.value }))
              }
              onBlur={() =>
                guardarManoDeObra({
                  alfajoresProducidos: normalizarProducidos(moBorrador.alfajoresProducidos),
                })
              }
            />
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary text-white px-2 d-flex align-items-center"
              style={{ height: "31px" }}
              onClick={() => cambiarProducidos(porHora ? 0.5 : 1)}
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
        etiqueta: etiquetaCostoMO(receta),
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
            <h2 className="mush-display text-white mb-0">
              {tituloDeSeccion(seccionActiva)}
            </h2>
            <span className="mush-display text-secondary fs-2">-</span>
            <span className="mush-display text-dulce fs-2">{receta.nombre}</span>
          </div>
        </div>

        {/* La tarjeta se centra en el alto restante */}
        <div
          className="mx-auto w-100 d-flex flex-column justify-content-center flex-grow-1"
          style={{ maxWidth: "1040px" }}
        >
          {/* Justo arriba de la tarjeta y contra su borde derecho: es lo que
              borra, asi que se lee junto con ella y no con el titulo. */}
          <div className="d-flex justify-content-end mb-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-danger py-1 px-3 d-inline-flex align-items-center gap-2 rounded-3"
              onClick={borrarManoDeObra}
              disabled={!hayManoDeObraCargada}
              title={
                hayManoDeObraCargada
                  ? "Dejar la mano de obra de esta receta sin cargar"
                  : "No hay valores cargados"
              }
            >
              <i className="bi bi-eraser"></i> Borrar valores
            </button>
          </div>

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
              {tituloDeSeccion(seccionActiva)}
              {/* Cuanto rinde una tanda se carga en el alta del producto, que es
                  donde se decide que se vende. Aca es un dato, no un campo. */}
              {seccionActiva.detalle && (
                <span
                  className="text-secondary fw-normal ms-2 text-lowercase"
                  style={{ fontSize: "1rem" }}
                >
                  ({seccionActiva.detalle(receta)})
                </span>
              )}
            </h2>
            <span className="mush-display text-secondary fs-2">-</span>
            <span className="mush-display text-dulce fs-2">{receta.nombre}</span>
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
                {/* La caja de gramos es para las tablas escritas en gramos: la
                    que esta escrita por tanda de alfajores no elige objetivo. */}
                {s.gramosBase ? (
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
                ) : null}

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
                          {numero(totalComponentes(componentesBorrador))}
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
