import { agruparNucleos, frequencia, identificarChipset } from "../chipset";
import type { Diagnostico } from "../ponte";
import { Barra, Cartao, Grafico } from "../ui";

/** Chip desenhado no estilo de ícones do app (traço do tema); a cor vem do fabricante. Não é logotipo de marca. */
function DesenhoDoChip({ cor }: { cor: string }) {
  const traco = { strokeWidth: "var(--icone-traco, 1.7)", strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg viewBox="0 0 64 64" width="72" height="72" fill="none" stroke="currentColor" style={{ color: cor, ...traco }} aria-hidden>
      <rect x="16" y="16" width="32" height="32" rx="7" />
      <rect x="25" y="25" width="14" height="14" rx="3.5" fill={cor} fillOpacity="0.22" />
      {[22, 32, 42].map((p) => <g key={p}><path d={`M${p} 16V9M${p} 48v7`} /><path d={`M16 ${p}H9M48 ${p}h7`} /></g>)}
    </svg>
  );
}

/** Cartão do chipset (como nos monitores de hardware): quem é, carga e frequência agora, e cada núcleo por grupo de potência. */
export function CartaoChipset({ d, historico }: { d: Diagnostico; historico: number[] }) {
  const c = identificarChipset(d);
  const grupos = agruparNucleos(d.chipset?.nucleos);
  const atuais = grupos.flatMap((g) => g.nucleos.map((n) => n.atual_mhz)).filter((x) => x > 0);
  const maiorAgora = atuais.length ? Math.max(...atuais) : 0;
  return (
    <Cartao className="!p-0 overflow-hidden">
      <div className="grid grid-cols-[9.5rem_minmax(0,1fr)]">
        <div className="flex flex-col items-center justify-center gap-1 p-3 text-center" style={{ background: `linear-gradient(160deg, ${c.cor}33, transparent 75%)` }}>
          <DesenhoDoChip cor={c.cor} />
          <div className="text-[11px] uppercase tracking-[0.16em] text-suave">{c.fabricante}</div>
          <div className="text-base font-bold leading-tight">{c.nome}</div>
          {c.modelo && <div className="num text-[11px] text-suave">{c.modelo}</div>}
          <div className="text-[11px] text-suave">{d.cpu_nucleos} núcleos</div>
        </div>
        <div className="min-w-0 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <div><div className="text-[11px] uppercase tracking-[0.16em] text-suave">Carga da CPU</div>{maiorAgora > 0 && <div className="num text-xs text-neon">{frequencia(maiorAgora)}</div>}</div>
            <div className="num text-2xl font-semibold">{Math.round(d.cpu_uso)}%</div>
          </div>
          <div className="mt-1"><Grafico series={[{ nome: "CPU", cor: "var(--color-neon)", valores: historico }]} altura={64} /></div>
        </div>
      </div>
      {grupos.length > 0 && (
        <div className="space-y-3 border-t border-borda p-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-suave">Frequência dos núcleos</div>
          {grupos.map((g) => (
            <div key={g.max_mhz}>
              <div className="mb-1 flex items-baseline justify-between text-xs"><span className="font-medium">{g.rotulo}{g.nucleos.length > 1 ? ` ×${g.nucleos.length}` : ""}</span><span className="num text-suave">até {frequencia(g.max_mhz)}</span></div>
              <ul className="space-y-1.5">
                {g.nucleos.map((n) => {
                  const pct = n.max_mhz ? Math.min(100, (n.atual_mhz / n.max_mhz) * 100) : 0;
                  return (
                    <li key={n.n} className="grid grid-cols-[4.6rem_minmax(0,1fr)_2.6rem_4.6rem] items-center gap-2 text-xs">
                      <span className="whitespace-nowrap text-suave">Núcleo {n.n}</span>
                      <Barra valor={pct} rotulo={`Núcleo ${n.n}`} />
                      <span className="num text-right text-suave">{n.atual_mhz > 0 ? `${Math.round(pct)}%` : "—"}</span>
                      <span className="num whitespace-nowrap text-right">{n.atual_mhz > 0 ? frequencia(n.atual_mhz) : "parado"}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Cartao>
  );
}
