import { useState, useMemo, useId } from "react";
import {
  UNIDADES_CONVERTIBLES,
  convertir,
  equivalenciaDeItem,
  formatearCantidad,
  mismaFamilia,
  textoEquivalencia,
} from "../../utils/conversiones.js";

// Etiqueta de formulario de la guia de estilos. Las tres cajas chicas la llevan
// centrada encima; la del ingrediente, alineada a la izquierda como el resto.
const ETIQUETA = "form-label text-secondary fw-semibold mb-1";
const ETIQUETA_CENTRADA = `${ETIQUETA} d-block text-center`;
const ESTILO_ETIQUETA = { fontSize: "0.78rem" };

/**
 * Tablita de calculos: convierte una cantidad de un ingrediente entre unidades.
 *
 * De kg a gr o de lts a ml sale de una cuenta fija. Para cruzar peso con volumen
 * o con unidades (kg -> lts, kg -> un) usa la equivalencia que se anoto a mano
 * en las observaciones de Precios o del alta del ingrediente: "1lts de miel pesa
 * 1,4 kg", "Un huevo, pesa 50 gr". Si el ingrediente no tiene nada anotado, lo
 * dice en vez de inventar un numero.
 */
const ConversorUnidades = ({ ingredientes }) => {
  // El conversor puede montarse mas de una vez: los id de los campos tienen que
  // ser unicos para que cada etiqueta apunte a su propia caja.
  const id = useId();
  const [ingredienteId, setIngredienteId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [desde, setDesde] = useState("kg");
  const [hasta, setHasta] = useState("un");

  const lista = useMemo(
    () =>
      [...(ingredientes || [])].sort((a, b) =>
        (a.nombre || "").localeCompare(b.nombre || "", "es", { sensitivity: "base" })
      ),
    [ingredientes]
  );

  const ingrediente = lista.find((i) => i.id === ingredienteId);
  const equivalencia = useMemo(() => equivalenciaDeItem(ingrediente), [ingrediente]);

  const cantidadNumero = Number(String(cantidad).replace(",", "."));
  const hayCantidad = String(cantidad).trim() !== "" && Number.isFinite(cantidadNumero);
  const necesitaEquivalencia = !mismaFamilia(desde, hasta);
  const resultado = hayCantidad ? convertir(cantidadNumero, desde, hasta, equivalencia) : null;

  const faltaIngrediente = necesitaEquivalencia && !ingrediente;
  const faltaAnotacion = necesitaEquivalencia && ingrediente && resultado === null && hayCantidad;

  return (
    <div className="mush-card p-3">
      <div className="d-flex align-items-center gap-2 mb-2">
        <i className="bi bi-arrow-left-right text-dulce"></i>
        <span className="mush-kicker">Conversor</span>
      </div>

      <label className={ETIQUETA} style={ESTILO_ETIQUETA} htmlFor={`${id}-ingrediente`}>
        Ingrediente
      </label>
      <select
        id={`${id}-ingrediente`}
        className="form-select form-select-sm mush-input py-1 px-2 mb-2"
        style={{ fontSize: "0.85rem" }}
        value={ingredienteId}
        onChange={(e) => setIngredienteId(e.target.value)}
      >
        <option value="">-- Seleccionar --</option>
        {lista.map((i) => (
          <option key={i.id} value={i.id}>
            {i.nombre}
          </option>
        ))}
      </select>

      <div className="row g-1 mb-2">
        <div className="col-4">
          <label className={ETIQUETA_CENTRADA} style={ESTILO_ETIQUETA} htmlFor={`${id}-cantidad`}>
            Cant.
          </label>
          <input
            id={`${id}-cantidad`}
            type="text"
            inputMode="decimal"
            className="form-control form-control-sm mush-input mush-dato py-1 px-2 text-center"
            style={{ fontSize: "0.85rem" }}
            placeholder="0"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            autoComplete="off"
            spellCheck="false"
          />
        </div>
        <div className="col-4">
          <label className={ETIQUETA_CENTRADA} style={ESTILO_ETIQUETA} htmlFor={`${id}-desde`}>
            De
          </label>
          <select
            id={`${id}-desde`}
            className="form-select form-select-sm mush-input py-1 px-2"
            style={{ fontSize: "0.85rem" }}
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          >
            {UNIDADES_CONVERTIBLES.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div className="col-4">
          <label className={ETIQUETA_CENTRADA} style={ESTILO_ETIQUETA} htmlFor={`${id}-hasta`}>
            A
          </label>
          <select
            id={`${id}-hasta`}
            className="form-select form-select-sm mush-input py-1 px-2"
            style={{ fontSize: "0.85rem" }}
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          >
            {UNIDADES_CONVERTIBLES.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Resultado: se separa con fondo propio para que se lea como un valor
          calculado, no como un dato cargado. */}
      <div className="mush-card-elevada p-2 px-3 text-center">
        {resultado !== null ? (
          <span className="text-white mush-dato" style={{ fontSize: "0.82rem" }}>
            {formatearCantidad(resultado)} {hasta}
          </span>
        ) : (
          <span className="text-secondary" style={{ fontSize: "0.78rem" }}>
            {faltaIngrediente
              ? "Elegí el ingrediente"
              : faltaAnotacion
                ? `${ingrediente.nombre} no tiene la equivalencia anotada`
                : "—"}
          </span>
        )}
      </div>

      {equivalencia && (
        <div
          className="text-secondary text-truncate mt-2"
          style={{ fontSize: "0.72rem" }}
          title={equivalencia.texto}
        >
          <i className="bi bi-journal-text me-1"></i>
          {textoEquivalencia(equivalencia)}
        </div>
      )}
    </div>
  );
};

export default ConversorUnidades;
