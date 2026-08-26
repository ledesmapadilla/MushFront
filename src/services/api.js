// Si estamos en entorno local de desarrollo (localhost:5173), apunta directamente al backend local (localhost:3001)
// En producción desplegada, utiliza la variable VITE_API_URL o el dominio de Vercel
const isDev = import.meta.env.DEV;
const API_URL = isDev
  ? "http://localhost:3001/api"
  : (import.meta.env.VITE_API_URL || "https://mush-back.vercel.app/api");

// Ninguna peticion puede colgar la interfaz: si el backend no responde en
// TIMEOUT_MS, se aborta y la app sigue trabajando con los datos locales.
const TIMEOUT_MS = 8000;

const pedir = (url, opciones = {}) =>
  fetch(url, { ...opciones, signal: AbortSignal.timeout(TIMEOUT_MS) });

// Una respuesta que no es JSON (por ejemplo una pagina de error HTML) no debe
// romper con un error de parseo: se devuelve un objeto vacio y decide res.ok.
const leerJson = async (res) => {
  try {
    return await res.json();
  } catch {
    return {};
  }
};

export const apiIngredientes = {
  async obtenerTodos() {
    try {
      const res = await pedir(`${API_URL}/ingredientes`);
      if (!res.ok) {
        throw new Error(`Error ${res.status}: no se pudo obtener ingredientes`);
      }
      const json = await leerJson(res);
      return json.data || [];
    } catch (error) {
      console.warn(`No se pudo conectar a ${API_URL}/ingredientes:`, error.message);
      return null;
    }
  },

  async crear(datos) {
    let res;
    try {
      res = await pedir(`${API_URL}/ingredientes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
    } catch {
      throw new Error(
        `No se pudo conectar con el servidor Backend (${API_URL}). Verifica que el backend esté corriendo en http://localhost:3001.`
      );
    }

    const json = await leerJson(res);
    if (!res.ok) {
      throw new Error(json.message || "Error de validación devuelto por el servidor.");
    }
    return json.data;
  },

  async actualizar(id, datos) {
    let res;
    try {
      res = await pedir(`${API_URL}/ingredientes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
    } catch {
      throw new Error(
        `No se pudo conectar con el servidor Backend (${API_URL}). Verifica que el backend esté corriendo en http://localhost:3001.`
      );
    }

    const json = await leerJson(res);
    if (!res.ok) {
      throw new Error(json.message || "Error de validación devuelto por el servidor.");
    }
    return json.data;
  },

  async eliminar(id) {
    let res;
    try {
      res = await pedir(`${API_URL}/ingredientes/${id}`, {
        method: "DELETE",
      });
    } catch {
      throw new Error(
        `No se pudo conectar con el servidor Backend (${API_URL}).`
      );
    }

    const json = await leerJson(res);
    if (!res.ok) throw new Error(json.message || "Error al eliminar en backend.");
    return json;
  },
};

export const apiAlfajores = {
  async obtenerTodos() {
    try {
      const res = await pedir(`${API_URL}/alfajores`);
      if (!res.ok) {
        throw new Error(`Error ${res.status}: no se pudo obtener alfajores`);
      }
      const json = await leerJson(res);
      return json.data || [];
    } catch (error) {
      console.warn(`No se pudo conectar a ${API_URL}/alfajores:`, error.message);
      return null;
    }
  },

  async crear(datos) {
    let res;
    try {
      res = await pedir(`${API_URL}/alfajores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
    } catch {
      throw new Error(
        `No se pudo conectar con el servidor Backend (${API_URL}). Verifica que el backend esté corriendo en http://localhost:3001.`
      );
    }

    const json = await leerJson(res);
    if (!res.ok) {
      throw new Error(json.message || "Error de validación devuelto por el servidor.");
    }
    return json.data;
  },

  async actualizar(id, datos) {
    let res;
    try {
      res = await pedir(`${API_URL}/alfajores/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
    } catch {
      throw new Error(
        `No se pudo conectar con el servidor Backend (${API_URL}). Verifica que el backend esté corriendo en http://localhost:3001.`
      );
    }

    const json = await leerJson(res);
    if (!res.ok) {
      throw new Error(json.message || "Error de validación devuelto por el servidor.");
    }
    return json.data;
  },

  async eliminar(id) {
    let res;
    try {
      res = await pedir(`${API_URL}/alfajores/${id}`, {
        method: "DELETE",
      });
    } catch {
      throw new Error(
        `No se pudo conectar con el servidor Backend (${API_URL}).`
      );
    }

    const json = await leerJson(res);
    if (!res.ok) throw new Error(json.message || "Error al eliminar en backend.");
    return json;
  },
};

export const apiPackaging = {
  async obtenerTodos() {
    try {
      const res = await pedir(`${API_URL}/packaging`);
      if (!res.ok) {
        throw new Error(`Error ${res.status}: no se pudo obtener packaging`);
      }
      const json = await leerJson(res);
      return json.data || [];
    } catch (error) {
      console.warn(`No se pudo conectar a ${API_URL}/packaging:`, error.message);
      return null;
    }
  },

  async crear(datos) {
    let res;
    try {
      res = await pedir(`${API_URL}/packaging`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
    } catch {
      throw new Error(
        `No se pudo conectar con el servidor Backend (${API_URL}). Verifica que el backend esté corriendo en http://localhost:3001.`
      );
    }

    const json = await leerJson(res);
    if (!res.ok) {
      throw new Error(json.message || "Error de validación devuelto por el servidor.");
    }
    return json.data;
  },

  async actualizar(id, datos) {
    let res;
    try {
      res = await pedir(`${API_URL}/packaging/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
    } catch {
      throw new Error(
        `No se pudo conectar con el servidor Backend (${API_URL}). Verifica que el backend esté corriendo en http://localhost:3001.`
      );
    }

    const json = await leerJson(res);
    if (!res.ok) {
      throw new Error(json.message || "Error de validación devuelto por el servidor.");
    }
    return json.data;
  },

  async eliminar(id) {
    let res;
    try {
      res = await pedir(`${API_URL}/packaging/${id}`, {
        method: "DELETE",
      });
    } catch {
      throw new Error(
        `No se pudo conectar con el servidor Backend (${API_URL}).`
      );
    }

    const json = await leerJson(res);
    if (!res.ok) throw new Error(json.message || "Error al eliminar en backend.");
    return json;
  },
};

export const apiPersonal = {
  async obtenerTodos() {
    try {
      const res = await pedir(`${API_URL}/personal`);
      if (!res.ok) {
        throw new Error(`Error ${res.status}: no se pudo obtener personal`);
      }
      const json = await leerJson(res);
      return json.data || [];
    } catch (error) {
      console.warn(`No se pudo conectar a ${API_URL}/personal:`, error.message);
      return null;
    }
  },

  async crear(datos) {
    let res;
    try {
      res = await pedir(`${API_URL}/personal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
    } catch {
      throw new Error(
        `No se pudo conectar con el servidor Backend (${API_URL}). Verifica que el backend esté corriendo en http://localhost:3001.`
      );
    }

    const json = await leerJson(res);
    if (!res.ok) {
      throw new Error(json.message || "Error de validación devuelto por el servidor.");
    }
    return json.data;
  },

  async actualizar(id, datos) {
    let res;
    try {
      res = await pedir(`${API_URL}/personal/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
    } catch {
      throw new Error(
        `No se pudo conectar con el servidor Backend (${API_URL}). Verifica que el backend esté corriendo en http://localhost:3001.`
      );
    }

    const json = await leerJson(res);
    if (!res.ok) {
      throw new Error(json.message || "Error de validación devuelto por el servidor.");
    }
    return json.data;
  },

  async eliminar(id) {
    let res;
    try {
      res = await pedir(`${API_URL}/personal/${id}`, { method: "DELETE" });
    } catch {
      throw new Error(`No se pudo conectar con el servidor Backend (${API_URL}).`);
    }

    const json = await leerJson(res);
    if (!res.ok) throw new Error(json.message || "Error al eliminar en backend.");
    return json;
  },
};

export const apiRecetas = {
  async obtenerTodos() {
    try {
      const res = await pedir(`${API_URL}/recetas`);
      if (!res.ok) {
        throw new Error(`Error ${res.status}: no se pudo obtener recetas`);
      }
      const json = await leerJson(res);
      return json.data || [];
    } catch (error) {
      console.warn(`No se pudo conectar a ${API_URL}/recetas:`, error.message);
      return null;
    }
  },

  async guardar(datos) {
    let res;
    try {
      res = await pedir(`${API_URL}/recetas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
    } catch {
      throw new Error(
        `No se pudo conectar con el servidor Backend (${API_URL}). Verifica que el backend esté corriendo en http://localhost:3001.`
      );
    }

    const json = await leerJson(res);
    if (!res.ok) {
      throw new Error(json.message || "Error al guardar la receta.");
    }
    return json.data;
  },

  async eliminar(idOrSlug) {
    let res;
    try {
      res = await pedir(`${API_URL}/recetas/${idOrSlug}`, { method: "DELETE" });
    } catch {
      throw new Error(`No se pudo conectar con el servidor Backend (${API_URL}).`);
    }

    const json = await leerJson(res);
    if (!res.ok) throw new Error(json.message || "Error al eliminar en backend.");
    return json;
  },
};
