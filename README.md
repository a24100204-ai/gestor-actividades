# Gestor de actividades

App web para organizar las actividades de los empleados.

- **Actividad:** nombre, descripción y estado (Pendiente, En proceso, Completada).
- **Lista enlazada:** implementada en `server.js` (`ListaEnlazada` y `Nodo`).
- **Persistencia:** `datos/actividades.txt`, una actividad por línea (`id|nombre|descripcion|estado`, cada campo codificado).

## Cómo ejecutarlo en Visual Studio Code

1. Instala [Node.js](https://nodejs.org) (versión 18 o superior).
2. En VS Code: **Archivo > Abrir carpeta** y elige `gestor-actividades`.
3. Abre la terminal (`Ctrl + ñ` o **Terminal > Nueva terminal**) y ejecuta:

   ```
   npm start
   ```
4. Abre http://localhost:3000 en el navegador.

No necesita `npm install`: no usa dependencias externas.

## API

| Método | Ruta | Acción |
|---|---|---|
| GET | /api/actividades | Consultar todas |
| GET | /api/actividades/:id | Consultar una |
| POST | /api/actividades | Registrar |
| PUT | /api/actividades/:id | Actualizar |
| DELETE | /api/actividades/:id | Eliminar |
