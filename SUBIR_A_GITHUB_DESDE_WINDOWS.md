# GitHub Desktop → Netlify · v8.6.9

**Actualización desde v8.6.8:** usa el ZIP de **solo cambios**, no el ZIP de todo el proyecto.

1. En GitHub Desktop, abre `gildem-craft-pro-live` en la rama `main` y haz **Fetch origin / Pull**.
2. Si hay conflictos de Merge, no copies nada hasta resolverlos o cancelar el Merge después de guardar una copia de tu trabajo. Nunca hagas Force Push para este parche.
3. Descomprime el ZIP de actualización. Con **Repository → Show in Explorer**, abre la carpeta del repositorio.
4. Copia los archivos internos del ZIP a esa carpeta, conservando la estructura (`app.js`, `styles.css`, `tests/`, etc.) y reemplaza los archivos existentes.
5. Haz **Commit to main → Push origin** y confirma en Netlify que se publicó la versión `8.6.9`.
6. Recarga con **Ctrl + Shift + R** para eliminar el diseño antiguo de la caché.

No copies el ZIP completo al cargador web de GitHub: el límite de 100 archivos puede interrumpir la operación.
