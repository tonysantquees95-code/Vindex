// Ajudantes de XML (sem DOMParser, para rodar igual no app e nos testes do Node).
export function escapar(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
export function desescapar(t: string): string {
  return t.replace(/&(#x[0-9a-fA-F]+|#\d+|lt|gt|amp|quot|apos);/g, (_m, e: string) => {
    if (e === "lt") return "<"; if (e === "gt") return ">"; if (e === "amp") return "&"; if (e === "quot") return '"'; if (e === "apos") return "'";
    const n = e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
  });
}
/** Caracteres que o XML não aceita (controles) saem do texto digitado. */
export function textoSeguro(t: string): string { return t.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ""); }
export function atributo(tag: string, nome: string): string | null {
  const m = new RegExp(`\\b${nome}="([^"]*)"`).exec(tag);
  return m ? desescapar(m[1]) : null;
}
