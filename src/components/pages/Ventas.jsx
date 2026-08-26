import { useState } from "react";
import { useMush } from "../../context/MushContext";
import { pesos, numero, porcentaje } from "../../utils/calculos";
import Swal from "sweetalert2";

const Ventas = () => {
  const { recetas, ventas, canalesVenta, registrarVenta, costear } = useMush();

  const [filtroCanal, setFiltroCanal] = useState("todos");
  const [filtroReceta, setFiltroReceta] = useState("todos");
  const [mostrarModalVenta, setMostrarModalVenta] = useState(false);

  // Formulario nueva venta
  const [nuevaVenta, setNuevaVenta] = useState({
    recetaId: recetas[0] ? recetas[0].id : "negro",
    cliente: "Mostrador Local",
    canal: "Local Propio",
    cantidad: 12,
    precioUnitario: recetas[0] ? recetas[0].precioVenta : 1800,
    metodoPago: "Efectivo",
    fecha: new Date().toISOString().split("T")[0],
    notas: "",
  });

  // Métricas acumuladas de ventas registradas
  const totalFacturado = ventas.reduce((acc, v) => acc + (v.total || 0), 0);
  const totalUnidadesVendidas = ventas.reduce((acc, v) => acc + (v.cantidad || 0), 0);

  // Ganancia total acumulada en ventas
  const totalGananciaVentas = ventas.reduce((acc, v) => {
    const receta = recetas.find((r) => r.id === v.recetaId);
    const costeo = costear(receta);
    const costoUnit = costeo ? costeo.costoUnitario : 0;
    const costoVenta = (v.cantidad || 0) * costoUnit;
    return acc + ((v.total || 0) - costoVenta);
  }, 0);

  const margenPromedio = totalFacturado > 0 ? totalGananciaVentas / totalFacturado : 0;

  // Filtrado
  const ventasFiltradas = ventas.filter((v) => {
    const coincideCanal = filtroCanal === "todos" || v.canal === filtroCanal;
    const coincideReceta = filtroReceta === "todos" || v.recetaId === filtroReceta;
    return coincideCanal && coincideReceta;
  });

  // Ranking de ventas por variedad
  const rankingVariedades = recetas.map((r) => {
    const ventasR = ventas.filter((v) => v.recetaId === r.id);
    const unidades = ventasR.reduce((acc, v) => acc + (v.cantidad || 0), 0);
    const facturacion = ventasR.reduce((acc, v) => acc + (v.total || 0), 0);
    return {
      receta: r,
      unidades,
      facturacion,
    };
  }).sort((a, b) => b.unidades - a.unidades);

  // Al cambiar variedad en el formulario de venta, actualizar precio sugerido
  const handleRecetaChange = (recetaId) => {
    const r = recetas.find((item) => item.id === recetaId);
    setNuevaVenta({
      ...nuevaVenta,
      recetaId,
      precioUnitario: r ? r.precioVenta : 1800,
    });
  };

  const handleGuardarVenta = (e) => {
    e.preventDefault();
    const cant = Number(nuevaVenta.cantidad) || 1;
    const precio = Number(nuevaVenta.precioUnitario) || 0;
    const total = cant * precio;
    const receta = recetas.find((r) => r.id === nuevaVenta.recetaId);

    registrarVenta({
      ...nuevaVenta,
      cantidad: cant,
      precioUnitario: precio,
      total,
    });

    setMostrarModalVenta(false);
    Swal.fire({
      title: "¡Venta Registrada con Éxito!",
      html: `Se registraron <b>${cant} alfajores ${receta?.nombre}</b> para <b>${nuevaVenta.cliente}</b>.<br>Total: <b>${pesos(total)}</b>`,
      icon: "success",
      confirmButtonColor: "#d29a54",
      background: "#16161a",
      color: "#fbf9f6",
    });
  };

  const totalCalculadoModal = (Number(nuevaVenta.cantidad) || 0) * (Number(nuevaVenta.precioUnitario) || 0);

  return (
    <div className="container px-4 py-4" style={{ paddingBottom: "75px" }}>
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <span className="mush-kicker">Comercialización & Facturación</span>
          <h2 className="mush-display text-white mb-0">Registro y Control de Ventas</h2>
        </div>
        <button
          className="btn-mush"
          onClick={() => {
            setNuevaVenta({
              recetaId: recetas[0] ? recetas[0].id : "negro",
              cliente: "Mostrador Local",
              canal: "Local Propio",
              cantidad: 12,
              precioUnitario: recetas[0] ? recetas[0].precioVenta : 1800,
              metodoPago: "Efectivo",
              fecha: new Date().toISOString().split("T")[0],
              notas: "",
            });
            setMostrarModalVenta(true);
          }}
        >
          <i className="bi bi-cart-plus-fill"></i> Registrar Nueva Venta
        </button>
      </div>

      {/* Tarjetas KPI */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="mush-kpi-card h-100">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="mush-kicker">Total Facturado</span>
              <div className="mush-kpi-icon bg-dulce-suave text-dulce">
                <i className="bi bi-currency-dollar"></i>
              </div>
            </div>
            <h3 className="mush-dato text-white mb-1">{pesos(totalFacturado)}</h3>
            <span className="small text-secondary">{ventas.length} ventas en sistema</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="mush-kpi-card h-100">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="mush-kicker">Unidades Vendidas</span>
              <div className="mush-kpi-icon" style={{ backgroundColor: "rgba(56, 189, 248, 0.15)", color: "#38bdf8" }}>
                <i className="bi bi-bag-check"></i>
              </div>
            </div>
            <h3 className="mush-dato text-white mb-1">{numero(totalUnidadesVendidas)} un.</h3>
            <span className="small text-secondary">
              {numero(Math.round(totalUnidadesVendidas / 12))} docenas entregadas
            </span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="mush-kpi-card h-100">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="mush-kicker">Ganancia Neta Obtenida</span>
              <div className="mush-kpi-icon" style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                <i className="bi bi-graph-up-arrow"></i>
              </div>
            </div>
            <h3 className="mush-dato text-ok mb-1">{pesos(totalGananciaVentas)}</h3>
            <span className="small text-secondary">
              Margen promedio: <strong className="text-white">{porcentaje(margenPromedio)}</strong>
            </span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="mush-kpi-card h-100">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="mush-kicker">Ticket Promedio</span>
              <div className="mush-kpi-icon bg-dulce-suave text-dulce">
                <i className="bi bi-receipt-cutoff"></i>
              </div>
            </div>
            <h3 className="mush-dato text-white mb-1">
              {pesos(ventas.length > 0 ? totalFacturado / ventas.length : 0)}
            </h3>
            <span className="small text-secondary">Promedio por operación</span>
          </div>
        </div>
      </div>

      <div className="row g-4 mb-4">
        {/* Columna Izquierda: Tabla de Ventas Registradas */}
        <div className="col-12 col-lg-8">
          <div className="mush-card p-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
              <div>
                <span className="mush-kicker">Operaciones Recientes</span>
                <h5 className="mush-display text-white mb-0">Historial de Ventas</h5>
              </div>

              {/* Filtros */}
              <div className="d-flex flex-wrap gap-2">
                <select
                  className="form-select form-select-sm mush-select"
                  style={{ width: "auto" }}
                  value={filtroCanal}
                  onChange={(e) => setFiltroCanal(e.target.value)}
                >
                  <option value="todos">Todos los Canales</option>
                  {canalesVenta.map((c) => (
                    <option key={c.canal} value={c.canal}>{c.canal}</option>
                  ))}
                </select>

                <select
                  className="form-select form-select-sm mush-select"
                  style={{ width: "auto" }}
                  value={filtroReceta}
                  onChange={(e) => setFiltroReceta(e.target.value)}
                >
                  <option value="todos">Todas las Variedades</option>
                  {recetas.map((r) => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mush-scroll-x">
              <table className="table mush-tabla">
                <thead>
                  <tr>
                    <th>N° Venta</th>
                    <th>Fecha</th>
                    <th>Cliente / Destino</th>
                    <th>Canal</th>
                    <th>Alfajor</th>
                    <th className="text-end">Cant.</th>
                    <th className="text-end">Precio Unit.</th>
                    <th className="text-end">Total</th>
                    <th className="text-end">Ganancia</th>
                    <th>Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {ventasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="text-center py-4 text-secondary">
                        No hay ventas registradas con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    ventasFiltradas.map((v) => {
                      const receta = recetas.find((r) => r.id === v.recetaId);
                      const costeo = costear(receta);
                      const costoTotalVenta = (v.cantidad || 0) * (costeo?.costoUnitario || 0);
                      const gananciaVenta = (v.total || 0) - costoTotalVenta;

                      return (
                        <tr key={v.id}>
                          <td className="fw-bold text-dulce">{v.id}</td>
                          <td className="text-secondary small">{v.fecha}</td>
                          <td className="text-white fw-bold">{v.cliente}</td>
                          <td>
                            <span className="badge bg-dark border border-secondary border-opacity-25 text-secondary small">
                              {v.canal}
                            </span>
                          </td>
                          <td className="text-light">
                            {receta?.imagen} {receta ? receta.nombre : v.recetaId}
                          </td>
                          <td className="text-end mush-dato text-white fw-bold">
                            {numero(v.cantidad)} un.
                          </td>
                          <td className="text-end mush-dato text-secondary">
                            {pesos(v.precioUnitario)}
                          </td>
                          <td className="text-end mush-dato fw-bold text-white fs-6">
                            {pesos(v.total)}
                          </td>
                          <td className="text-end mush-dato fw-bold text-ok">
                            +{pesos(gananciaVenta)}
                          </td>
                          <td>
                            <span className="badge bg-dark text-secondary border border-secondary border-opacity-25 small">
                              {v.metodoPago || "Efectivo"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Ranking de Alfajores Más Vendidos */}
        <div className="col-12 col-lg-4">
          <div className="mush-card p-4 h-100">
            <span className="mush-kicker">Desempeño Comercial</span>
            <h5 className="mush-display text-white mb-3">Ranking por Variedad</h5>

            <div className="d-flex flex-column gap-3">
              {rankingVariedades.map((item, idx) => (
                <div key={item.receta.id} className="mush-card-elevada p-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <div className="d-flex align-items-center gap-2">
                      <span className="badge bg-dark border border-secondary text-dulce fw-bold">
                        #{idx + 1}
                      </span>
                      <strong className="text-white">
                        {item.receta.imagen} {item.receta.nombre}
                      </strong>
                    </div>
                    <span className="text-dulce fw-bold mush-dato">
                      {numero(item.unidades)} un.
                    </span>
                  </div>

                  <div className="mush-progress-bar my-2">
                    <div
                      className="mush-progress-fill"
                      style={{
                        width: `${totalUnidadesVendidas > 0 ? (item.unidades / totalUnidadesVendidas) * 100 : 0}%`,
                        backgroundColor: "#d29a54",
                      }}
                    ></div>
                  </div>

                  <div className="d-flex justify-content-between small text-secondary">
                    <span>Facturación Total:</span>
                    <strong className="text-ok mush-dato">{pesos(item.facturacion)}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Registrar Nueva Venta */}
      {mostrarModalVenta && (
        <div className="modal d-block" style={{ backgroundColor: "rgba(0, 0, 0, 0.75)" }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content mush-modal">
              <div className="modal-header mush-modal-header">
                <h5 className="modal-title mush-display text-white">
                  <i className="bi bi-cart-plus text-dulce me-2"></i>
                  Registrar Venta de Alfajores
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setMostrarModalVenta(false)}
                ></button>
              </div>
              <form onSubmit={handleGuardarVenta}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label text-secondary small">Variedad de Alfajor</label>
                    <select
                      className="form-select mush-select"
                      value={nuevaVenta.recetaId}
                      onChange={(e) => handleRecetaChange(e.target.value)}
                      required
                    >
                      {recetas.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.imagen} {r.nombre} - Precio sugerido: {pesos(r.precioVenta)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-6">
                      <label className="form-label text-secondary small">Cliente / Nombre</label>
                      <input
                        type="text"
                        className="form-control mush-input"
                        placeholder="Ej. Café Martínez Centro"
                        value={nuevaVenta.cliente}
                        onChange={(e) => setNuevaVenta({ ...nuevaVenta, cliente: e.target.value })}
                        required
                      />
                    </div>

                    <div className="col-6">
                      <label className="form-label text-secondary small">Canal de Venta</label>
                      <select
                        className="form-select mush-select"
                        value={nuevaVenta.canal}
                        onChange={(e) => setNuevaVenta({ ...nuevaVenta, canal: e.target.value })}
                      >
                        {canalesVenta.map((c) => (
                          <option key={c.canal} value={c.canal}>{c.canal}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-6">
                      <label className="form-label text-secondary small">Cantidad (Unidades)</label>
                      <input
                        type="number"
                        min="1"
                        className="form-control mush-input"
                        value={nuevaVenta.cantidad}
                        onChange={(e) => setNuevaVenta({ ...nuevaVenta, cantidad: e.target.value })}
                        required
                      />
                      <span className="small text-secondary">
                        {numero(Math.round((Number(nuevaVenta.cantidad) || 0) / 12))} docenas
                      </span>
                    </div>

                    <div className="col-6">
                      <label className="form-label text-secondary small">Precio Unitario ($)</label>
                      <input
                        type="number"
                        min="1"
                        className="form-control mush-input text-dulce fw-bold"
                        value={nuevaVenta.precioUnitario}
                        onChange={(e) => setNuevaVenta({ ...nuevaVenta, precioUnitario: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-6">
                      <label className="form-label text-secondary small">Medio de Pago</label>
                      <select
                        className="form-select mush-select"
                        value={nuevaVenta.metodoPago}
                        onChange={(e) => setNuevaVenta({ ...nuevaVenta, metodoPago: e.target.value })}
                      >
                        <option value="Efectivo">Efectivo</option>
                        <option value="Transferencia">Transferencia Bancaria</option>
                        <option value="Mercado Pago">Mercado Pago</option>
                        <option value="QR / Tarjeta">Tarjeta / QR</option>
                        <option value="Cuenta Corriente">Cuenta Corriente (Mayorista)</option>
                      </select>
                    </div>

                    <div className="col-6">
                      <label className="form-label text-secondary small">Fecha de Venta</label>
                      <input
                        type="date"
                        className="form-control mush-input"
                        value={nuevaVenta.fecha}
                        onChange={(e) => setNuevaVenta({ ...nuevaVenta, fecha: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  {/* Resumen Total */}
                  <div className="mush-card-elevada p-3 d-flex justify-content-between align-items-center">
                    <span className="text-secondary small">Total Facturado de la Operación:</span>
                    <span className="text-ok fw-bold fs-4 mush-dato">
                      {pesos(totalCalculadoModal)}
                    </span>
                  </div>
                </div>

                <div className="modal-footer mush-modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary text-white"
                    onClick={() => setMostrarModalVenta(false)}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn-mush">
                    Confirmar Venta
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

export default Ventas;
