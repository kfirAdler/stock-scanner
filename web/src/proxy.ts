import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);
const PUBLIC_PAGES = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/callback",
  "/terms",
  "/privacy",
  "/disclaimer",
]);

function pathnameWithoutLocale(pathname: string) {
  const segments = pathname.split("/");
  if (routing.locales.includes(segments[1] as (typeof routing.locales)[number])) {
    return `/${segments.slice(2).join("/")}`.replace(/\/$/, "") || "/";
  }
  return pathname.replace(/\/$/, "") || "/";
}

function requestLocale(request: NextRequest): (typeof routing.locales)[number] {
  const pathLocale = request.nextUrl.pathname.split("/")[1];
  if (routing.locales.includes(pathLocale as (typeof routing.locales)[number])) {
    return pathLocale as (typeof routing.locales)[number];
  }
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  if (routing.locales.includes(cookieLocale as (typeof routing.locales)[number])) {
    return cookieLocale as (typeof routing.locales)[number];
  }
  return routing.defaultLocale;
}

function copySessionCookies(target: NextResponse, source: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie.name, cookie.value, cookie);
  });
  return target;
}

function privateResponse(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function localizedPath(locale: string, path: string) {
  return `/${locale}${path}`;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { response: supabaseResponse, user } = await updateSession(request);

  if (pathname.startsWith("/api/")) {
    // The scheduled scanner authenticates with its own secret inside this route.
    if (pathname.startsWith("/api/admin/")) return supabaseResponse;
    if (user) return supabaseResponse;

    return copySessionCookies(
      privateResponse(NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 })),
      supabaseResponse
    );
  }

  const locale = requestLocale(request);
  const route = pathnameWithoutLocale(pathname);
  const isPublicPage = PUBLIC_PAGES.has(route);
  const isAuthEntry = route === "/auth/login" || route === "/auth/register";

  if (!user && !isPublicPage) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = localizedPath(locale, "/auth/login");
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return copySessionCookies(
      privateResponse(NextResponse.redirect(loginUrl)),
      supabaseResponse
    );
  }

  if (user && isAuthEntry) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = localizedPath(locale, "/");
    homeUrl.search = "";
    return copySessionCookies(
      privateResponse(NextResponse.redirect(homeUrl)),
      supabaseResponse
    );
  }

  const response = intlMiddleware(request);
  supabaseResponse.headers.forEach((value, key) => {
    response.headers.set(key, value);
  });
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value);
  });

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
