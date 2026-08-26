import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

const Error404 = () => {
  const navigate = useNavigate();
  const [imagenProcesada, setImagenProcesada] = useState("/404.png");

  // Procesar la imagen #404.png de la raíz para hacer transparente el fondo blanco
  // y lograr que se fusione de forma 100% invisible con el fondo de la página
  useEffect(() => {
    const img = new Image();
    img.src = "/404.png";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || 600;
        canvas.height = img.naturalHeight || 600;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Detección de fondo blanco/marfil exterior
          if (r > 235 && g > 235 && b > 235) {
            const brillo = (r + g + b) / 3;
            if (brillo >= 248) {
              data[i + 3] = 0; // Transparente total
            } else {
              data[i + 3] = Math.round((248 - brillo) * 20); // Suavizado de bordes
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
        setImagenProcesada(canvas.toDataURL("image/png"));
      } catch (e) {
        console.warn("No se pudo procesar canvas de 404, usando fallback:", e);
      }
    };
  }, []);

  return (
    <div
      className="container px-3 text-center d-flex flex-column justify-content-center align-items-center flex-grow-1 position-relative py-3"
      style={{
        minHeight: "calc(100vh - 245px)",
        maxWidth: "680px",
      }}
    >
      {/* 1. Arriba a la izquierda: Logo de MUSH difuminado */}
      <div
        className="position-absolute"
        style={{
          top: "10px",
          left: "24px",
          zIndex: 10,
        }}
      >
        <img
          src="/mush sin fondo.png"
          alt="MUSH Logo"
          style={{
            height: "64px",
            width: "auto",
            objectFit: "contain",
            mixBlendMode: "screen",
            opacity: 0.75,
            filter: "drop-shadow(0 2px 10px rgba(255, 255, 255, 0.25))",
          }}
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = "/logo.jpg";
          }}
        />
      </div>

      {/* 2. Arriba a la derecha (más a la izquierda): Botones Volver e Ir a Inicio con flecha */}
      <div
        className="position-absolute d-flex gap-2"
        style={{
          top: "14px",
          right: "80px",
          zIndex: 10,
        }}
      >
        <button
          type="button"
          className="btn-mush-ghost px-3 py-1"
          style={{ fontSize: "0.82rem" }}
          onClick={() => navigate(-1)}
        >
          Volver
        </button>
        <Link
          to="/"
          className="btn-mush px-3 py-1"
          style={{ fontSize: "0.82rem" }}
        >
          Ir a Inicio <i className="bi bi-arrow-right ms-1"></i>
        </Link>
      </div>

      {/* 3. Título con la palabra error en minúscula */}
      <h1
        className="text-white fw-bold mb-2 mt-4"
        style={{
          fontSize: "2.5rem",
          letterSpacing: "0.04em",
          textTransform: "none",
          fontFamily: "inherit",
        }}
      >
        error #404
      </h1>

      {/* 4. Dibujo de la raíz (#404.png) integrado 100% sin recuadro */}
      <div className="my-2 d-flex justify-content-center">
        <img
          src={imagenProcesada}
          alt="Error 404 - Huevo Roto"
          className="img-fluid"
          style={{
            maxHeight: "235px",
            width: "auto",
            objectFit: "contain",
            backgroundColor: "transparent",
            filter: "drop-shadow(0 10px 24px rgba(0,0,0,0.4))",
          }}
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = "/#404.png";
          }}
        />
      </div>

      {/* 5. Mensaje: Ups! tamaño original (h3) y algo salió mal en tamaño intermedio */}
      <h3 className="text-white mt-2 mb-0">
        <strong className="fw-bold">Ups!</strong>
        <span className="fw-normal text-secondary ms-1" style={{ fontSize: "1.35rem" }}>
          , algo salió mal.
        </span>
      </h3>
    </div>
  );
};

export default Error404;
