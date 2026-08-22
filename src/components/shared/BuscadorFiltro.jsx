import { useRef } from "react";

/**
 * Buscador de filtrado con boton para limpiar.
 *
 * Cuando hay texto escrito aparece una "x" dentro de la caja que borra el
 * filtro y vuelve a mostrar todos los valores. Es el unico buscador del
 * proyecto: todas las pantallas de listado lo usan.
 *
 * - `conIcono` antepone la lupa (variante de barra de filtros ancha).
 * - `pequeno` usa `form-control-sm` (variante de cabecera de tarjeta).
 */
const BuscadorFiltro = ({
  valor,
  alCambiar,
  placeholder = "Buscar...",
  conIcono = false,
  pequeno = true,
}) => {
  const inputRef = useRef(null);
  const hayTexto = Boolean(valor);

  const limpiar = () => {
    alCambiar("");
    // Devolver el foco para poder seguir escribiendo sin volver a hacer clic
    inputRef.current?.focus();
  };

  return (
    <div className={`mush-buscador ${conIcono ? "input-group" : ""}`}>
      {conIcono && (
        <span className="input-group-text bg-dark border-secondary border-opacity-50 text-secondary">
          <i className="bi bi-search"></i>
        </span>
      )}

      <input
        ref={inputRef}
        type="text"
        className={`form-control ${pequeno ? "form-control-sm" : ""} mush-input`}
        placeholder={placeholder}
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && hayTexto) limpiar();
        }}
        autoComplete="off"
        spellCheck="false"
      />

      {hayTexto && (
        <button
          type="button"
          className="mush-filtro-limpiar"
          onClick={limpiar}
          title="Borrar filtro"
          aria-label="Borrar filtro"
        >
          <i className="bi bi-x-lg"></i>
        </button>
      )}
    </div>
  );
};

export default BuscadorFiltro;
