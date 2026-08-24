/**
 * Armador de archivos .zip, lo justo para escribir un .xlsx.
 *
 * Un xlsx es un zip con unos XML adentro. Se guardan sin comprimir (metodo 0):
 * son archivos chicos y asi no hace falta traer una libreria de compresion.
 */

// Tabla del CRC32, que es lo que el zip usa para verificar cada archivo.
const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let valor = i;
    for (let bit = 0; bit < 8; bit += 1) {
      valor = valor & 1 ? 0xedb88320 ^ (valor >>> 1) : valor >>> 1;
    }
    tabla[i] = valor >>> 0;
  }
  return tabla;
})();

const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = TABLA_CRC[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

// El zip guarda los numeros en little endian.
const escribir = (destino, posicion, valor, bytes) => {
  for (let i = 0; i < bytes; i += 1) {
    destino[posicion + i] = (valor >>> (i * 8)) & 0xff;
  }
};

/**
 * Arma el zip. `archivos` es una lista de { nombre, contenido } con el
 * contenido en texto.
 */
export const armarZip = (archivos) => {
  const codificador = new TextEncoder();
  const entradas = archivos.map(({ nombre, contenido }) => ({
    nombre: codificador.encode(nombre),
    datos: codificador.encode(contenido),
  }));

  // 30 bytes de cabecera local por archivo, 46 de entrada al indice, 22 del
  // cierre.
  const total =
    entradas.reduce(
      (suma, { nombre, datos }) => suma + 30 + nombre.length + datos.length + 46 + nombre.length,
      0
    ) + 22;

  const salida = new Uint8Array(total);
  let posicion = 0;
  const indice = [];

  for (const { nombre, datos } of entradas) {
    const desde = posicion;
    const crc = crc32(datos);

    escribir(salida, posicion, 0x04034b50, 4); // firma de cabecera local
    escribir(salida, posicion + 4, 20, 2); // version necesaria
    escribir(salida, posicion + 6, 0x0800, 2); // los nombres van en utf-8
    escribir(salida, posicion + 8, 0, 2); // sin comprimir
    escribir(salida, posicion + 14, crc, 4);
    escribir(salida, posicion + 18, datos.length, 4);
    escribir(salida, posicion + 22, datos.length, 4);
    escribir(salida, posicion + 26, nombre.length, 2);
    posicion += 30;

    salida.set(nombre, posicion);
    posicion += nombre.length;
    salida.set(datos, posicion);
    posicion += datos.length;

    indice.push({ nombre, datos, crc, desde });
  }

  const arranqueDelIndice = posicion;

  for (const { nombre, datos, crc, desde } of indice) {
    escribir(salida, posicion, 0x02014b50, 4); // firma de entrada del indice
    escribir(salida, posicion + 4, 20, 2);
    escribir(salida, posicion + 6, 20, 2);
    escribir(salida, posicion + 8, 0x0800, 2);
    escribir(salida, posicion + 10, 0, 2);
    escribir(salida, posicion + 16, crc, 4);
    escribir(salida, posicion + 20, datos.length, 4);
    escribir(salida, posicion + 24, datos.length, 4);
    escribir(salida, posicion + 28, nombre.length, 2);
    escribir(salida, posicion + 42, desde, 4);
    posicion += 46;

    salida.set(nombre, posicion);
    posicion += nombre.length;
  }

  escribir(salida, posicion, 0x06054b50, 4); // firma del cierre
  escribir(salida, posicion + 8, indice.length, 2);
  escribir(salida, posicion + 10, indice.length, 2);
  escribir(salida, posicion + 12, posicion - arranqueDelIndice, 4);
  escribir(salida, posicion + 16, arranqueDelIndice, 4);

  return salida;
};
