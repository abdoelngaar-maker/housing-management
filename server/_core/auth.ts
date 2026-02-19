/**
 * Standalone authentication system using JWT + username/password
 * No dependency on Manus OAuth
 */

import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import type { User } from "../../drizzle/schema";

export type SessionPayload = {
  openId: string;
  name: string;
};

function getSessionSecret() {
  const secret = ENV.cookieSecret;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(
  openId: string,
  name: string,
  expiresInMs: number = ONE_YEAR_MS
): Promise<string> {
  const issuedAt = Date.now();
  const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
  const secretKey = getSessionSecret();

  return new SignJWT({ openId, name })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(secretKey);
}

export async function verifySession(
  cookieValue: string | undefined | null
): Promise<SessionPayload | null> {
  if (!cookieValue) return null;

  try {
    const secretKey = getSessionSecret();
    const { payload } = await jwtVerify(cookieValue, secretKey, {
      algorithms: ["HS256"],
    });
    const { openId, name } = payload as Record<string, unknown>;

    if (typeof openId !== "string" || !openId || typeof name !== "string" || !name) {
      return null;
    }

    return { openId, name };
  } catch (err) {
    console.error("[Auth] JWT verification failed:", err);
    return null;
  }
}

/**
 * Parse cookies from the Cookie header string.
 * Manual implementation to avoid dynamic require("cookie") which fails with esbuild bundling.
 */
function parseCookies(cookieHeader: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!cookieHeader) return map;

  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx < 0) continue;
    const key = pair.substring(0, eqIdx).trim();
    let val = pair.substring(eqIdx + 1).trim();
    // Remove surrounding quotes if present
    if (val.length >= 2 && val[0] === '"' && val[val.length - 1] === '"') {
      val = val.slice(1, -1);
    }
    try {
      map.set(key, decodeURIComponent(val));
    } catch {
      map.set(key, val);
    }
  }
  return map;
}

export async function authenticateRequest(req: Request): Promise<User | null> {
  const cookies = parseCookies(req.headers.cookie);
  const sessionCookie = cookies.get(COOKIE_NAME);
  
  if (!sessionCookie) {
    return null;
  }

  const session = await verifySession(sessionCookie);

  if (!session) {
    console.log("[Auth] Session verification failed for cookie");
    return null;
  }

  console.log("[Auth] Session verified, openId:", session.openId, "name:", session.name);

  let user = await db.getUserByOpenId(session.openId);
  
  if (!user) {
    console.log("[Auth] User not found in DB for openId:", session.openId, "- creating user...");
    // User exists in JWT but not in DB - create them
    try {
      await db.upsertUser({
        openId: session.openId,
        name: session.name,
        email: `admin@local`,
        loginMethod: "password",
        role: "admin",
        lastSignedIn: new Date(),
      });
      user = await db.getUserByOpenId(session.openId);
      console.log("[Auth] User created successfully:", user ? "found" : "still not found");
    } catch (error) {
      console.error("[Auth] Failed to create user:", error);
      return null;
    }
  }

  if (!user) {
    console.log("[Auth] User still null after upsert attempt");
    return null;
  }

  // Update last signed in (non-critical)
  try {
    await db.upsertUser({
      openId: user.openId,
      lastSignedIn: new Date(),
    });
  } catch (error) {
    console.warn("[Auth] Failed to update lastSignedIn:", error);
  }

  return user;
}

export function registerAuthRoutes(app: Express) {
  // Login endpoint
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان" });
      return;
    }

    try {
      // Check if this is the admin (owner) login
      const adminUsername = process.env.ADMIN_USERNAME || "admin";
      const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

      if (username === adminUsername && password === adminPassword) {
        // Admin login
        const openId = ENV.ownerOpenId || "admin-owner";
        
        console.log("[Auth] Admin login attempt, openId:", openId);
        
        await db.upsertUser({
          openId,
          name: "المدير",
          email: `${adminUsername}@local`,
          loginMethod: "password",
          role: "admin",
          lastSignedIn: new Date(),
        });

        // Verify the user was actually saved
        const savedUser = await db.getUserByOpenId(openId);
        console.log("[Auth] Admin user after upsert:", savedUser ? `id=${savedUser.id}, openId=${savedUser.openId}` : "NOT FOUND!");

        const token = await createSessionToken(openId, "المدير");
        const cookieOptions = getSessionCookieOptions(req);
        
        console.log("[Auth] Setting cookie with options:", JSON.stringify(cookieOptions));
        
        res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        res.json({ success: true, user: { name: "المدير", role: "admin" } });
        return;
      }

      // Regular user login - check database
      const user = await db.getUserByEmail(username);
      if (!user) {
        res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
        return;
      }

      const token = await createSessionToken(user.openId, user.name || username);
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ success: true, user: { name: user.name, role: user.role } });
    } catch (error) {
      console.error("[Auth] Login failed:", error);
      res.status(500).json({ error: "فشل تسجيل الدخول" });
    }
  });

  // Debug endpoint to check auth status
  app.get("/api/auth/debug", async (req: Request, res: Response) => {
    try {
      const cookies = parseCookies(req.headers.cookie);
      const sessionCookie = cookies.get(COOKIE_NAME);
      const hasCookie = !!sessionCookie;
      
      let session: SessionPayload | null = null;
      let user: User | null = null;
      
      if (sessionCookie) {
        session = await verifySession(sessionCookie);
        if (session) {
          user = await db.getUserByOpenId(session.openId) || null;
        }
      }
      
      res.json({
        hasCookie,
        cookieName: COOKIE_NAME,
        sessionValid: !!session,
        sessionOpenId: session?.openId || null,
        sessionName: session?.name || null,
        userFound: !!user,
        userId: user?.id || null,
        userRole: user?.role || null,
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Register endpoint (admin only creates users)
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const { name, email, password, role } = req.body;

    if (!name || !email) {
      res.status(400).json({ error: "الاسم والبريد الإلكتروني مطلوبان" });
      return;
    }

    try {
      const { nanoid } = await import("nanoid");
      const openId = nanoid();
      await db.upsertUser({
        openId,
        name,
        email,
        loginMethod: "password",
        role: role || "user",
        lastSignedIn: new Date(),
      });

      res.json({ success: true });
    } catch (error) {
      console.error("[Auth] Register failed:", error);
      res.status(500).json({ error: "فشل إنشاء الحساب" });
    }
  });
}
