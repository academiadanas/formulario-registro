# CLAUDE.md

## Arquitectura de clientes Supabase

### Rutas API públicas (sin autenticación de usuario)
- **Cliente**: `createPublicSupabaseClient()` de `src/lib/supabase-public.ts`
- **Key**: `SUPABASE_SERVICE_ROLE_KEY` (bypasea RLS, solo server-side)
- **Rutas que lo usan**:
  - `src/app/api/registro/route.ts` — registro de inscripción
  - `src/app/api/registro/buscar/route.ts` — búsqueda de registro
  - `src/app/api/catalogos/route.ts` — catálogos de estados/municipios
  - `src/app/api/pdf/[id]/route.ts` — generación de PDF y envío de correo

### Rutas API de admin (requieren autenticación)
- **Cliente**: `createServerSupabaseClient()` de `src/lib/supabase-server.ts`
- **Key**: `NEXT_PUBLIC_SUPABASE_ANON_KEY` + cookies de sesión (`@supabase/ssr`)
- **Rutas que lo usan**:
  - `src/app/api/admin/users/route.ts`

## Políticas RLS en Supabase

### Tabla `registros`
- INSERT para `anon`: `WITH CHECK (true)`
- UPDATE para `anon`: permitido (para guardar rutas de archivos)
- SELECT para `anon`: permitido (necesario para `.insert().select("id")` / RETURNING)

### Tabla `catalogos`
- SELECT para `anon`: permitido

### Tabla `alumnas`
- Las operaciones de INSERT/UPDATE/SELECT se hacen con service_role (bypasea RLS)

### Storage (bucket `documentos`)
- Subida pública permitida para `anon`
- Acceso completo (lectura/escritura) para `authenticated`
