"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const usernameInput = formData.get("username") as string;
  const passwordInput = formData.get("password") as string;

  const ADMIN_USER = process.env.AUTH_USER;
  const ADMIN_PASS = process.env.AUTH_PASS;


  if (!ADMIN_USER || !ADMIN_PASS) {
    return { error: "Server configuration error: ENV not found." };
  }

  // Simple direct comparison
  if (usernameInput === ADMIN_USER && passwordInput === ADMIN_PASS) {
    const cookieStore = await cookies();
    
    cookieStore.set("auth-token", "atb-secret-session", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
      sameSite: "lax",
    });

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