/**
 * Bajar una tabla de la pantalla a una planilla de Excel.
 *
 * El archivo es un .xlsx de verdad (un zip con los XML que define el formato),
 * no un CSV ni una tabla HTML disfrazada: asi Excel lo abre sin avisos de
 * archivo de procedencia dudosa, y respeta la negrita, el tamano de letra y el
 * formato de moneda.
 *
 * Toda planilla arranca igual: el titulo de la pantalla en grande, la fecha en
 * la que se bajo, y recien despues la tabla.
 */
import { fechaHoy, fechaLegible } from "./sueldos.js";
import { armarZip } from "./zip.js";

// Los formatos propios, numerados desde 164 (de ahi para arriba son libres).
const FORMATOS = {
  moneda: { id: 164, codigo: '"$"\\ #,##0.00' },
  porcentaje: { id: 165, codigo: '0\\ "%"' },
  numero: { id: 166, codigo: "#,##0.00" },
};

// El orden de los estilos es el que usa la hoja al nombrarlos por numero.
const ESTILOS = { normal: 0, titulo: 1, fecha: 2, encabezado: 3, moneda: 4, porcentaje: 5, numero: 6 };

const escapar = (texto) =>
  String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// Dentro de un atributo hay que escapar tambien las comillas: el formato de
// moneda las lleva y sin esto el XML queda roto.
const escaparAtributo = (texto) => escapar(texto).replace(/"/g, "&quot;");

/** 0 -> A, 25 -> Z, 26 -> AA. */
const columnaExcel = (indice) => {
  let nombre = "";
  let n = indice;
  do {
    nombre = String.fromCharCode(65 + (n % 26)) + nombre;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return nombre;
};

const celda = (fila, columna, valor, estilo) => {
  const ref = `${columnaExcel(columna)}${fila}`;
  const vacia = valor === null || valor === undefined || valor === "";
  if (vacia) return `<c r="${ref}" s="${estilo}"/>`;

  if (typeof valor === "number" && Number.isFinite(valor)) {
    // En el archivo los numeros van siempre con punto: el separador que se ve
    // lo pone Excel segun el idioma.
    return `<c r="${ref}" s="${estilo}"><v>${valor}</v></c>`;
  }

  return `<c r="${ref}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${escapar(
    valor
  )}</t></is></c>`;
};

const hoja = (titulo, cols, filas) => {
  const anchos = cols
    .map((_, i) => `<col min="${i + 1}" max="${i + 1}" width="22" customWidth="1"/>`)
    .join("");

  const encabezados = cols
    .map(({ titulo: nombre }, i) => celda(4, i, nombre, ESTILOS.encabezado))
    .join("");

  const cuerpo = filas
    .map((fila, f) => {
      const celdas = fila
        .map((valor, i) => {
          const formato = cols[i]?.formato;
          const estilo = typeof valor === "number" ? ESTILOS[formato] ?? ESTILOS.numero : ESTILOS.normal;
          return celda(f + 5, i, valor, estilo);
        })
        .join("");
      return `<row r="${f + 5}">${celdas}</row>`;
    })
    .join("");

  const ultima = columnaExcel(Math.max(cols.length - 1, 0));

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<cols>${anchos}</cols><sheetData>` +
    `<row r="1" ht="21" customHeight="1">${celda(1, 0, titulo, ESTILOS.titulo)}</row>` +
    `<row r="2">${celda(2, 0, fechaLegible(fechaHoy()), ESTILOS.fecha)}</row>` +
    `<row r="3"/>` +
    `<row r="4">${encabezados}</row>` +
    `${cuerpo}</sheetData>` +
    `<mergeCells count="2"><mergeCell ref="A1:${ultima}1"/><mergeCell ref="A2:${ultima}2"/></mergeCells>` +
    `</worksheet>`
  );
};

// Fuentes, rellenos, bordes y la combinacion de todo eso en cada estilo.
const ESTILOS_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<numFmts count="3">` +
  Object.values(FORMATOS)
    .map(({ id, codigo }) => `<numFmt numFmtId="${id}" formatCode="${escaparAtributo(codigo)}"/>`)
    .join("") +
  `</numFmts>` +
  `<fonts count="4">` +
  `<font><sz val="11"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="16"/><name val="Calibri"/></font>` +
  `<font><sz val="10"/><color rgb="FF666666"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="11"/><name val="Calibri"/></font>` +
  `</fonts>` +
  `<fills count="3">` +
  `<fill><patternFill patternType="none"/></fill>` +
  `<fill><patternFill patternType="gray125"/></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFEDE6DC"/><bgColor indexed="64"/></patternFill></fill>` +
  `</fills>` +
  `<borders count="2">` +
  `<border><left/><right/><top/><bottom/><diagonal/></border>` +
  `<border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border>` +
  `</borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="7">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  `<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  `<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>` +
  `<xf numFmtId="${FORMATOS.moneda.id}" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="${FORMATOS.porcentaje.id}" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="${FORMATOS.numero.id}" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `</cellXfs></styleSheet>`;

const nombreDeArchivo = (titulo) =>
  `${titulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}-${fechaHoy()}.xlsx`;

/**
 * Arma la planilla y la baja.
 *
 * `columnas` son los titulos: un texto suelto, o `{ titulo, formato }` cuando la
 * columna lleva moneda, porcentaje o numero. `filas` son los datos, cada una un
 * arreglo en el mismo orden que las columnas.
 */
export const armarPlanilla = (titulo, columnas, filas) => {
  const cols = columnas.map((col) => (typeof col === "string" ? { titulo: col } : col));

  return [
    {
      nombre: "[Content_Types].xml",
      contenido:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        `</Types>`,
    },
    {
      nombre: "_rels/.rels",
      contenido:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`,
    },
    {
      nombre: "xl/workbook.xml",
      contenido:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
        `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<sheets><sheet name="Hoja1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      nombre: "xl/_rels/workbook.xml.rels",
      contenido:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        `</Relationships>`,
    },
    { nombre: "xl/styles.xml", contenido: ESTILOS_XML },
    { nombre: "xl/worksheets/sheet1.xml", contenido: hoja(titulo, cols, filas) },
  ];
};

/** Arma la planilla y la baja. */
export const descargarPlanilla = (titulo, columnas, filas) => {
  const archivos = armarPlanilla(titulo, columnas, filas);
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(
    new Blob([armarZip(archivos)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
  );
  enlace.download = nombreDeArchivo(titulo);
  enlace.click();
  URL.revokeObjectURL(enlace.href);
};
