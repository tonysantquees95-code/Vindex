// VindexScanner: desenho no navegador (canvas). A lógica dos pixels fica em imagem.ts.
import { CANTOS_INTEIRA, acharPapel, aposGiro, aplicarFiltro, caber, corrigirPerspectiva, encaixarA4, tamanhoDoQuad, type Cantos, type Filtro } from "./imagem.ts";

/** Deixa a tela respirar entre dois passos pesados (senão ela congela e parece travada). */
export const respirar = (): Promise<void> => new Promise((ok) => setTimeout(ok, 0));

export async function carregar(b: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try { return await createImageBitmap(b, { imageOrientation: "from-image" }); } catch { /* cai para a imagem comum */ }
  const url = URL.createObjectURL(b);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally { window.setTimeout(() => URL.revokeObjectURL(url), 5000); }
}

/** Acha o papel numa cópia pequena da foto (cantos e caixa em frações). Null = não achou papel. */
export async function detectarPapel(origem: Blob): Promise<ReturnType<typeof acharPapel>> {
  const img = await carregar(origem);
  const m = caber(img.width, img.height, 240), pc = document.createElement("canvas");
  pc.width = m.w; pc.height = m.h;
  const px = pc.getContext("2d", { willReadFrequently: true })!;
  px.drawImage(img, 0, 0, m.w, m.h);
  if ("close" in img) img.close();
  return acharPapel(px.getImageData(0, 0, m.w, m.h).data, m.w, m.h);
}

/**
 * Desenha a página: tamanho, giro e filtro. `lado` = maior lado da imagem pronta.
 * `cantos` (escolhidos pela pessoa) valem mais que o recorte automático: a folha é endireitada por eles.
 */
export async function desenhar(origem: Blob, filtro: Filtro, giro: number, lado: number, recortar = false, cantos?: Cantos | null): Promise<HTMLCanvasElement> {
  const img = await carregar(origem);
  let base: CanvasImageSource = img, bw = img.width, bh = img.height;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  let quad: Cantos | null = cantos ?? null;
  if (!quad && recortar) {
    const m = caber(img.width, img.height, 240), pc = document.createElement("canvas");
    pc.width = m.w; pc.height = m.h;
    const px = pc.getContext("2d", { willReadFrequently: true })!;
    px.drawImage(img, 0, 0, m.w, m.h);
    const r = acharPapel(px.getImageData(0, 0, m.w, m.h).data, m.w, m.h);
    if (r?.cantos) quad = r.cantos;
    else if (r) { const f = 0.006; sx = Math.max(0, (r.x - f) * img.width); sy = Math.max(0, (r.y - f) * img.height); sw = Math.min(img.width - sx, (r.w + 2 * f) * img.width); sh = Math.min(img.height - sy, (r.h + 2 * f) * img.height); }
  }
  if (quad && !(quad === CANTOS_INTEIRA)) {
    // endireita a folha: lê a foto numa resolução um pouco acima da final e redesenha o quadrilátero como retângulo
    const f = caber(img.width, img.height, Math.min(2600, Math.max(900, Math.round(lado * 1.4))));
    const fc = document.createElement("canvas");
    fc.width = f.w; fc.height = f.h;
    const fx = fc.getContext("2d", { willReadFrequently: true })!;
    fx.drawImage(img, 0, 0, f.w, f.h);
    const t = encaixarA4(tamanhoDoQuad(quad, f.w, f.h, lado).w, tamanhoDoQuad(quad, f.w, f.h, lado).h); // folha com cara de A4 sai em A4 exato
    const fonte = fx.getImageData(0, 0, f.w, f.h).data, o = new Uint8ClampedArray(t.w * t.h * 4);
    await respirar();
    let ok = true;
    for (let y = 0; y < t.h && ok; y += 64) { ok = !!corrigirPerspectiva(fonte, f.w, f.h, quad, t.w, t.h, { de: y, ate: Math.min(t.h, y + 64), saida: o }); await respirar(); }
    if (ok) {
      const rc = document.createElement("canvas");
      rc.width = t.w; rc.height = t.h;
      const rx = rc.getContext("2d")!, id = rx.createImageData(t.w, t.h);
      id.data.set(o); rx.putImageData(id, 0, 0);
      base = rc; bw = t.w; bh = t.h; sx = 0; sy = 0; sw = t.w; sh = t.h;
    }
  }
  const { w, h } = caber(sw, sh, lado);
  const fim = aposGiro(w, h, giro);
  const c = document.createElement("canvas");
  c.width = fim.w; c.height = fim.h;
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.fillStyle = "#fff"; x.fillRect(0, 0, fim.w, fim.h);
  x.translate(fim.w / 2, fim.h / 2); x.rotate((giro * Math.PI) / 180);
  x.drawImage(base, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
  if ("close" in img) img.close();
  void bw; void bh;
  if (filtro !== "original") { const d = x.getImageData(0, 0, fim.w, fim.h); aplicarFiltro(d.data, fim.w, fim.h, filtro); x.putImageData(d, 0, 0); }
  return c;
}
export const jpeg = (c: HTMLCanvasElement, q = 0.85): Promise<Uint8Array> => new Promise((ok, erro) => c.toBlob(async (b) => (b ? ok(new Uint8Array(await b.arrayBuffer())) : erro(new Error("Não consegui preparar a imagem."))), "image/jpeg", q));

