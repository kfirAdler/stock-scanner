import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { response: supabaseResponse, authenticated: false };

  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  let authenticated = false;
  let validationError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { data, error } = await supabase.auth.getClaims();
      if (data?.claims?.sub) {
        authenticated = true;
        validationError = null;
        break;
      }
      if (!error) break;
      validationError = error;
      if (error.name !== "AuthRetryableFetchError") break;
    } catch (error) {
      validationError = error;
    }
  }

  if (validationError) {
    console.error("Session validation failed", validationError);
  }

  return { response: supabaseResponse, authenticated };
}
