import { useEffect, useId, useRef } from "react";

/**
 * Logo do Vindex Universal Tools: o V (azul e turquesa) com um anel duplo de Saturno e uma lua dourada que gira em volta.
 * O degradê do anel escorre devagar e a lua passa por trás e pela frente do V (9 s por volta; ela encolhe atrás e cresce na frente, sem salto).
 * Quem pede menos movimento no aparelho recebe o logo parado. Cores fixas da marca (não seguem o tema).
 * `animado={false}` deixa parado (ícone pequeno, listas). O desenho é o mesmo do ícone do app.
 */
export function LogoVivo({ tam = 40, className = "", animado = true }: { tam?: number; className?: string; animado?: boolean }) {
  const id = useId().replace(/:/g, "");
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = svg.current; if (!el || typeof el.pauseAnimations !== "function") return;
    let reduz = false;
    try { reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { /* sem matchMedia: segue animado */ }
    if (!animado || reduz) { el.pauseAnimations(); el.setCurrentTime(1.2); }
  }, [animado]);
  const T = "9s";
  return (
    <span className={`logo-vivo inline-block flex-none ${className}`} style={{ width: tam, height: tam }} role="img" aria-label="Vindex Universal Tools">
      <svg ref={svg} viewBox="-2 -2 104 104" width={tam} height={tam} overflow="visible" aria-hidden="true">
        <defs>
          <linearGradient id={`r${id}`} gradientUnits="userSpaceOnUse" x1="96" y1="50" x2="142" y2="50" spreadMethod="reflect">
            <stop offset="0" stopColor="#5ba8f0" /><stop offset="0.5" stopColor="#43cfc4" /><stop offset="1" stopColor="#8f8cf2" />
            <animate attributeName="x1" dur={T} repeatCount="indefinite" values="96;4" />
            <animate attributeName="x2" dur={T} repeatCount="indefinite" values="142;50" />
          </linearGradient>
        </defs>
        <g transform="rotate(-28 50 50)">
          <path d="M4 50 A46 16 0 0 1 96 50" fill="none" stroke={`url(#r${id})`} strokeWidth="2.5" opacity=".55" />
          <path d="M13 50 A37 12 0 0 1 87 50" fill="none" stroke={`url(#r${id})`} strokeWidth="5" opacity=".55" />
          <circle r="5.5" fill="#fbbf24" cx="0" cy="0">
            <animateMotion dur={T} repeatCount="indefinite" path="M-2 50 A52 21 0 0 1 102 50" keyPoints="0;1;1" keyTimes="0;0.5;1" calcMode="linear" />
            <animate attributeName="r" dur={T} repeatCount="indefinite" values="5.5;4;5.5;5.5" keyTimes="0;0.25;0.5;1" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0 0 1 1" />
            <animate attributeName="opacity" dur={T} repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.5;0.5;1" />
          </circle>
        </g>
        <path d="M33 24 L50 68" fill="none" stroke="#5ba8f0" strokeWidth="11" strokeLinecap="round" />
        <path d="M50 68 L67 24" fill="none" stroke="#43cfc4" strokeWidth="11" strokeLinecap="round" />
        <g transform="rotate(-28 50 50)">
          <path d="M4 50 A46 16 0 0 0 96 50" fill="none" stroke={`url(#r${id})`} strokeWidth="2.5" />
          <path d="M13 50 A37 12 0 0 0 87 50" fill="none" stroke={`url(#r${id})`} strokeWidth="5" />
          <circle r="5.5" fill="#fbbf24" cx="0" cy="0">
            <animateMotion dur={T} repeatCount="indefinite" path="M102 50 A52 21 0 0 1 -2 50" keyPoints="0;0;1" keyTimes="0;0.5;1" calcMode="linear" />
            <animate attributeName="r" dur={T} repeatCount="indefinite" values="5.5;5.5;7;5.5" keyTimes="0;0.5;0.75;1" calcMode="spline" keySplines="0 0 1 1;0.4 0 0.6 1;0.4 0 0.6 1" />
            <animate attributeName="opacity" dur={T} repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.5;0.5;1" />
          </circle>
        </g>
      </svg>
    </span>
  );
}
