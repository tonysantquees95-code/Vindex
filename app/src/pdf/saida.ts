// Como o resultado sai do app: no Vindex usa o salvar/compartilhar do aparelho; na web (ou na demonstração) baixa pelo navegador.
export interface SaidaPdf {
  salvar(dados: Uint8Array, nome: string, mime: string): Promise<string | null>;
  compartilhar?(dados: Uint8Array, nome: string, mime: string): Promise<void>;
}

export const saidaNavegador: SaidaPdf = {
  async salvar(dados, nome, mime) {
    const url = URL.createObjectURL(new Blob([dados as BlobPart], { type: mime }));
    const a = document.createElement("a");
    a.href = url; a.download = nome; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return nome;
  },
  async compartilhar(dados, nome, mime) {
    const arquivo = new File([dados as BlobPart], nome, { type: mime });
    if (!navigator.canShare?.({ files: [arquivo] })) throw new Error("Este navegador não compartilha arquivos. Use Salvar.");
    try { await navigator.share({ files: [arquivo], title: nome }); } catch (e) { if ((e as { name?: string }).name !== "AbortError") throw e; }
  }
};
export const podeCompartilharNoNavegador = (): boolean => typeof navigator !== "undefined" && typeof navigator.canShare === "function";
