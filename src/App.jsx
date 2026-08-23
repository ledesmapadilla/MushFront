import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MushProvider } from "./context/MushContext.jsx";
import Menu from "./components/shared/Menu.jsx";
import Footer from "./components/shared/Footer.jsx";
import Inicio from "./components/pages/Inicio.jsx";
import Recetas from "./components/pages/Recetas.jsx";
import RecetaDetalle from "./components/pages/RecetaDetalle.jsx";
import StockInsumos from "./components/pages/StockInsumos.jsx";
import Produccion from "./components/pages/Produccion.jsx";
import CostosFinanzas from "./components/pages/CostosFinanzas.jsx";
import Ventas from "./components/pages/Ventas.jsx";
import AltaAlfajores from "./components/pages/AltaAlfajores.jsx";
import AltaIngredientes from "./components/pages/AltaIngredientes.jsx";
import Packaging from "./components/pages/Packaging.jsx";
import AltaPersonal from "./components/pages/AltaPersonal.jsx";
import Precios from "./components/pages/Precios.jsx";
import Costos from "./components/pages/Costos.jsx";
import CostoDetalle from "./components/pages/CostoDetalle.jsx";
import CostosVariedades from "./components/pages/CostosVariedades.jsx";
import PreciosVenta from "./components/pages/PreciosVenta.jsx";
import Error404 from "./components/pages/Error404.jsx";

function App() {
  return (
    <MushProvider>
      <BrowserRouter>
        <Menu />
        <main>
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/recetas" element={<Recetas />} />
            <Route path="/recetas/:slug" element={<RecetaDetalle />} />
            <Route path="/recetas/:slug/:seccion" element={<RecetaDetalle />} />
            <Route path="/productos" element={<AltaAlfajores />} />
            <Route path="/altas/alfajores" element={<AltaAlfajores />} />
            <Route path="/altas/productos" element={<AltaAlfajores />} />
            <Route path="/ingredientes" element={<AltaIngredientes />} />
            <Route path="/altas/ingredientes" element={<AltaIngredientes />} />
            <Route path="/packaging" element={<Packaging />} />
            <Route path="/packagin" element={<Packaging />} />
            <Route path="/altas/packaging" element={<Packaging />} />
            <Route path="/precios" element={<Precios />} />
            <Route path="/altas/precios" element={<Precios />} />
            <Route path="/personal" element={<AltaPersonal />} />
            <Route path="/altas/personal" element={<AltaPersonal />} />
            <Route path="/altas" element={<Navigate to="/productos" replace />} />
            <Route path="/stock" element={<StockInsumos />} />
            <Route path="/produccion" element={<Produccion />} />
            <Route path="/finanzas" element={<CostosFinanzas />} />
            <Route path="/costos" element={<Costos />} />
            <Route path="/costos/:slug" element={<CostosVariedades />} />
            <Route path="/costos/:slug/:parte" element={<CostoDetalle />} />
            <Route path="/precios-venta" element={<PreciosVenta />} />
            <Route path="/ventas" element={<Ventas />} />
            <Route path="*" element={<Error404 />} />
          </Routes>
        </main>
        <Footer />
      </BrowserRouter>
    </MushProvider>
  );
}

export default App;

