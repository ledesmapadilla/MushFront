import { Link } from "react-router-dom";
import { useMush } from "../../context/MushContext";
import { pesos, numero, porcentaje } from "../../utils/calculos";
import { ventasMensuales } from "../../data/negocio";

const Inicio = () => {
  const {
    recetas,
    ingredientes,
    ordenesProduccion,
    costear,
    listaAlertas,
    resumen,
    canalesVenta,
    serie,
  } = useMush();

  const alertas = listaAlertas();
  const resumenMes = resumen();
  const serieMensual = serie();
  const opEnProceso = ordenesProduccion.filter((op) => op.estado === "En proceso");

  // Total de unidades producidas en órdenes terminadas
  const totalUnidadesProducidas = ordenesProduccion
    .filter((op) => op.estado === "Terminada")
    .reduce((acc, op) => acc + op.unidades, 0);

  // Valor total del inventario de insumos
  const valorInventarioInsumos = ingredientes.reduce(
    (acc, item) => acc + item.stock * item.precio,
    0
  );

  return (
    <div className="container px-4 pt-2 pb-5">
      {/* Hero Banner de Marca Contenido */}
      <section className="mush-hero mush-card p-4 p-lg-5 mb-4 rounded-4">
        <div className="row align-items-center gy-4">
          <div className="col-12 col-lg-8">
            <div className="d-flex align-items-center gap-2 mb-2">
              <span className="mush-kicker">Panel de Control & Fábrica</span>
              <span className="badge bg-dulce-suave text-dulce border border-dulce small">
                Versión Prototipo
              </span>
            </div>
            <h1 className="mush-display text-white display-5 fw-bold mb-3">
              Gestión Integral MUSH
            </h1>
            <p className="lead text-secondary mb-4" style={{ maxWidth: "680px" }}>
              Control en tiempo real de <strong>recetas de autor</strong>, costeo de materias primas, planificación de <strong>tandas de producción</strong>, inventario de insumos y rentabilidad de ventas.
            </p>

            {/* Botones de acción rápida */}
            <div className="d-flex flex-wrap gap-2">
              <Link to="/produccion" className="btn-mush">
                <i className="bi bi-gear-wide-connected"></i> Nueva Tanda de Producción
              </Link>
              <Link to="/stock" className="btn-mush-ghost">
                <i className="bi bi-box-seam"></i> Insumos & Compras
              </Link>
              <Link to="/ventas" className="btn-mush-ghost">
                <i className="bi bi-cart-plus"></i> Registrar Venta
              </Link>
            </div>
          </div>

          <div className="col-12 col-lg-4 text-center">
            <div className="p-3 d-inline-block">
              <img
                src="/mush-logo.png"
                alt="MUSH Alfajores de Autor"
                className="mush-logo-hero img-fluid"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/logo.jpg";
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <div>
        {/* Alerta de Stock si hay insumos en estado crítico o bajo */}
        {alertas.length > 0 && (
          <div className="alert mush-card border-warning text-light p-3 mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div className="d-flex align-items-center gap-3">
              <div
                className="bg-warning text-dark rounded-circle d-flex align-items-center justify-content-center"
                style={{ width: "42px", height: "42px", flexShrink: 0 }}
              >
                <i className="bi bi-exclamation-triangle-fill fs-5"></i>
              </div>
              <div>
                <h6 className="fw-bold mb-0 text-warning">
                  Atención: {alertas.length} insumo{alertas.length > 1 ? "s" : ""} por debajo del stock de seguridad
                </h6>
                <span className="small text-secondary">
                  {alertas.map((a) => `${a.nombre} (${a.stock} ${a.unidad})`).join(", ")}
                </span>
              </div>
            </div>
            <Link to="/stock" className="btn btn-sm btn-warning fw-bold text-dark px-3 py-2">
              <i className="bi bi-cart-check-fill me-1"></i> Generar Orden de Compra
            </Link>
          </div>
        )}

        {/* Tarjetas de Métricas Clave (KPIs) */}
        <div className="row g-3 mb-4">
          <div className="col-12 col-sm-6 col-xl-3">
            <div className="mush-kpi-card h-100">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <span className="mush-kicker">Facturación Mes ({resumenMes.mes})</span>
                <div className="mush-kpi-icon bg-dulce-suave text-dulce">
                  <i className="bi bi-currency-dollar"></i>
                </div>
              </div>
              <h3 className="mush-dato text-white mb-1">{pesos(resumenMes.facturacion)}</h3>
              <div className="small text-secondary d-flex align-items-center gap-1">
                <span className="text-ok fw-bold">
                  <i className="bi bi-arrow-up-right"></i> +{porcentaje(resumenMes.variacionUnidades)}
                </span>
                <span>vs mes anterior</span>
              </div>
            </div>
          </div>

          <div className="col-12 col-sm-6 col-xl-3">
            <div className="mush-kpi-card h-100">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <span className="mush-kicker">Ganancia Neta Estimada</span>
                <div className="mush-kpi-icon" style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                  <i className="bi bi-graph-up-arrow"></i>
                </div>
              </div>
              <h3 className="mush-dato text-ok mb-1">{pesos(resumenMes.ganancia)}</h3>
              <div className="small text-secondary">
                Margen operativo: <span className="text-white fw-bold">{porcentaje(resumenMes.margen)}</span>
              </div>
            </div>
          </div>

          <div className="col-12 col-sm-6 col-xl-3">
            <div className="mush-kpi-card h-100">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <span className="mush-kicker">Alfajores Vendidos (Mes)</span>
                <div className="mush-kpi-icon" style={{ backgroundColor: "rgba(56, 189, 248, 0.15)", color: "#38bdf8" }}>
                  <i className="bi bi-bag-check"></i>
                </div>
              </div>
              <h3 className="mush-dato text-white mb-1">{numero(resumenMes.unidades)} un.</h3>
              <div className="small text-secondary">
                {numero(Math.round(resumenMes.unidades / 12))} docenas distribuidas
              </div>
            </div>
          </div>

          <div className="col-12 col-sm-6 col-xl-3">
            <div className="mush-kpi-card h-100">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <span className="mush-kicker">Stock & Fabricación</span>
                <div className="mush-kpi-icon" style={{ backgroundColor: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>
                  <i className="bi bi-boxes"></i>
                </div>
              </div>
              <h3 className="mush-dato text-white mb-1">{pesos(valorInventarioInsumos)}</h3>
              <div className="small text-secondary">
                {ingredientes.length} insumos | {totalUnidadesProducidas} alfajores fabricados
              </div>
            </div>
          </div>
        </div>

        {/* Sección: Las 4 Variedades de Alfajores MUSH */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <span className="mush-kicker">Catálogo & Fichas Técnicas</span>
            <h4 className="mush-display text-white mb-0">Variedades de Alfajores</h4>
          </div>
          <Link to="/recetas" className="btn-mush-outline btn-sm">
            Ver Recetas <i className="bi bi-arrow-right"></i>
          </Link>
        </div>

        <div className="row g-3 mb-5">
          {recetas.map((receta) => {
            const costeo = costear(receta);
            return (
              <div className="col-12 col-sm-6 col-lg-3" key={receta.id}>
                <div className="mush-card mush-card-hover h-100 p-3 d-flex flex-column justify-content-between">
                  <div>
                    {/* Header de la card */}
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <span className="fs-3">{receta.imagen || "🍪"}</span>
                      <span className="mush-badge mush-badge-dulce">{receta.badge || "Autor"}</span>
                    </div>

                    <h5 className="text-white fw-bold mb-1">{receta.nombre}</h5>
                    <p className="text-secondary small mb-3" style={{ minHeight: "40px" }}>
                      {receta.resumen}
                    </p>

                    {/* Datos de costeo rápido */}
                    <div className="mush-card-elevada p-2 mb-3">
                      <div className="d-flex justify-content-between small mb-1">
                        <span className="text-secondary">Costo Unitario:</span>
                        <span className="text-white fw-bold mush-dato">{pesos(costeo.costoUnitario)}</span>
                      </div>
                      <div className="d-flex justify-content-between small mb-1">
                        <span className="text-secondary">Precio de Venta:</span>
                        <span className="text-dulce fw-bold mush-dato">{pesos(receta.precioVenta)}</span>
                      </div>
                      <div className="d-flex justify-content-between small">
                        <span className="text-secondary">Margen Ganancia:</span>
                        <span className="text-ok fw-bold mush-dato">
                          {pesos(costeo.margenUnitario)} ({porcentaje(costeo.margenPorcentaje)})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Botón ver receta */}
                  <Link
                    to={`/recetas/${receta.id}`}
                    className="btn btn-sm btn-outline-secondary w-100 text-white d-flex align-items-center justify-content-center gap-1"
                  >
                    <i className="bi bi-book"></i> Ver Receta
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dos columnas: Producción en Proceso y Ventas Recientes */}
        <div className="row g-4 mb-4">
          {/* Columna Izquierda: Órdenes de Producción Activas */}
          <div className="col-12 col-lg-6">
            <div className="mush-card p-4 h-100">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <span className="mush-kicker">Fábrica en Marcha</span>
                  <h5 className="mush-display text-white mb-0">Tandas en Producción</h5>
                </div>
                <Link to="/produccion" className="btn-mush btn-sm">
                  <i className="bi bi-plus-lg"></i> Nueva Tanda
                </Link>
              </div>

              {opEnProceso.length === 0 ? (
                <div className="text-center py-4 text-secondary">
                  <i className="bi bi-check2-circle fs-2 text-ok d-block mb-2"></i>
                  No hay tandas en proceso actualmente.
                </div>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {opEnProceso.map((op) => {
                    const receta = recetas.find((r) => r.id === op.recetaId);
                    return (
                      <div key={op.id} className="mush-card-elevada p-3">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div>
                            <span className="badge bg-dark border border-secondary text-secondary me-2">
                              {op.id}
                            </span>
                            <strong className="text-white">{receta ? receta.nombre : op.recetaId}</strong>
                          </div>
                          <span className="mush-badge mush-badge-alerta">
                            <i className="bi bi-hourglass-split"></i> {op.estado}
                          </span>
                        </div>
                        <div className="d-flex justify-content-between align-items-center small text-secondary">
                          <span>
                            <i className="bi bi-layers me-1 text-dulce"></i>
                            {op.tandas} tanda{op.tandas > 1 ? "s" : ""} ({op.unidades} alfajores)
                          </span>
                          <span>
                            <i className="bi bi-person me-1"></i>
                            {op.responsable}
                          </span>
                          <Link to="/produccion" className="text-dulce text-decoration-none">
                            Gestionar <i className="bi bi-chevron-right"></i>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Columna Derecha: Canales de Venta & Distribución */}
          <div className="col-12 col-lg-6">
            <div className="mush-card p-4 h-100">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <span className="mush-kicker">Distribución & Ventas</span>
                  <h5 className="mush-display text-white mb-0">Canales de Comercialización</h5>
                </div>
                <Link to="/finanzas" className="btn-mush-ghost btn-sm">
                  Ver Finanzas <i className="bi bi-arrow-right"></i>
                </Link>
              </div>

              <div className="d-flex flex-column gap-3">
                {canalesVenta.map((canal) => (
                  <div key={canal.canal} className="mush-card-elevada p-3">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="text-white fw-bold">{canal.canal}</span>
                      <span className="text-dulce fw-bold mush-dato">
                        {numero(canal.unidades)} un. ({porcentaje(canal.participacion)})
                      </span>
                    </div>
                    <div className="mush-progress-bar mb-2">
                      <div
                        className="mush-progress-fill"
                        style={{
                          width: `${canal.participacion * 100}%`,
                          backgroundColor: canal.color || "#d29a54",
                        }}
                      ></div>
                    </div>
                    <span className="text-secondary small">{canal.notas}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sección: Evolución Mensual de Producción y Ventas */}
        <div className="mush-card p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
            <div>
              <span className="mush-kicker">Histórico Semestral</span>
              <h5 className="mush-display text-white mb-0">Evolución de Facturación vs Ganancia</h5>
            </div>
            <div className="d-flex gap-3 small">
              <span className="d-flex align-items-center gap-1 text-secondary">
                <span style={{ width: "12px", height: "12px", backgroundColor: "#d29a54", borderRadius: "3px" }}></span>
                Facturación Bruta
              </span>
              <span className="d-flex align-items-center gap-1 text-secondary">
                <span style={{ width: "12px", height: "12px", backgroundColor: "#10b981", borderRadius: "3px" }}></span>
                Ganancia Neta
              </span>
            </div>
          </div>

          <div className="mush-scroll-x">
            <table className="table mush-tabla">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Alfajores Vendidos</th>
                  <th>Negro</th>
                  <th>Blanco</th>
                  <th>Maicena</th>
                  <th>Nuez</th>
                  <th>Facturación</th>
                  <th>Costo Estimado</th>
                  <th>Ganancia Neta</th>
                  <th>Margen %</th>
                </tr>
              </thead>
              <tbody>
                {serieMensual.map((m, idx) => {
                  const datosMes = ventasMensuales[idx] || { negro: "-", blanco: "-", maicena: "-", nuez: "-" };
                  const margenPct = m.facturacion > 0 ? m.ganancia / m.facturacion : 0;
                  return (
                    <tr key={m.mes}>
                      <td className="fw-bold text-white">{m.mes} 2026</td>
                      <td className="fw-bold text-dulce">{numero(m.unidades)}</td>
                      <td>{datosMes?.negro || "-"}</td>
                      <td>{datosMes?.blanco || "-"}</td>
                      <td>{datosMes?.maicena || "-"}</td>
                      <td>{datosMes?.nuez || "-"}</td>
                      <td className="text-white fw-bold">{pesos(m.facturacion)}</td>
                      <td className="text-secondary">{pesos(m.costo)}</td>
                      <td className="text-ok fw-bold">{pesos(m.ganancia)}</td>
                      <td>
                        <span className="mush-badge mush-badge-ok">
                          {porcentaje(margenPct)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Inicio;
