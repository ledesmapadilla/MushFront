const Footer = () => {
  const anio = new Date().getFullYear();

  return (
    <footer className="fixed-bottom py-2" style={{ zIndex: 1020, pointerEvents: "none" }}>
      <div className="container px-3 px-lg-4" style={{ pointerEvents: "auto" }}>
        <div className="mush-navbar py-2 px-3 px-lg-4 rounded-4 shadow-sm text-center">
          <span className="small text-secondary">
            © {anio} &nbsp;&nbsp; MUSH - Alfajores Artesanales.
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
