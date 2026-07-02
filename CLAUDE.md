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
  - `src/app/api/registro/buscar/route.ts` — búsqueda de registro
  - `src/app/api/catalogos/route.ts` — catálogos de estados/municipios
  - `src/app/api/pdf/[id]/route.ts` — generación de PDF y envío de correo
  - `src/app/api/registro/archivos/route.ts` — **DEPRECATED** (ver sección "Pendientes")

No existen rutas API de admin en este proyecto: el panel administrativo y sus endpoints (`/admin/...`, `/api/admin/...`, `/api/programas/admin`) se eliminaron en Julio 2026 porque el panel vive en el proyecto escolar.

---

## Flujo de creación de registros (post fix Abril 2026)

El flujo del formulario es ATÓMICO. Esto es crítico y no debe modificarse sin entender por qué.

### Cómo funciona

1. **Cliente genera UUID** al montar `FormularioInscripcion.tsx` (`crypto.randomUUID()` guardado en `useRef`).
2. **Alumna llena los pasos 1-5** del wizard. Los archivos seleccionados se guardan en `useState<File | null>`, NO se suben a Storage todavía.
3. **Al pulsar "Enviar Registro" (paso 6)**, en este orden:
   - a) Se suben los archivos a `temp/{uuid}/{tipo}.{ext}` en Storage usando signed URLs
   - b) Si todos los uploads tienen éxito, se hace UN ÚNICO `POST /api/registro` con todos los datos del formulario + las rutas + el `uploadId`
   - c) El endpoint valida server-side: rutas obligatorias presentes (INE + comprobante de domicilio), rutas dentro de `temp/{uploadId}/` (anti-inyección)
   - d) Si valida, hace UN solo INSERT con todo: campos del formulario + las 3 columnas de rutas + `upload_session_id = uploadId`
4. **Si los uploads fallan:** no se llama a `/api/registro`. No queda registro en BD. El cliente muestra mensaje de error.
5. **Si el INSERT falla:** los archivos quedan en `temp/{uuid}/` sin registro asociado (huérfanos). Se limpian con la herramienta del proyecto escolar.

### Por qué los archivos se quedan en `temp/` permanentemente

Diseño deliberado. Los archivos NO se mueven a `{id}/` después del INSERT por dos razones:
- **Atomicidad:** mover archivos después del INSERT crea otro punto de falla. Si el move falla, queda inconsistencia entre BD y Storage.
- **Trazabilidad:** la columna `upload_session_id` en BD permite correlacionar archivo con registro. No hace falta path "bonito".

Las rutas en BD apuntan literalmente a `temp/{uuid}/...` y así se acceden desde el admin.

### Validaciones server-side críticas en `/api/registro`

NO eliminar ni debilitar. Son la última línea de defensa contra registros incompletos:
- `uploadId` debe ser UUID válido
- `rutas` debe ser objeto con `ruta_ine` y `ruta_comprobante_domicilio` no vacíos
- Cada ruta debe cumplir `startsWith(\`temp/${uploadId}/\`)` Y `!includes('..')`

---

## Esquema de BD (tabla `registros`)

Columnas relevantes para esta app:

- `id` — bigint, PK, autogenerado
- Campos personales del formulario (nombre, apellido_paterno, correo_electronico, etc.)
- `ruta_ine` — text, ruta en Storage. Formato: `temp/{uuid}/ine.{ext}`. Obligatorio en INSERT desde formulario público.
- `ruta_comprobante_domicilio` — text, ruta en Storage. Formato: `temp/{uuid}/comprobante_domicilio.{ext}`. Obligatorio en INSERT desde formulario público.
- `ruta_acta_nacimiento` — text, opcional (solo cursos que la requieren).
- `upload_session_id` — UUID, nullable. Identifica la sesión de upload del cliente. Permite limpieza de Storage huérfano. NULL para registros históricos pre-Abril 2026 (ids 1-22 migración por CSV + algunos posteriores).

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

## Pendientes / iteraciones futuras

### Borrar endpoint deprecado

`src/app/api/registro/archivos/route.ts` está marcado como DEPRECATED desde Abril 2026. El flujo atómico nuevo no lo usa. Mantener temporalmente por si hay clientes con caché vieja del navegador. Borrar después de varias semanas confirmando que ningún cliente lo invoca.

### Limpieza de archivos huérfanos en Storage

Los archivos huérfanos (carpetas `temp/{uuid}/` sin registro asociado en `registros`) se limpian con una herramienta que vive en el **proyecto escolar** (panel administrativo), NO en este proyecto. Si una alumna abandona el formulario después de subir archivos pero antes del submit final, queda basura en Storage hasta que el admin la limpie desde su panel.

### Política de Storage

Considerar restringir la SELECT policy del bucket `documentos` para que clientes anónimos no puedan listar archivos del bucket. No es bloqueante porque las URLs no son adivinables, pero es buena higiene.

---

## Reglas para Claude Code en este proyecto

### Cosas que NUNCA debes hacer sin pedir confirmación

- Modificar el flujo de `handleSubmit` en `FormularioInscripcion.tsx` (es atómico por diseño).
- Eliminar las validaciones server-side en `/api/registro/route.ts` (uploadId, rutas, anti-inyección).
- Tocar el bloque de tabla `alumnas` dentro de `/api/registro/route.ts`.
- Cambiar el path pattern `temp/{uuid}/{tipo}.{ext}` sin actualizar también el endpoint de validación y la columna `upload_session_id`.
- Mover archivos entre paths de Storage (la decisión de no mover es deliberada).
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

## Historial de fixes importantes

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