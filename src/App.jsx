import { BrowserRouter, Routes, Route } from "react-router-dom";
import Menu from "./components/shared/Menu.jsx";
import Footer from "./components/shared/Footer.jsx";
import Inicio from "./components/pages/Inicio.jsx";
import Error404 from "./components/pages/Error404.jsx";

function App() {
  return (
    <BrowserRouter>
      <Menu />
      <main>
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="*" element={<Error404 />} />
        </Routes>
      </main>
      <Footer />
    </BrowserRouter>
  );
}

export default App;
