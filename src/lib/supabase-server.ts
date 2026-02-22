import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const cookieDomain = '.academiadanas.com';

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                domain: cookieDomain,
                path: '/',
                sameSite: 'lax',
                secure: true,
              })
            );
          } catch {
            // setAll solo funciona en Server Actions y Route Handlers
          }
        },
      },
    }
  );
}