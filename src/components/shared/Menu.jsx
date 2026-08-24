import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useMush } from "../../context/MushContext";

const Menu = () => {
  const location = useLocation();
  const { listaAlertas, ordenesProduccion, tema, alternarTema } = useMush();
  const [navColapsado, setNavColapsado] = useState(true);

  const [dropdownAltas, setDropdownAltas] = useState(false);
  const dropdownRef = useRef(null);

  // Cerrar el dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickFuera = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownAltas(false);
      }
    };
    document.addEventListener("mousedown", handleClickFuera);
    return () => document.removeEventListener("mousedown", handleClickFuera);
  }, []);

  const alertas = listaAlertas();
  const opActivas = ordenesProduccion.filter((op) => op.estado !== "Terminada");
  // Al entrar a una tarjeta se navega a una ruta anidada (/recetas/maicena,
  // /costos/mendiant/packaging): la pagina de la que salio queda destacada igual.
  const rutaActiva = (ruta) =>
    location.pathname === ruta || location.pathname.startsWith(`${ruta}/`);

  const esRutaAltas =
    location.pathname.startsWith("/altas") ||
    rutaActiva("/productos") ||
    rutaActiva("/ingredientes") ||
    rutaActiva("/packaging") ||
    rutaActiva("/personal") ||
    rutaActiva("/precios") ||
    rutaActiva("/packagin");

  const navItems = [
    { ruta: "/recetas", etiqueta: "Recetas", icono: "bi-book" },
    { ruta: "/costos", etiqueta: "Costos", icono: "bi-cash-stack" },
    { ruta: "/precios-venta", etiqueta: "Precios Venta", icono: "bi-tag" },
    {
      ruta: "/stock",
      etiqueta: "Insumos & Stock",
      icono: "bi-box-seam",
      badge: alertas.length > 0 ? `${alertas.length}` : null,
      badgeClass: "mush-badge-critico",
    },
    {
      ruta: "/produccion",
      etiqueta: "Producción",
      icono: "bi-gear-wide-connected",
      badge: opActivas.length > 0 ? `${opActivas.length}` : null,
      badgeClass: "mush-badge-dulce",
    },
    { ruta: "/finanzas", etiqueta: "Costos & Rentabilidad", icono: "bi-graph-up-arrow" },
    { ruta: "/ventas", etiqueta: "Ventas", icono: "bi-cart-check" },
    { ruta: "/ventas-nuevo", etiqueta: "Ventas Nuevo", icono: "bi-cart-plus" },
  ];

  return (
    <header className="sticky-top py-2">
      <div className="container px-3 px-lg-4">
        <nav className="navbar navbar-expand-lg mush-navbar py-2 px-3 px-lg-4 rounded-4 shadow-sm">
          {/* Logo */}
          <Link
            to="/"
            className="navbar-brand d-flex align-items-center text-decoration-none py-1 me-3"
            onClick={() => setNavColapsado(true)}
          >
            <img
              src="/mush-logo.png"
              alt="MUSH"
              className="mush-logo-nav"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/logo.jpg";
              }}
            />
          </Link>

          {/* Botón responsive hamburger */}
          <button
            className="navbar-toggler border-0 p-2 text-light"
            type="button"
            onClick={() => setNavColapsado(!navColapsado)}
            aria-label="Abrir navegación"
          >
            <i className={`bi ${navColapsado ? "bi-list" : "bi-x-lg"} fs-3 text-dulce`}></i>
          </button>

          {/* Enlaces de navegación */}
          <div className={`collapse navbar-collapse ${navColapsado ? "" : "show"}`}>
            <ul className="navbar-nav mx-auto my-2 my-lg-0 gap-1 gap-lg-2 align-items-lg-center">
              {/* Tablero */}
              <li className="nav-item">
                <Link
                  to="/"
                  className={`mush-nav-link ${location.pathname === "/" ? "activo" : ""}`}
                  onClick={() => setNavColapsado(true)}
                >
                  <i className="bi bi-speedometer2 fs-6"></i>
                  <span>Tablero</span>
                </Link>
              </li>

              {/* Menú Desplegable ALTAS (solo por clic) */}
              <li
                className="nav-item dropdown position-relative"
                ref={dropdownRef}
              >
                <button
                  type="button"
                  className={`mush-nav-link d-inline-flex align-items-center gap-1 ${esRutaAltas ? "activo" : ""}`}
                  onClick={() => setDropdownAltas(!dropdownAltas)}
                  aria-expanded={dropdownAltas}
                >
                  <i className="bi bi-folder2 fs-6"></i>
                  <span>Altas</span>
                  <i className="bi bi-chevron-down small ms-1" style={{ fontSize: "0.65rem" }}></i>
                </button>

                {dropdownAltas && (
                  <ul
                    className="dropdown-menu show shadow-lg border border-secondary border-opacity-25 rounded-3 py-1 animate__animated animate__fadeIn"
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      zIndex: 1050,
                      backgroundColor: "var(--mush-superficie)",
                      minWidth: "170px",
                    }}
                  >
                    <li>
                      <Link
                        to="/productos"
                        className="dropdown-item d-flex align-items-center gap-2 py-2"
                        onClick={() => {
                          setDropdownAltas(false);
                          setNavColapsado(true);
                        }}
                      >
                        <span className="fs-6">🍪</span>
                        <span className="small fw-semibold text-white">Productos</span>
                      </Link>
                    </li>
                    <li>
                      <hr className="dropdown-divider my-1 border-secondary border-opacity-25" />
                    </li>
                    <li>
                      <Link
                        to="/ingredientes"
                        className="dropdown-item d-flex align-items-center gap-2 py-2"
                        onClick={() => {
                          setDropdownAltas(false);
                          setNavColapsado(true);
                        }}
                      >
                        <span className="fs-6">🌾</span>
                        <span className="small fw-semibold text-white">Ingredientes</span>
                      </Link>
                    </li>
                    <li>
                      <hr className="dropdown-divider my-1 border-secondary border-opacity-25" />
                    </li>
                    <li>
                      <Link
                        to="/packaging"
                        className="dropdown-item d-flex align-items-center gap-2 py-2"
                        onClick={() => {
                          setDropdownAltas(false);
                          setNavColapsado(true);
                        }}
                      >
                        <span className="fs-6">📦</span>
                        <span className="small fw-semibold text-white">Packaging</span>
                      </Link>
                    </li>
                    <li>
                      <hr className="dropdown-divider my-1 border-secondary border-opacity-25" />
                    </li>
                    <li>
                      <Link
                        to="/precios"
                        className="dropdown-item d-flex align-items-center gap-2 py-2"
                        onClick={() => {
                          setDropdownAltas(false);
                          setNavColapsado(true);
                        }}
                      >
                        <span className="fs-6">💲</span>
                        <span className="small fw-semibold text-white">Precios</span>
                      </Link>
                    </li>
                    <li>
                      <hr className="dropdown-divider my-1 border-secondary border-opacity-25" />
                    </li>
                    <li>
                      <Link
                        to="/personal"
                        className="dropdown-item d-flex align-items-center gap-2 py-2"
                        onClick={() => {
                          setDropdownAltas(false);
                          setNavColapsado(true);
                        }}
                      >
                        <span className="fs-6">🧑‍🍳</span>
                        <span className="small fw-semibold text-white">Personal</span>
                      </Link>
                    </li>
                  </ul>
                )}
              </li>

              {/* Demás Items de navegación */}
              {navItems.map((item) => {
                const activo = rutaActiva(item.ruta);
                return (
                  <li className="nav-item" key={item.ruta}>
                    <Link
                      to={item.ruta}
                      className={`mush-nav-link ${activo ? "activo" : ""}`}
                      onClick={() => setNavColapsado(true)}
                    >
                      <i className={`bi ${item.icono} fs-6`}></i>
                      <span>{item.etiqueta}</span>
                      {item.badge && (
                        <span className={`badge ${item.badgeClass} ms-1`} style={{ fontSize: "0.65rem", padding: "0.2rem 0.45rem" }}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Acciones de la barra */}
            <div className="d-flex align-items-center gap-2 mt-3 mt-lg-0">
              <Link
                to="/ventas"
                className="btn-mush btn-sm py-2 px-3"
                onClick={() => setNavColapsado(true)}
              >
                <span>Nueva Venta</span>
              </Link>

              {/* Botón cambiar tema Claro / Oscuro */}
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary border-0 p-2 text-secondary"
                onClick={alternarTema}
                title={tema === "light" ? "Cambiar a Modo Oscuro" : "Cambiar a Modo Claro"}
              >
                <i className={`bi ${tema === "light" ? "bi-moon-stars-fill text-dulce" : "bi-sun-fill text-warning"} fs-6`}></i>
              </button>
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
};

export default Menu;
