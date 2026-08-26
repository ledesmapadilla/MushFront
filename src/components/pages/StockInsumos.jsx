import { useState } from "react";
import { useMush } from "../../context/MushContext";
import { pesos, numero, estadoStock } from "../../utils/calculos";
import BuscadorFiltro from "../shared/BuscadorFiltro.jsx";
import Swal from "sweetalert2";

const StockInsumos = () => {
  const {
    ingredientes,
    compras,
    guardarIngrediente,
    registrarCompra,
    listaAlertas,
  } = useMush();

  const [pestanaActiva, setPestanaActiva] = useState("inventario"); // 'inventario' | 'compras' | 'sugeridas'
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos"); // 'todos' | 'critico' | 'bajo' | 'ok'

  // Modales
  const [mostrarModalCompra, setMostrarModalCompra] = useState(false);
  const [mostrarModalAjuste, setMostrarModalAjuste] = useState(false);
  const [mostrarModalNuevo, setMostrarModalNuevo] = useState(false);

  // Estados de formularios
  const [compraForm, setCompraForm] = useState({
    insumoId: ingredientes[0] ? ingredientes[0].id : "",
    proveedor: ingredientes[0] ? ingredientes[0].proveedor : "",
    cantidad: 10,
    precioUnitario: ingredientes[0] ? ingredientes[0].precio : 0,
    detalle: "",
  });

  const [ajusteForm, setAjusteForm] = useState({
    id: "",
    nombre: "",
    stock: 0,
    minimo: 0,
    precio: 0,
    unidad: "kg",
  });

  const [nuevoForm, setNuevoForm] = useState({
    id: "",
    nombre: "",
    unidad: "kg",
    categoria: "Secos",
    stock: 10,
    minimo: 10,
    precio: 1000,
    proveedor: "",
  });

  const alertas = listaAlertas();

  // Valor total del inventario
  const valorTotalInventario = ingredientes.reduce(
    (acc, i) => acc + i.stock * i.precio,
    0
  );

  // Total gastado en compras
  const totalGastadoCompras = compras.reduce((acc, c) => acc + (c.monto || 0), 0);

  // Filtrado de ingredientes
  const ingredientesFiltrados = ingredientes.filter((item) => {
    const coincideTexto =
      item.nombre.toLowerCase().includes(filtroTexto.toLowerCase()) ||
      item.proveedor.toLowerCase().includes(filtroTexto.toLowerCase()) ||
      (item.categoria && item.categoria.toLowerCase().includes(filtroTexto.toLowerCase()));

    const estado = estadoStock(item);
    const coincideEstado =
      filtroEstado === "todos" ||
      (filtroEstado === "critico" && estado === "critico") ||
      (filtroEstado === "bajo" && estado === "bajo") ||
      (filtroEstado === "ok" && estado === "ok");

    return coincideTexto && coincideEstado;
  });

  // Lista de reposición sugerida
  const listaSugerida = ingredientes
    .filter((i) => i.stock < i.minimo)
    .map((i) => {
      const cantidadNecesaria = Math.ceil(i.minimo * 1.5 - i.stock);
      const costoEstimado = cantidadNecesaria * i.precio;
      return {
        ...i,
        cantidadNecesaria,
        costoEstimado,
      };
    });

  const totalPresupuestoSugerido = listaSugerida.reduce(
    (acc, i) => acc + i.costoEstimado,
    0
  );

  // Manejo de Compra
  const handleAbrirCompraInsumo = (insumo) => {
    setCompraForm({
      insumoId: insumo.id,
      proveedor: insumo.proveedor,
      cantidad: Math.max(5, Math.ceil(insumo.minimo * 1.2 - insumo.stock)),
      precioUnitario: insumo.precio,
      detalle: `Reposición de ${insumo.nombre}`,
    });
    setMostrarModalCompra(true);
  };

  const handleInsumoSelectChange = (id) => {
    const sel = ingredientes.find((i) => i.id === id);
    if (sel) {
      setCompraForm({
        ...compraForm,
        insumoId: id,
        proveedor: sel.proveedor,
        precioUnitario: sel.precio,
        detalle: `Reposición de ${sel.nombre}`,
      });
    }
  };

  const handleGuardarCompra = (e) => {
    e.preventDefault();
    const insumo = ingredientes.find((i) => i.id === compraForm.insumoId);
    const monto = Number(compraForm.cantidad) * Number(compraForm.precioUnitario);

    registrarCompra({
      insumoId: compraForm.insumoId,
      proveedor: compraForm.proveedor,
      detalle: compraForm.detalle || `Compra de ${insumo?.nombre || "Insumo"}`,
      cantidad: Number(compraForm.cantidad),
      unidad: insumo?.unidad || "kg",
      precioUnitario: Number(compraForm.precioUnitario),
      monto,
    });

    setMostrarModalCompra(false);
    Swal.fire({
      title: "¡Compra Registrada con Éxito!",
      html: `Se sumaron <b>${compraForm.cantidad} ${insumo?.unidad}</b> de <b>${insumo?.nombre}</b> al stock.<br>Total orden: <b>${pesos(monto)}</b>`,
      icon: "success",
      confirmButtonColor: "#d29a54",
      background: "#16161a",
      color: "#fbf9f6",
    });
  };

  // Manejo de Ajuste de Stock Manual
  const handleAbrirAjuste = (insumo) => {
    setAjusteForm({
      id: insumo.id,
      nombre: insumo.nombre,
      stock: insumo.stock,
      minimo: insumo.minimo,
      precio: insumo.precio,
      unidad: insumo.unidad,
      categoria: insumo.categoria || "Secos",
      proveedor: insumo.proveedor,
    });
    setMostrarModalAjuste(true);
  };

  const handleGuardarAjuste = (e) => {
    e.preventDefault();
    guardarIngrediente({
      ...ajusteForm,
      stock: Number(ajusteForm.stock),
      minimo: Number(ajusteForm.minimo),
      precio: Number(ajusteForm.precio),
    });

    setMostrarModalAjuste(false);
    Swal.fire({
      title: "Stock y Datos Actualizados",
      text: `Se actualizaron los valores para ${ajusteForm.nombre}.`,
      icon: "success",
      confirmButtonColor: "#d29a54",
      background: "#16161a",
      color: "#fbf9f6",
    });
  };

  // Manejo de Nuevo Insumo
  const handleGuardarNuevo = (e) => {
    e.preventDefault();
    const idGenerado = nuevoForm.id.trim() || nuevoForm.nombre.toLowerCase().replace(/\s+/g, "_");
    guardarIngrediente({
      ...nuevoForm,
      id: idGenerado,
      stock: Number(nuevoForm.stock),
      minimo: Number(nuevoForm.minimo),
      precio: Number(nuevoForm.precio),
    });

    setMostrarModalNuevo(false);
    Swal.fire({
      title: "Nuevo Insumo Agregado",
      text: `Se dio de alta el insumo ${nuevoForm.nombre}.`,
      icon: "success",
      confirmButtonColor: "#d29a54",
      background: "#16161a",
      color: "#fbf9f6",
    });
  };

  // Comprar todo el paquete sugerido
  const handleComprarTodoSugerido = () => {
    listaSugerida.forEach((item) => {
      registrarCompra({
        insumoId: item.id,
        proveedor: item.proveedor,
        detalle: `Reposición automática stock seguridad (${item.nombre})`,
        cantidad: item.cantidadNecesaria,
        unidad: item.unidad,
        precioUnitario: item.precio,
        monto: item.costoEstimado,
      });
    });

    Swal.fire({
      title: "¡Lote de Compras Procesado!",
      html: `Se registraron órdenes de reposición para <b>${listaSugerida.length} insumos</b> por un total de <b>${pesos(totalPresupuestoSugerido)}</b>. El stock ha sido restablecido a niveles óptimos.`,
      icon: "success",
      confirmButtonColor: "#d29a54",
      background: "#16161a",
      color: "#fbf9f6",
    });
  };

  return (
    <div className="container px-4 py-4" style={{ paddingBottom: "75px" }}>
      {/* Header y Acciones */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <span className="mush-kicker">Materias Primas & Proveedores</span>
          <h2 className="mush-display text-white mb-0">Control de Insumos, Stock y Compras</h2>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button
            className="btn-mush-ghost"
            onClick={() => setMostrarModalNuevo(true)}
          >
            <i className="bi bi-plus-circle"></i> Nuevo Insumo
          </button>
          <button
            className="btn-mush"
            onClick={() => {
              setCompraForm({
                insumoId: ingredientes[0]?.id || "",
                proveedor: ingredientes[0]?.proveedor || "",
                cantidad: 10,
                precioUnitario: ingredientes[0]?.precio || 0,
                detalle: "",
              });
              setMostrarModalCompra(true);
            }}
          >
            <i className="bi bi-cart-plus-fill"></i> Registrar Compra
          </button>
        </div>
      </div>

      {/* Tarjetas de Métricas de Stock */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="mush-kpi-card h-100">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="mush-kicker">Valor Inventario Actual</span>
              <div className="mush-kpi-icon bg-dulce-suave text-dulce">
                <i className="bi bi-safe"></i>
              </div>
            </div>
            <h3 className="mush-dato text-white mb-1">{pesos(valorTotalInventario)}</h3>
            <span className="small text-secondary">Capital inmovilizado en insumos</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="mush-kpi-card h-100">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="mush-kicker">Insumos en Alerta</span>
              <div className={`mush-kpi-icon ${alertas.length > 0 ? "bg-danger bg-opacity-25 text-danger" : "bg-success bg-opacity-25 text-success"}`}>
                <i className={`bi ${alertas.length > 0 ? "bi-exclamation-triangle" : "bi-check2-circle"}`}></i>
              </div>
            </div>
            <h3 className={`mush-dato mb-1 ${alertas.length > 0 ? "text-riesgo" : "text-ok"}`}>
              {alertas.length} insumo{alertas.length !== 1 ? "s" : ""}
            </h3>
            <span className="small text-secondary">Por debajo del stock mínimo</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="mush-kpi-card h-100">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="mush-kicker">Variedad de Insumos</span>
              <div className="mush-kpi-icon" style={{ backgroundColor: "rgba(56, 189, 248, 0.15)", color: "#38bdf8" }}>
                <i className="bi bi-box-seam"></i>
              </div>
            </div>
            <h3 className="mush-dato text-white mb-1">{ingredientes.length} materias primas</h3>
            <span className="small text-secondary">Harinas, chocolates, DDL, frutos secos</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="mush-kpi-card h-100">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="mush-kicker">Compras Realizadas</span>
              <div className="mush-kpi-icon" style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                <i className="bi bi-receipt"></i>
              </div>
            </div>
            <h3 className="mush-dato text-white mb-1">{pesos(totalGastadoCompras)}</h3>
            <span className="small text-secondary">{compras.length} órdenes registradas</span>
          </div>
        </div>
      </div>

      {/* Tabs de Navegación del Módulo */}
      <div className="mush-tabs mb-4">
        <button
          className={`mush-tab-btn ${pestanaActiva === "inventario" ? "activo" : ""}`}
          onClick={() => setPestanaActiva("inventario")}
        >
          <i className="bi bi-boxes me-1"></i> Inventario de Insumos ({ingredientes.length})
        </button>
        <button
          className={`mush-tab-btn ${pestanaActiva === "compras" ? "activo" : ""}`}
          onClick={() => setPestanaActiva("compras")}
        >
          <i className="bi bi-cart-check me-1"></i> Órdenes de Compra ({compras.length})
        </button>
        <button
          className={`mush-tab-btn ${pestanaActiva === "sugeridas" ? "activo" : ""}`}
          onClick={() => setPestanaActiva("sugeridas")}
        >
          <i className="bi bi-lightning-charge me-1"></i> Reposición Sugerida
          {listaSugerida.length > 0 && (
            <span className="badge bg-danger ms-2">{listaSugerida.length}</span>
          )}
        </button>
      </div>

      {/* PESTAÑA 1: INVENTARIO */}
      {pestanaActiva === "inventario" && (
        <div className="mush-card p-4">
          {/* Barra de Filtros y Búsqueda */}
          <div className="row g-3 align-items-center mb-3">
            <div className="col-12 col-md-6 col-lg-5">
              <BuscadorFiltro
                valor={filtroTexto}
                alCambiar={setFiltroTexto}
                placeholder="Buscar insumo, categoría o proveedor..."
                conIcono
                pequeno={false}
              />
            </div>

            <div className="col-12 col-md-6 col-lg-4 d-flex gap-2">
              <select
                className="form-select mush-select"
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
              >
                <option value="todos">Todos los Estados ({ingredientes.length})</option>
                <option value="critico">Stock Crítico (Bajo mínimo)</option>
                <option value="bajo">Stock Próximo a Mínimo</option>
                <option value="ok">Stock Óptimo</option>
              </select>
            </div>

            <div className="col-12 col-lg-3 text-lg-end text-secondary small">
              Mostrando {ingredientesFiltrados.length} de {ingredientes.length} insumos
            </div>
          </div>

          {/* Tabla de Insumos */}
          <div className="mush-scroll-x">
            <table className="table mush-tabla">
              <thead>
                <tr>
                  <th>Insumo / Materia Prima</th>
                  <th>Categoría</th>
                  <th>Proveedor</th>
                  <th className="text-end">Stock Actual</th>
                  <th className="text-end">Stock Mínimo</th>
                  <th style={{ width: "160px" }}>Nivel de Stock</th>
                  <th className="text-end">Costo Unit.</th>
                  <th className="text-end">Valorización</th>
                  <th className="text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ingredientesFiltrados.map((item) => {
                  const estado = estadoStock(item);
                  const porcentajeStock = Math.min(100, Math.round((item.stock / (item.minimo * 1.5)) * 100));
                  const valorLinea = item.stock * item.precio;

                  let badgeClass = "mush-badge-ok";
                  let badgeTexto = "Óptimo";
                  let barraColor = "#10b981";

                  if (estado === "critico") {
                    badgeClass = "mush-badge-critico";
                    badgeTexto = "Crítico";
                    barraColor = "#ef4444";
                  } else if (estado === "bajo") {
                    badgeClass = "mush-badge-alerta";
                    badgeTexto = "Bajo";
                    barraColor = "#f59e0b";
                  }

                  return (
                    <tr key={item.id}>
                      <td>
                        <strong className="text-white d-block">{item.nombre}</strong>
                        <span className="small text-secondary">ID: {item.id}</span>
                      </td>
                      <td>
                        <span className="badge bg-dark border border-secondary border-opacity-25 text-secondary">
                          {item.categoria || "Insumo"}
                        </span>
                      </td>
                      <td className="text-light small">{item.proveedor}</td>
                      <td className="text-end mush-dato">
                        <span className={`fw-bold ${estado === "critico" ? "text-riesgo" : "text-white"}`}>
                          {numero(item.stock)} {item.unidad}
                        </span>
                      </td>
                      <td className="text-end text-secondary mush-dato">
                        {numero(item.minimo)} {item.unidad}
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className="mush-progress-bar flex-grow-1">
                            <div
                              className="mush-progress-fill"
                              style={{ width: `${porcentajeStock}%`, backgroundColor: barraColor }}
                            ></div>
                          </div>
                          <span className={`mush-badge ${badgeClass}`} style={{ fontSize: "0.65rem" }}>
                            {badgeTexto}
                          </span>
                        </div>
                      </td>
                      <td className="text-end text-secondary mush-dato">
                        {pesos(item.precio)} / {item.unidad}
                      </td>
                      <td className="text-end text-dulce fw-bold mush-dato">
                        {pesos(valorLinea)}
                      </td>
                      <td className="text-center">
                        <div className="d-flex justify-content-center gap-1">
                          <button
                            className="btn btn-sm btn-outline-warning p-1 px-2"
                            onClick={() => handleAbrirCompraInsumo(item)}
                            title="Comprar / Reponer"
                          >
                            <i className="bi bi-cart-plus"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-outline-secondary text-white p-1 px-2"
                            onClick={() => handleAbrirAjuste(item)}
                            title="Ajustar Stock / Editar"
                          >
                            <i className="bi bi-pencil-square"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: ÓRDENES DE COMPRA */}
      {pestanaActiva === "compras" && (
        <div className="mush-card p-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <span className="mush-kicker">Historial de Adquisiciones</span>
              <h5 className="mush-display text-white mb-0">Órdenes de Compra a Proveedores</h5>
            </div>
            <button
              className="btn-mush btn-sm"
              onClick={() => setMostrarModalCompra(true)}
            >
              <i className="bi bi-plus-circle"></i> Nueva Compra
            </button>
          </div>

          <div className="mush-scroll-x">
            <table className="table mush-tabla">
              <thead>
                <tr>
                  <th>N° Orden</th>
                  <th>Fecha</th>
                  <th>Proveedor</th>
                  <th>Detalle Insumo</th>
                  <th className="text-end">Cantidad</th>
                  <th className="text-end">Precio Unit.</th>
                  <th className="text-end">Monto Total</th>
                  <th className="text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {compras.map((compra) => (
                  <tr key={compra.id}>
                    <td className="fw-bold text-dulce">{compra.id}</td>
                    <td className="text-secondary">{compra.fecha || compra.entrega || "2026-08-17"}</td>
                    <td className="text-white fw-bold">{compra.proveedor}</td>
                    <td className="text-light">{compra.detalle}</td>
                    <td className="text-end mush-dato text-white">
                      {numero(compra.cantidad || 0)} {compra.unidad || "kg"}
                    </td>
                    <td className="text-end text-secondary mush-dato">
                      {pesos(compra.precioUnitario || (compra.monto / (compra.cantidad || 1)))}
                    </td>
                    <td className="text-end fw-bold text-ok mush-dato">
                      {pesos(compra.monto)}
                    </td>
                    <td className="text-center">
                      <span className={`mush-badge ${compra.estado === "Confirmada" || compra.estado === "Completada" ? "mush-badge-ok" : "mush-badge-alerta"}`}>
                        {compra.estado || "Completada"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PESTAÑA 3: REPOSICIÓN SUGERIDA INTELIGENTE */}
      {pestanaActiva === "sugeridas" && (
        <div className="mush-card p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
            <div>
              <span className="mush-kicker">Cálculo Automático de Reposición</span>
              <h5 className="mush-display text-white mb-0">Lista de Compras para Stock de Seguridad</h5>
            </div>
            {listaSugerida.length > 0 && (
              <button
                className="btn-mush"
                onClick={handleComprarTodoSugerido}
              >
                <i className="bi bi-lightning-fill"></i> Comprar Todo el Lote ({pesos(totalPresupuestoSugerido)})
              </button>
            )}
          </div>

          {listaSugerida.length === 0 ? (
            <div className="text-center py-5 text-secondary">
              <i className="bi bi-check-circle-fill fs-1 text-ok d-block mb-3"></i>
              <h5 className="text-white">¡Excelente! Todo el stock está en niveles óptimos</h5>
              <p className="small">No hay materias primas por debajo del stock mínimo de seguridad.</p>
            </div>
          ) : (
            <>
              <p className="text-secondary small mb-3">
                Se detectaron <strong>{listaSugerida.length} insumos</strong> por debajo del límite mínimo. El sistema calculó la cantidad recomendada para restaurar el inventario a un 150% del stock de seguridad.
              </p>

              <div className="mush-scroll-x mb-3">
                <table className="table mush-tabla">
                  <thead>
                    <tr>
                      <th>Insumo</th>
                      <th>Proveedor</th>
                      <th className="text-end">Stock Actual</th>
                      <th className="text-end">Mínimo</th>
                      <th className="text-end">Cantidad Sugerida</th>
                      <th className="text-end">Precio Unit.</th>
                      <th className="text-end">Presupuesto</th>
                      <th className="text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listaSugerida.map((item) => (
                      <tr key={item.id}>
                        <td className="fw-bold text-white">{item.nombre}</td>
                        <td className="text-light small">{item.proveedor}</td>
                        <td className="text-end text-riesgo fw-bold mush-dato">
                          {numero(item.stock)} {item.unidad}
                        </td>
                        <td className="text-end text-secondary mush-dato">
                          {numero(item.minimo)} {item.unidad}
                        </td>
                        <td className="text-end text-dulce fw-bold mush-dato">
                          +{numero(item.cantidadNecesaria)} {item.unidad}
                        </td>
                        <td className="text-end text-secondary mush-dato">
                          {pesos(item.precio)} / {item.unidad}
                        </td>
                        <td className="text-end text-white fw-bold mush-dato">
                          {pesos(item.costoEstimado)}
                        </td>
                        <td className="text-center">
                          <button
                            className="btn btn-sm btn-outline-warning px-2 py-1"
                            onClick={() => handleAbrirCompraInsumo(item)}
                          >
                            <i className="bi bi-cart-plus me-1"></i> Comprar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-top border-secondary">
                      <td colSpan="6" className="text-end fw-bold text-white">
                        Presupuesto Total Estimado de Reposición:
                      </td>
                      <td className="text-end text-ok fw-bold fs-5 mush-dato">
                        {pesos(totalPresupuestoSugerido)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* MODAL 1: REGISTRAR COMPRA */}
      {mostrarModalCompra && (
        <div className="modal d-block" style={{ backgroundColor: "rgba(0, 0, 0, 0.75)" }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content mush-modal">
              <div className="modal-header mush-modal-header">
                <h5 className="modal-title mush-display text-white">
                  <i className="bi bi-cart-plus text-dulce me-2"></i>
                  Registrar Compra de Insumos
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setMostrarModalCompra(false)}
                ></button>
              </div>
              <form onSubmit={handleGuardarCompra}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label text-secondary small">Materia Prima / Insumo</label>
                    <select
                      className="form-select mush-select"
                      value={compraForm.insumoId}
                      onChange={(e) => handleInsumoSelectChange(e.target.value)}
                      required
                    >
                      {ingredientes.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.nombre} (Stock actual: {i.stock} {i.unidad} - Proveedor: {i.proveedor})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-secondary small">Proveedor</label>
                    <input
                      type="text"
                      className="form-control mush-input"
                      value={compraForm.proveedor}
                      onChange={(e) => setCompraForm({ ...compraForm, proveedor: e.target.value })}
                      required
                    />
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-6">
                      <label className="form-label text-secondary small">Cantidad a Comprar</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        className="form-control mush-input"
                        value={compraForm.cantidad}
                        onChange={(e) => setCompraForm({ ...compraForm, cantidad: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label text-secondary small">Precio Unitario ($)</label>
                      <input
                        type="number"
                        min="1"
                        className="form-control mush-input"
                        value={compraForm.precioUnitario}
                        onChange={(e) => setCompraForm({ ...compraForm, precioUnitario: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-secondary small">Detalle / N° Factura / Remito</label>
                    <input
                      type="text"
                      className="form-control mush-input"
                      placeholder="Ej. Factura A-0004-001928"
                      value={compraForm.detalle}
                      onChange={(e) => setCompraForm({ ...compraForm, detalle: e.target.value })}
                    />
                  </div>

                  <div className="mush-card-elevada p-3 d-flex justify-content-between align-items-center">
                    <span className="text-secondary small">Monto Total de la Compra:</span>
                    <span className="text-ok fw-bold fs-5 mush-dato">
                      {pesos(Number(compraForm.cantidad || 0) * Number(compraForm.precioUnitario || 0))}
                    </span>
                  </div>
                </div>

                <div className="modal-footer mush-modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary text-white"
                    onClick={() => setMostrarModalCompra(false)}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn-mush">
                    Guardar Compra e Incrementar Stock
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: AJUSTAR STOCK MANUAL / EDITAR INSUMO */}
      {mostrarModalAjuste && (
        <div className="modal d-block" style={{ backgroundColor: "rgba(0, 0, 0, 0.75)" }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content mush-modal">
              <div className="modal-header mush-modal-header">
                <h5 className="modal-title mush-display text-white">
                  <i className="bi bi-pencil-square text-dulce me-2"></i>
                  Ajustar Insumo: {ajusteForm.nombre}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setMostrarModalAjuste(false)}
                ></button>
              </div>
              <form onSubmit={handleGuardarAjuste}>
                <div className="modal-body p-4">
                  <div className="row g-3 mb-3">
                    <div className="col-6">
                      <label className="form-label text-secondary small">Stock Físico Actual</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        className="form-control mush-input text-white fw-bold"
                        value={ajusteForm.stock}
                        onChange={(e) => setAjusteForm({ ...ajusteForm, stock: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label text-secondary small">Stock Mínimo de Seguridad</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        className="form-control mush-input"
                        value={ajusteForm.minimo}
                        onChange={(e) => setAjusteForm({ ...ajusteForm, minimo: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-6">
                      <label className="form-label text-secondary small">Precio de Costo ($/{ajusteForm.unidad})</label>
                      <input
                        type="number"
                        min="0"
                        className="form-control mush-input"
                        value={ajusteForm.precio}
                        onChange={(e) => setAjusteForm({ ...ajusteForm, precio: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label text-secondary small">Proveedor Principal</label>
                      <input
                        type="text"
                        className="form-control mush-input"
                        value={ajusteForm.proveedor}
                        onChange={(e) => setAjusteForm({ ...ajusteForm, proveedor: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="modal-footer mush-modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary text-white"
                    onClick={() => setMostrarModalAjuste(false)}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn-mush">
                    Guardar Cambios
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: NUEVO INSUMO */}
      {mostrarModalNuevo && (
        <div className="modal d-block" style={{ backgroundColor: "rgba(0, 0, 0, 0.75)" }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content mush-modal">
              <div className="modal-header mush-modal-header">
                <h5 className="modal-title mush-display text-white">
                  <i className="bi bi-plus-circle text-dulce me-2"></i>
                  Dar de Alta Nuevo Insumo
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setMostrarModalNuevo(false)}
                ></button>
              </div>
              <form onSubmit={handleGuardarNuevo}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label text-secondary small">Nombre del Insumo</label>
                    <input
                      type="text"
                      className="form-control mush-input"
                      placeholder="Ej. Esencia de Vainilla Natural"
                      value={nuevoForm.nombre}
                      onChange={(e) => setNuevoForm({ ...nuevoForm, nombre: e.target.value })}
                      required
                    />
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-6">
                      <label className="form-label text-secondary small">Unidad de Medida</label>
                      <select
                        className="form-select mush-select"
                        value={nuevoForm.unidad}
                        onChange={(e) => setNuevoForm({ ...nuevoForm, unidad: e.target.value })}
                      >
                        <option value="kg">Kilogramos (kg)</option>
                        <option value="un">Unidades (un)</option>
                        <option value="l">Litros (l)</option>
                        <option value="g">Gramos (g)</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label text-secondary small">Categoría</label>
                      <select
                        className="form-select mush-select"
                        value={nuevoForm.categoria}
                        onChange={(e) => setNuevoForm({ ...nuevoForm, categoria: e.target.value })}
                      >
                        <option value="Secos">Secos (Harinas/Azúcares)</option>
                        <option value="Frescos">Frescos (Manteca/Huevos)</option>
                        <option value="Chocolatería">Chocolatería / Coberturas</option>
                        <option value="Rellenos">Rellenos / Dulces</option>
                        <option value="Frutos Secos">Frutos Secos</option>
                        <option value="Packaging">Packaging</option>
                        <option value="Otros">Otros</option>
                      </select>
                    </div>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-6">
                      <label className="form-label text-secondary small">Stock Inicial</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        className="form-control mush-input"
                        value={nuevoForm.stock}
                        onChange={(e) => setNuevoForm({ ...nuevoForm, stock: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label text-secondary small">Stock Mínimo</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        className="form-control mush-input"
                        value={nuevoForm.minimo}
                        onChange={(e) => setNuevoForm({ ...nuevoForm, minimo: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-6">
                      <label className="form-label text-secondary small">Precio de Costo ($)</label>
                      <input
                        type="number"
                        min="1"
                        className="form-control mush-input"
                        value={nuevoForm.precio}
                        onChange={(e) => setNuevoForm({ ...nuevoForm, precio: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label text-secondary small">Proveedor</label>
                      <input
                        type="text"
                        className="form-control mush-input"
                        placeholder="Ej. Molino San Jorge"
                        value={nuevoForm.proveedor}
                        onChange={(e) => setNuevoForm({ ...nuevoForm, proveedor: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="modal-footer mush-modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary text-white"
                    onClick={() => setMostrarModalNuevo(false)}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn-mush">
                    Dar de Alta Insumo
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

export default StockInsumos;
