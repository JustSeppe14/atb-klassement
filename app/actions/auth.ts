"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const usernameInput = formData.get("username");
  const passwordInput = formData.get("password");

  // Fetch from process.env
  const ADMIN_USER = process.env.ADMIN_USERNAME;
  const ADMIN_PASS = process.env.ADMIN_PASSWORD;

  // Safety check: ensure env variables exist
  if (!ADMIN_USER || !ADMIN_PASS) {
    console.error("Auth Error: ADMIN_USERNAME or ADMIN_PASSWORD not set in environment.");
    return { error: "Server configuratiefout" };
  }

  if (usernameInput === ADMIN_USER && passwordInput === ADMIN_PASS) {
    const cookieStore = await cookies();
    
    cookieStore.set("auth-token", "atb-secret-session", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
      sameSite: "lax", // Standard security practice
    });

    // Important: redirect must be outside the try/catch if you add one later
    redirect("/dashboard"); 
  } else {
    return { error: "Foutieve gebruikersnaam of wachtwoord" };
  }
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("auth-token");
  redirect("/"); 
}