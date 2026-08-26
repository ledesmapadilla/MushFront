import { useState } from "react";
import { useMush } from "../../context/MushContext";
import { pesos, porcentaje } from "../../utils/calculos";
import Swal from "sweetalert2";

const CostosFinanzas = () => {
  const {
    recetas,
    costosOperativos,
    setCostosOperativos,
    costear,
    resumen,
  } = useMush();

  // Simulador interactivo
  const [variacionInsumos, setVariacionInsumos] = useState(0); // en %
  const [variacionPrecios, setVariacionPrecios] = useState(0); // en %

  // Modal para editar costos operativos
  const [mostrarModalCostos, setMostrarModalCostos] = useState(false);
  const [formManoObra, setFormManoObra] = useState(costosOperativos.manoDeObraPorTanda);
  const [formIndirectos, setFormIndirectos] = useState(costosOperativos.indirectosPorcentaje * 100);

  const resumenMes = resumen();

  // Matriz de costeo por receta
  const matrizCosteo = recetas.map((r) => {
    const costeo = costear(r);
    const rinde = r.rinde || 60;
    const costoInsumosUnit = costeo.insumos / rinde;
    const manoObraUnit = costeo.manoDeObra / rinde;
    const indirectosUnit = costeo.indirectos / rinde;

    // Cálculo simulado
    const nuevoCostoInsumos = costoInsumosUnit * (1 + variacionInsumos / 100);
    const nuevoCostoTotal = nuevoCostoInsumos + manoObraUnit + indirectosUnit;
    const nuevoPrecioVenta = r.precioVenta * (1 + variacionPrecios / 100);
    const nuevaGanancia = nuevoPrecioVenta - nuevoCostoTotal;
    const nuevoMargen = nuevoPrecioVenta > 0 ? nuevaGanancia / nuevoPrecioVenta : 0;

    return {
      receta: r,
      costoInsumosUnit,
      manoObraUnit,
      indirectosUnit,
      costoTotalUnit: costeo.costoUnitario,
      gananciaUnit: costeo.margenUnitario,
      margenPct: costeo.margenPorcentaje,
      // Simulados
      nuevoCostoTotal,
      nuevoPrecioVenta,
      nuevaGanancia,
      nuevoMargen,
    };
  });

  // Identificar el más rentable
  const masRentablePesos = [...matrizCosteo].sort((a, b) => b.gananciaUnit - a.gananciaUnit)[0];
  const masRentableMargen = [...matrizCosteo].sort((a, b) => b.margenPct - a.margenPct)[0];

  const handleGuardarCostosOperativos = (e) => {
    e.preventDefault();
    setCostosOperativos({
      manoDeObraPorTanda: Number(formManoObra),
      indirectosPorcentaje: Number(formIndirectos) / 100,
    });
    setMostrarModalCostos(false);
    Swal.fire({
      title: "Costos Operativos Actualizados",
      text: "Se recalcularon los costes de todas las tandas y alfajores.",
      icon: "success",
      confirmButtonColor: "#d29a54",
      background: "#16161a",
      color: "#fbf9f6",
    });
  };

  return (
    <div className="container px-4 py-4" style={{ paddingBottom: "75px" }}>
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <span className="mush-kicker">Rentabilidad & Estructura Financiera</span>
          <h2 className="mush-display text-white mb-0">Costos, Márgenes y Ganancias</h2>
        </div>
        <button
          className="btn-mush-ghost"
          onClick={() => {
            setFormManoObra(costosOperativos.manoDeObraPorTanda);
            setFormIndirectos(costosOperativos.indirectosPorcentaje * 100);
            setMostrarModalCostos(true);
          }}
        >
          <i className="bi bi-sliders"></i> Parámetros Operativos
        </button>
      </div>

      {/* Tarjetas KPI de Finanzas */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="mush-kpi-card h-100">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="mush-kicker">Facturación Mensual</span>
              <div className="mush-kpi-icon bg-dulce-suave text-dulce">
                <i className="bi bi-currency-dollar"></i>
              </div>
            </div>
            <h3 className="mush-dato text-white mb-1">{pesos(resumenMes.facturacion)}</h3>
            <span className="small text-secondary">Ingresos brutos por ventas</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="mush-kpi-card h-100">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="mush-kicker">Costo de Mercaderías</span>
              <div className="mush-kpi-icon" style={{ backgroundColor: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
                <i className="bi bi-cart-dash"></i>
              </div>
            </div>
            <h3 className="mush-dato text-white mb-1">{pesos(resumenMes.costo)}</h3>
            <span className="small text-secondary">Insumos + Mano de obra + Indirectos</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="mush-kpi-card h-100">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="mush-kicker">Ganancia Neta</span>
              <div className="mush-kpi-icon" style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                <i className="bi bi-piggy-bank"></i>
              </div>
            </div>
            <h3 className="mush-dato text-ok mb-1">{pesos(resumenMes.ganancia)}</h3>
            <span className="small text-secondary">
              Margen promedio: <strong className="text-white">{porcentaje(resumenMes.margen)}</strong>
            </span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="mush-kpi-card h-100">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="mush-kicker">Alfajor Estrella</span>
              <div className="mush-kpi-icon bg-dulce-suave text-dulce">
                <i className="bi bi-star-fill"></i>
              </div>
            </div>
            <h4 className="text-white fw-bold mb-1 fs-5">{masRentablePesos?.receta.nombre}</h4>
            <span className="small text-ok fw-bold">
              +{pesos(masRentablePesos?.gananciaUnit)} ganancia / unidad
            </span>
          </div>
        </div>
      </div>

      {/* Matriz Comparativa de Costos y Rentabilidad por Variedad */}
      <div className="mush-card p-4 mb-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
          <div>
            <span className="mush-kicker">Fichas de Costeo Comparadas</span>
            <h4 className="mush-display text-white mb-0">Estructura de Costo y Ganancia por Alfajor</h4>
          </div>
          <span className="badge bg-dark border border-secondary text-secondary p-2 small">
            Base: Tanda de 60 unidades
          </span>
        </div>

        <div className="mush-scroll-x">
          <table className="table mush-tabla">
            <thead>
              <tr>
                <th>Alfajor</th>
                <th className="text-end">Materia Prima</th>
                <th className="text-end">Mano de Obra</th>
                <th className="text-end">Indirectos (18%)</th>
                <th className="text-end">Costo Unitario</th>
                <th className="text-end">Precio Venta</th>
                <th className="text-end">Ganancia $</th>
                <th className="text-end">Margen %</th>
                <th className="text-center">Rentabilidad</th>
              </tr>
            </thead>
            <tbody>
              {matrizCosteo.map((item) => (
                <tr key={item.receta.id}>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <span className="fs-4">{item.receta.imagen}</span>
                      <div>
                        <strong className="text-white d-block">{item.receta.nombre}</strong>
                        <span className="small text-secondary">{item.receta.categoria}</span>
                      </div>
                    </div>
                  </td>
                  <td className="text-end mush-dato text-secondary">{pesos(item.costoInsumosUnit)}</td>
                  <td className="text-end mush-dato text-secondary">{pesos(item.manoObraUnit)}</td>
                  <td className="text-end mush-dato text-secondary">{pesos(item.indirectosUnit)}</td>
                  <td className="text-end mush-dato fw-bold text-white fs-6">
                    {pesos(item.costoTotalUnit)}
                  </td>
                  <td className="text-end mush-dato fw-bold text-dulce fs-6">
                    {pesos(item.receta.precioVenta)}
                  </td>
                  <td className="text-end mush-dato fw-bold text-ok fs-6">
                    +{pesos(item.gananciaUnit)}
                  </td>
                  <td className="text-end mush-dato">
                    <span className="mush-badge mush-badge-ok">
                      {porcentaje(item.margenPct)}
                    </span>
                  </td>
                  <td className="text-center">
                    {item.receta.id === masRentablePesos?.receta.id ? (
                      <span className="badge bg-warning text-dark fw-bold">Mayor Ganancia $</span>
                    ) : item.receta.id === masRentableMargen?.receta.id ? (
                      <span className="badge bg-success text-white fw-bold">Mayor Margen %</span>
                    ) : (
                      <span className="badge bg-dark border border-secondary text-secondary">Estándar</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Simulador Interactivo de Escenarios de Costos e Inflación */}
      <div className="mush-card p-4 mb-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
          <div>
            <span className="mush-kicker">Proyección & Sensibilidad</span>
            <h4 className="mush-display text-white mb-0">Simulador de Aumentos y Ajuste de Precios</h4>
          </div>
          {(variacionInsumos !== 0 || variacionPrecios !== 0) && (
            <button
              className="btn btn-sm btn-outline-secondary text-white"
              onClick={() => {
                setVariacionInsumos(0);
                setVariacionPrecios(0);
              }}
            >
              <i className="bi bi-arrow-counterclockwise me-1"></i> Restablecer Valores
            </button>
          )}
        </div>

        <p className="text-secondary small mb-4">
          Ajustá los controles deslizantes para simular el impacto en los márgenes si aumentan los precios de las materias primas o si decidís actualizar la lista de precios de venta.
        </p>

        <div className="row g-4 align-items-center mb-4">
          {/* Slider 1: Variación Materia Prima */}
          <div className="col-12 col-md-6">
            <div className="mush-card-elevada p-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-secondary small fw-bold">
                  Variación Costo Materia Prima:
                </span>
                <span className={`fw-bold mush-dato ${variacionInsumos > 0 ? "text-riesgo" : variacionInsumos < 0 ? "text-ok" : "text-white"}`}>
                  {variacionInsumos > 0 ? `+${variacionInsumos}` : variacionInsumos}%
                </span>
              </div>
              <input
                type="range"
                className="form-range"
                min="-20"
                max="50"
                step="1"
                value={variacionInsumos}
                onChange={(e) => setVariacionInsumos(Number(e.target.value))}
              />
              <div className="d-flex justify-content-between text-secondary" style={{ fontSize: "0.7rem" }}>
                <span>-20%</span>
                <span>0% (Actual)</span>
                <span>+50%</span>
              </div>
            </div>
          </div>

          {/* Slider 2: Variación Precio de Venta */}
          <div className="col-12 col-md-6">
            <div className="mush-card-elevada p-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-secondary small fw-bold">
                  Variación Precio de Venta al Público:
                </span>
                <span className={`fw-bold mush-dato ${variacionPrecios > 0 ? "text-ok" : variacionPrecios < 0 ? "text-riesgo" : "text-white"}`}>
                  {variacionPrecios > 0 ? `+${variacionPrecios}` : variacionPrecios}%
                </span>
              </div>
              <input
                type="range"
                className="form-range"
                min="-20"
                max="50"
                step="1"
                value={variacionPrecios}
                onChange={(e) => setVariacionPrecios(Number(e.target.value))}
              />
              <div className="d-flex justify-content-between text-secondary" style={{ fontSize: "0.7rem" }}>
                <span>-20%</span>
                <span>0% (Actual)</span>
                <span>+50%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Resultados del Simulador */}
        <div className="row g-3">
          {matrizCosteo.map((item) => {
            const difGanancia = item.nuevaGanancia - item.gananciaUnit;
            return (
              <div className="col-12 col-sm-6 col-lg-3" key={item.receta.id}>
                <div className="mush-card-elevada p-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="text-white fw-bold">{item.receta.nombre}</span>
                    <span className="fs-5">{item.receta.imagen}</span>
                  </div>

                  <div className="d-flex justify-content-between small mb-1">
                    <span className="text-secondary">Nuevo Costo:</span>
                    <span className="text-white mush-dato">{pesos(item.nuevoCostoTotal)}</span>
                  </div>
                  <div className="d-flex justify-content-between small mb-1">
                    <span className="text-secondary">Nuevo Precio:</span>
                    <span className="text-dulce fw-bold mush-dato">{pesos(item.nuevoPrecioVenta)}</span>
                  </div>
                  <div className="d-flex justify-content-between small pt-2 border-top border-secondary border-opacity-25 mb-1">
                    <span className="text-secondary">Nueva Ganancia:</span>
                    <span className="text-ok fw-bold mush-dato">{pesos(item.nuevaGanancia)}</span>
                  </div>
                  <div className="d-flex justify-content-between small">
                    <span className="text-secondary">Nuevo Margen:</span>
                    <span className="text-ok mush-dato fw-bold">{porcentaje(item.nuevoMargen)}</span>
                  </div>

                  {difGanancia !== 0 && (
                    <div className="mt-2 text-center small">
                      <span className={`badge ${difGanancia > 0 ? "bg-success" : "bg-danger"}`}>
                        {difGanancia > 0 ? `+${pesos(difGanancia)}` : pesos(difGanancia)} / alfajor
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal: Editar Parámetros Operativos */}
      {mostrarModalCostos && (
        <div className="modal d-block" style={{ backgroundColor: "rgba(0, 0, 0, 0.75)" }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content mush-modal">
              <div className="modal-header mush-modal-header">
                <h5 className="modal-title mush-display text-white">
                  <i className="bi bi-sliders text-dulce me-2"></i>
                  Parámetros de Costos Operativos
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setMostrarModalCostos(false)}
                ></button>
              </div>
              <form onSubmit={handleGuardarCostosOperativos}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label text-secondary small">
                      Mano de Obra Directa por Tanda ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="form-control mush-input"
                      value={formManoObra}
                      onChange={(e) => setFormManoObra(e.target.value)}
                      required
                    />
                    <span className="small text-secondary">
                      Costo estimado de horneado, bañado y empaquetado de 60 unidades.
                    </span>
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-secondary small">
                      Costos Indirectos, Packaging y Amortización (%)
                    </label>
                    <div className="input-group">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        className="form-control mush-input"
                        value={formIndirectos}
                        onChange={(e) => setFormIndirectos(e.target.value)}
                        required
                      />
                      <span className="input-group-text bg-dark border-secondary text-white">%</span>
                    </div>
                    <span className="small text-secondary">
                      Porcentaje aplicado sobre los costos directos (gas, luz, packaging de autor).
                    </span>
                  </div>
                </div>

                <div className="modal-footer mush-modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary text-white"
                    onClick={() => setMostrarModalCostos(false)}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn-mush">
                    Guardar y Recalcular
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

export default CostosFinanzas;
