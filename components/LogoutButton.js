"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton({
  callbackUrl = "/admin/login",
  label = "Logout",
  className,
  style,
}) {
  async function handleLogout() {
    await signOut({ callbackUrl });
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={className}
      style={style}
    >
      {label}
    </button>
  );
}
