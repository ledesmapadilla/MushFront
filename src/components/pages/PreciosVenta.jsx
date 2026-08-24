import { useState, useEffect, useMemo } from "react";
import { useMush } from "../../context/MushContext";
import { productosDeCatalogo, variedadesDe } from "../../data/productos";
import { buscarReceta, costearProducto } from "../../utils/costos";
import { moneda, fechaLegible } from "../../utils/sueldos";
import { numero } from "../../utils/calculos";
import BotonExcel from "../shared/BotonExcel.jsx";
import {
  anotarPrecios,
  COLUMNAS_HISTORIAL,
  historialDeReceta,
  margenReal,
  precioDesdeMargen,
  preciosDeProducto,
  ultimaActualizacion,
} from "../../utils/precios";

/**
 * Precios de venta: una fila por producto, con el costo al lado de los dos
 * precios y, separados al final, los margenes.
 *
 * El costo se calcula (es el mismo de Costos). Los precios y los margenes se
 * cargan a mano en la tabla y se guardan en la receta, asi que quedan para
 * todos, no solo en este navegador.
 *
 * Las tabletas no tienen precio propio: lo tiene cada variedad, y por eso van
 * como filas debajo de su titulo.
 */

// El ancho lo comparten el titulo y la tabla, para que no se desfasen.
const ANCHO_BLOQUE = "1380px";

// Los precios que se cargan a mano. El id es el campo dentro de `receta.precios`.
// Los precios no se cargan: salen del costo y del margen que se quiere dejar.
const PRECIOS = [
  { id: "publico", titulo: "Precio publico", color: "mush-col-publico", canal: "publico" },
  {
    id: "revendedor",
    titulo: "Precio revendedor",
    color: "mush-col-revendedor",
    canal: "revendedor",
  },
];

// Lo unico que se carga a mano: la ganancia que se quiere dejar, en porcentaje.
// La columna mide lo justo para tres cifras y el signo.
const MARGENES = [
  {
    id: "margenPublico",
    titulo: "Gcia. deseada (publico)",
    color: "mush-col-publico",
    letra: "0.58rem",
  },
  {
    id: "margenRevendedor",
    titulo: "Gcia. real (revend.)",
    color: "mush-col-revendedor",
    canal: "revendedor",
    letra: "0.58rem",
  },
];

// Lo que deja cada canal en pesos: el precio menos el costo.
const GANANCIAS = [
  {
    id: "gananciaPublico",
    titulo: "Ganancia publico",
    color: "mush-col-publico",
    canal: "publico",
    letra: "0.58rem",
  },
  {
    id: "gananciaRevendedor",
    titulo: "Ganancia revendedor",
    color: "mush-col-revendedor",
    canal: "revendedor",
    letra: "0.58rem",
  },
];

// El descuento que se le hace al revendedor. Va en su propio bloque, entre el
// detalle y los margenes.
const UNIDADES_POR_CAJA = "unidadesPorCaja";

const DESCUENTOS = [
  {
    id: "dtoRevendedor",
    titulo: "Dto. revendedor",
    color: "mush-col-revendedor",
    // Es la columna mas angosta: el titulo entra solo con la letra mas chica.
    letra: "0.58rem",
  },
];

// Lo que se guarda en la receta: la ganancia que se quiere dejar en publico y
// el descuento del revendedor. Todo lo demas sale de ahi.
const EDITABLES = [...DESCUENTOS, { id: "margenPublico" }, { id: UNIDADES_POR_CAJA }];

// Los bloques se dibujan como tablas aparte, asi que los altos se fijan a mano:
// si no, cada una los calcula por su cuenta y las lineas dejan de coincidir.
const ALTO_CABECERA = "66px";
const ALTO_FILA = "34px";

// Una cuenta escrita como se lee: el nombre, y a la derecha el numerador sobre
// el denominador separados por una raya.
const formula = (nombre, arriba, abajo) => (
  <span className="d-inline-flex align-items-center gap-1">
    <span className="text-secondary text-nowrap" style={{ fontSize: "0.72rem" }}>
      {nombre}
    </span>
    <span className="text-center">
      <span className="d-block text-white text-nowrap px-1" style={{ fontSize: "0.72rem" }}>
        {arriba}
      </span>
      <span
        className="d-block text-white text-nowrap px-1 border-top border-secondary"
        style={{ fontSize: "0.72rem" }}
      >
        {abajo}
      </span>
    </span>
  </span>
);

// Un porcentaje, redondeado al entero. Si no esta se lee "-", igual que un
// importe vacio.
const porcentaje = (valor) =>
  valor === null || valor === undefined ? "-" : `${Math.round(valor)} %`;

// Las filas del modal, en el orden en que se leen. Las que llevan campo son
// editables (el margen) o calculadas (el precio y su ganancia).
const FILAS_MODAL = [
  { titulo: "Producto", valor: (fila) => fila.nombre },
  { titulo: "Un.", esUnidad: true },
  { titulo: "Costos", esCosto: true },
  { titulo: "Gcia. deseada (publico)", campoMargen: "margenPublico", nota: "(Dato)" },
  {
    titulo: "Gcia. real (revendedor)",
    valor: null,
    canalMargen: "revendedor",
    nota: "(de cálculo)",
  },
  { titulo: "Precio publico", canal: "publico" },
  { titulo: "Dto. revendedor", campoMargen: "dtoRevendedor" },
  { titulo: "Precio revendedor", canal: "revendedor" },
];

// Lo que no se vende por unidad: solo aparece en la lista por caja.
const SOLO_POR_CAJA = ["tabletas-chocolate"];

/**
 * La lista por caja. Un mismo producto se vende en mas de una caja (x6, x12), y
 * cada una lleva su propio precio: por eso va un renglon por caja. Cuantas
 * unidades entran en cada una se carga en la tabla.
 *
 * Los que no estan en el catalogo (surtidos, mixtos, mini mixto) viven solo en
 * esta pantalla: no tienen receta con ingredientes ni aparecen en Recetas ni en
 * Costos.
 */
const FILAS_POR_CAJA = [
  { slug: "clasico-semiamargo", cajas: 2 },
  { slug: "clasico-blanco", cajas: 2 },
  { slug: "maicena", cajas: 2 },
  { slug: "alfajor-de-nuez", cajas: 2 },
  { slug: "alfajor-de-pistacho", cajas: 2 },
  { slug: "surtidos", nombre: "Surtidos", imagen: "🎁", cajas: 2 },
  { slug: "mixtos", nombre: "Mixtos", imagen: "🍬", cajas: 2 },
  { slug: "mini-semi", cajas: 2, mini: true },
  { slug: "mini-mixto", nombre: "Mini Mixto", imagen: "🍡", cajas: 2, mini: true },
  // La tableta no se cuenta por unidades: se vende en doy pack.
  { slug: "tabletas-chocolate", cajas: 1, cantidadFija: "Doy Pack", corte: true },
];

/**
 * Lo que lleva adentro una caja armada (surtidos, mixtos): que alfajores y
 * cuantos de cada uno, mas la caja de carton.
 *
 * Su costo no sale de una receta: es la suma de lo que cuesta cada alfajor que
 * entra (con su propio packaging y mano de obra) mas la caja.
 */
/**
 * La caja de carton que lleva cada caja segun lo que entra en ella. Se suma al
 * costo de lo que va adentro.
 */
const CARTON = {
  clasico: {
    6: "pack_caja_de_carton_por_6_6naz",
    12: "pack_caja_de_carton_por_1_ac5z",
  },
  mini: "pack_caja_mini_uv3g",
};

const COMPOSICIONES = {
  "mini-mixto#0": {
    lleva: [
      ["mini-semi", 6],
      ["mini-blanco", 6],
    ],
    caja: "pack_caja_mini_uv3g",
  },
  "mini-mixto#1": {
    lleva: [
      ["mini-semi", 15],
      ["mini-blanco", 15],
    ],
    caja: "pack_caja_de_carton_por_1_ac5z",
  },
  "mixtos#0": {
    lleva: [
      ["clasico-semiamargo", 3],
      ["clasico-blanco", 3],
    ],
    caja: "pack_caja_de_carton_por_6_6naz",
  },
  "mixtos#1": {
    lleva: [
      ["clasico-semiamargo", 6],
      ["clasico-blanco", 6],
    ],
    caja: "pack_caja_de_carton_por_1_ac5z",
  },
  "surtidos#0": {
    lleva: [
      ["clasico-semiamargo", 1],
      ["clasico-blanco", 1],
      ["alfajor-de-nuez", 1],
      ["alfajor-de-pistacho", 1],
      ["maicena", 2],
    ],
    caja: "pack_caja_de_carton_por_6_6naz",
  },
  "surtidos#1": {
    lleva: [
      ["clasico-semiamargo", 2],
      ["clasico-blanco", 2],
      ["alfajor-de-nuez", 2],
      ["alfajor-de-pistacho", 2],
      ["maicena", 4],
    ],
    caja: "pack_caja_de_carton_por_1_ac5z",
  },
};

// El dinero se cuenta en centavos. Si las partes se muestran redondeadas pero
// el total se calcula con todos los decimales, la suma no cierra en pantalla por
// una diferencia que no existe.
const enCentavos = (valor) => Math.round(valor * 100) / 100;

// El precio del revendedor: el publico con su descuento. Se usa tanto para
// mostrarlo como para anotarlo en el historial.
const precioDeRevendedor = (costo, { margenPublico, dtoRevendedor }) =>
  preciosDeProducto(costo, { margenPublico, dtoRevendedor }).revendedor;

const PreciosVenta = () => {
  const { alfajores, recetas, ingredientes, packaging, personal, guardarReceta } = useMush();

  // Los precios se miran por unidad o por caja; la caja multiplica todo por
  // las unidades que entren en ella.
  const [porCaja, setPorCaja] = useState(false);

  const filas = useMemo(() => {
    const datos = { ingredientes, packaging, personal };

    // El costo de un producto. Los que agrupan variedades (las tabletas) no
    // tienen ingredientes propios: su costo es el promedio de las suyas.
    const costoDe = (slug) => {
      const receta = buscarReceta(recetas, slug);
      const propio = costearProducto(receta, datos);

      const variedades = variedadesDe(slug);
      if (variedades.length === 0 || propio.total > 0) return { receta, costo: propio };

      const costos = variedades
        .map((v) => costearProducto(buscarReceta(recetas, v.slug), datos))
        .filter((c) => c.total > 0);
      if (costos.length === 0) return { receta, costo: propio };

      // La caja lleva una de cada variedad: se suman todos los ingredientes, y
      // el packaging y la mano de obra van una sola vez (son iguales en todas).
      return {
        receta,
        costo: (() => {
          const sumaIngredientes = enCentavos(
            costos.reduce((suma, c) => suma + c.ingredientes, 0)
          );
          const pack = enCentavos(costos[0].packaging);
          const manoObra = enCentavos(costos[0].manoObra);

          return {
            ...costos[0],
            sumaIngredientes,
            variedades: costos.length,
            packaging: pack,
            manoObra,
            total: sumaIngredientes + pack + manoObra,
          };
        })(),
      };
    };

    // Lo que cuesta una caja armada: cada alfajor que lleva (con su packaging y
    // su mano de obra) mas la caja de carton. Los dos se usan tambien para
    // mostrar de donde sale el numero.
    const costoDeCajaArmada = ({ lleva, caja }) => {
      const contenido = lleva.reduce(
        (suma, [slugAlfajor, cantidad]) =>
          suma + enCentavos(costoDe(slugAlfajor).costo.total) * cantidad,
        0
      );
      const carton = Number((packaging || []).find((x) => x.id === caja)?.precio) || 0;
      const unidad = costoDe(lleva[0][0]).costo;
      return { ...unidad, total: contenido + carton, unidad: "caja" };
    };

    // Por unidad: los productos del catalogo, salvo los que solo se venden por
    // caja.
    if (!porCaja) {
      return productosDeCatalogo(alfajores)
        .filter((producto) => !SOLO_POR_CAJA.includes(producto.slug))
        .map((producto) => {
          const { receta, costo } = costoDe(producto.slug);
          return {
            id: producto.slug,
            slug: producto.slug,
            nombre: receta?.nombre || producto.nombre,
            imagen: producto.imagen,
            corte: producto.corte,
            receta,
            costo,
          };
        });
    }

    // Por caja: un renglon por cada caja del producto. Un mismo producto se
    // vende en mas de una caja (x6, x12), y cada una lleva su propio precio.
    const delCatalogo = productosDeCatalogo(alfajores);
    return FILAS_POR_CAJA.flatMap(({ slug, nombre, imagen, cajas, corte, cantidadFija, mini }) => {
      const producto = delCatalogo.find((p) => p.slug === slug);
      const { receta, costo } = costoDe(slug);

      return Array.from({ length: cajas }, (_, caja) => {
        // Cada caja guarda lo suyo, asi que necesita su propia identidad.
        const id = `${slug}#${caja}`;
        const armada = COMPOSICIONES[id];

        return {
          id,
          slug,
          caja,
          nombre: receta?.nombre || producto?.nombre || nombre,
          imagen: producto?.imagen || imagen,
          // La linea doble arranca en la primera caja del producto que la abre
          corte: caja === 0 && (corte ?? producto?.corte),
          receta,
          cantidadFija,
          mini,
          // La caja armada ya viene costeada entera: lo que se carga en "un. x
          // caja" es lo que lleva adentro, no un multiplicador.
          armada: Boolean(armada),
          costo: armada ? costoDeCajaArmada(armada) : costo,
        };
      });
    });
  }, [alfajores, recetas, ingredientes, packaging, personal, porCaja]);

  // La fila que se esta mirando en el modal de calculo (null = cerrado).
  const [filaModal, setFilaModal] = useState(null);
  // Y aparte se puede ver como fueron cambiando los datos.
  const [verHistorial, setVerHistorial] = useState(false);

  const abrirModal = (fila) => {
    setFilaModal(fila);
    setVerHistorial(false);
  };

  // Borrador local para poder tipear sin guardar en cada tecla.
  const [borrador, setBorrador] = useState({});

  /**
   * Lo que tiene guardado una fila.
   *
   * Por unidad hay un solo juego de valores por receta; por caja hay uno por
   * cada caja, en `precios.cajas`. La fila sabe cual le toca.
   */
  const guardadoDe = (receta, caja) => {
    const precios = receta?.precios || {};
    if (caja === undefined) return precios;
    return (precios.cajas || [])[caja] || {};
  };

  // Lo guardado manda: si cambia la receta (o contesta el backend), se refresca.
  useEffect(() => {
    const guardados = {};

    const anotar = (id, valores) =>
      EDITABLES.forEach(({ id: campo }) => {
        if (valores[campo] !== undefined && valores[campo] !== "") {
          guardados[`${id}:${campo}`] = String(valores[campo]);
        }
      });

    (recetas || []).forEach((receta) => {
      const precios = receta.precios || {};
      anotar(receta.slug, precios);
      (precios.cajas || []).forEach((caja, i) => anotar(`${receta.slug}#${i}`, caja || {}));
    });

    setBorrador(guardados);
  }, [recetas]);

  const valorDe = (id, campo) => borrador[`${id}:${campo}`] ?? "";

  const escribir = (id, campo, valor) =>
    setBorrador((prev) => ({ ...prev, [`${id}:${campo}`]: valor.replace(/[^0-9.,]/g, "") }));

  /**
   * Guarda un valor y anota como quedo el precio.
   *
   * La anotacion es una foto del momento, asi que se arma con el dato nuevo ya
   * puesto. Cada caja lleva su propio historial.
   */
  const guardar = (fila, campo) => {
    if (!fila.receta) return;

    const anterior = guardadoDe(fila.receta, fila.caja);
    const escrito = valorDe(fila.id, campo);
    const numero = escrito === "" ? "" : Number(String(escrito).replace(",", ".")) || 0;
    // Salir del campo sin haberlo tocado no es un cambio.
    if (String(anterior[campo] ?? "") === String(numero)) return;

    const cambiado = { ...anterior, [campo]: numero };
    // Por caja el precio es el de la caja entera: el unitario por lo que entra.
    const unidades = fila.caja === undefined ? 1 : Number(cambiado[UNIDADES_POR_CAJA]) || 0;
    const costo = fila.costo.total * (unidades || 1);
    const anotado = anotarPrecios(cambiado, {
      costo: unidades || fila.caja === undefined ? costo : null,
      publico: precioDesdeMargen(costo, cambiado.margenPublico),
      revendedor: precioDeRevendedor(costo, cambiado),
    });

    const precios = fila.receta.precios || {};
    if (fila.caja === undefined) {
      guardarReceta({ ...fila.receta, precios: { ...precios, ...anotado } });
      return;
    }

    const cajas = [...(precios.cajas || [])];
    cajas[fila.caja] = anotado;
    guardarReceta({ ...fila.receta, precios: { ...precios, cajas } });
  };

  // El costo unitario de un producto y el precio de una caja de carton: los usa
  // el detalle del costo de una caja armada.
  const costoUnitarioDe = (slug) =>
    costearProducto(buscarReceta(recetas, slug), { ingredientes, packaging, personal }).total;

  const precioDeCaja = (id) => Number((packaging || []).find((x) => x.id === id)?.precio) || 0;

  // Como se lee la unidad de una fila: por caja dice de que caja se trata.
  const unidadDeFila = (fila) => {
    if (!porCaja) return fila.costo.unidad;
    if (fila.cantidadFija) return fila.cantidadFija;
    const unidades = numeroDe(fila, UNIDADES_POR_CAJA);
    return unidades ? `caja x ${numero(unidades)}` : "caja";
  };

  /**
   * De donde sale el costo de la fila, escrito como se lee.
   *
   * Una caja armada es la suma de lo que lleva adentro mas su caja de carton;
   * una caja comun es el costo de la unidad por lo que entra.
   *
   * Los importes van con centavos: redondeados a pesos, las partes no suman el
   * total y la cuenta parece mal hecha.
   */
  const detalleDeCosto = (fila) => {
    if (!porCaja) return null;

    // La caja que lleva una de cada variedad: todos los ingredientes juntos, y
    // el packaging y la mano de obra una sola vez.
    const { sumaIngredientes, variedades, packaging: pack, manoObra } = fila.costo;
    if (sumaIngredientes) {
      return (
        `${moneda(sumaIngredientes, 2)} de ingredientes (${variedades} variedades) + ` +
        `${moneda(pack, 2)} de packaging + ${moneda(manoObra, 2)} de mano de obra`
      );
    }

    const armada = COMPOSICIONES[fila.id];
    if (armada) {
      const partes = armada.lleva.map(([slug, cantidad]) => {
        const costo = moneda(costoUnitarioDe(slug), 2);
        return cantidad === 1 ? costo : `${cantidad} x ${costo}`;
      });
      return `${partes.join(" + ")} + ${moneda(precioDeCaja(armada.caja), 2)} de caja`;
    }

    const unidades = numeroDe(fila, UNIDADES_POR_CAJA);
    if (!unidades) return null;

    const contenido = `${moneda(fila.costo.total, 2)} x ${numero(unidades)}`;
    const carton = cartonDeFila(fila);
    return carton ? `${contenido} + ${moneda(carton, 2)} de caja` : contenido;
  };

  // Lo que se ve en la tabla, para bajarlo a una planilla.
  const COLUMNAS_PLANILLA = [
    "Fecha de actualizacion",
    "Producto",
    { titulo: "Costos", formato: "moneda" },
    porCaja ? "Un. x caja" : "Un",
    { titulo: "Precio publico", formato: "moneda" },
    { titulo: "Precio revendedor", formato: "moneda" },
    { titulo: "Dto. revendedor", formato: "porcentaje" },
    { titulo: "Gcia. deseada", formato: "porcentaje" },
    { titulo: "Gcia. real revendedor", formato: "porcentaje" },
    { titulo: "Ganancia publico", formato: "moneda" },
    { titulo: "Ganancia revendedor", formato: "moneda" },
  ];

  const filasDePlanilla = () =>
    filas.map((fila) => [
      fechaLegible(fechaDeFila(fila)),
      fila.nombre,
      costoDeFila(fila),
      porCaja ? unidadDeFila(fila) : fila.costo.unidad,
      precioDeCanal(fila, "publico"),
      precioDeCanal(fila, "revendedor"),
      numeroDe(fila, "dtoRevendedor"),
      numeroDe(fila, "margenPublico"),
      margenRealDeCanal(fila, "revendedor"),
      gananciaDeCanal(fila, "publico"),
      gananciaDeCanal(fila, "revendedor"),
    ]);

  // Cuando se actualizo el precio de esta fila (de esta caja, si es por caja).
  const fechaDeFila = (fila) =>
    ultimaActualizacion({ precios: guardadoDe(fila.receta, fila.caja) });

  // Lo escrito en un campo, como numero. Se lee del borrador y no de lo
  // guardado, asi las cuentas se mueven mientras se prueba.
  const numeroDe = (fila, id) => Number(String(valorDe(fila.id, id)).replace(",", ".")) || 0;

  /**
   * El precio de cada canal, sobre lo que se vende:
   *   publico    -> del costo y la ganancia que se quiere dejar
   *   revendedor -> el publico menos el descuento que se le hace
   *
   * Por caja el costo es el de la caja entera (lo que lleva adentro mas su caja
   * de carton), asi que el redondeo a la centena cae sobre el precio de la caja
   * y no sobre el de la unidad.
   */
  const precioDeCanal = (fila, canal) => {
    const costo = costoDeFila(fila);
    if (costo === null) return null;

    const margenPublico = numeroDe(fila, "margenPublico");
    if (canal === "publico") return precioDesdeMargen(costo, margenPublico);

    return precioDeRevendedor(costo, {
      margenPublico,
      dtoRevendedor: numeroDe(fila, "dtoRevendedor"),
    });
  };

  // Por unidad es uno; por caja, lo que entre en la caja (sin cargar, no hay
  // precio de caja que mostrar).
  const multiplicador = (fila) => {
    if (!porCaja || fila.cantidadFija || fila.armada) return 1;
    return numeroDe(fila, UNIDADES_POR_CAJA) || null;
  };

  /**
   * La caja de carton que lleva una fila. Por unidad no hay caja.
   *
   * Los mini van en su propia caja, salvo las cajas grandes (x30, x36) que no
   * entran ahi y usan la de 12 clasico.
   */
  const cartonDeFila = (fila) => {
    // La caja armada ya la tiene sumada, y la que no se cuenta por unidades (el
    // doy pack) trae su propio packaging.
    if (!porCaja || fila.armada || fila.cantidadFija) return 0;

    const unidades = numeroDe(fila, UNIDADES_POR_CAJA);
    if (!unidades) return 0;

    // Un mini de hasta 12 va en caja mini; de ahi para arriba, en la de 12
    // clasico. Una cantidad sin caja declarada no suma nada.
    const id = fila.mini
      ? unidades <= 12
        ? CARTON.mini
        : CARTON.clasico[12]
      : CARTON.clasico[unidades];
    return id ? precioDeCaja(id) : 0;
  };

  const costoDeFila = (fila) => {
    const cantidad = multiplicador(fila);
    if (cantidad === null) return null;
    // La caja armada ya viene costeada con su carton adentro.
    if (fila.armada) return fila.costo.total;
    return fila.costo.total * cantidad + cartonDeFila(fila);
  };
  const gananciaDeCanal = (fila, canal) => {
    const precio = precioDeCanal(fila, canal);
    const costo = costoDeFila(fila);
    return precio === null || costo === null ? null : precio - costo;
  };

  // Lo que queda de ganancia sobre el precio que se termina cobrando. No es el
  // porcentaje que se pidio: el redondeo y el descuento lo mueven.
  // El porcentaje no cambia entre unidad y caja: la caja es la unidad repetida.
  const margenRealDeCanal = (fila, canal) =>
    margenReal(precioDeCanal(fila, canal), costoDeFila(fila));

  const campo = (fila, id, ancho) => (
    <input
      type="text"
      inputMode="decimal"
      className="form-control form-control-sm mush-input mush-dato py-0 px-1 text-center"
      style={{ width: ancho }}
      placeholder="-"
      value={valorDe(fila.id, id)}
      onChange={(e) => escribir(fila.id, id, e.target.value)}
      onBlur={() => guardar(fila, id)}
      // Enter cierra la carga: sale del campo, y al salir se guarda.
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      autoComplete="off"
      spellCheck="false"
    />
  );

  // Cada bloque de columnas es una tabla propia, con su marco, despegada de las
  // otras. Comparten los altos de arriba, asi las filas quedan enfrentadas.
  const tablaBloque = (columnas, ancho, celda) => (
    <table
      className="table mush-tabla mush-tabla-compacta mush-tabla-pareja align-middle mb-0 flex-shrink-0"
      style={{ tableLayout: "fixed", width: ancho }}
    >
      <thead>
        <tr className="text-center" style={{ height: ALTO_CABECERA }}>
          {columnas.map(({ id, titulo, color, letra }) => (
            <th key={id} className={color} style={{ width: `${100 / columnas.length}%` }}>
              <span
                className="mush-th-caja"
                style={letra ? { fontSize: letra, letterSpacing: "normal" } : undefined}
              >
                {titulo}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((fila) => (
            <tr
              key={fila.id}
              className={fila.corte ? "mush-fila-corte" : ""}
              style={{ height: ALTO_FILA }}
            >
              {columnas.map((columna) => (
                <td key={columna.id} className={columna.color}>
                  {celda(fila, columna)}
                </td>
              ))}
            </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="container py-4">
      <div
        className="mx-auto d-flex flex-column"
        style={{
          maxWidth: ANCHO_BLOQUE,
          width: "100%",
          // Alto fijo, no minimo: con minimo la hoja crece con el contenido y
          // termina scrolleando la ventana entera, la tabla nunca scrollea por
          // dentro y el encabezado pegajoso no tiene contra que pegarse.
          //
          // Lo que se descuenta es el navbar arriba (~86px), el padding de la
          // pagina (48px) y el footer fijo (~56px): la tarjeta llega justo hasta
          // donde arranca el footer.
          height: "calc(100vh - 190px)",
          overflow: "hidden",
        }}
      >
        {/* El titulo queda centrado en la pagina y el switch, centrado en lo que
            sobra a su derecha. */}
        <div className="d-flex align-items-center mb-1">
          <span className="flex-grow-1" style={{ flexBasis: 0 }}></span>
          <h2 className="mush-display text-white mb-0">Lista de Precios</h2>
          <div
            className="flex-grow-1 d-flex align-items-center justify-content-center gap-2"
            style={{ flexBasis: 0 }}
          >
            <span
              className={porCaja ? "text-secondary" : "text-dulce fw-bold"}
              style={{ fontSize: "0.72rem" }}
            >
              por unidad
            </span>
            <div className="form-check form-switch m-0">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                id="switch-por-caja"
                checked={porCaja}
                onChange={(e) => setPorCaja(e.target.checked)}
              />
            </div>
            <label
              className={porCaja ? "text-dulce fw-bold" : "text-secondary"}
              style={{ fontSize: "0.72rem", cursor: "pointer" }}
              htmlFor="switch-por-caja"
            >
              por cantidad
            </label>

            <BotonExcel
              titulo="Lista de Precios"
              columnas={COLUMNAS_PLANILLA}
              filas={filasDePlanilla}
              className="ms-3"
            />
          </div>
        </div>
        <p className="text-center text-secondary mb-4" style={{ fontSize: "0.8rem" }}>
          Precio por {porCaja ? "cantidad" : "unidad"} de cada producto
        </p>

        <div className="mush-card p-3 p-sm-4 d-flex flex-column flex-grow-1" style={{ minHeight: 0 }}>
          {/* Tres bloques: el producto con sus precios, los margenes y las
              ganancias. Cada uno es una tabla aparte para que se lean como
              bloques independientes y no como columnas de una sola. */}
          <div
            className="mush-scroll-tabla flex-grow-1 d-flex align-items-start gap-3"
            style={{ minHeight: 0, overflowX: "hidden" }}
          >
            {/* Ancho fijo por columna: asi entra todo sin scroll de costado */}
            <table
              className="table mush-tabla mush-tabla-compacta mush-tabla-pareja align-middle mb-0 flex-grow-1"
              style={{ tableLayout: "fixed", width: "100%", minWidth: 0 }}
            >
              <thead>
                <tr className="text-center" style={{ height: ALTO_CABECERA }}>
                  {/* Cuando se actualizo por ultima vez el precio */}
                  <th style={{ width: "88px" }}>
                    {/* El titulo hereda mayusculas y espaciado de los encabezados:
                        con un texto largo eso solo lo agranda. */}
                    <span
                      className="mush-th-caja"
                      style={{ fontSize: "0.52rem", letterSpacing: "normal" }}
                    >
                      Fecha de actualizacion
                    </span>
                  </th>
                  <th>
                    <span className="mush-th-caja">Producto</span>
                  </th>
                  <th style={{ width: "100px" }}>
                    <span className="mush-th-caja">Costos</span>
                  </th>
                  <th style={{ width: "60px" }}>
                    <span className="mush-th-caja" style={{ fontSize: "0.62rem" }}>
                      {porCaja ? (
                        <>
                          {/* Los encabezados van en mayusculas por CSS: la x se
                              excluye para que no se convierta en X. */}
                          Un.
                          <br />
                          <span style={{ textTransform: "none" }}>x</span> caja
                        </>
                      ) : (
                        "Un"
                      )}
                    </span>
                  </th>
                  {PRECIOS.map(({ id, titulo, color }, i) => (
                    <th
                      key={id}
                      className={`${color} ${i === 0 ? "mush-col-doble" : ""}`}
                      style={{ width: "120px" }}
                    >
                      <span className="mush-th-caja">{titulo}</span>
                    </th>
                  ))}
                  <th className="mush-col-doble" style={{ width: "74px" }}>
                    {/* La columna es angosta: el titulo entra con la letra mas chica */}
                    <span
                      className="mush-th-caja"
                      style={{ fontSize: "0.6rem", letterSpacing: "normal" }}
                    >
                      Detalle
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filas.map((fila) => (
                    <tr
                      key={fila.id}
                      className={fila.corte ? "mush-fila-corte" : ""}
                      style={{ height: ALTO_FILA }}
                    >
                      {/* La fecha del ultimo cambio de precio, venga de esta
                          pantalla o de un cambio de costo. */}
                      <td className="text-center">
                        <span className="mush-dato text-secondary" style={{ fontSize: "0.6rem" }}>
                          {fechaLegible(fechaDeFila(fila)) || "-"}
                        </span>
                      </td>

                      <td>
                        {/* La aclaracion va debajo del nombre: al lado le comia el
                            ancho y le cortaba la palabra. */}
                        <span className="d-flex align-items-center gap-2">
                          <span style={{ fontSize: "0.85rem" }}>{fila.imagen}</span>
                          <span className="d-block text-truncate">
                            <strong
                              className="text-white d-block text-truncate"
                              style={{ fontSize: "0.75rem", lineHeight: 1.15 }}
                              title={fila.nombre}
                            >
                              {fila.nombre}
                            </strong>

                          </span>
                        </span>
                      </td>

                      {/* El costo es calculado: no se edita */}
                      <td className="text-center">
                        <span className="mush-dato text-secondary" style={{ fontSize: "0.72rem" }}>
                          {moneda(costoDeFila(fila), 2)}
                        </span>
                      </td>

                      <td className="text-center">
                        {!porCaja || fila.cantidadFija ? (
                          <span className="text-secondary" style={{ fontSize: "0.72rem" }}>
                            {porCaja ? fila.cantidadFija : fila.costo.unidad}
                          </span>
                        ) : (
                          campo(fila, UNIDADES_POR_CAJA, "100%")
                        )}
                      </td>

                      {PRECIOS.map(({ id, color, canal }, i) => (
                        <td
                          key={id}
                          className={`${color} text-center ${i === 0 ? "mush-col-doble" : ""}`}
                        >
                          <span className="mush-dato" style={{ fontSize: "0.95rem" }}>
                            {moneda(precioDeCanal(fila, canal), 2)}
                          </span>
                        </td>
                      ))}

                      <td className="text-center mush-col-doble">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary py-0 px-2 text-white d-inline-flex align-items-center"
                          style={{ fontSize: "0.72rem", minHeight: "20px" }}
                          onClick={() => abrirModal(fila)}
                          title={`Calculo de precio de ${fila.nombre}`}
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>

            {tablaBloque(DESCUENTOS, "92px", (fila, { id }) => (
              <span className="d-flex align-items-center justify-content-center gap-1">
                {campo(fila, id, "48px")}
                <span className="text-secondary" style={{ fontSize: "0.72rem" }}>
                  %
                </span>
              </span>
            ))}

            {/* Los margenes van en porcentaje, con el signo al lado */}
            {tablaBloque(MARGENES, "168px", (fila, { id, canal }) =>
              canal ? (
                <span className="mush-dato d-block text-center" style={{ fontSize: "0.8rem" }}>
                  {porcentaje(margenRealDeCanal(fila, canal))}
                </span>
              ) : (
                <span className="d-flex align-items-center justify-content-center gap-1">
                  {campo(fila, id, "48px")}
                  <span className="text-secondary" style={{ fontSize: "0.72rem" }}>
                    %
                  </span>
                </span>
              )
            )}

            {tablaBloque(GANANCIAS, "236px", (fila, { canal }) => (
              <span className="mush-dato d-block text-center" style={{ fontSize: "0.95rem" }}>
                {moneda(gananciaDeCanal(fila, canal), 2)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* MODAL: de donde sale el precio de un producto */}
      {filaModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.75)", zIndex: 1055 }}
          onClick={() => setFilaModal(null)}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            style={{ maxWidth: verHistorial ? "940px" : "460px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content mush-card p-3 p-sm-4 rounded-4 shadow-lg border border-secondary border-opacity-25">
              <div className="d-flex align-items-start mb-3">
                <h5 className="text-white mb-0 fw-bold fs-6 flex-grow-1 text-center">
                  Calculo de precio
                  <span className="text-secondary fw-normal ms-2" style={{ fontSize: "0.8rem" }}>
                    (Gross Margin)
                  </span>
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white flex-shrink-0"
                  onClick={() => setFilaModal(null)}
                  aria-label="Cerrar"
                ></button>
              </div>

              {/* Las dos cuentas del modal, escritas como se leen: el precio
                  sale del costo y la ganancia que se quiere dejar; la ganancia
                  real sale del precio que se termina cobrando. */}
              <div className="mush-card-elevada rounded-3 py-2 px-2 mb-3 d-flex align-items-center justify-content-center gap-3">
                {formula("Precio =", "Costo", "1 - gcia. deseada")}
                <span className="mush-division-vertical"></span>
                {formula("Gcia. real (revend.) =", "Precio rev. - Costo", "Precio rev.")}
              </div>

              {verHistorial ? (
                /* Una fila por fecha con todo lo que hace al precio ese dia:
                   asi se compara un dia contra otro de un vistazo. */
                <div className="mush-scroll-tabla" style={{ maxHeight: "300px" }}>
                  <table
                    className="table mush-tabla mush-tabla-compacta mush-tabla-pareja align-middle mb-0"
                    style={{ tableLayout: "fixed", width: "898px" }}
                  >
                    <thead>
                      <tr className="text-center">
                        <th style={{ width: "84px" }}>
                          <span className="mush-th-caja" style={{ fontSize: "0.62rem" }}>
                            Fecha
                          </span>
                        </th>
                        {COLUMNAS_HISTORIAL.map(({ id, titulo, ancho }) => (
                          <th key={id} style={{ width: ancho }}>
                            <span className="mush-th-caja" style={{ fontSize: "0.62rem" }}>
                              {titulo}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {historialDeReceta(filaModal.receta).length === 0 ? (
                        <tr>
                          <td
                            colSpan={COLUMNAS_HISTORIAL.length + 1}
                            className="text-center py-4 text-secondary"
                          >
                            Todavia no hubo cambios de precio.
                          </td>
                        </tr>
                      ) : (
                        historialDeReceta(filaModal.receta).map((dia) => (
                          <tr key={dia.fecha} style={{ height: ALTO_FILA }}>
                            <td className="text-center">
                              <span
                                className="mush-dato text-secondary"
                                style={{ fontSize: "0.72rem" }}
                              >
                                {fechaLegible(dia.fecha)}
                              </span>
                            </td>
                            {COLUMNAS_HISTORIAL.map(({ id, formato, valor }) => {
                              const dato = valor ? valor(dia) : dia[id];
                              return (
                              <td key={id} className="text-center">
                                <span
                                  className="mush-dato text-white"
                                  style={{ fontSize: "0.72rem" }}
                                >
                                  {formato === "moneda"
                                    ? moneda(dato, 2)
                                    : formato === "porcentaje"
                                      ? porcentaje(dato)
                                      : dato || "-"}
                                </span>
                              </td>
                              );
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <table className="table mush-tabla mush-tabla-compacta align-middle mb-0">
                  <tbody>
                    {FILAS_MODAL.map(
                    ({ titulo, valor, esCosto, esUnidad, campoMargen, canal, canalMargen, nota }) => (
                      <tr key={titulo} style={{ height: ALTO_FILA }}>
                        <td style={{ width: "42%" }}>
                          <span className="text-secondary" style={{ fontSize: "0.75rem" }}>
                            {titulo}
                          </span>
                        </td>
                        {/* El valor va centrado en la celda; lo que lo acompana
                            (la nota) se apoya a la derecha y no lo corre del
                            centro. Los precios no: van con su ganancia al lado. */}
                        <td className="text-center" style={{ position: "relative" }}>
                          {campoMargen ? (
                            <span className="d-flex align-items-center justify-content-center gap-1">
                              {campo(filaModal, campoMargen, "48px")}
                              <span className="text-secondary" style={{ fontSize: "0.72rem" }}>
                                %
                              </span>
                            </span>
                          ) : canal ? (
                            <span className="d-flex align-items-center justify-content-start gap-3 ps-2">
                              <span className="mush-dato text-white" style={{ fontSize: "0.8rem" }}>
                                {moneda(precioDeCanal(filaModal, canal), 2)}
                              </span>
                              <span className="text-secondary" style={{ fontSize: "0.72rem" }}>
                                ganancia:{" "}
                                <span className="mush-dato text-ok">
                                  {moneda(gananciaDeCanal(filaModal, canal), 2)}
                                </span>
                              </span>
                            </span>
                          ) : canalMargen ? (
                            <span className="mush-dato text-white" style={{ fontSize: "0.8rem" }}>
                              {porcentaje(margenRealDeCanal(filaModal, canalMargen))}
                            </span>
                          ) : (
                            <span className="d-block">
                              <span
                                className="mush-dato text-white d-block"
                                style={{ fontSize: "0.8rem" }}
                              >
                                {esCosto
                                  ? moneda(costoDeFila(filaModal), 2)
                                  : esUnidad
                                    ? unidadDeFila(filaModal)
                                    : valor(filaModal, porCaja)}
                              </span>
                              {/* De donde sale el costo de una caja */}
                              {esCosto && detalleDeCosto(filaModal) && (
                                <span
                                  className="text-secondary d-block"
                                  style={{ fontSize: "0.62rem" }}
                                >
                                  {detalleDeCosto(filaModal)}
                                </span>
                              )}
                            </span>
                          )}

                          {nota && (
                            <span
                              className="mush-celda-nota text-secondary fst-italic"
                              style={{ fontSize: "0.72rem" }}
                            >
                              {nota}
                            </span>
                          )}
                        </td>
                      </tr>
                      )
                    )}
                  </tbody>
                </table>
              )}

              {/* Como fueron cambiando los datos que se cargan */}
              <div className="d-flex justify-content-end gap-2 mt-3">
                <button
                  type="button"
                  className="btn-mush-ghost"
                  onClick={() => setVerHistorial((previo) => !previo)}
                >
                  {verHistorial ? "Volver" : "Historial"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreciosVenta;
