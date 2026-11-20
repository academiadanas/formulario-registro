-- ============================================================================
-- AUDITORÍA DE RLS — CONSULTAS DE SOLO LECTURA
-- Para reescribir desde lo medido las secciones "Políticas RLS en Supabase" y
-- "Pendientes → Política de Storage" de CLAUDE.md.
--
-- ⚠ SOLO LECTURA: todo es SELECT sobre catálogos del sistema. No cambia nada.
-- Correr en el SQL Editor de Supabase, UNA consulta a la vez, y guardar cada
-- resultado completo (copiar la tabla). Las pruebas desde fuera están en
-- scripts/auditoria-rls-pruebas.mts.
--
-- Afirmaciones del CLAUDE.md que se comprueban, y con qué:
--   C1 registros: INSERT para anon con WITH CHECK (true) ........ Q1, Q2, Q3
--   C2 registros: UPDATE para anon permitido (legacy) ............ Q1, Q2, Q3
--   C3 registros: SELECT para anon permitido ...................... Q1, Q2, Q3 + prueba P1
--   C4 catalogos: SELECT para anon permitido ...................... Q1, Q2, Q3 + prueba P1
--   C5 alumnas: INSERT/UPDATE/SELECT solo con service_role ........ Q1, Q2, Q3 + prueba P7
--   C6 Storage: subida pública permitida para anon ................ Q2 + pruebas P3, P4
--   C7 Storage: acceso completo para authenticated ................ Q2, Q4
--   C8 Storage: "broad SELECT policy" que permite list() .......... Q2 + prueba P3
--   C9 Pendientes: restringir el list() anónimo ................... Q2 + prueba P3
--
-- Qué se puede afirmar con cada consulta:
--   - Q1 y Q3 dicen si la política importa: sin RLS activo, la tabla queda
--     abierta a quien tenga el permiso de tabla (Q3); sin permiso de tabla,
--     ninguna política abre nada para ese rol.
--   - Q2 dice qué permite cada política, pero es una DEFINICIÓN: lo que deja
--     hacer depende de las funciones que llame (Q4) y de los datos.
--   - Lo que haga una sesión `authenticated` real solo queda comprobado por
--     definición (Q2 + Q4), salvo que se decida crear una cuenta de prueba.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Q1 — ¿Tiene RLS activo cada tabla?
--   rls_activo = false → las políticas NO aplican: manda solo Q3.
--   rls_forzado = true → aplica también al dueño de la tabla (raro aquí).
-- ----------------------------------------------------------------------------
select n.nspname as esquema,
       c.relname as tabla,
       c.relrowsecurity as rls_activo,
       c.relforcerowsecurity as rls_forzado
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where (n.nspname = 'public' and c.relname in ('registros', 'catalogos', 'alumnas'))
   or (n.nspname = 'storage' and c.relname = 'objects')
order by 1, 2;


-- ----------------------------------------------------------------------------
-- Q2 — Todas las políticas de esas tablas y de storage.objects.
--   roles: {anon}, {authenticated} o {public} (= todos, anon incluido).
--   cmd: SELECT / INSERT / UPDATE / DELETE / ALL.
--   qual = USING (qué filas existentes ve o toca);
--   with_check = WITH CHECK (qué filas nuevas o modificadas acepta).
--   permissive = PERMISSIVE se suman con OR; RESTRICTIVE restan con AND.
-- ----------------------------------------------------------------------------
select schemaname as esquema,
       tablename as tabla,
       policyname as politica,
       permissive,
       roles,
       cmd,
       qual,
       with_check
from pg_policies
where (schemaname = 'public' and tablename in ('registros', 'catalogos', 'alumnas'))
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, cmd, policyname;


-- ----------------------------------------------------------------------------
-- Q3 — Permisos de tabla (GRANT) para anon y authenticated.
--   Sin el permiso aquí, el rol no puede hacer esa operación aunque una
--   política lo "permita": PostgREST responde "permission denied".
--   Ninguna fila para un rol = ese rol no tiene ningún permiso en la tabla.
-- ----------------------------------------------------------------------------
select table_schema as esquema,
       table_name as tabla,
       grantee as rol,
       string_agg(privilege_type, ', ' order by privilege_type) as permisos
from information_schema.role_table_grants
where ((table_schema = 'public' and table_name in ('registros', 'catalogos', 'alumnas'))
    or (table_schema = 'storage' and table_name = 'objects'))
  and grantee in ('anon', 'authenticated')
group by 1, 2, 3
order by 1, 2, 3;


-- ----------------------------------------------------------------------------
-- Q4 — Definición de toda función propia que aparezca en las políticas de
--   Q2 (p. ej. public.tiene_acceso_control_escolar()). Sin esto, una
--   política como "(select public.f())" no dice qué permite.
--   security_definer = true → corre con los permisos de su dueño.
--   volatilidad: i = immutable, s = stable, v = volatile.
--   ejecutable_por: quién puede llamarla (con anon en la lista, la llave
--   anónima puede invocarla por /rest/v1/rpc).
-- ----------------------------------------------------------------------------
select distinct
       p.oid::regprocedure as funcion,
       p.prosecdef as security_definer,
       p.provolatile as volatilidad,
       array(select r.rolname
             from pg_roles r
             where r.rolname in ('anon', 'authenticated', 'service_role')
               and has_function_privilege(r.oid, p.oid, 'EXECUTE')
             order by 1) as ejecutable_por,
       pg_get_functiondef(p.oid) as definicion
from pg_policies pol
cross join lateral regexp_matches(
         coalesce(pol.qual, '') || ' ' || coalesce(pol.with_check, ''),
         '([a-z_][a-z0-9_]*)\(',
         'g') as m(grupos)
join pg_proc p on p.proname = m.grupos[1]
join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
where (pol.schemaname = 'public' and pol.tablename in ('registros', 'catalogos', 'alumnas'))
   or (pol.schemaname = 'storage' and pol.tablename = 'objects');
