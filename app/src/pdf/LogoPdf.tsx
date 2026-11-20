import { useId } from "react";

/** Logo do Vindex PDF: uma folha de documento com o V do Vindex no meio, nas cores do app (--color-neon e --color-magenta). */
export function LogoPdf({ tam = 40, className = "" }: { tam?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className={className} width={tam * 0.82} height={tam} viewBox="0 0 82 100" role="img" aria-label="Vindex PDF">
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--color-neon, #22d3ee)" /><stop offset="1" stopColor="var(--color-magenta, #e879f9)" /></linearGradient>
      </defs>
      <path d="M10 4h42l24 24v62a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6V10a6 6 0 0 1 6-6z" fill={`url(#g${id})`} opacity=".16" stroke={`url(#g${id})`} strokeWidth="5" strokeLinejoin="round" />
      <path d="M52 4v18a6 6 0 0 0 6 6h18" fill="none" stroke={`url(#g${id})`} strokeWidth="5" strokeLinejoin="round" />
      <path d="M24 42 41 76 58 42" fill="none" stroke={`url(#g${id})`} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
