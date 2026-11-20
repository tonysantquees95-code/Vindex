import { lazy, Suspense, useMemo } from "react";
import { useMotor } from "../estado";
import { LogoPdf } from "../pdf/LogoPdf";
import { saidaNavegador, type SaidaPdf } from "../pdf/saida";

const Ferramentas = lazy(() => import("../pdf/GradeDeFerramentas").then((m) => ({ default: m.FerramentasPdf })));

/** Aba "PDF" do Vindex: as ferramentas do Vindex PDF (juntar, dividir, comprimir, converter...) dentro do app. */
export function PdfTela() {
  const motor = useMotor();
  const saida = useMemo<SaidaPdf>(() => {
    const d = motor.documentos;
    if (!d) return saidaNavegador;
    return { salvar: (dados, nome) => d.salvarCopia(dados, nome), compartilhar: d.compartilhar ? (dados, nome, mime) => d.compartilhar!(dados, nome, mime) : undefined };
  }, [motor]);
  return (
    <Suspense fallback={<p className="text-sm text-suave">Abrindo as ferramentas…</p>}>
      <Ferramentas saida={saida} cabeca={
        <div className="flex items-center gap-3">
          <LogoPdf tam={44} />
          <div><h1 className="text-xl font-extrabold">Vindex PDF</h1><p className="text-sm text-suave">Juntar, dividir, comprimir e converter PDFs, no seu aparelho.</p></div>
        </div>
      } />
    </Suspense>
  );
}
