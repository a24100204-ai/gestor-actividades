// Servidor del gestor de actividades.
// Sin dependencias externas: solo módulos nativos de Node.js.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PUERTO = process.env.PORT || 3000;
const ARCHIVO = path.join(__dirname, 'datos', 'actividades.txt');
const PUBLIC = path.join(__dirname, 'public');
const ESTADOS = ['Pendiente', 'En proceso', 'Completada'];

/* ------------------------- LISTA ENLAZADA ------------------------- */
class Nodo {
  constructor(actividad) {
    this.actividad = actividad; // { id, nombre, descripcion, estado }
    this.siguiente = null;
  }
}

class ListaEnlazada {
  constructor() {
    this.cabeza = null;
    this.tamano = 0;
  }

  // Registrar: agrega al final de la lista
  agregar(actividad) {
    const nuevo = new Nodo(actividad);
    if (!this.cabeza) {
      this.cabeza = nuevo;
    } else {
      let actual = this.cabeza;
      while (actual.siguiente) actual = actual.siguiente;
      actual.siguiente = nuevo;
    }
    this.tamano++;
    return actividad;
  }

  // Consultar una actividad por id
  buscar(id) {
    let actual = this.cabeza;
    while (actual) {
      if (actual.actividad.id === id) return actual.actividad;
      actual = actual.siguiente;
    }
    return null;
  }

  // Actualizar los campos de una actividad
  actualizar(id, cambios) {
    const actividad = this.buscar(id);
    if (!actividad) return null;
    Object.assign(actividad, cambios);
    return actividad;
  }

  // Eliminar un nodo de la lista
  eliminar(id) {
    if (!this.cabeza) return false;
    if (this.cabeza.actividad.id === id) {
      this.cabeza = this.cabeza.siguiente;
      this.tamano--;
      return true;
    }
    let actual = this.cabeza;
    while (actual.siguiente) {
      if (actual.siguiente.actividad.id === id) {
        actual.siguiente = actual.siguiente.siguiente;
        this.tamano--;
        return true;
      }
      actual = actual.siguiente;
    }
    return false;
  }

  // Consultar todas las actividades
  aArreglo() {
    const resultado = [];
    let actual = this.cabeza;
    while (actual) {
      resultado.push(actual.actividad);
      actual = actual.siguiente;
    }
    return resultado;
  }
}

/* ------------------------- PERSISTENCIA .TXT ------------------------- */
// Formato: una actividad por línea -> id|nombre|descripcion|estado
// Cada campo se codifica con encodeURIComponent para que ningún texto rompa el formato.
const lista = new ListaEnlazada();
let siguienteId = 1;

function guardar() {
  const lineas = lista.aArreglo().map((a) =>
    [a.id, a.nombre, a.descripcion, a.estado].map((c) => encodeURIComponent(c)).join('|')
  );
  fs.writeFileSync(ARCHIVO, lineas.join('\n') + (lineas.length ? '\n' : ''), 'utf8');
}

function cargar() {
  fs.mkdirSync(path.dirname(ARCHIVO), { recursive: true });
  if (!fs.existsSync(ARCHIVO)) {
    fs.writeFileSync(ARCHIVO, '', 'utf8');
    return;
  }
  const lineas = fs.readFileSync(ARCHIVO, 'utf8').split('\n').filter(Boolean);
  for (const linea of lineas) {
    const [id, nombre, descripcion, estado] = linea.split('|').map(decodeURIComponent);
    lista.agregar({ id: Number(id), nombre, descripcion, estado });
    siguienteId = Math.max(siguienteId, Number(id) + 1);
  }
}

/* ------------------------- SERVIDOR HTTP ------------------------- */
function responderJSON(res, codigo, datos) {
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(datos));
}

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    let cuerpo = '';
    req.on('data', (parte) => {
      cuerpo += parte;
      if (cuerpo.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(cuerpo ? JSON.parse(cuerpo) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

function validar(datos) {
  const nombre = String(datos.nombre || '').trim();
  const descripcion = String(datos.descripcion || '').trim();
  const estado = String(datos.estado || '');
  if (!nombre) return { error: 'El nombre es obligatorio.' };
  if (!ESTADOS.includes(estado)) return { error: 'El estado no es válido.' };
  return { valor: { nombre, descripcion, estado } };
}

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

function servirEstatico(req, res) {
  const url = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const ruta = path.normalize(path.join(PUBLIC, url));
  if (!ruta.startsWith(PUBLIC)) {
    res.writeHead(403);
    return res.end('Acceso denegado');
  }
  fs.readFile(ruta, (err, contenido) => {
    if (err) {
      res.writeHead(404);
      return res.end('No encontrado');
    }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(ruta)] || 'application/octet-stream' });
    res.end(contenido);
  });
}

const servidor = http.createServer(async (req, res) => {
  try {
    const coincide = req.url.match(/^\/api\/actividades(?:\/(\d+))?$/);
    if (!coincide) return servirEstatico(req, res);
    const id = coincide[1] ? Number(coincide[1]) : null;

    // GET: consultar
    if (req.method === 'GET') {
      if (id === null) return responderJSON(res, 200, lista.aArreglo());
      const a = lista.buscar(id);
      return a ? responderJSON(res, 200, a) : responderJSON(res, 404, { error: 'No existe la actividad.' });
    }

    // POST: registrar
    if (req.method === 'POST' && id === null) {
      const { valor, error } = validar(await leerCuerpo(req));
      if (error) return responderJSON(res, 400, { error });
      const nueva = lista.agregar({ id: siguienteId++, ...valor });
      guardar();
      return responderJSON(res, 201, nueva);
    }

    // PUT: actualizar
    if (req.method === 'PUT' && id !== null) {
      const { valor, error } = validar(await leerCuerpo(req));
      if (error) return responderJSON(res, 400, { error });
      const actualizada = lista.actualizar(id, valor);
      if (!actualizada) return responderJSON(res, 404, { error: 'No existe la actividad.' });
      guardar();
      return responderJSON(res, 200, actualizada);
    }

    // DELETE: eliminar
    if (req.method === 'DELETE' && id !== null) {
      if (!lista.eliminar(id)) return responderJSON(res, 404, { error: 'No existe la actividad.' });
      guardar();
      return responderJSON(res, 200, { ok: true });
    }

    responderJSON(res, 405, { error: 'Método no permitido.' });
  } catch (e) {
    responderJSON(res, 400, { error: 'Solicitud inválida.' });
  }
});

cargar();
servidor.listen(PUERTO, () => {
  console.log(`Servidor listo en http://localhost:${PUERTO}`);
});
