// Abre uma planilha (xlsx, csv, tsv) pelo mesmo leitor do Vindex.
import { Csv, Xlsx, type Planilha } from "../leitor/planilha.ts";

export async function abrirPlanilha(nome: string, dados: Uint8Array): Promise<Planilha> {
  return /\.(csv|tsv)$/i.test(nome) ? Csv.abrir(dados, nome) : Xlsx.abrir(dados);
}
