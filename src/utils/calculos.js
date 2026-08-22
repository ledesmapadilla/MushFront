import { ventasMensuales } from "../data/negocio";

const formateadorPesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const formateadorNumero = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 2,
});

export const pesos = (valor) => formateadorPesos.format(valor || 0);
export const numero = (valor) => formateadorNumero.format(valor || 0);
export const porcentaje = (valor, decimales = 1) =>
  `${((valor || 0) * 100).toFixed(decimales)} %`;

const buscarIngrediente = (id, listaIngredientes) =>
  listaIngredientes.find((item) => item.id === id);

/** Estado del stock de un insumo respecto de su minimo. */
export const estadoStock = (insumo) => {
  if (!insumo) return "ok";
  if (insumo.stock < insumo.minimo) return "critico";
  if (insumo.stock < insumo.minimo * 1.25) return "bajo";
  return "ok";
};

/** Costo de cada insumo dentro de una tanda, ordenado por incidencia. */
const detalleInsumos = (receta, listaIngredientes) => {
  if (!receta || !receta.ingredientes) return [];
  const lineas = receta.ingredientes.map(({ id, cantidad }) => {
    const insumo = buscarIngrediente(id, listaIngredientes) || {
      nombre: id,
      unidad: "kg",
      precio: 0,
    };
    return {
      id,
      nombre: insumo.nombre,
      unidad: insumo.unidad,
      categoria: insumo.categoria || "Insumo",
      cantidad,
      precio: insumo.precio,
      costo: cantidad * insumo.precio,
    };
  });

  const total = lineas.reduce((acumulado, linea) => acumulado + linea.costo, 0);

  return lineas
    .map((linea) => ({
      ...linea,
      incidencia: total > 0 ? linea.costo / total : 0,
    }))
    .sort((a, b) => b.costo - a.costo);
};

/** Costeo completo de una receta, por tanda y por unidad. */
export const costearReceta = (receta, listaIngredientes, operativos) => {
  if (!receta) return {};
  const insumosDetalle = detalleInsumos(receta, listaIngredientes);
  const insumos = insumosDetalle.reduce(
    (acumulado, linea) => acumulado + linea.costo,
    0,
  );
  const manoDeObra = operativos.manoDeObraPorTanda || 0;
  const directo = insumos + manoDeObra;
  const indirectos = directo * (operativos.indirectosPorcentaje || 0);
  const costoTanda = directo + indirectos;
  const rinde = receta.rinde || 60;
  const costoUnitario = costoTanda / rinde;
  const precioVenta = receta.precioVenta || 0;
  const margenUnitario = precioVenta - costoUnitario;

  return {
    insumos,
    insumosDetalle,
    manoDeObra,
    indirectos,
    costoTanda,
    rinde,
    costoUnitario,
    margenUnitario,
    margenPorcentaje: precioVenta > 0 ? margenUnitario / precioVenta : 0,
    markup: costoUnitario > 0 ? precioVenta / costoUnitario : 0,
  };
};

/** Insumos que consume una orden de N tandas. */
export const consumoDeOrden = (receta, tandas, listaIngredientes) =>
  detalleInsumos(receta, listaIngredientes).map((linea) => ({
    ...linea,
    cantidadTotal: linea.cantidad * tandas,
    costoTotal: linea.costo * tandas,
  }));

/** Insumos por debajo del minimo, para avisos en el tablero. */
export const insumosEnAlerta = (listaIngredientes) =>
  listaIngredientes
    .filter((insumo) => estadoStock(insumo) !== "ok")
    .sort((a, b) => (a.stock / (a.minimo || 1)) - (b.stock / (b.minimo || 1)));

/** Cálculo de resumen mensual dinámico */
export const calcularResumenMes = (listaRecetas, listaIngredientes, operativos) => {
  if (!ventasMensuales || ventasMensuales.length === 0) {
    return {
      mes: "Actual",
      unidades: 0,
      facturacion: 0,
      costo: 0,
      ganancia: 0,
      margen: 0,
      variacionUnidades: 0,
      resultadoPorReceta: [],
    };
  }

  const ultimoMes = ventasMensuales[ventasMensuales.length - 1] || { mes: "Actual" };
  const mesPrevio = ventasMensuales[ventasMensuales.length - 2] || {};

  const resultadoPorReceta = (listaRecetas || []).map((receta) => {
    const costeo = costearReceta(receta, listaIngredientes, operativos);
    const unidades = ultimoMes[receta.id] || 0;
    const facturacion = unidades * (receta.precioVenta || 0);
    const costo = unidades * (costeo.costoUnitario || 0);

    return {
      receta,
      costeo,
      unidades,
      facturacion,
      costo,
      ganancia: facturacion - costo,
    };
  });

  const acumular = (campo) =>
    resultadoPorReceta.reduce((total, fila) => total + (fila[campo] || 0), 0);

  const unidadesMesPrevio = (listaRecetas || []).reduce(
    (total, receta) => total + (mesPrevio[receta.id] || 0),
    0,
  );

  const totalUnidades = acumular("unidades");
  const totalFacturacion = acumular("facturacion");
  const totalCosto = acumular("costo");
  const totalGanancia = acumular("ganancia");

  return {
    mes: ultimoMes.mes,
    unidades: totalUnidades,
    facturacion: totalFacturacion,
    costo: totalCosto,
    ganancia: totalGanancia,
    margen: totalFacturacion > 0 ? totalGanancia / totalFacturacion : 0,
    variacionUnidades: unidadesMesPrevio > 0 ? (totalUnidades / unidadesMesPrevio - 1) : 0,
    resultadoPorReceta,
  };
};

/** Serie mensual para gráficos */
export const calcularSerieMensual = (listaRecetas, listaIngredientes, operativos) => {
  if (!ventasMensuales || ventasMensuales.length === 0) return [];
  return ventasMensuales.map((mes) => {
    const totales = (listaRecetas || []).reduce(
      (acumulado, receta) => {
        const unidades = mes[receta.id] || 0;
        const costeo = costearReceta(receta, listaIngredientes, operativos);
        return {
          unidades: acumulado.unidades + unidades,
          facturacion: acumulado.facturacion + unidades * (receta.precioVenta || 0),
          costo: acumulado.costo + unidades * (costeo.costoUnitario || 0),
        };
      },
      { unidades: 0, facturacion: 0, costo: 0 },
    );

    return {
      mes: mes.mes,
      ...totales,
      ganancia: totales.facturacion - totales.costo,
    };
  });
};
