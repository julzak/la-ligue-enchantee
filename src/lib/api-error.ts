import { NextResponse } from "next/server";

// Réponse 500 JSON homogène pour les routes admin. Sans elle, une erreur
// Prisma non attrapée renvoie un 500 à corps vide et l'UI admin affiche
// « JSON.parse: unexpected end of data » au lieu d'un message exploitable.
export function jsonError500(tag: string, e: unknown, prefix: string) {
  console.error(tag, e);
  const detail = e instanceof Error ? e.message.split("\n").slice(-3).join(" ").trim() : "";
  return NextResponse.json(
    { error: `${prefix} : ${detail || "erreur inconnue"}` },
    { status: 500 }
  );
}
