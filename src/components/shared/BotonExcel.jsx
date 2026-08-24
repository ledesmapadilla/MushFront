import { descargarPlanilla } from "../../utils/exportar";

/**
 * Baja a una planilla lo que muestra la pantalla.
 *
 * Cada pantalla arma sus columnas y sus filas: el boton no sabe de donde salen,
 * solo las escribe. El titulo encabeza la planilla y le da el nombre al archivo.
 */
const BotonExcel = ({ titulo, columnas, filas, className = "" }) => (
  <button
    type="button"
    className={`btn-mush-ghost text-ok d-inline-flex align-items-center gap-2 text-nowrap ${className}`}
    onClick={() => descargarPlanilla(titulo, columnas, filas())}
    title={`Bajar ${titulo.toLowerCase()} a una planilla`}
  >
    <i className="bi bi-file-earmark-spreadsheet"></i>
    Excel
  </button>
);

export default BotonExcel;
