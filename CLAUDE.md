# CLAUDE.md

## Identificación del proyecto

**Proyecto: FORMULARIO DE INSCRIPCIÓN PÚBLICO**
- **URL de producción:** inscripcion.academiadanas.com
- **Función:** registro de alumnas nuevas a la academia (formulario público)
- **Stack:** Next.js (App Router), TypeScript, Tailwind CSS, Supabase
- **Deploy:** Vercel Hobby (CI/CD automático en push a main)

**Este proyecto NO contiene:**
- Panel administrativo (vive en proyecto separado: aplicación escolar)
- Gestión de usuarios admin
- Finanzas, POS, expedientes, programas
- Modal de limpieza de archivos huérfanos en Storage

Si una tarea requiere modificar el panel administrativo, ESTÁ EN OTRO PROYECTO. Confirmar con el usuario antes de hacer cualquier cambio que mencione "admin", "control escolar", "sidebar", "useUserRole", etc.

---

## Arquitectura de clientes Supabase

### Rutas API públicas (sin autenticación de usuario)

- **Cliente:** `createPublicSupabaseClient()` de `src/lib/supabase-public.ts`
- **Key:** `SUPABASE_SERVICE_ROLE_KEY` (bypasea RLS, solo server-side)
- **Rutas que lo usan:**
  - `src/app/api/registro/route.ts` — creación atómica del registro de inscripción (incluye uploads ya validados)
  - `src/app/api/registro/upload-url/route.ts` — emisión de signed upload URLs para archivos
  - `src/app/api/catalogos/route.ts` — catálogos de estados/municipios
  - `src/app/api/pdf/[id]/route.ts` — envío del correo de confirmación de inscripción. **Exige `uploadSessionId` en el cuerpo** y solo responde si coincide con `registros.upload_session_id` del folio (si no, el mismo 404 que un folio inexistente). No devuelve la dirección de correo. La pantalla de gracias recibe `{ registroId, uploadId, correo }` del formulario vía `src/lib/confirmacion-inscripcion.ts` (memoria + sessionStorage), **nunca por la URL**: el uploadId es la carpeta de los documentos en un bucket público. Si la pestaña no tiene esos datos, la pantalla muestra el folio y un contacto, sin envío. Registros sin `upload_session_id` (históricos) no pueden usar esta ruta, a propósito (Noviembre 2026)

No existen rutas API de admin en este proyecto: el panel administrativo y sus endpoints (`/admin/...`, `/api/admin/...`, `/api/programas/admin`) se eliminaron en Julio 2026 porque el panel vive en el proyecto escolar.

`/api/registro/buscar` se eliminó en Noviembre 2026: no tenía llamadores desde que se quitó la página `/buscar` (commit `71e2f05`, Marzo 2026), la función `buscar_registro` que invocaba ya no existe en la BD, y devolvía nombre completo y curso a quien conociera correo y teléfono.

---

## Flujo de creación de registros (post fix Abril 2026)

El flujo del formulario es ATÓMICO. Esto es crítico y no debe modificarse sin entender por qué.

### Cómo funciona

1. **Cliente genera UUID** al montar `FormularioInscripcion.tsx` (`crypto.randomUUID()` guardado en `useRef`).
2. **Alumna llena los pasos 1-5** del wizard. Los archivos seleccionados se guardan en `useState<File | null>`, NO se suben a Storage todavía.
3. **Al pulsar "Enviar Registro" (paso 6)**, en este orden:
   - a) Se suben los archivos a `temp/{uuid}/{tipo}.{ext}` en Storage usando signed URLs
   - b) Si todos los uploads tienen éxito, se hace UN ÚNICO `POST /api/registro` con todos los datos del formulario + las rutas + el `uploadId`
   - c) El endpoint valida server-side: rutas obligatorias presentes, cada ruta exactamente `temp/{uploadId}/{tipo}.{ext}` (anti-inyección) y cada archivo existente y no vacío en Storage
   - d) Si valida, hace UN solo INSERT con todo: campos del formulario + las columnas de rutas (todavía en `temp/`) + `upload_session_id = uploadId`
   - e) Después del INSERT y del bloque de `alumnas`, en la misma petición, **promueve** los documentos a `registros/{uuid nuevo}/` (ver abajo)
4. **Si los uploads fallan:** no se llama a `/api/registro`. No queda registro en BD. El cliente muestra mensaje de error.
5. **Si el INSERT falla:** los archivos quedan en `temp/{uuid}/` sin registro asociado (huérfanos). Se limpian con la herramienta del proyecto escolar.

### Promoción de `temp/` a `registros/` (Noviembre 2026)

Invariante: **ninguna columna `ruta_*` apunta bajo `temp/`**. `temp/` es solo para subidas en curso o abandonadas. Se comprueba con `node --env-file=.env.local scripts/verificar-invariante-documentos.mts` (sale con 1 si se rompe).

`promoverDocumentos` (`src/lib/documentos-registro.ts`) corre síncrona al final de `/api/registro`: **copiar → verificar (tamaño, eTag, tipo) → UPDATE de `ruta_*` condicionado a que sigan apuntando al original → SOLO ENTONCES borrar el original**. Nunca mover. Reemplaza el diseño anterior ("los archivos se quedan en `temp/` para siempre"), cuyo argumento era que mover tras el INSERT crea otro punto de falla: con copiar-verificar-borrar ningún estado intermedio deja una `ruta_*` rota.

- **El uuid de `registros/{uuid}/` es nuevo, generado en el servidor**, distinto de `upload_session_id`. `upload_session_id` es la llave de `/api/pdf` y la conoce el navegador de la alumna; así deja de revelar dónde están sus documentos. El vínculo registro→carpeta vive solo en `ruta_*`.
- **Nunca lanza ni afecta la respuesta**: la alumna recibe lo mismo pase lo que pase. Cada llamada a Storage tiene 5 s de límite y la promoción un tope total de 20 s; la ruta exporta `maxDuration = 60` para que Vercel no corte entre el INSERT y la respuesta.
- **Reglas de borrado:** un original se borra solo si el UPDATE confirmó que la fila apunta a la copia; una copia, solo si se sabe que la fila no la usa. Si el UPDATE queda incierto (corte por tiempo), se relee la fila; si tampoco se puede, no se borra nada.
- **Una línea de log por promoción**, con `registroId` y `uploadSessionId`, nunca con la ruta nueva: `[promocion] registro N …` (éxito) o `[promocion] FALLA registro N … Estado: …`.
- **Si falla,** el registro queda con alguna `ruta_*` en `temp/` (el original sigue ahí) o con un sobrante en `temp/` (la ruta ya apunta a la copia, pero el original no se borró). El script de invariante reporta los dos. La migración de promoción (`scripts/migraciones/`) repara el primero; el sobrante hoy se limpia a mano, verificando antes que nadie lo referencia.
- **Registros anteriores a este cambio** siguen en `temp/` hasta que corra esa migración.

### Validaciones server-side críticas en `/api/registro`

NO eliminar ni debilitar. Son la última línea de defensa contra registros incompletos:
- `uploadId` debe ser UUID válido
- Rutas obligatorias según curso y edad (adulto: INE frente, reverso y comprobante; menor: acta y comprobante)
- **Toda ruta que venga, obligatoria u opcional, debe ser exactamente `temp/{uploadId}/{tipo}.{ext}`** de esa petición y de su columna (`rutaValida` en `src/lib/documentos-registro.ts`; `ext` ∈ pdf, jpg, png, igual que `upload-url`). Si no, 400. Antes solo el acta se rechazaba; las demás se descartaban en silencio.
- **Cada archivo debe existir en `temp/{uploadId}/` y no estar vacío** (`verificarArchivosSubidos`), antes del INSERT. Si Storage no responde, 503 sin registro creado. Evita que un registro nazca apuntando a archivos ya promovidos por un envío anterior con el mismo `uploadId`.
- **Mensajes de estos rechazos:** con ellos la alumna NO queda inscrita, y una inscripción abandonada no deja rastro que nadie revise. Cada mensaje le dice que su registro no se guardó, que sus datos siguen en el formulario, qué hacer (pulsar «Enviar registro» de nuevo o regresar al paso 2 por un documento) y a quién escribir si vuelve a pasar (`CONTACTO_SI_PERSISTE`, tomado de `ACADEMIA_INFO`). El formulario sube la pantalla hasta el aviso (`mostrarErrorEnvio`). No reemplazarlos por errores genéricos.
- **Datos personales (Octubre 2026):** `validarDatosPersonales` replica las reglas de `validateStep` del formulario (presencia tras trim, teléfonos de 10 dígitos, CP de 5, misma regex de correo, fecha `YYYY-MM-DD` real y condicionales por el **valor** del país: MEXICO exige estado y municipio, ESTADOS UNIDOS exige estado de `ESTADOS_USA`, cualquier otro texto exige solo el campo libre). Corre después del trim de los 35 campos y antes de las mayúsculas, de la consulta a `programas` y del cálculo de edad. Responde 400 con un solo `error` en español que une los campos con la etiqueta de su paso. No valida `estado_civil`, `grado_estudios` ni parentescos contra listas ("otro" viaja como texto libre) ni pone topes de longitud. Si el cliente cambia una regla, cambiarla aquí también.

---

## Esquema de BD (tabla `registros`)

Columnas relevantes para esta app:

- `id` — bigint, PK, autogenerado
- Campos personales del formulario (nombre, apellido_paterno, correo_electronico, etc.)
- `ruta_ine_frente`, `ruta_ine_reverso`, `ruta_acta_nacimiento`, `ruta_comprobante_domicilio` — text, ruta en Storage. Formato final: `registros/{uuid}/{tipo}.{ext}` (el INSERT las escribe en `temp/{upload_session_id}/` y la promoción las actualiza). Conviven rutas relativas y URLs públicas completas en registros viejos, y enlaces de Drive en los registros 23–29.
- `upload_session_id` — UUID, nullable. Identifica la sesión de upload del cliente. Permite limpieza de Storage huérfano. NULL para registros históricos pre-Abril 2026 (ids 1-22 migración por CSV + algunos posteriores).
- **Aceptación de documentos legales (Septiembre 2026):** `aceptacion_documentos` (boolean), `aceptacion_documentos_at` (timestamptz, `DEFAULT now()`, la BD lo llena), `version_contrato`, `version_terminos`, `version_aviso_privacidad` (date). Todas nullable; NULL en históricos, sin backfill. El cliente envía `aceptacion_documentos` con el valor real del checkbox `aceptaAviso`; `/api/registro` tiene un guard que responde 400 si no es `=== true`, e inserta `aceptacion_documentos: true` más las tres versiones tomadas de `VERSIONES_DOCUMENTOS` en `src/lib/constants.ts` (único punto de cambio al actualizar un documento). Las versiones nunca viajan desde el cliente. Desde Septiembre 2026 `VERSIONES_DOCUMENTOS` es derivada de `DOCUMENTOS_LEGALES` (misma constante, más `slug` y `sha256` por documento); ver sección "Validación de versiones legales en build".
- **Hash de los documentos legales (Septiembre 2026, fase B):** `hash_contrato`, `hash_terminos`, `hash_aviso_privacidad` (text, nullable). Cada uno es el sha256 del texto del documento tal como lo publica el sitio (cuerpo Markdown sin frontmatter, LF, sin espacios al inicio ni al final; es el mismo valor que expone `versiones.json`). `/api/registro` los toma de `DOCUMENTOS_LEGALES[*].sha256` en `src/lib/constants.ts`, igual que la fecha, en el mismo INSERT; nunca viajan desde el cliente. Junto con la fecha, permiten demostrar el texto exacto que aceptó cada alumna aunque después se corrija el documento sin subir versión. Los registros anteriores a este cambio los tienen en NULL a propósito, sin retrofit: no hay evidencia de qué texto exacto vieron y no se inventa.
- **Versión de la ficha técnica del programa (Septiembre 2026):** `version_ficha` (text, nullable). `/api/registro` la toma de `programas.ficha_version` en la misma consulta que valida el curso, nunca del cuerpo de la petición. Si el programa no tiene ficha versionada se guarda NULL (no se inventa valor ni se bloquea la inscripción) y se deja `console.warn` con el código del programa. NULL en históricos, sin backfill. La fuente de verdad es la BD: cambiar la versión de una ficha no requiere deploy, se edita `ficha_version` desde el panel escolar. No se guarda el slug: el vínculo registro→ficha se reconstruye vía `registros.curso` → `programas.codigo` → `programas.slug`. **Renombrar un `codigo` en `programas` rompería ese vínculo para los registros históricos** (`registros.curso` es texto, sin clave foránea); si hace falta cambiar un código, crear un programa nuevo y ocultar el viejo.

### Efecto colateral: tabla `alumnas`

`/api/registro/route.ts` también escribe a la tabla `alumnas` (búsqueda por email; INSERT si no existe, UPDATE si existe). Este bloque está claramente delimitado en el archivo con comentarios `// === INSERT O UPDATE AUTOMÁTICO EN ALUMNAS ===` y `// === FIN INSERT/UPDATE ALUMNAS ===`. NO modificar sin entender el flujo completo.

---

## Políticas RLS en Supabase

### Tabla `registros`
- INSERT para `anon`: `WITH CHECK (true)` (pero el endpoint usa service role, no depende de esto)
- UPDATE para `anon`: permitido (legacy, ya no se usa porque el flujo es atómico)
- SELECT para `anon`: permitido

### Tabla `catalogos`
- SELECT para `anon`: permitido

### Tabla `alumnas`
- Operaciones de INSERT/UPDATE/SELECT se hacen con service_role (bypasea RLS)

### Storage (bucket `documentos`)
- Subida pública permitida para `anon` (los formularios públicos suben con signed URL)
- Acceso completo (lectura/escritura) para `authenticated`
- **Advertencia conocida:** el bucket tiene "broad SELECT policy" que permite `list()`. Considerar restringir en iteración futura de seguridad.

---

## Validación de versiones legales en build

El sitio web (repo aparte) publica `https://academiadanas.com/legal/versiones.json` con, por documento (slug), la fecha de "Última actualización" (`lastUpdated`) y el `sha256` del texto. El script `scripts/verificar-versiones-legales.mts` corre como `prebuild` (antes de `next build` vía `npm run build`) y compara ese JSON contra `DOCUMENTOS_LEGALES` en `src/lib/constants.ts`.

**Comportamiento:**
- JSON inaccesible (timeout 5 s, un reintento), malformado o con `schemaVersion` desconocido: aviso y el build continúa.
- Fecha o hash distintos, o slug ausente en el JSON: **falla el build en producción** (`VERCEL_ENV=production`); solo aviso en previews y en local.
- Documento en el JSON que no está en `DOCUMENTOS_LEGALES`: aviso siempre, nunca fallo.
- `LEGAL_VERSIONS_CHECK=off`: omite la verificación (solo emergencias; configurar como variable de entorno en Vercel y quitarla después).
- Invocar `next build` directo se salta el prebuild. Usar siempre `npm run build`.

**Procedimiento al modificar un documento legal (orden obligatorio):**
1. En el repo del sitio web: publicar el texto nuevo y subir la leyenda "Última actualización". Esperar a que `versiones.json` en producción muestre la fecha y el hash nuevos.
2. En este repo: copiar `lastUpdated` y `sha256` del JSON a la entrada correspondiente de `DOCUMENTOS_LEGALES`. Es el único archivo que se toca. Ejemplo previo del procedimiento: commit `1e84c7c`.
3. `npm run build`, commit, push a `main`.

Si el hash cambia pero la fecha no, el texto se editó en el sitio sin subir versión. El script explica las dos salidas: publicar versión nueva (cambio de fondo) o copiar solo el hash (corrección menor). Los registros históricos nunca se tocan: cada uno conserva la fecha de versión que aceptó.

El script se ejecuta con Node directamente (type stripping, requiere Node >= 22.18; `engines` en package.json lo fija). `scripts/` está excluido de `tsconfig.json` para que el type-check de Next no procese el import con extensión `.ts`.

---

## Pendientes / iteraciones futuras

### Limpieza de archivos huérfanos en Storage

Los archivos huérfanos (carpetas `temp/{uuid}/` sin registro asociado en `registros`) se limpian con una herramienta que vive en el **proyecto escolar** (panel administrativo), NO en este proyecto. Si una alumna abandona el formulario después de subir archivos pero antes del submit final, queda basura en Storage hasta que el admin la limpie desde su panel.

### Política de Storage

Considerar restringir la SELECT policy del bucket `documentos` para que clientes anónimos no puedan listar archivos del bucket. No es bloqueante porque las URLs no son adivinables, pero es buena higiene.

### Registros duplicados por reintento del envío (Noviembre 2026)

`/api/registro` no rechaza un `upload_session_id` que ya tiene registro. Si el INSERT se hizo pero la respuesta no llegó a la alumna y ella vuelve a pulsar "Enviar Registro", el formulario re-sube los archivos a la misma `temp/{uploadId}/` (`upload-file.ts` usa `upsert: true`) y se crea un segundo registro de la misma alumna. La comprobación de existencia de archivos antes del INSERT evita que un registro nazca apuntando a archivos borrados, pero no evita el duplicado. Arreglo pendiente: rechazar (o resolver de forma idempotente devolviendo el folio existente) un `upload_session_id` que ya tenga registro. Ese mismo arreglo cierra que un cliente que conozca el `upload_session_id` de otra alumna lo use como propio para ligar sus archivos a un registro nuevo.

---

## Reglas para Claude Code en este proyecto

### Cosas que NUNCA debes hacer sin pedir confirmación

- Modificar el flujo de `handleSubmit` en `FormularioInscripcion.tsx` (es atómico por diseño).
- Eliminar las validaciones server-side en `/api/registro/route.ts` (uploadId, rutas, anti-inyección).
- Tocar el bloque de tabla `alumnas` dentro de `/api/registro/route.ts`.
- Cambiar el path pattern `temp/{uuid}/{tipo}.{ext}` sin actualizar también `upload-url/route.ts`, `rutaValida` en `src/lib/documentos-registro.ts` y la columna `upload_session_id`.
- Cambiar el orden o las reglas de borrado de `promoverDocumentos` (copiar → verificar → UPDATE → borrar original). Nunca mover objetos ni borrar uno que una `ruta_*` pueda estar usando.
- Modificar la columna `upload_session_id` o su índice.

### Cosas que requieren cuidado

- Cualquier cambio en `src/app/api/registro/upload-url/route.ts` debe mantener consistencia con el path que `/api/registro` valida (ambos usan `temp/{uuid}/{tipo}.{ext}`).
- Cualquier cambio en `src/lib/upload-file.ts` afecta directamente al formulario público.
- Si se agregan nuevos tipos de documento, actualizar `TIPOS_PERMITIDOS` en `upload-url/route.ts` y la lógica de validación en `/api/registro/route.ts`.

### Convenciones de este proyecto

- TypeScript estricto, tipos explícitos.
- Mensajes al usuario en español (campo `error` en respuestas API).
- Mensajes técnicos para debugging en `console.error`.
- Mayúsculas en campos de texto del formulario (excepto correo, teléfono, fecha, números).
- Verificar `npm run build` antes de cualquier git commit.

---

## Base de datos: Claude Code no la modifica

Distinción importante: esto NO es sobre el código de la aplicación, que
obviamente escribe en la base al atender a las usuarias. Es sobre las
acciones de Claude Code.

Claude Code nunca ejecuta cambios de contenido o estructura en la base de
datos de Supabase: ni INSERT, ni UPDATE, ni DELETE, ni DDL (CREATE / ALTER /
DROP). Ni directamente, ni desde un script que él corra, ni como paso de una
migración.

Leer sí: consultas SELECT para auditar, verificar o entender el estado.

Cuando haga falta un cambio, Claude Code entrega el SQL con una explicación
de qué hace y qué toca, y Roberto lo ejecuta en el editor SQL de Supabase.
Sin excepciones, por trivial o urgente que parezca.

En migraciones que combinan archivos y base: el script puede copiar o mover
objetos en Storage, pero las actualizaciones de columnas las GENERA como un
archivo .sql para que Roberto las revise y las corra. No las ejecuta.

---

## Historial de fixes importantes

### Noviembre 2026 — Promoción de documentos a `registros/`
- **Problema:** los documentos se quedaban para siempre en `temp/{upload_session_id}/`, cuyo nombre conoce el navegador de la alumna y es la llave de `/api/pdf`. `temp/` no era temporal y Supabase no respalda los archivos de Storage.
- **Fix:** `/api/registro` promueve cada inscripción a `registros/{uuid nuevo}/` con copiar-verificar-UPDATE-borrar (sección "Promoción de `temp/` a `registros/`"), y además exige el nombre exacto de cada ruta y que el archivo exista antes del INSERT. Los registros anteriores se migran aparte (Pieza B), con el UPDATE entregado como `.sql`.

### Noviembre 2026 — Rutas adivinables en Storage
- **Problema:** el bucket `documentos` es público. Los archivos subidos antes del fix de Abril 2026 (y las re-subidas desde Control Escolar) vivían en `{folio}/...`, recorribles por folio consecutivo.
- **Fix:** migración de un solo uso `scripts/migraciones/2026-11-17-documentos-ruta-folio.mts` movió los 20 objetos fuera de `temp/` a `registros/{uuid}/{tipo}.{ext}` y actualizó su columna `ruta_*` (conservando forma relativa o URL; las URLs del proyecto Supabase anterior se reescribieron al actual).
- **Prefijo `registros/`:** NO usar `temp/` para archivos sin `upload_session_id` correlacionado: la herramienta de huérfanos de Control Escolar recorre `temp/{uuid}/` y propondría borrarlos. El plan y la bitácora de la migración no se versionan (contienen las rutas nuevas).

### Abril 2026 — Fix arquitectónico de atomicidad
- **Problema:** el flujo era 3 llamadas HTTP no atómicas (INSERT con rutas NULL → uploads → UPDATE rutas). Si fallaba en medio, quedaba registro huérfano (caso real: folio 84 duplicado).
- **Fix:** invertir el orden. UUID en cliente → uploads a `temp/{uuid}/` → UN solo INSERT atómico con todo.
- **Migración BD:** se agregó columna `upload_session_id` UUID con índice parcial.
- **Commit:** `2f43647`

### Marzo 2026 — Migración a signed URLs
- **Problema:** el límite de 4.5 MB de Vercel Hobby causaba fallos en uploads grandes.
- **Fix:** mover uploads del navegador → Vercel → Supabase a navegador → Supabase directo, vía signed URLs emitidas por servidor.

---

## Despliegue

- **Plataforma:** Vercel (Hobby plan)
- **Branch principal:** `main`
- **Deploy:** automático en cada push a `main`
- **Verificación pre-deploy:** `npm run build` debe pasar sin errores ni warnings.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
