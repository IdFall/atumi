import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { ACTIVITY_COOKIE, activityCookieValue, INACTIVE_PARAM, isSessionInactive } from "@/config/session";

/**
 * Rafraîchit la session Supabase à chaque requête et pose les en-têtes de sécurité.
 * Ce n'est pas un contrôle d'accès : les autorisations sont vérifiées dans l'API
 * et par les règles RLS de la base.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [name, value] of Object.entries(headers ?? {})) {
            response.headers.set(name, value);
          }
        },
      },
    });
    const { data } = await supabase.auth.getClaims();
    const sessionId = data?.claims?.session_id;
    if (typeof sessionId === "string" && sessionId) {
      const now = Date.now();
      if (isSessionInactive(request.cookies.get(ACTIVITY_COOKIE)?.value, sessionId, now)) {
        // Plus d'une heure sans activité : on ferme la session de cet appareil.
        await supabase.auth.signOut({ scope: "local" });
        return withSecurityHeaders(signedOutResponse(request, response));
      }
      response.cookies.set(ACTIVITY_COOKIE, activityCookieValue(sessionId, now), {
        httpOnly: true,
        secure: request.nextUrl.protocol === "https:",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
  }

  return withSecurityHeaders(response);
}

/**
 * Réponse après une déconnexion pour inactivité : une page est redirigée vers
 * /connexion avec un message ; une requête de données (action, API) continue,
 * sans session, et sera refusée comme pour un visiteur.
 */
function signedOutResponse(request: NextRequest, sessionResponse: NextResponse): NextResponse {
  const isPage = request.method === "GET" && (request.headers.get("accept") ?? "").includes("text/html");
  const response = isPage
    ? NextResponse.redirect(new URL(`/connexion?${INACTIVE_PARAM}=1`, request.url))
    : sessionResponse;
  for (const cookie of sessionResponse.cookies.getAll()) response.cookies.set(cookie);
  response.cookies.delete(ACTIVITY_COOKIE);
  return response;
}

function withSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/).*)"],
};
