/**
 * Las preparaciones de la casa: no son un ingrediente que se compra, se hacen
 * aparte y despues entran en el alfajor.
 *
 * Cada una esta escrita para una base: los gramos que rinde la receta de la
 * pasta y el praline, o los alfajores que salen de una tanda del bano. De ahi
 * salen las dos pantallas que las usan:
 *
 *   - Recetas: la tabla anidada dentro de "Ingredientes por unidad", donde se
 *     cargan y se editan.
 *   - Costos: las tablas de calculo, que llevan esa base a la cantidad que se
 *     quiera y muestran lo que cuesta.
 *
 * El titulo y la base se escriben una sola vez, aca.
 */
export const PREPARACIONES = [
  {
    id: "pasta-pistacho",
    titulo: "Pasta de Pistacho",
    gramosBase: 740,
    soloEn: ["alfajor-de-pistacho"],
  },
  {
    id: "praline-pistacho",
    titulo: "Praliné de Pistacho",
    gramosBase: 240,
    soloEn: ["alfajor-de-pistacho"],
  },
  {
    id: "bano-blanco-praline",
    titulo: "Baño de chocolate blanco/pasta praline",
    alfajoresBase: 20,
    // Cada fila se puede desglosar en varios componentes.
    conComponentes: true,
    soloEn: ["alfajor-de-pistacho"],
  },
];

/** Las preparaciones que tienen algo cargado en esta receta. */
export const preparacionesDeReceta = (receta) =>
  PREPARACIONES.filter((preparacion) =>
    (receta?.ingredientes || []).some((linea) => linea.seccion === preparacion.id)
  );
