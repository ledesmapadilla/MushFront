import { useState, useEffect, useRef } from "react";
import BotonExcel from "../shared/BotonExcel.jsx";
import { useMush } from "../../context/MushContext";
import { PRODUCTO, SUBPRODUCTO, esSubproducto, tipoDe } from "../../data/productos";
import { unidadSingular } from "../../utils/costos";
import BuscadorFiltro from "../shared/BuscadorFiltro.jsx";
import Swal from "sweetalert2";

/**
 * El encabezado bajo el que van las cajas que llevan mas de un producto.
 *
 * No es un producto ni existe en los datos: un producto es lo que se hace con
 * una receta, y una mezcla no se hace, se arma con varios. Es solo el titulo
 * que las junta, para que no parezcan colgando del ultimo producto de la lista.
 */
const GRUPO_MEZCLA = "Alfajores combinados";

// El valor que toma "de que producto es" cuando la respuesta es que no es de
// ninguno. No se guarda: lo que se guarda es lo que la caja lleva adentro.
const MEZCLA = "__mezcla__";

/**
 * La categoria de un producto contesta una sola pregunta: en que se cuenta lo
 * que rinde una tanda. De eso sale si la mano de obra se paga por hora o
 * repartiendo el sueldo del mes, asi que elegir mal cambia el costo.
 *
 * Ya no esta "Mendiant": era el nombre de un producto, no de una familia, y
 * hacia lo mismo que "Lata". No la usaba ninguno.
 */
const CATEGORIAS_PRODUCTO = ["Alfajor", "Mini", "Tableta", "Lata", "Doy Pack"];

/**
 * La de un subproducto es solo una etiqueta: no toca ningun numero, porque un
 * subproducto no tiene receta ni rinde. Sirve para reconocerlo en las listas y
 * para buscarlo.
 */
const CATEGORIAS_SUBPRODUCTO = ["Caja", "Pack"];

const categoriasDe = (tipo) =>
  tipo === SUBPRODUCTO ? CATEGORIAS_SUBPRODUCTO : CATEGORIAS_PRODUCTO;

const FORM_INICIAL = {
  id: "",
  // "producto" o "subproducto".
  tipo: PRODUCTO,
  nombre: "",
  categoria: "Alfajor",
  observaciones: "",
  emoji: "",
  // Solo el producto: su receta. No se elige -se crea con el-, pero al editar
  // uno que ya existe hay que conservar la que tiene.
  receta: "",
  // La que tenia al abrirse, para no perderla si se pasa a subproducto y se
  // vuelve.
  recetaOriginal: "",
  // Para cuantas unidades es una tanda de masa. Vive en la receta, pero se
  // carga y se corrige aca.
  rinde: "",
  // En que se cuenta ese rinde. De una receta que ya existe sale de ella, no de
  // la categoria: cambiar la categoria no le mueve la unidad a una receta
  // cargada.
  unidadRindeActual: "",
  // Solo el subproducto: de que producto es (un producto, o MEZCLA), que lleva
  // adentro y en que caja de carton va. "padre" es del formulario nada mas: lo
  // que se guarda es "lleva", y de ahi se vuelve a deducir.
  padre: "",
  lleva: [],
  carton: "",
  activo: true,
};

const LINEA_VACIA = { producto: "", cantidad: "" };

/**
 * En que se cuenta el rinde de una receta, segun la categoria del producto.
 *
 * Casi todo se cuenta en alfajores, pero una tableta rinde tabletas y el
 * mendiant una lata. No es un detalle de texto: la mano de obra de lo que no se
 * cuenta en alfajores se paga por hora y no por sueldo mensual.
 */
const UNIDAD_DE_RINDE = { Tableta: "tableta", Lata: "lata" };

const unidadDeRinde = (categoria) => UNIDAD_DE_RINDE[categoria] || "alfajores";

const enPlural = (unidad) => (unidad.endsWith("s") ? unidad : `${unidad}s`);

const unidadDeRindeEnPlural = (categoria) => enPlural(unidadDeRinde(categoria));

// Un texto sin mayusculas ni tildes, para buscar: escribir "clasico" tiene que
// encontrar "Alfajor Clásico Semiamargo".
const sinTildes = (txt) =>
  String(txt || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

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

  // Lo unico que se elige de otra lista: la caja de carton del packaging.
  const cartones = (packaging || []).filter((item) => /caja/i.test(item.nombre || ""));

  const recetaDe = (slug) => (recetas || []).find((r) => r.slug === slug || r.id === slug);

  const nombreDeReceta = (slug) => recetaDe(slug)?.nombre || slug;

  /**
   * En que se vende un producto: casi siempre por alfajor, pero el mendiant se
   * vende por lata y las tabletas por tableta. Sale de la unidad del rinde de
   * su receta, que es la misma con la que se lo costea.
   */
  const seVendePor = (item) => `Por ${unidadSingular(recetaDe(item.receta))}`;

  const [form, setForm] = useState(FORM_INICIAL);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [errorNombre, setErrorNombre] = useState("");
  // Lo mismo con el nombre de un subproducto, que se arma solo con el producto
  // que lleva y cuantos: se deja de armar en cuanto se escribe encima.
  const [nombreAMano, setNombreAMano] = useState(false);

  /**
   * La fila que se acaba de guardar: se la lleva a la vista y se la pinta un
   * momento.
   *
   * La lista tiene su propio scroll y esta agrupada por familia, asi que un
   * producto nuevo no aparece al final sino en el medio, donde le toque: sin
   * esto hay que salir a buscarlo a mano.
   */
  const [recienGuardado, setRecienGuardado] = useState("");
  const filas = useRef({});

  useEffect(() => {
    if (!recienGuardado) return;

    // Espera al repintado, porque la fila todavia no existe cuando se guarda.
    const id = requestAnimationFrame(() => {
      filas.current[recienGuardado]?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
    const apagar = setTimeout(() => setRecienGuardado(""), 2600);

    return () => {
      cancelAnimationFrame(id);
      clearTimeout(apagar);
    };
  }, [recienGuardado]);

  // Un subproducto se arma con productos, asi que solo esos se pueden elegir:
  // una caja de 6 no lleva otra caja de 6 adentro.
  const productosBase = (alfajores || [])
    .filter((item) => !esSubproducto(item) && item.activo !== false)
    .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es", { sensitivity: "base" }));

  const nombreDeProducto = (id) =>
    (alfajores || []).find((item) => item.id === id)?.nombre || "";

  /**
   * Las categorias que se pueden elegir.
   *
   * Si lo cargado tiene una que ya no esta en la lista -el Pack Sabores, que es
   * un producto de categoria "Pack"- se agrega igual, para que abrirlo a
   * editarlo no se la cambie sin querer.
   */
  const categoriasVisibles = (() => {
    const validas = categoriasDe(form.tipo);
    return !form.categoria || validas.includes(form.categoria)
      ? validas
      : [...validas, form.categoria];
  })();

  // Un subproducto de un producto lleva ese producto y nada mas: en vez de una
  // lista alcanza con decir cuantos entran.
  const esDeUnProducto = Boolean(form.padre) && form.padre !== MEZCLA;

  // Una linea sin producto elegido esta a medio cargar: no cuenta.
  const lineasValidas = (lista) =>
    (lista || []).filter((c) => c.producto && Number(c.cantidad) > 0);

  // Cuantas unidades tiene el subproducto: la suma de lo que lleva. No se
  // escribe a mano, porque seria el mismo numero anotado dos veces.
  const unidadesDe = (lista) =>
    lineasValidas(lista).reduce((suma, c) => suma + Number(c.cantidad), 0);

  const cambiarLinea = (indice, campo, valor) =>
    setForm((prev) => {
      const lleva = prev.lleva.map((c, i) => (i === indice ? { ...c, [campo]: valor } : c));
      return { ...prev, lleva, nombre: nombreDeSubproducto(prev, lleva) };
    });

  const agregarLinea = () =>
    setForm((prev) => ({ ...prev, lleva: [...prev.lleva, { ...LINEA_VACIA }] }));

  const quitarLinea = (indice) =>
    setForm((prev) => {
      const lleva = prev.lleva.filter((_, i) => i !== indice);
      return { ...prev, lleva, nombre: nombreDeSubproducto(prev, lleva) };
    });

  /**
   * El nombre que le corresponde a un subproducto: "Clasico Semiamargo
   * (CAJA x 6)". Sale del producto que lleva y de cuantos, asi que todos se
   * llaman igual y no conviven "Clasico semiamargo (CAJA x 6)" con
   * "Clasico Blanco (CAJA x 6)", con distinta mayuscula.
   *
   * Un surtido lleva varios productos y no hay nombre que se pueda deducir de
   * ahi: devuelve vacio y manda lo que se escriba.
   */
  const nombrePropuesto = (lleva) => {
    const lineas = lineasValidas(lleva);
    if (lineas.length !== 1) return "";
    return `${nombreDeProducto(lineas[0].producto)} (CAJA x ${Number(lineas[0].cantidad)})`;
  };

  // Si el nombre se escribio a mano, se respeta.
  const nombreDeSubproducto = (estado, lleva) =>
    nombreAMano ? estado.nombre : nombrePropuesto(lleva) || estado.nombre;

  /**
   * Un producto que todavia no tiene receta: la va a crear al guardarse.
   *
   * Es el caso normal, porque un producto se hace con una receta y esa receta
   * es la suya: no hay nada que elegir. Solo tiene una ya puesta el que se esta
   * editando, y uno viejo al que nunca se le cargo (el Pack Sabores).
   */
  const necesitaReceta = form.tipo === PRODUCTO && !form.receta;

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

      // Al elegir de que producto es, lo que lleva se arma solo: si es de uno,
      // una linea con ese producto; si es una mezcla, la lista para cargarla.
      if (name === "padre") {
        if (!value) {
          proximo.lleva = [];
        } else if (value === MEZCLA) {
          // Una mezcla lleva mas de uno: arranca con dos lineas.
          proximo.lleva =
            prev.lleva.length > 1 ? prev.lleva : [{ ...LINEA_VACIA }, { ...LINEA_VACIA }];
        } else {
          proximo.lleva = [{ producto: value, cantidad: prev.lleva[0]?.cantidad || "" }];
        }
        proximo.nombre = nombreDeSubproducto(prev, proximo.lleva);
      }

      // Al cambiar de tipo se limpia lo que era del otro: son dos altas
      // distintas, y arrastrar los campos de la anterior deja datos sueltos.
      if (name === "tipo" && value !== prev.tipo) {
        if (value === SUBPRODUCTO) {
          proximo.receta = "";
          proximo.rinde = "";
          // Lo que lleva se arma al elegir de que producto es.
          proximo.padre = "";
          proximo.lleva = [];
        } else {
          proximo.padre = "";
          proximo.lleva = [];
          proximo.carton = "";
          // Al volver a producto se recupera la receta que ya tenia: ir y venir
          // entre los dos tipos no le crea una segunda.
          proximo.receta = prev.recetaOriginal;
        }

        // Las categorias de un tipo no valen para el otro: si la que estaba
        // elegida no existe en el nuevo, se toma la primera.
        const validas = categoriasDe(value);
        if (!validas.includes(proximo.categoria)) proximo.categoria = validas[0];
      }

      return proximo;
    });

    // El nombre escrito a mano manda sobre el propuesto.
    if (name === "nombre") {
      setNombreAMano(Boolean(value.trim()));
      setErrorNombre("");
    }
  };

  const handleAbrirNuevo = () => {
    setForm(FORM_INICIAL);
    setModoEdicion(false);
    setErrorNombre("");
    setNombreAMano(false);
    setMostrarModal(true);
  };

  /**
   * Lo que lleva un subproducto, para el formulario.
   *
   * Las cajas cargadas antes de los tipos lo decian de dos maneras distintas:
   * un surtido, con su composicion anotada por receta; y una caja comun, sin
   * composicion, solo con su receta y cuantas unidades entraban. Las dos se
   * leen aca y salen iguales: una lista de productos con su cantidad.
   */
  const llevaDe = (item) => {
    const productoDeReceta = (receta) =>
      (alfajores || []).find((p) => !esSubproducto(p) && p.receta === receta)?.id || "";

    if ((item.composicion || []).length > 0) {
      return item.composicion.map((c) => ({
        producto: c.producto || productoDeReceta(c.receta),
        cantidad: c.cantidad !== undefined ? String(c.cantidad) : "",
      }));
    }

    if (item.receta && Number(item.unidades) > 0) {
      return [{ producto: productoDeReceta(item.receta), cantidad: String(item.unidades) }];
    }

    return [{ ...LINEA_VACIA }];
  };

  const handleEditar = (item) => {
    const tipo = tipoDe(item);
    // El rinde es de la receta, pero se corrige desde aca sin tener que ir
    // hasta la tarjeta Masa.
    const suReceta =
      tipo === PRODUCTO && item.receta
        ? (recetas || []).find((r) => r.slug === item.receta || r.id === item.receta)
        : null;
    const lleva = tipo === SUBPRODUCTO ? llevaDe(item) : [];

    // De que producto es no se guarda: se vuelve a deducir de lo que lleva.
    // Un solo producto adentro, por repetido que este, es de ese producto;
    // varios distintos son una mezcla; ninguno es una caja a medio cargar.
    const cargadas = lineasValidas(lleva);
    const distintos = [...new Set(cargadas.map((l) => l.producto))];
    const padre =
      tipo !== SUBPRODUCTO || distintos.length === 0
        ? ""
        : distintos.length === 1
          ? distintos[0]
          : MEZCLA;

    // De un solo producto se muestra una linea sola, asi que si venian varias
    // del mismo se suman: colapsarlas quedandose con la primera perderia el
    // resto al guardar.
    const llevaDelFormulario =
      padre && padre !== MEZCLA
        ? [
            {
              producto: padre,
              cantidad: String(cargadas.reduce((suma, l) => suma + Number(l.cantidad), 0)),
            },
          ]
        : lleva;

    // El nombre de un subproducto lo propone la pantalla: si se le cambia la
    // cantidad, acompana, en vez de quedar diciendo "(CAJA x 6)" cuando ahora
    // entran 8. Deja de proponerlo en cuanto se escriba encima.
    //
    // Una mezcla no se toca: como lleva varios productos no hay nombre que
    // deducir, y nombrePropuesto devuelve vacio para ella.
    setNombreAMano(tipo === PRODUCTO);

    setForm({
      ...FORM_INICIAL,
      id: item.id,
      tipo,
      nombre: item.nombre || "",
      categoria: item.categoria || "Alfajor",
      observaciones: item.observaciones || "",
      emoji: item.emoji || "",
      receta: tipo === PRODUCTO ? item.receta || "" : "",
      recetaOriginal: tipo === PRODUCTO ? item.receta || "" : "",
      rinde: Number(suReceta?.rinde) > 0 ? String(suReceta.rinde) : "",
      unidadRindeActual: suReceta?.unidadRinde || "",
      padre,
      lleva: llevaDelFormulario,
      carton: item.carton || "",
      activo: item.activo !== false,
    });
    setModoEdicion(true);
    setErrorNombre("");
    setMostrarModal(true);
  };

  const handleCerrarModal = () => {
    setForm(FORM_INICIAL);
    setModoEdicion(false);
    setErrorNombre("");
    setNombreAMano(false);
    setMostrarModal(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorNombre("");

    const esSub = form.tipo === SUBPRODUCTO;
    const lineas = lineasValidas(form.lleva);

    // Un subproducto sin contenido no tiene costo ni nombre: se pregunta antes
    // que nada, porque el nombre sale justamente de lo que lleva.
    if (esSub && lineas.length === 0) {
      setErrorNombre(
        form.padre === MEZCLA
          ? "Falta decir que lleva la mezcla, y cuantos de cada uno."
          : form.padre
            ? "Falta decir cuantos entran por caja."
            : "Falta decir de que producto es."
      );
      return;
    }

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

    // Sin el rinde no se puede costear nada: los ingredientes de la masa se
    // anotan por tanda y se dividen por este numero. Vale para cualquier
    // producto, no solo para el que estrena receta: es el unico lugar donde se
    // carga, asi que si no se pide aca no se pide en ningun lado.
    if (!esSub && !(Number(form.rinde) > 0)) {
      setErrorNombre(
        `Falta decir para cuantos ${unidadDeRindeEnPlural(form.categoria)} es la masa.`
      );
      return;
    }

    // La caja de carton no es obligatoria -hay cosas que se venden sin ella-,
    // pero olvidarsela es facil y el costo sale mal sin ruido: la caja es lo
    // unico que un subproducto suma por su cuenta. Se pregunta, no se impide.
    if (esSub && !form.carton) {
      const respuesta = await Swal.fire({
        ...swalConfig,
        title: "¿Sin caja de cartón?",
        text: `"${nombreLimpio}" no tiene ninguna elegida, así que su costo va a ser solamente el de lo que lleva adentro.`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Guardar así",
        cancelButtonText: "Volver y elegirla",
        reverseButtons: true,
      });

      if (!respuesta.isConfirmed) return;
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

    // Un producto trae su receta, vacia: queda su tarjeta en Recetas y en
    // Costos para ir a llenarla. Un subproducto no crea recetas: no se hace,
    // se arma.
    const recetaCreada =
      necesitaReceta
        ? recetaEnBlanco(
            slugLibre(nombreLimpio),
            nombreLimpio,
            form.categoria || "Alfajor",
            Number(form.rinde)
          )
        : null;

    // Si la receta ya existia, se le va a mandar solo el rinde: el guardado es
    // parcial y no toca sus ingredientes ni su mano de obra.
    const rindeNuevo = Math.max(0, Math.round(Number(form.rinde) || 0));
    const recetaPrevia =
      !esSub && !recetaCreada && form.receta
        ? (recetas || []).find((r) => r.slug === form.receta || r.id === form.receta)
        : null;

    const productoAGuardar = {
      ...itemPrevio,
      id: idFinal || "",
      nombre: nombreLimpio,
      categoria: form.categoria || "Alfajor",
      observaciones: form.observaciones ? form.observaciones.trim() : "",
      emoji: (form.emoji || "").trim(),
      tipo: form.tipo,
      // Solo el producto se costea con una receta.
      receta: esSub ? "" : recetaCreada ? recetaCreada.slug : form.receta,
      // Se sigue escribiendo la presentacion, que es lo que leen Precios y
      // Ventas para saber si la fila es una unidad o una caja.
      presentacion: esSub ? "caja" : "unidad",
      // Las unidades no se escriben a mano: son la suma de lo que lleva.
      unidades: esSub ? unidadesDe(form.lleva) : 0,
      carton: esSub ? form.carton : "",
      composicion: esSub
        ? lineas.map((c) => ({ producto: c.producto, cantidad: Number(c.cantidad) }))
        : [],
      activo: form.activo !== false,
    };

    try {
      // El producto primero. Las recetas se tocan despues, y solo si esto
      // salio bien: guardarlas antes dejaba una receta huerfana cada vez que
      // el producto no se podia guardar, y desde la app no se pueden borrar.
      await guardarAlfajor(productoAGuardar);

      if (recetaCreada) guardarReceta(recetaCreada);

      if (recetaPrevia && rindeNuevo !== (Number(recetaPrevia.rinde) || 0)) {
        guardarReceta({ id: recetaPrevia.id, slug: recetaPrevia.slug, rinde: rindeNuevo });
      }

      setRecienGuardado(productoAGuardar.id);

      Swal.fire({
        ...swalConfig,
        title: modoEdicion
          ? `Se han guardado los cambios de ${nombreLimpio}`
          : `Se ha creado el producto ${nombreLimpio}`,
        icon: "success",
        timer: 1600,
        showConfirmButton: false,
      });

      handleCerrarModal();
    } catch (error) {
      const mensaje = error.message || "Error al validar los datos.";
      setErrorNombre(mensaje);
    }
  };

  const verObservacion = (item) =>
    Swal.fire({
      ...swalConfig,
      title: item.nombre,
      text: item.observaciones,
      confirmButtonText: "Cerrar",
    });

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
      if (!result.isConfirmed) return;

      eliminarAlfajor(item.id);
      if (form.id === item.id) {
        handleCerrarModal();
      }

      // La fila desaparece de la lista, pero el aviso confirma que se borro lo
      // que se queria borrar y no la de al lado.
      Swal.fire({
        ...swalConfig,
        title: esSubproducto(item)
          ? "Se ha eliminado el subproducto"
          : "Se ha eliminado el producto",
        icon: "success",
        timer: 1600,
        showConfirmButton: false,
      });
    });
  };

  const porNombre = (a, b) =>
    (a.nombre || "").localeCompare(b.nombre || "", "es", { sensitivity: "base" });

  /**
   * Los productos van agrupados por familia y, adentro, alfabeticos: todos los
   * alfajores juntos, despues los mini, y asi. El orden de las familias es el
   * del desplegable de categoria; una que no este en la lista va al final.
   *
   * Ordenar solo por nombre los mezclaba: "Mendiant" caia entre los alfajores.
   */
  const porFamilia = (a, b) => {
    const puesto = (item) => {
      const i = CATEGORIAS_PRODUCTO.indexOf(item.categoria);
      return i === -1 ? CATEGORIAS_PRODUCTO.length : i;
    };
    return puesto(a) - puesto(b) || porNombre(a, b);
  };

  /**
   * De que producto cuelga un subproducto.
   *
   * De uno solo, y solo si lleva un unico producto repetido: una caja de 6
   * clasicos es del clasico. Un surtido lleva varios y no cuelga de ninguno.
   */
  const padreDe = (sub) => {
    const ids = [
      ...new Set(
        llevaDe(sub)
          .filter((l) => l.producto && Number(l.cantidad) > 0)
          .map((l) => l.producto)
      ),
    ];
    return ids.length === 1 ? ids[0] : "";
  };

  /**
   * Que lleva un subproducto, en una linea de texto: el producto cuando es uno
   * solo, y cuantos son cuando es un surtido.
   */
  const contenidoDe = (sub) => {
    const lineas = llevaDe(sub).filter((l) => l.producto && Number(l.cantidad) > 0);
    if (lineas.length === 0) return "";
    if (lineas.length === 1) return nombreDeProducto(lineas[0].producto);
    return `${lineas.length} productos surtidos`;
  };

  /**
   * Las filas de la tabla: cada producto y, debajo, los subproductos que lo
   * llevan. Los surtidos no cuelgan de uno solo, asi que van juntos al final.
   *
   * Ordenado asi se ve de un vistazo en cuantas presentaciones se vende cada
   * cosa, que es lo que la lista alfabetica escondia: "Clasico Blanco (CAJA x
   * 6)" quedaba a diez filas de "Clasico Blanco".
   */
  const filasDeLaTabla = (() => {
    const texto = sinTildes(busqueda);
    const visibles = (alfajores || []).filter(
      (item) =>
        sinTildes(item.nombre).includes(texto) ||
        sinTildes(item.categoria).includes(texto) ||
        sinTildes(item.observaciones).includes(texto)
    );

    const productos = visibles.filter((item) => !esSubproducto(item)).sort(porFamilia);
    const subproductos = visibles.filter(esSubproducto);
    const colgados = new Set();
    const filas = [];

    productos.forEach((producto) => {
      filas.push({ item: producto, sangria: false });
      subproductos
        .filter((sub) => padreDe(sub) === producto.id)
        .sort((a, b) => (Number(a.unidades) || 0) - (Number(b.unidades) || 0))
        .forEach((sub) => {
          colgados.add(sub.id);
          filas.push({ item: sub, sangria: true });
        });
    });

    // Las que llevan mas de un producto no cuelgan de ninguno: van al final,
    // bajo su propio encabezado. Sin el parecerian subproductos del ultimo
    // producto de la lista, que es de lo unico que estarian debajo.
    const mezclas = subproductos.filter((sub) => !colgados.has(sub.id)).sort(porNombre);

    if (mezclas.length > 0) {
      filas.push({ separador: GRUPO_MEZCLA });
      mezclas.forEach((sub) => filas.push({ item: sub, sangria: true }));
    }

    return filas;
  })();

  return (
    <div className="container py-4">
      {/* Contenedor ensanchado y centrado */}
      <div className="mx-auto" style={{ maxWidth: "1240px", width: "100%", paddingBottom: "75px" }}>
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
                columnas={[
                  "Producto",
                  "Tipo",
                  "Categoria",
                  "Se vende",
                  "Se hace con",
                  "Observaciones",
                ]}
                filas={() =>
                  filasDeLaTabla
                    // El encabezado de las mezclas es de la pantalla, no un dato.
                    .filter(({ item }) => item)
                    .map(({ item }) => [
                      item.nombre,
                      esSubproducto(item) ? "Subproducto" : "Producto",
                      item.categoria,
                      esSubproducto(item) ? `Caja x ${item.unidades || 0}` : seVendePor(item),
                      esSubproducto(item)
                        ? contenidoDe(item)
                        : item.receta
                          ? nombreDeReceta(item.receta)
                          : "",
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
            <table
              className="table mush-tabla mush-tabla-titulo-fijo align-middle mb-0"
              style={{ tableLayout: "fixed" }}
            >
              <thead>
                <tr>
                  <th style={{ width: "36%" }}>Producto</th>
                  <th style={{ width: "11%" }}>Categoría</th>
                  <th style={{ width: "22%" }}>Se vende</th>
                  <th className="text-center" style={{ width: "9%" }}>Obs.</th>
                  {/* Los dos botones no se parten ni se salen: necesitan su
                      ancho, y "Se vende" puede bajar de renglon. */}
                  <th className="text-end" style={{ width: "22%" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filasDeLaTabla.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-4 text-secondary">
                      No hay productos cargados.
                    </td>
                  </tr>
                ) : (
                  filasDeLaTabla.map(({ item, sangria, separador }) =>
                    separador ? (
                      <tr key={separador}>
                        <td
                          colSpan="5"
                          className="border-top border-secondary border-opacity-25 pt-3 pb-1"
                        >
                          <strong className="text-white" style={{ fontSize: "0.82rem" }}>
                            {separador}
                          </strong>
                        </td>
                      </tr>
                    ) : (
                    <tr
                      key={item.id}
                      ref={(el) => {
                        filas.current[item.id] = el;
                      }}
                      className={item.id === recienGuardado ? "mush-fila-nueva" : undefined}
                    >
                      <td>
                        {/* Un subproducto va corrido a la derecha y colgando de
                            su producto, que es la fila de arriba. */}
                        <strong
                          className={`d-block ${sangria ? "text-secondary ps-3" : "text-white"}`}
                          style={{ fontSize: "0.82rem", lineHeight: 1.25 }}
                          title={item.nombre}
                        >
                          {sangria && <span className="me-1">↳</span>}
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
                      {/* De donde sale su costo y en que presentacion se vende:
                          un producto lo dice su receta, un subproducto lo que
                          lleva adentro. */}
                      <td>
                        {/* Entero, sin recortar: es el dato por el que se mira
                            esta columna. Si no entra en el ancho, baja de
                            renglon. */}
                        <span className="text-secondary d-block" style={{ fontSize: "0.8rem" }}>
                          {esSubproducto(item) ? (
                            contenidoDe(item) ? (
                              <>
                                Caja x {item.unidades || 0}
                                <span className="ms-1" style={{ fontSize: "0.72rem" }}>
                                  de {contenidoDe(item)}
                                </span>
                              </>
                            ) : (
                              <span className="text-alerta">
                                <i className="bi bi-exclamation-triangle-fill"></i> sin contenido
                              </span>
                            )
                          ) : item.receta ? (
                            seVendePor(item)
                          ) : (
                            <span className="text-alerta">
                              <i className="bi bi-exclamation-triangle-fill"></i> sin receta
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="text-center">
                        {/* La observacion puede ser larga y no vale una columna
                            entera: se abre cuando se la quiere leer. */}
                        {item.observaciones ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary py-0 px-2 text-white"
                            style={{ fontSize: "0.72rem", minHeight: "24px" }}
                            onClick={() => verObservacion(item)}
                            title="Ver la observación"
                          >
                            Ver
                          </button>
                        ) : (
                          <span className="text-secondary" style={{ fontSize: "0.8rem" }}>
                            —
                          </span>
                        )}
                      </td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-1 text-nowrap">
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
            style={{ maxWidth: "580px" }}
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
                {/* Lo primero que se elige, porque de eso depende todo el
                    resto del formulario: un producto se hace con una receta,
                    un subproducto se arma con productos ya dados de alta. */}
                <div className="mb-3">
                  <div className="d-flex gap-2">
                    {[
                      {
                        valor: PRODUCTO,
                        titulo: "Producto",
                        ayuda: "Se hace con una receta",
                      },
                      {
                        valor: SUBPRODUCTO,
                        titulo: "Subproducto",
                        ayuda: "Se arma con productos",
                      },
                    ].map(({ valor, titulo, ayuda }) => (
                      <label
                        key={valor}
                        className={`flex-fill rounded-3 border p-2 text-center ${
                          form.tipo === valor
                            ? "border-ok bg-ok-suave"
                            : "border-secondary border-opacity-25"
                        }`}
                        style={{ cursor: "pointer" }}
                      >
                        <input
                          type="radio"
                          name="tipo"
                          className="d-none"
                          value={valor}
                          checked={form.tipo === valor}
                          onChange={handleChange}
                        />
                        <span
                          className={`d-block fw-bold ${
                            form.tipo === valor ? "text-white" : "text-secondary"
                          }`}
                          style={{ fontSize: "0.85rem" }}
                        >
                          {titulo}
                        </span>
                        <span
                          className={form.tipo === valor ? "text-ok" : "text-secondary"}
                          style={{ fontSize: "0.7rem" }}
                        >
                          {ayuda}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* De quien es este subproducto. Es una sola pregunta, y
                    "Mezcla de alfajores" es una respuesta valida: una caja de 6
                    es del clasico, pero un surtido no es de nadie.

                    De la respuesta sale todo lo demas: el costo, las unidades y
                    el nombre. Por eso no hay ningun otro campo que pueda decir
                    algo distinto. */}
                {form.tipo === SUBPRODUCTO && (
                  <div className="mb-2">
                    <label
                      className="form-label text-secondary fw-semibold mb-1 d-block"
                      style={{ fontSize: "0.78rem" }}
                    >
                      Subproducto de qué producto es <span className="text-danger">*</span>
                    </label>

                    {/* La respuesta entra en un renglon: de que producto es y,
                        si es de uno, cuantos entran. */}
                    <div className="d-flex align-items-center gap-2">
                      <select
                        name="padre"
                        className="form-select form-select-sm mush-input py-1 px-2 flex-grow-1"
                        style={{ fontSize: "0.85rem", minWidth: 0 }}
                        value={form.padre}
                        onChange={handleChange}
                      >
                        <option value="">-- Elegir --</option>
                        {productosBase.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.nombre}
                          </option>
                        ))}
                        <option value={MEZCLA}>{GRUPO_MEZCLA}</option>
                      </select>

                      {/* De un producto solo hace falta saber cuantos entran. */}
                      {esDeUnProducto && (
                        <>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="form-control form-control-sm mush-input mush-dato py-1 px-2 text-center flex-shrink-0"
                            style={{ fontSize: "0.85rem", width: "62px" }}
                            placeholder="0"
                            value={form.lleva[0]?.cantidad ?? ""}
                            onChange={(e) =>
                              cambiarLinea(0, "cantidad", e.target.value.replace(/[^0-9]/g, ""))
                            }
                            autoComplete="off"
                            title="Cuantas unidades entran por caja"
                          />
                          <span
                            className="text-white text-nowrap flex-shrink-0"
                            style={{ fontSize: "0.8rem" }}
                          >
                            por caja
                          </span>
                        </>
                      )}
                    </div>

                    {/* Una mezcla no es de nadie: hay que decir que lleva. */}
                    {form.padre === MEZCLA && (
                      <>
                        <div className="mush-card-elevada rounded-3 p-2 mt-2">
                          {form.lleva.map((linea, indice) => (
                            <div className="row g-2 mb-2" key={indice}>
                              <div className="col-7">
                                <select
                                  className="form-select form-select-sm mush-input py-1 px-2"
                                  style={{ fontSize: "0.85rem" }}
                                  value={linea.producto}
                                  onChange={(e) => cambiarLinea(indice, "producto", e.target.value)}
                                >
                                  <option value="">-- Elegir producto --</option>
                                  {productosBase.map((item) => (
                                    <option key={item.id} value={item.id}>
                                      {item.nombre}
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
                                  value={linea.cantidad}
                                  onChange={(e) =>
                                    cambiarLinea(indice, "cantidad", e.target.value.replace(/[^0-9]/g, ""))
                                  }
                                  autoComplete="off"
                                />
                              </div>
                              <div className="col-2 d-flex align-items-center">
                                {form.lleva.length > 1 && (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger py-0 px-2 d-inline-flex align-items-center"
                                    style={{ fontSize: "0.72rem", minHeight: "24px" }}
                                    onClick={() => quitarLinea(indice)}
                                    title="Quitar"
                                  >
                                    <i className="bi bi-trash"></i>
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}

                          <div className="d-flex justify-content-between align-items-center gap-2">
                            <button
                              type="button"
                              className="btn-mush-outline py-1 px-3"
                              style={{ fontSize: "0.78rem" }}
                              onClick={agregarLinea}
                            >
                              Agregar otro producto
                            </button>
                            {/* Las unidades no son un campo: son la suma de lo
                                que lleva, y se muestran para controlarla. */}
                            <span className="text-secondary" style={{ fontSize: "0.75rem" }}>
                              {unidadesDe(form.lleva) > 0
                                ? `${unidadesDe(form.lleva)} unidades en total`
                                : "sin unidades todavia"}
                            </span>
                          </div>
                        </div>

                        <p className="text-secondary mb-0 mt-1" style={{ fontSize: "0.72rem" }}>
                          Una mezcla no se llama sola: hay que ponerle el nombre acá abajo.
                        </p>
                      </>
                    )}
                  </div>
                )}

                {/* Como se llama, de que es y con que se lo reconoce. */}
                <div className="row g-2 mb-2">
                  <div className="col-6">
                    <label className="form-label text-secondary fw-semibold mb-1" style={{ fontSize: "0.78rem" }}>
                      {form.tipo === SUBPRODUCTO ? "Subproducto" : "Producto"}{" "}
                      <span className="text-danger">*</span>
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
                    {form.tipo === SUBPRODUCTO && !errorNombre && (
                      <div className="text-secondary mt-1" style={{ fontSize: "0.7rem" }}>
                        Se arma solo con lo de arriba. Se puede cambiar.
                      </div>
                    )}
                  </div>

                  <div className="col-3">
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
                      {categoriasVisibles.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-3">
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
                      title="Windows + . abre el selector de emojis"
                    />
                    {/* Nadie se acuerda del atajo, y sin el hay que ir a
                        buscar el emoji a otro lado para copiarlo. */}
                    <div
                      className="text-secondary text-center mt-1"
                      style={{ fontSize: "0.68rem", lineHeight: 1.2 }}
                    >
                      Windows + . para elegir
                    </div>
                  </div>
                </div>

                {/* Un producto que ya tiene receta la conserva: no se elige ni
                    se cambia desde aca, porque la receta es suya. Se dice cual
                    es para saber donde ir a cargarle los ingredientes. */}
                {form.tipo === PRODUCTO && form.receta && (
                  <div
                    className="d-flex align-items-center flex-wrap gap-1 mb-2 text-secondary"
                    style={{ fontSize: "0.78rem" }}
                  >
                    <i className="bi bi-journal-text"></i>
                    Se hace con la receta
                    <span className="text-white fw-semibold">{nombreDeReceta(form.receta)}</span>
                    <span style={{ fontSize: "0.72rem" }}>
                      — sus ingredientes y su rinde se cargan en Recetas.
                    </span>
                  </div>
                )}

                {/* La receta se crea junto con el producto, y necesita su
                    rinde antes de existir: los ingredientes de la masa se
                    anotan por tanda, asi que sin este numero no hay costo por
                    unidad. Es lo unico que se pregunta aca; el resto se carga
                    despues, en Recetas. */}
                {form.tipo === PRODUCTO && (
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
                        className="form-control form-control-sm mush-input mush-dato py-1 px-2 text-center"
                        style={{ fontSize: "0.85rem", width: "95px" }}
                        value={form.rinde}
                        onChange={handleChange}
                        autoComplete="off"
                      />
                      <span className="text-white" style={{ fontSize: "0.82rem" }}>
                        {form.unidadRindeActual
                          ? enPlural(form.unidadRindeActual)
                          : unidadDeRindeEnPlural(form.categoria)}
                      </span>
                    </div>
                    <p className="text-ok mb-0 mt-1" style={{ fontSize: "0.72rem" }}>
                      {necesitaReceta
                        ? "Se crea la receta de este producto, vacía, con su tarjeta en Recetas y en Costos para cargarle los ingredientes."
                        : "Es el número por el que se reparten los ingredientes de la masa, así que de él sale el costo de cada unidad."}
                    </p>
                  </div>
                )}

                {/* En que va: es lo unico que un subproducto suma por su cuenta
                    al costo de lo que lleva adentro. */}
                {form.tipo === SUBPRODUCTO && (
                  <div className="mb-2">
                    <label
                      className="form-label text-secondary fw-semibold mb-1"
                      style={{ fontSize: "0.78rem" }}
                    >
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
