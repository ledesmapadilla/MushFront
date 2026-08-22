import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useMush } from "../../context/MushContext";
import { pesos, numero, porcentaje } from "../../utils/calculos";
import Swal from "sweetalert2";

const Calculadora = () => {
  const {
    recetas,
    ingredientes,
    costosOperativos,
    costear,
    consumoOrden,
    agregarOrdenProduccion,
  } = useMush();

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Variedad seleccionada (default: 'negro')
  const variedadParam = searchParams.get("variedad");
  const [recetaActivaId, setRecetaActivaId] = useState(
    variedadParam || (recetas[0] ? recetas[0].id : "negro")
  );

  // Cantidad de tandas a calcular
  const [tandasCalculo, setTandasCalculo] = useState(1);

  // Modal para ordenar producción directa
  const [mostrarModalOP, setMostrarModalOP] = useState(false);
  const [opResponsable, setOpResponsable] = useState("Ivana López");
  const [opNotas, setOpNotas] = useState("");

  useEffect(() => {
    if (variedadParam && recetas.some((r) => r.id === variedadParam)) {
      setRecetaActivaId(variedadParam);
    }
  }, [variedadParam, recetas]);

  const recetaActiva = recetas.find((r) => r.id === recetaActivaId) || recetas[0];
  if (!recetaActiva) return null;

  const costeoBase = costear(recetaActiva);
  const consumoCalculado = consumoOrden(recetaActiva, tandasCalculo);

  // Total de unidades calculadas
  const totalUnidades = (recetaActiva.rinde || 60) * tandasCalculo;

  // Costo total de las tandas seleccionadas
  const costoTotalInsumosTandas = consumoCalculado.reduce((acc, c) => acc + c.costoTotal, 0);
  const manoDeObraTotal = costosOperativos.manoDeObraPorTanda * tandasCalculo;
  const directoTotal = costoTotalInsumosTandas + manoDeObraTotal;
  const indirectosTotal = directoTotal * costosOperativos.indirectosPorcentaje;
  const costoTotalLote = directoTotal + indirectosTotal;
  const facturacionEstimada = totalUnidades * recetaActiva.precioVenta;
  const gananciaLote = facturacionEstimada - costoTotalLote;

  // Verificar si hay insumos faltantes en stock para las tandas elegidas
  const insumosFaltantes = consumoCalculado.filter((linea) => {
    const insumoStock = ingredientes.find((i) => i.id === linea.id);
    return !insumoStock || insumoStock.stock < linea.cantidadTotal;
  });

  const handleCrearOP = (e) => {
    e.preventDefault();
    agregarOrdenProduccion({
      recetaId: recetaActiva.id,
      tandas: tandasCalculo,
      responsable: opResponsable,
      notas: opNotas || `Orden creada desde ficha técnica (${tandasCalculo} tandas)`,
      estado: "Planificada",
    });

    setMostrarModalOP(false);
    Swal.fire({
      title: "¡Orden de Producción Creada!",
      html: `Se programó la fabricación de <b>${totalUnidades} alfajores ${recetaActiva.nombre}</b> (${tandasCalculo} tanda${tandasCalculo > 1 ? "s" : ""}).`,
      icon: "success",
      confirmButtonColor: "#d29a54",
      background: "#16161a",
      color: "#fbf9f6",
      showCancelButton: true,
      confirmButtonText: "Ir a Producción",
      cancelButtonText: "Seguir en Calculadora",
    }).then((res) => {
      if (res.isConfirmed) {
        navigate("/produccion");
      }
    });
  };

  return (
    <div style={{ backgroundColor: "#fde047", minHeight: "calc(100vh - 140px)" }} className="py-4">
      <div className="container px-4">
        {/* Header */}
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
          <div>
            <span className="mush-kicker" style={{ color: "#854d0e" }}>Formulaciones & Fichas Técnicas</span>
            <h2 className="mush-display text-dark mb-0">Calculadora de Producción</h2>
          </div>
        <div className="d-flex gap-2">
          <button
            className="btn-mush"
            onClick={() => setMostrarModalOP(true)}
          >
            <i className="bi bi-gear-wide-connected"></i> Programar Fabricación
          </button>
        </div>
      </div>

      {/* Selector de Variedades (Tabs con iconos y badges) */}
      <div className="row g-2 mb-4">
        {recetas.map((r) => {
          const seleccionada = r.id === recetaActivaId;
          const costeoR = costear(r);
          return (
            <div className="col-12 col-sm-6 col-lg-3" key={r.id}>
              <button
                type="button"
                className={`w-100 p-3 text-start mush-card mush-card-hover border ${
                  seleccionada ? "border-dulce bg-dulce-suave" : ""
                }`}
                onClick={() => setRecetaActivaId(r.id)}
                style={{ cursor: "pointer" }}
              >
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <span className="fs-3">{r.imagen || "🍪"}</span>
                  <span className={`mush-badge ${seleccionada ? "mush-badge-dulce" : "mush-badge-info"}`}>
                    {r.badge || "Variedad"}
                  </span>
                </div>
                <h6 className="text-white fw-bold mb-1">{r.nombre}</h6>
                <div className="d-flex justify-content-between small text-secondary">
                  <span>Costo: <strong className="text-white">{pesos(costeoR.costoUnitario)}</strong></span>
                  <span>Venta: <strong className="text-dulce">{pesos(r.precioVenta)}</strong></span>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Contenido de la Receta Activa */}
      <div className="row g-4">
        {/* Columna Izquierda: Calculadora de Tandas, Insumos y Costos */}
        <div className="col-12 col-lg-8">
          {/* Tarjeta de Especificación y Multiplicador */}
          <div className="mush-card p-4 mb-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
              <div>
                <span className="mush-badge mush-badge-dulce mb-1">{recetaActiva.categoria}</span>
                <h3 className="mush-display text-white mb-1">
                  {recetaActiva.imagen} {recetaActiva.nombre}
                </h3>
                <p className="text-secondary mb-0">{recetaActiva.resumen}</p>
              </div>

              {/* Selector de Tandas Interactivo */}
              <div className="mush-card-elevada p-3 d-flex align-items-center gap-3">
                <div>
                  <span className="mush-kicker d-block">Multiplicador</span>
                  <strong className="text-white small">Tandas a Elaborar</strong>
                </div>
                <div className="d-flex align-items-center gap-1">
                  <button
                    className="btn btn-sm btn-outline-secondary text-white px-2 py-1"
                    onClick={() => setTandasCalculo(Math.max(1, tandasCalculo - 1))}
                    disabled={tandasCalculo <= 1}
                  >
                    <i className="bi bi-dash-lg"></i>
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    className="form-control form-control-sm text-center fw-bold mush-input"
                    style={{ width: "60px" }}
                    value={tandasCalculo}
                    onChange={(e) => setTandasCalculo(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                  <button
                    className="btn btn-sm btn-outline-secondary text-white px-2 py-1"
                    onClick={() => setTandasCalculo(tandasCalculo + 1)}
                  >
                    <i className="bi bi-plus-lg"></i>
                  </button>
                </div>
              </div>
            </div>

            {/* Ficha rápida de parámetros técnicos */}
            <div className="row g-2 pt-2 border-top border-secondary border-opacity-25 text-center">
              <div className="col-6 col-sm-3">
                <div className="p-2 rounded bg-black bg-opacity-40">
                  <span className="text-secondary small d-block">Rendimiento Base</span>
                  <strong className="text-white mush-dato">{recetaActiva.rinde} un / tanda</strong>
                </div>
              </div>
              <div className="col-6 col-sm-3">
                <div className="p-2 rounded bg-black bg-opacity-40">
                  <span className="text-secondary small d-block">Total a Fabricar</span>
                  <strong className="text-dulce mush-dato">{totalUnidades} alfajores</strong>
                </div>
              </div>
              <div className="col-6 col-sm-3">
                <div className="p-2 rounded bg-black bg-opacity-40">
                  <span className="text-secondary small d-block">Tiempo de Proceso</span>
                  <strong className="text-white mush-dato">{recetaActiva.tiempoMinutos} min</strong>
                </div>
              </div>
              <div className="col-6 col-sm-3">
                <div className="p-2 rounded bg-black bg-opacity-40">
                  <span className="text-secondary small d-block">Horneado</span>
                  <strong className="text-white mush-dato">{recetaActiva.temperatura}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Tabla de Insumos Requeridos y Stock Disponible */}
          <div className="mush-card p-4 mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <span className="mush-kicker">Materia Prima Necesaria</span>
                <h5 className="mush-display text-white mb-0">
                  Ingredientes para {tandasCalculo} Tanda{tandasCalculo > 1 ? "s" : ""} ({totalUnidades} un.)
                </h5>
              </div>
              {insumosFaltantes.length > 0 ? (
                <span className="mush-badge mush-badge-critico">
                  <i className="bi bi-exclamation-triangle-fill"></i> Faltan {insumosFaltantes.length} insumos en stock
                </span>
              ) : (
                <span className="mush-badge mush-badge-ok">
                  <i className="bi bi-check-circle-fill"></i> Stock suficiente disponible
                </span>
              )}
            </div>

            <div className="mush-scroll-x">
              <table className="table mush-tabla">
                <thead>
                  <tr>
                    <th>Ingrediente</th>
                    <th>Categoría</th>
                    <th className="text-end">Por Tanda</th>
                    <th className="text-end">Cantidad Total</th>
                    <th className="text-end">Stock Actual</th>
                    <th className="text-end">Precio Unit.</th>
                    <th className="text-end">Costo Total</th>
                    <th className="text-center">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {consumoCalculado.map((item) => {
                    const insumoStock = ingredientes.find((i) => i.id === item.id);
                    const stockDisp = insumoStock ? insumoStock.stock : 0;
                    const alcanza = stockDisp >= item.cantidadTotal;

                    return (
                      <tr key={item.id}>
                        <td className="fw-bold text-white">
                          {item.nombre}
                        </td>
                        <td>
                          <span className="badge bg-dark text-secondary border border-secondary border-opacity-25 small">
                            {item.categoria}
                          </span>
                        </td>
                        <td className="text-end mush-dato text-secondary">
                          {numero(item.cantidad)} {item.unidad}
                        </td>
                        <td className="text-end mush-dato text-dulce fw-bold">
                          {numero(item.cantidadTotal)} {item.unidad}
                        </td>
                        <td className="text-end mush-dato">
                          <span className={alcanza ? "text-white" : "text-riesgo fw-bold"}>
                            {numero(stockDisp)} {item.unidad}
                          </span>
                        </td>
                        <td className="text-end text-secondary mush-dato">
                          {pesos(item.precio)} / {item.unidad}
                        </td>
                        <td className="text-end fw-bold text-white mush-dato">
                          {pesos(item.costoTotal)}
                        </td>
                        <td className="text-center">
                          {alcanza ? (
                            <span className="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25">
                              OK
                            </span>
                          ) : (
                            <span className="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-25">
                              Faltante
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-top border-secondary">
                    <td colSpan="6" className="text-end fw-bold text-white">
                      Total Materia Prima ({tandasCalculo} tandas):
                    </td>
                    <td className="text-end text-dulce fw-bold fs-6 mush-dato">
                      {pesos(costoTotalInsumosTandas)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Paso a paso de Elaboración */}
          <div className="mush-card p-4">
            <span className="mush-kicker">Guía Técnica de Producción</span>
            <h5 className="mush-display text-white mb-3">Procedimiento Paso a Paso</h5>

            <div className="d-flex flex-column gap-3">
              {recetaActiva.pasos.map((paso, index) => (
                <div key={index} className="mush-card-elevada p-3 d-flex align-items-start gap-3">
                  <div
                    className="bg-dulce-suave text-dulce fw-bold rounded-circle d-flex align-items-center justify-content-center"
                    style={{ width: "32px", height: "32px", flexShrink: 0 }}
                  >
                    {index + 1}
                  </div>
                  <div className="text-light small pt-1 lh-base">
                    {paso}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Columna Derecha: Costeo Financiero & Rentabilidad */}
        <div className="col-12 col-lg-4">
          <div className="mush-card p-4 sticky-top" style={{ top: "85px" }}>
            <span className="mush-kicker">Estructura Económica</span>
            <h5 className="mush-display text-white mb-3">Costeo & Margen Unitario</h5>

            {/* Resumen Unitario */}
            <div className="mush-card-elevada p-3 mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-secondary small">Precio de Venta al Público:</span>
                <span className="text-dulce fw-bold fs-5 mush-dato">
                  {pesos(recetaActiva.precioVenta)}
                </span>
              </div>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-secondary small">Costo Unitario Total:</span>
                <span className="text-white fw-bold mush-dato">
                  {pesos(costeoBase.costoUnitario)}
                </span>
              </div>
              <div className="d-flex justify-content-between align-items-center pt-2 border-top border-secondary border-opacity-25">
                <span className="text-white small fw-bold">Ganancia Neta por Alfajor:</span>
                <span className="text-ok fw-bold fs-5 mush-dato">
                  {pesos(costeoBase.margenUnitario)}
                </span>
              </div>
              <div className="text-end small text-ok mt-1">
                Margen de Rentabilidad: <strong>{porcentaje(costeoBase.margenPorcentaje)}</strong>
              </div>
            </div>

            {/* Desglose de Costos por Tanda (60 un) */}
            <h6 className="text-secondary small text-uppercase tracking-wider mb-2">
              Desglose por Tanda (60 unidades)
            </h6>
            <div className="d-flex flex-column gap-2 mb-4">
              <div className="d-flex justify-content-between small">
                <span className="text-secondary">Materia Prima Directa:</span>
                <span className="text-white mush-dato">{pesos(costeoBase.insumos)}</span>
              </div>
              <div className="d-flex justify-content-between small">
                <span className="text-secondary">Mano de Obra Directa:</span>
                <span className="text-white mush-dato">{pesos(costeoBase.manoDeObra)}</span>
              </div>
              <div className="d-flex justify-content-between small">
                <span className="text-secondary">Costos Indirectos & Packaging (18%):</span>
                <span className="text-white mush-dato">{pesos(costeoBase.indirectos)}</span>
              </div>
              <div className="d-flex justify-content-between small fw-bold pt-2 border-top border-secondary border-opacity-25">
                <span className="text-white">Costo Total de Tanda:</span>
                <span className="text-dulce mush-dato">{pesos(costeoBase.costoTanda)}</span>
              </div>
            </div>

            {/* Proyección del Lote Seleccionado ({tandasCalculo} tandas) */}
            <div className="mush-card-elevada p-3 mb-4 bg-black bg-opacity-40">
              <span className="mush-kicker">Proyección del Lote ({totalUnidades} alfajores)</span>
              <div className="d-flex justify-content-between small mb-1 mt-2">
                <span className="text-secondary">Facturación Estimada:</span>
                <span className="text-white fw-bold mush-dato">{pesos(facturacionEstimada)}</span>
              </div>
              <div className="d-flex justify-content-between small mb-1">
                <span className="text-secondary">Costo Total Lote:</span>
                <span className="text-secondary mush-dato">{pesos(costoTotalLote)}</span>
              </div>
              <div className="d-flex justify-content-between small pt-2 border-top border-secondary border-opacity-25">
                <span className="text-ok fw-bold">Ganancia Proyectada:</span>
                <span className="text-ok fw-bold fs-6 mush-dato">{pesos(gananciaLote)}</span>
              </div>
            </div>

            {/* Botón Mandar a Fabricar */}
            <button
              className="btn-mush w-100 justify-content-center py-2"
              onClick={() => setMostrarModalOP(true)}
            >
              <i className="bi bi-play-circle-fill"></i> Mandar a Fabricar Lote
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Crear Orden de Producción Directa */}
      {mostrarModalOP && (
        <div className="modal d-block" style={{ backgroundColor: "rgba(0, 0, 0, 0.75)" }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content mush-modal">
              <div className="modal-header mush-modal-header">
                <h5 className="modal-title mush-display text-white">
                  <i className="bi bi-gear-wide-connected text-dulce me-2"></i>
                  Crear Orden de Producción
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setMostrarModalOP(false)}
                ></button>
              </div>
              <form onSubmit={handleCrearOP}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label text-secondary small">Alfajor a Elaborar</label>
                    <input
                      type="text"
                      className="form-control mush-input"
                      value={recetaActiva.nombre}
                      disabled
                    />
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-6">
                      <label className="form-label text-secondary small">Tandas</label>
                      <input
                        type="number"
                        min="1"
                        className="form-control mush-input"
                        value={tandasCalculo}
                        onChange={(e) => setTandasCalculo(Math.max(1, parseInt(e.target.value) || 1))}
                        required
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label text-secondary small">Total Alfajores</label>
                      <input
                        type="text"
                        className="form-control mush-input text-dulce fw-bold"
                        value={`${totalUnidades} unidades`}
                        disabled
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-secondary small">Responsable de Tanda</label>
                    <select
                      className="form-select mush-select"
                      value={opResponsable}
                      onChange={(e) => setOpResponsable(e.target.value)}
                    >
                      <option value="Ivana López">Ivana López (Pastelera Jefa)</option>
                      <option value="Sofía Ramos">Sofía Ramos (Chocolatería)</option>
                      <option value="Marcos V.">Marcos V. (Horneado & Armado)</option>
                      <option value="Equipo MUSH">Equipo Completo MUSH</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-secondary small">Notas / Pedido Asociado</label>
                    <textarea
                      className="form-control mush-input"
                      rows="2"
                      placeholder="Ej. Stock para cafeterías o evento del fin de semana..."
                      value={opNotas}
                      onChange={(e) => setOpNotas(e.target.value)}
                    ></textarea>
                  </div>

                  {insumosFaltantes.length > 0 && (
                    <div className="alert alert-warning py-2 small mb-0">
                      <i className="bi bi-exclamation-triangle-fill me-1"></i>
                      Aviso: Hay {insumosFaltantes.length} insumo(s) con stock menor al requerido. Podés crear la orden y reponer los insumos en compras.
                    </div>
                  )}
                </div>

                <div className="modal-footer mush-modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary text-white"
                    onClick={() => setMostrarModalOP(false)}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn-mush">
                    Confirmar y Programar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default Calculadora;
