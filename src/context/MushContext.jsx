import { createContext, useContext, useState, useEffect } from "react";
import {
  ingredientesIniciales,
  costosOperativosIniciales,
  ordenesProduccionIniciales,
  ventasIniciales,
  comprasIniciales,
  canalesVenta as canalesVentaData,
} from "../data/negocio";
import {
  costearReceta as calcCostearReceta,
  consumoDeOrden as calcConsumoDeOrden,
  insumosEnAlerta as calcInsumosEnAlerta,
  calcularResumenMes,
  calcularSerieMensual,
} from "../utils/calculos";
import { costearProducto } from "../utils/costos";
import { anotarPrecios, preciosDeProducto } from "../utils/precios";
import { apiIngredientes, apiAlfajores, apiPackaging, apiRecetas, apiPersonal } from "../services/api.js";

const MushContext = createContext();

const STORAGE_KEY = "mush_sistema_alfajores_v4";

// Dos recetas son la misma solo si coinciden en un id o slug realmente definido:
// comparar campos vacios haria que "undefined === undefined" empareje cualquier par.
const mismaReceta = (a, b) =>
  Boolean((a.id && b.id && a.id === b.id) || (a.slug && b.slug && a.slug === b.slug));

export function MushProvider({ children }) {
  // Tema claro / oscuro (por defecto "light")
  const [tema, setTema] = useState(() => {
    try {
      const guardado = localStorage.getItem(`${STORAGE_KEY}_tema`);
      return guardado || "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-bs-theme", tema);
    try {
      localStorage.setItem(`${STORAGE_KEY}_tema`, tema);
    } catch (e) {
      console.warn("Error guardando tema", e);
    }
  }, [tema]);

  const alternarTema = () => {
    setTema((prev) => (prev === "light" ? "dark" : "light"));
  };

  // Inicialización con persistencia en localStorage
  const [ingredientes, setIngredientes] = useState(() => {
    try {
      const guardado = localStorage.getItem(`${STORAGE_KEY}_ingredientes`);
      return guardado ? JSON.parse(guardado) : ingredientesIniciales;
    } catch {
      return ingredientesIniciales;
    }
  });

  const [alfajores, setAlfajores] = useState(() => {
    try {
      const guardado = localStorage.getItem(`${STORAGE_KEY}_alfajores`);
      return guardado ? JSON.parse(guardado) : [];
    } catch {
      return [];
    }
  });

  const [packaging, setPackaging] = useState(() => {
    try {
      const guardado = localStorage.getItem(`${STORAGE_KEY}_packaging`);
      return guardado ? JSON.parse(guardado) : [];
    } catch {
      return [];
    }
  });

  const [personal, setPersonal] = useState(() => {
    try {
      const guardado = localStorage.getItem(`${STORAGE_KEY}_personal`);
      return guardado ? JSON.parse(guardado) : [];
    } catch {
      return [];
    }
  });

  const [recetas, setRecetas] = useState(() => {
    // Limpiar restos viejos de almacenamiento
    try {
      localStorage.removeItem("mush_sistema_alfajores_v3_recetas");
      localStorage.removeItem("mush_sistema_alfajores_v2_recetas");
      localStorage.removeItem("mush_sistema_alfajores_recetas");
      localStorage.removeItem("mush_recetas_v1");
      localStorage.removeItem("mush_recetas");
      const guardado = localStorage.getItem(`${STORAGE_KEY}_recetas`);
      return guardado ? JSON.parse(guardado) : [];
    } catch {
      return [];
    }
  });

  const [costosOperativos, setCostosOperativos] = useState(() => {
    try {
      const guardado = localStorage.getItem(`${STORAGE_KEY}_costosOperativos`);
      return guardado ? JSON.parse(guardado) : costosOperativosIniciales;
    } catch {
      return costosOperativosIniciales;
    }
  });

  const [ordenesProduccion, setOrdenesProduccion] = useState(() => {
    try {
      const guardado = localStorage.getItem(`${STORAGE_KEY}_ordenesProduccion`);
      return guardado ? JSON.parse(guardado) : ordenesProduccionIniciales;
    } catch {
      return ordenesProduccionIniciales;
    }
  });

  const [ventas, setVentas] = useState(() => {
    try {
      const guardado = localStorage.getItem(`${STORAGE_KEY}_ventas`);
      return guardado ? JSON.parse(guardado) : ventasIniciales;
    } catch {
      return ventasIniciales;
    }
  });

  const [compras, setCompras] = useState(() => {
    try {
      const guardado = localStorage.getItem(`${STORAGE_KEY}_compras`);
      return guardado ? JSON.parse(guardado) : comprasIniciales;
    } catch {
      return comprasIniciales;
    }
  });

  const [canalesVenta] = useState(canalesVentaData);

  // Sincronización con localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_ingredientes`, JSON.stringify(ingredientes));
    } catch (e) {
      console.warn("Error guardando ingredientes en localStorage", e);
    }
  }, [ingredientes]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_alfajores`, JSON.stringify(alfajores));
    } catch (e) {
      console.warn("Error guardando alfajores en localStorage", e);
    }
  }, [alfajores]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_packaging`, JSON.stringify(packaging));
    } catch (e) {
      console.warn("Error guardando packaging en localStorage", e);
    }
  }, [packaging]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_personal`, JSON.stringify(personal));
    } catch (e) {
      console.warn("Error guardando personal en localStorage", e);
    }
  }, [personal]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_recetas`, JSON.stringify(recetas));
    } catch (e) {
      console.warn("Error guardando recetas en localStorage", e);
    }
  }, [recetas]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_costosOperativos`, JSON.stringify(costosOperativos));
    } catch (e) {
      console.warn("Error guardando costosOperativos en localStorage", e);
    }
  }, [costosOperativos]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_ordenesProduccion`, JSON.stringify(ordenesProduccion));
    } catch (e) {
      console.warn("Error guardando ordenesProduccion en localStorage", e);
    }
  }, [ordenesProduccion]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_ventas`, JSON.stringify(ventas));
    } catch (e) {
      console.warn("Error guardando ventas en localStorage", e);
    }
  }, [ventas]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_compras`, JSON.stringify(compras));
    } catch (e) {
      console.warn("Error guardando compras en localStorage", e);
    }
  }, [compras]);

  /**
   * Lo ultimo que fallo contra el servidor.
   *
   * El proyecto trabaja siempre contra el backend. Un guardado que no llego no
   * se finge hecho ni queda "solo en este navegador": al refrescar reaparece lo
   * viejo y no hay forma de darse cuenta de que se perdio. Cuando algo falla,
   * la pantalla no cambia y esto lo dice.
   */
  const [fallaBackend, setFallaBackend] = useState("");

  const anotarFalla = (accion, err) => {
    const detalle = err?.message || "El servidor no responde.";
    setFallaBackend(`No se pudo ${accion}. ${detalle}`);
  };

  // Funciones de cálculo vinculadas al estado actual
  const costear = (receta) => calcCostearReceta(receta, ingredientes, costosOperativos);
  const consumoOrden = (receta, tandas) => calcConsumoDeOrden(receta, tandas, ingredientes);
  const listaAlertas = () => calcInsumosEnAlerta(ingredientes);
  const resumen = () => calcularResumenMes(recetas, ingredientes, costosOperativos);
  const serie = () => calcularSerieMensual(recetas, ingredientes, costosOperativos);

  // Cargar ingredientes, alfajores, packaging y recetas desde el backend al iniciar
  useEffect(() => {
    const cargarBackend = async () => {
      try {
        const [datosIngredientes, datosAlfajores, datosPackaging, datosRecetas, datosPersonal] =
          await Promise.all([
            apiIngredientes.obtenerTodos(),
            apiAlfajores.obtenerTodos(),
            apiPackaging.obtenerTodos(),
            apiRecetas.obtenerTodos(),
            apiPersonal.obtenerTodos(),
          ]);

        // `obtenerTodos` devuelve null cuando no pudo conectarse. Sin datos del
        // servidor, lo que se ve es la copia vieja del navegador y no se va a
        // poder guardar nada: hay que decirlo antes de que alguien trabaje
        // encima.
        if (!datosIngredientes || !datosAlfajores || !datosPackaging || !datosRecetas) {
          setFallaBackend(
            "No hay conexión con el servidor. Lo que ves puede estar desactualizado y no se va a poder guardar."
          );
        }

        if (datosIngredientes && Array.isArray(datosIngredientes)) {
          setIngredientes(datosIngredientes);
        }

        if (datosAlfajores && Array.isArray(datosAlfajores)) {
          setAlfajores(datosAlfajores);
        }

        if (datosPackaging && Array.isArray(datosPackaging)) {
          setPackaging(datosPackaging);
        }

        if (datosPersonal && Array.isArray(datosPersonal)) {
          setPersonal(datosPersonal);
        }

        if (datosRecetas && Array.isArray(datosRecetas)) {
          setRecetas(datosRecetas);
        }
      } catch (e) {
        setFallaBackend(`No hay conexión con el servidor. ${e?.message || ""}`.trim());
      }
    };
    cargarBackend();
  }, []);

  /**
   * Anota en cada receta como quedaron sus precios cuando cambia lo que le da
   * el costo: el precio de un ingrediente, el de un packaging o un sueldo.
   *
   * El precio de venta no se toca a mano en esos casos, pero se mueve igual, y
   * si no se anota aca el cambio no queda registrado en ningun lado. Se compara
   * el costo de antes con el de despues y solo se anotan las recetas que
   * efectivamente cambiaron.
   */
  const anotarCambioDeCosto = (cambios) => {
    const antes = { ingredientes, packaging, personal };
    const despues = { ...antes, ...cambios };

    (recetas || []).forEach((receta) => {
      const costoAntes = costearProducto(receta, antes).total;
      const costoDespues = costearProducto(receta, despues).total;
      if (costoAntes === costoDespues) return;

      const { publico, revendedor } = preciosDeProducto(costoDespues, receta.precios);
      const precios = anotarPrecios(receta.precios, {
        costo: costoDespues,
        publico,
        revendedor,
      });
      if (precios !== receta.precios) guardarReceta({ ...receta, precios });
    });
  };

  // Acciones: Stock / Ingredientes
  const guardarIngrediente = async (datos) => {
    let guardado = { ...datos };

    if (!guardado.id) {
      const baseSlug = (guardado.nombre || "ing")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "_")
        .slice(0, 20);
      const randomSuffix = Math.random().toString(36).substring(2, 6);
      guardado.id = `${baseSlug}_${randomSuffix}`;
    }

    // Primero el servidor: si no se pudo guardar ahi, no se guardo.
    try {
      const existe = ingredientes.some((i) => i.id === guardado.id);
      const res = existe
        ? await apiIngredientes.actualizar(guardado.id, guardado)
        : await apiIngredientes.crear(guardado);
      if (res) guardado = { ...guardado, ...res };
    } catch (err) {
      anotarFalla("guardar el ingrediente", err);
      throw err;
    }

    // Recien ahora, con el servidor al dia, se actualiza la pantalla.
    const listaNueva = ingredientes.some((i) => i.id === guardado.id)
      ? ingredientes.map((i) => (i.id === guardado.id ? { ...i, ...guardado } : i))
      : [...ingredientes, guardado];

    setIngredientes(listaNueva);
    anotarCambioDeCosto({ ingredientes: listaNueva });

    return guardado;
  };

  const eliminarIngrediente = async (id) => {
    try {
      await apiIngredientes.eliminar(id);
    } catch (err) {
      anotarFalla("eliminar el ingrediente", err);
      throw err;
    }
    setIngredientes((prev) => prev.filter((i) => i.id !== id));
  };

  // Acciones: Alfajores / Productos
  const guardarAlfajor = async (datos) => {
    let guardado = { ...datos };

    if (!guardado.id) {
      const baseSlug = (guardado.nombre || "alf")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "_")
        .slice(0, 20);
      const randomSuffix = Math.random().toString(36).substring(2, 6);
      guardado.id = `alf_${baseSlug}_${randomSuffix}`;
    }

    // Primero el servidor: si no se pudo guardar ahi, no se guardo.
    try {
      const existe = alfajores.some((a) => a.id === guardado.id);
      const res = existe
        ? await apiAlfajores.actualizar(guardado.id, guardado)
        : await apiAlfajores.crear(guardado);
      if (res) guardado = { ...guardado, ...res };
    } catch (err) {
      anotarFalla("guardar el producto", err);
      throw err;
    }

    setAlfajores((prev) => {
      const existeLocal = prev.some((a) => a.id === guardado.id);
      if (existeLocal) {
        return prev.map((a) => (a.id === guardado.id ? { ...a, ...guardado } : a));
      } else {
        return [...prev, guardado];
      }
    });

    return guardado;
  };

  const eliminarAlfajor = async (id) => {
    try {
      await apiAlfajores.eliminar(id);
    } catch (err) {
      anotarFalla("eliminar el producto", err);
      throw err;
    }
    setAlfajores((prev) => prev.filter((a) => a.id !== id));
  };

  // Acciones: Packaging
  const guardarPackaging = async (datos) => {
    let guardado = { ...datos };

    if (!guardado.id) {
      const baseSlug = (guardado.nombre || "pack")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "_")
        .slice(0, 20);
      const randomSuffix = Math.random().toString(36).substring(2, 6);
      guardado.id = `pack_${baseSlug}_${randomSuffix}`;
    }

    // Primero el servidor: si no se pudo guardar ahi, no se guardo.
    try {
      const existe = packaging.some((p) => p.id === guardado.id);
      const res = existe
        ? await apiPackaging.actualizar(guardado.id, guardado)
        : await apiPackaging.crear(guardado);
      if (res) guardado = { ...guardado, ...res };
    } catch (err) {
      anotarFalla("guardar el packaging", err);
      throw err;
    }

    const listaNueva = packaging.some((p) => p.id === guardado.id)
      ? packaging.map((p) => (p.id === guardado.id ? { ...p, ...guardado } : p))
      : [...packaging, guardado];

    setPackaging(listaNueva);
    anotarCambioDeCosto({ packaging: listaNueva });

    return guardado;
  };

  const eliminarPackaging = async (id) => {
    try {
      await apiPackaging.eliminar(id);
    } catch (err) {
      anotarFalla("eliminar el packaging", err);
      throw err;
    }
    setPackaging((prev) => prev.filter((p) => p.id !== id));
  };

  // Acciones: Personal
  const fusionarPersonal = (persona) =>
    setPersonal((prev) => {
      const existe = prev.some((p) => p.id === persona.id);
      if (existe) {
        return prev.map((p) => (p.id === persona.id ? { ...p, ...persona } : p));
      }
      return [...prev, persona];
    });

  const guardarPersonal = async (datos) => {
    let guardado = { ...datos };

    if (!guardado.id) {
      const baseSlug = (guardado.nombre || "per")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]/g, "_")
        .slice(0, 20);
      const randomSuffix = Math.random().toString(36).substring(2, 6);
      guardado.id = `per_${baseSlug}_${randomSuffix}`;
    }

    const existe = personal.some((p) => p.id === guardado.id);

    // Primero el servidor: si no se pudo guardar ahi, no se guardo. El backend
    // completa ademas campos como creadoEn / actualizadoEn.
    try {
      const res = existe
        ? await apiPersonal.actualizar(guardado.id, guardado)
        : await apiPersonal.crear(guardado);
      if (res) guardado = { ...guardado, ...res };
    } catch (err) {
      anotarFalla("guardar el legajo", err);
      throw err;
    }

    fusionarPersonal(guardado);
    anotarCambioDeCosto({
      personal: existe
        ? personal.map((p) => (p.id === guardado.id ? { ...p, ...guardado } : p))
        : [...personal, guardado],
    });

    return guardado;
  };

  const eliminarPersonal = async (id) => {
    try {
      await apiPersonal.eliminar(id);
    } catch (err) {
      anotarFalla("eliminar el legajo", err);
      throw err;
    }
    setPersonal((prev) => prev.filter((p) => p.id !== id));
  };

  // Acciones: Compras
  const registrarCompra = (compra) => {
    const nuevaCompra = {
      id: `OC-${Math.floor(1000 + Math.random() * 9000)}`,
      fecha: new Date().toISOString().split("T")[0],
      estado: "Completada",
      ...compra,
    };

    setCompras((prev) => [nuevaCompra, ...prev]);

    // Incrementar stock del ingrediente y actualizar su precio
    setIngredientes((prev) =>
      prev.map((item) => {
        if (item.id === compra.insumoId) {
          return {
            ...item,
            stock: Number(item.stock) + Number(compra.cantidad),
            precio: compra.precioUnitario ? Number(compra.precioUnitario) : item.precio,
          };
        }
        return item;
      })
    );

    return nuevaCompra;
  };

  // Acciones: Producción
  const agregarOrdenProduccion = (orden) => {
    const receta = recetas.find((r) => r.id === orden.recetaId);
    const rinde = receta ? receta.rinde : 60;
    const tandas = Number(orden.tandas) || 1;

    const nueva = {
      id: `OP-${Math.floor(1000 + Math.random() * 9000)}`,
      fecha: orden.fecha || new Date().toISOString().split("T")[0],
      estado: orden.estado || "Planificada",
      recetaId: orden.recetaId,
      tandas,
      unidades: tandas * rinde,
      responsable: orden.responsable || "Equipo MUSH",
      notas: orden.notas || "",
    };

    setOrdenesProduccion((prev) => [nueva, ...prev]);
    return nueva;
  };

  const cambiarEstadoProduccion = (ordenId, nuevoEstado) => {
    setOrdenesProduccion((prev) =>
      prev.map((op) => {
        if (op.id !== ordenId) return op;

        // Si cambia a "Terminada" y no lo estaba antes, se descuentan los insumos
        if (nuevoEstado === "Terminada" && op.estado !== "Terminada") {
          const receta = recetas.find((r) => r.id === op.recetaId);
          if (receta) {
            const consumo = consumoOrden(receta, op.tandas);
            setIngredientes((prevIngs) =>
              prevIngs.map((ing) => {
                const itemConsumo = consumo.find((c) => c.id === ing.id);
                if (itemConsumo) {
                  return {
                    ...ing,
                    stock: Math.max(0, Number((ing.stock - itemConsumo.cantidadTotal).toFixed(2))),
                  };
                }
                return ing;
              })
            );
          }
        }

        return { ...op, estado: nuevoEstado };
      })
    );
  };

  // Acciones: Ventas
  const registrarVenta = (venta) => {
    const receta = recetas.find((r) => r.id === venta.recetaId);
    const precio = venta.precioUnitario || (receta ? receta.precioVenta : 0);
    const cantidad = Number(venta.cantidad) || 1;
    const total = cantidad * precio;

    const nuevaVenta = {
      id: `VTA-${Math.floor(1000 + Math.random() * 9000)}`,
      fecha: venta.fecha || new Date().toISOString().split("T")[0],
      cliente: venta.cliente || "Cliente Particular",
      canal: venta.canal || "Local Propio",
      recetaId: venta.recetaId,
      cantidad,
      precioUnitario: precio,
      total,
      metodoPago: venta.metodoPago || "Efectivo",
      notas: venta.notas || "",
    };

    setVentas((prev) => [nuevaVenta, ...prev]);
    return nuevaVenta;
  };

  // Acciones: Recetas
  const fusionarReceta = (receta) =>
    setRecetas((prev) => {
      const existe = prev.some((r) => mismaReceta(r, receta));
      if (existe) {
        return prev.map((r) => (mismaReceta(r, receta) ? { ...r, ...receta } : r));
      } else {
        return [...prev, receta];
      }
    });

  /**
   * Guardar una receta.
   *
   * Primero el servidor y despues la pantalla: si el guardado no llego, la
   * receta no se toca y el campo vuelve solo al valor que hay en el servidor.
   *
   * A diferencia de las demas, esta no relanza el error: casi todas sus
   * llamadas son al salir de un campo y nadie espera la respuesta, asi que el
   * aviso de arriba es lo unico que puede enterar de la falla.
   */
  const guardarReceta = async (datos) => {
    const guardada = { ...datos };

    try {
      const res = await apiRecetas.guardar(guardada);
      // El backend completa campos como creadoEn / actualizadoEn.
      fusionarReceta(res ? { ...guardada, ...res } : guardada);
    } catch (err) {
      anotarFalla("guardar la receta", err);
    }

    return guardada;
  };

  return (
    <MushContext.Provider
      value={{
        ingredientes,
        alfajores,
        recetas,
        costosOperativos,
        ordenesProduccion,
        ventas,
        compras,
        canalesVenta,
        costear,
        consumoOrden,
        listaAlertas,
        resumen,
        serie,
        guardarIngrediente,
        eliminarIngrediente,
        guardarAlfajor,
        eliminarAlfajor,
        packaging,
        guardarPackaging,
        eliminarPackaging,
        personal,
        guardarPersonal,
        eliminarPersonal,
        registrarCompra,
        agregarOrdenProduccion,
        cambiarEstadoProduccion,
        registrarVenta,
        guardarReceta,
        setCostosOperativos,
        tema,
        alternarTema,
        fallaBackend,
        limpiarFallaBackend: () => setFallaBackend(""),
      }}
    >
      {/* Sin servidor no se guarda nada, asi que el aviso va arriba de todo y
          no se va solo: se cierra a mano, cuando se lo leyo. */}
      {fallaBackend && (
        <div
          className="position-fixed top-0 start-0 w-100 px-3 pt-2"
          style={{ zIndex: 2000 }}
          role="alert"
        >
          <div className="container">
            <div className="alert alert-danger d-flex align-items-center gap-2 mb-0 py-2 shadow">
              <i className="bi bi-exclamation-octagon-fill"></i>
              <span className="flex-grow-1" style={{ fontSize: "0.85rem" }}>
                {fallaBackend}
              </span>
              <button
                type="button"
                className="btn-close"
                onClick={() => setFallaBackend("")}
                aria-label="Cerrar"
              ></button>
            </div>
          </div>
        </div>
      )}
      {children}
    </MushContext.Provider>
  );
}

export function useMush() {
  const context = useContext(MushContext);
  if (!context) {
    throw new Error("useMush debe ser usado dentro de un MushProvider");
  }
  return context;
}
