import { useState } from "react";
import { useMush } from "../../context/MushContext";
import { pesos, numero } from "../../utils/calculos";
import Swal from "sweetalert2";

const Produccion = () => {
  const {
    recetas,
    ingredientes,
    ordenesProduccion,
    agregarOrdenProduccion,
    cambiarEstadoProduccion,
    consumoOrden,
    costear,
  } = useMush();

  const [filtroEstado, setFiltroEstado] = useState("todas");
  const [mostrarModalOP, setMostrarModalOP] = useState(false);

  // Formulario nueva OP
  const [nuevaOP, setNuevaOP] = useState({
    recetaId: recetas[0] ? recetas[0].id : "negro",
    tandas: 2,
    fecha: new Date().toISOString().split("T")[0],
    responsable: "Ivana López",
    notas: "",
  });

  // Métricas
  const opPlanificadas = ordenesProduccion.filter((op) => op.estado === "Planificada");
  const opEnProceso = ordenesProduccion.filter((op) => op.estado === "En proceso");
  const opTerminadas = ordenesProduccion.filter((op) => op.estado === "Terminada");
  const totalAlfajoresTerminados = opTerminadas.reduce((acc, op) => acc + (op.unidades || 0), 0);

  // Filtrado de órdenes
  const ordenesFiltradas = ordenesProduccion.filter((op) => {
    if (filtroEstado === "todas") return true;
    return op.estado.toLowerCase() === filtroEstado.toLowerCase();
  });

  // Receta seleccionada en modal
  const recetaModal = recetas.find((r) => r.id === nuevaOP.recetaId) || recetas[0];
  const tandasNum = Number(nuevaOP.tandas) || 1;
  const unidadesModal = (recetaModal?.rinde || 60) * tandasNum;
  const consumoModal = consumoOrden(recetaModal, tandasNum);

  // Comprobar faltantes para modal
  const faltantesModal = consumoModal.filter((linea) => {
    const ing = ingredientes.find((i) => i.id === linea.id);
    return !ing || ing.stock < linea.cantidadTotal;
  });

  const handleCrearOP = (e) => {
    e.preventDefault();
    const creada = agregarOrdenProduccion({
      ...nuevaOP,
      tandas: tandasNum,
    });

    setMostrarModalOP(false);
    Swal.fire({
      title: "¡Orden de Producción Creada!",
      html: `Se registró la orden <b>${creada.id}</b> para elaborar <b>${creada.unidades} alfajores ${recetaModal.nombre}</b>.`,
      icon: "success",
      confirmButtonColor: "#d29a54",
      background: "#16161a",
      color: "#fbf9f6",
    });
  };

  const handleCambiarEstado = (op, nuevoEstado) => {
    if (nuevoEstado === "Terminada") {
      const receta = recetas.find((r) => r.id === op.recetaId);
      const consumo = consumoOrden(receta, op.tandas);

      Swal.fire({
        title: "¿Finalizar Orden de Producción?",
        html: `Al marcar como <b>Terminada</b>, se descontarán automáticamente los ingredientes del stock:<br><br>
          <ul class="text-start small text-secondary">
            ${consumo.map((c) => `<li>${c.nombre}: <b>${numero(c.cantidadTotal)} ${c.unidad}</b></li>`).join("")}
          </ul>
          <p class="text-ok fw-bold mb-0">¡Se sumarán ${op.unidades} alfajores al stock final!</p>`,
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#10b981",
        cancelButtonColor: "#2f2f38",
        confirmButtonText: "Sí, finalizar y descontar stock",
        cancelButtonText: "Cancelar",
        background: "#16161a",
        color: "#fbf9f6",
      }).then((result) => {
        if (result.isConfirmed) {
          cambiarEstadoProduccion(op.id, "Terminada");
          Swal.fire({
            title: "¡Lote Completado con Éxito!",
            text: `La orden ${op.id} fue finalizada y los insumos fueron descontados del inventario.`,
            icon: "success",
            confirmButtonColor: "#d29a54",
            background: "#16161a",
            color: "#fbf9f6",
          });
        }
      });
    } else {
      cambiarEstadoProduccion(op.id, nuevoEstado);
    }
  };

  return (
    <div className="container px-4 py-4" style={{ paddingBottom: "75px" }}>
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <span className="mush-kicker">Planificación & Fabricación</span>
          <h2 className="mush-display text-white mb-0">Gestión de Producción y Lotes</h2>
        </div>
        <button
          className="btn-mush"
          onClick={() => setMostrarModalOP(true)}
        >
          <i className="bi bi-plus-circle-fill"></i> Nueva Orden de Producción
        </button>
      </div>

      {/* Tarjetas KPI */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="mush-kpi-card h-100">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="mush-kicker">Tandas en Proceso</span>
              <div className="mush-kpi-icon" style={{ backgroundColor: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>
                <i className="bi bi-hourglass-split"></i>
              </div>
            </div>
            <h3 className="mush-dato text-alerta mb-1">{opEnProceso.length} órdenes</h3>
            <span className="small text-secondary">
              {opEnProceso.reduce((acc, op) => acc + (op.unidades || 0), 0)} alfajores elaborándose
            </span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="mush-kpi-card h-100">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="mush-kicker">Planificadas / Espera</span>
              <div className="mush-kpi-icon bg-dulce-suave text-dulce">
                <i className="bi bi-calendar-check"></i>
              </div>
            </div>
            <h3 className="mush-dato text-dulce mb-1">{opPlanificadas.length} órdenes</h3>
            <span className="small text-secondary">Programadas para los próximos días</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="mush-kpi-card h-100">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="mush-kicker">Lotes Finalizados</span>
              <div className="mush-kpi-icon" style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                <i className="bi bi-check2-all"></i>
              </div>
            </div>
            <h3 className="mush-dato text-ok mb-1">{opTerminadas.length} órdenes</h3>
            <span className="small text-secondary">Lotes completados</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="mush-kpi-card h-100">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="mush-kicker">Alfajores Fabricados</span>
              <div className="mush-kpi-icon" style={{ backgroundColor: "rgba(56, 189, 248, 0.15)", color: "#38bdf8" }}>
                <i className="bi bi-boxes"></i>
              </div>
            </div>
            <h3 className="mush-dato text-white mb-1">{numero(totalAlfajoresTerminados)} un.</h3>
            <span className="small text-secondary">
              {numero(Math.round(totalAlfajoresTerminados / 12))} docenas terminadas
            </span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros por Estado */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2">
        <div className="mush-tabs">
          <button
            className={`mush-tab-btn ${filtroEstado === "todas" ? "activo" : ""}`}
            onClick={() => setFiltroEstado("todas")}
          >
            Todas ({ordenesProduccion.length})
          </button>
          <button
            className={`mush-tab-btn ${filtroEstado === "en proceso" ? "activo" : ""}`}
            onClick={() => setFiltroEstado("en proceso")}
          >
            <i className="bi bi-hourglass-split me-1 text-alerta"></i> En Proceso ({opEnProceso.length})
          </button>
          <button
            className={`mush-tab-btn ${filtroEstado === "planificada" ? "activo" : ""}`}
            onClick={() => setFiltroEstado("planificada")}
          >
            <i className="bi bi-calendar3 me-1 text-dulce"></i> Planificadas ({opPlanificadas.length})
          </button>
          <button
            className={`mush-tab-btn ${filtroEstado === "terminada" ? "activo" : ""}`}
            onClick={() => setFiltroEstado("terminada")}
          >
            <i className="bi bi-check2-circle me-1 text-ok"></i> Terminadas ({opTerminadas.length})
          </button>
        </div>
      </div>

      {/* Lista de Órdenes de Producción */}
      <div className="d-flex flex-column gap-3">
        {ordenesFiltradas.length === 0 ? (
          <div className="mush-card p-5 text-center text-secondary">
            <i className="bi bi-inbox fs-1 d-block mb-2 text-dulce"></i>
            No se encontraron órdenes con el filtro seleccionado.
          </div>
        ) : (
          ordenesFiltradas.map((op) => {
            const receta = recetas.find((r) => r.id === op.recetaId);
            const costeo = costear(receta);
            const consumo = consumoOrden(receta, op.tandas);

            // Verificar si hay faltantes
            const tieneFaltantes = consumo.some((linea) => {
              const ing = ingredientes.find((i) => i.id === linea.id);
              return !ing || ing.stock < linea.cantidadTotal;
            });

            return (
              <div key={op.id} className="mush-card p-4">
                <div className="row gy-3 align-items-center">
                  {/* Info Principal */}
                  <div className="col-12 col-md-4 col-xl-3">
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <span className="badge bg-dark border border-secondary text-secondary fw-bold">
                        {op.id}
                      </span>
                      <span className="small text-secondary">
                        <i className="bi bi-calendar-event me-1"></i>
                        {op.fecha}
                      </span>
                    </div>
                    <h5 className="text-white fw-bold mb-1">
                      {receta?.imagen} {receta ? receta.nombre : op.recetaId}
                    </h5>
                    <span className="text-secondary small d-block">
                      Responsable: <strong className="text-light">{op.responsable}</strong>
                    </span>
                    {op.notas && (
                      <span className="small text-secondary fst-italic mt-1 d-block">
                        "{op.notas}"
                      </span>
                    )}
                  </div>

                  {/* Volumen & Costo */}
                  <div className="col-12 col-sm-6 col-md-4 col-xl-3">
                    <div className="mush-card-elevada p-3">
                      <div className="d-flex justify-content-between small mb-1">
                        <span className="text-secondary">Tandas:</span>
                        <span className="text-white fw-bold mush-dato">{op.tandas} tandas</span>
                      </div>
                      <div className="d-flex justify-content-between small mb-1">
                        <span className="text-secondary">Total Alfajores:</span>
                        <span className="text-dulce fw-bold mush-dato">{op.unidades} unidades</span>
                      </div>
                      <div className="d-flex justify-content-between small">
                        <span className="text-secondary">Costo Estimado Lote:</span>
                        <span className="text-light mush-dato">{pesos(costeo.costoTanda * op.tandas)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Estado y Consumo de Insumos */}
                  <div className="col-12 col-sm-6 col-md-4 col-xl-3">
                    <div className="d-flex flex-column gap-1">
                      <span className="text-secondary small">Estado del Lote:</span>
                      <div>
                        {op.estado === "Terminada" && (
                          <span className="mush-badge mush-badge-ok">
                            <i className="bi bi-check-circle-fill"></i> Terminada & Empaquetada
                          </span>
                        )}
                        {op.estado === "En proceso" && (
                          <span className="mush-badge mush-badge-alerta">
                            <i className="bi bi-hourglass-split"></i> En Proceso de Elaboración
                          </span>
                        )}
                        {op.estado === "Planificada" && (
                          <span className="mush-badge mush-badge-dulce">
                            <i className="bi bi-clock"></i> Planificada
                          </span>
                        )}
                      </div>

                      {op.estado !== "Terminada" && (
                        <div className="mt-1">
                          {tieneFaltantes ? (
                            <span className="small text-riesgo fw-bold">
                              <i className="bi bi-exclamation-circle me-1"></i>
                              Stock insuficiente de algunos insumos
                            </span>
                          ) : (
                            <span className="small text-ok">
                              <i className="bi bi-check2 me-1"></i>
                              Insumos disponibles en depósito
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Acciones para cambiar de estado */}
                  <div className="col-12 col-xl-3 text-xl-end">
                    <div className="d-flex flex-wrap justify-content-xl-end gap-2">
                      {op.estado === "Planificada" && (
                        <button
                          className="btn btn-sm btn-warning text-dark fw-bold px-3 py-2"
                          onClick={() => handleCambiarEstado(op, "En proceso")}
                        >
                          <i className="bi bi-play-fill"></i> Iniciar Elaboración
                        </button>
                      )}

                      {op.estado === "En proceso" && (
                        <button
                          className="btn btn-sm btn-success text-white fw-bold px-3 py-2"
                          onClick={() => handleCambiarEstado(op, "Terminada")}
                        >
                          <i className="bi bi-check-lg"></i> Finalizar & Descontar Stock
                        </button>
                      )}

                      {op.estado === "Terminada" && (
                        <button className="btn btn-sm btn-outline-secondary text-secondary" disabled>
                          <i className="bi bi-check2-all"></i> Lote Cerrado
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Nueva Orden de Producción */}
      {mostrarModalOP && (
        <div className="modal d-block" style={{ backgroundColor: "rgba(0, 0, 0, 0.75)" }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content mush-modal">
              <div className="modal-header mush-modal-header">
                <h5 className="modal-title mush-display text-white">
                  <i className="bi bi-gear-wide-connected text-dulce me-2"></i>
                  Crear Nueva Orden de Producción
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setMostrarModalOP(false)}
                ></button>
              </div>
              <form onSubmit={handleCrearOP}>
                <div className="modal-body p-4">
                  <div className="row g-3 mb-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label text-secondary small">Variedad de Alfajor</label>
                      <select
                        className="form-select mush-select"
                        value={nuevaOP.recetaId}
                        onChange={(e) => setNuevaOP({ ...nuevaOP, recetaId: e.target.value })}
                        required
                      >
                        {recetas.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.imagen} {r.nombre} (Rinde: {r.rinde} un/tanda)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label text-secondary small">Tandas a Fabricar</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        className="form-control mush-input"
                        value={nuevaOP.tandas}
                        onChange={(e) => setNuevaOP({ ...nuevaOP, tandas: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label text-secondary small">Fecha Programada</label>
                      <input
                        type="date"
                        className="form-control mush-input"
                        value={nuevaOP.fecha}
                        onChange={(e) => setNuevaOP({ ...nuevaOP, fecha: e.target.value })}
                        required
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label text-secondary small">Responsable del Lote</label>
                      <select
                        className="form-select mush-select"
                        value={nuevaOP.responsable}
                        onChange={(e) => setNuevaOP({ ...nuevaOP, responsable: e.target.value })}
                      >
                        <option value="Ivana López">Ivana López (Pastelería)</option>
                        <option value="Sofía Ramos">Sofía Ramos (Chocolatería)</option>
                        <option value="Marcos V.">Marcos V. (Horneado & Armado)</option>
                        <option value="Equipo Completo MUSH">Equipo Completo MUSH</option>
                      </select>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-secondary small">Notas u Observaciones del Lote</label>
                    <textarea
                      className="form-control mush-input"
                      rows="2"
                      placeholder="Ej. Producción destinada a reposición de cafeterías y feria de fin de semana..."
                      value={nuevaOP.notas}
                      onChange={(e) => setNuevaOP({ ...nuevaOP, notas: e.target.value })}
                    ></textarea>
                  </div>

                  {/* Resumen de consumo de insumos antes de crear */}
                  <div className="mush-card-elevada p-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <strong className="text-white small">
                        Insumos a consumir para {unidadesModal} alfajores ({tandasNum} tandas):
                      </strong>
                      {faltantesModal.length > 0 ? (
                        <span className="badge bg-danger">Faltan {faltantesModal.length} insumos</span>
                      ) : (
                        <span className="badge bg-success">Stock Disponible</span>
                      )}
                    </div>
                    <div className="row g-2 small">
                      {consumoModal.map((c) => {
                        const ing = ingredientes.find((i) => i.id === c.id);
                        const alcanza = ing && ing.stock >= c.cantidadTotal;
                        return (
                          <div key={c.id} className="col-6 col-md-4">
                            <div className="d-flex justify-content-between p-2 bg-dark rounded border border-secondary border-opacity-25">
                              <span className="text-secondary">{c.nombre}:</span>
                              <span className={alcanza ? "text-white fw-bold" : "text-riesgo fw-bold"}>
                                {numero(c.cantidadTotal)} {c.unidad}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
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
                    Programar Orden de Producción
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

export default Produccion;
