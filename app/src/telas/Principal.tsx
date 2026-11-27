import { useState } from "react";
import { Dialogo } from "../leitor/Dialogo";
import { useMotor } from "../estado";

/** Pergunta se o Vindex deve ser o gerenciador principal, no visual do app. */
export function PerguntaPrincipal({ aoFechar }: { aoFechar: () => void }) {
  const motor = useMotor();
  const [erro, setErro] = useState("");
  const responder = (usar: boolean) => {
    void motor.principal?.responder(usar).then(aoFechar).catch((e) => setErro(e instanceof Error ? e.message : "Não consegui abrir a escolha do Android."));
  };
  return (
    <Dialogo titulo="Usar o Vindex como gerenciador principal?" aoFechar={() => { if (erro) aoFechar(); else responder(false); }}>
      <p className="text-sm text-suave">Quando um app pedir para abrir os downloads ou uma pasta, o Vindex abre. Na próxima tela escolha o Vindex e toque em "Sempre".</p>
      {erro && <p role="alert" className="mt-3 text-sm text-erro">{erro}</p>}
      <div className="mt-4 flex gap-2">
        <button onClick={() => (erro ? aoFechar() : responder(false))} className="min-h-11 flex-1 rounded-xl border border-borda text-sm">Agora não</button>
        <button onClick={() => responder(true)} className="btn-primario min-h-11 flex-1 rounded-xl bg-neon text-sm font-extrabold text-[#04121c]">Sim, usar</button>
      </div>
    </Dialogo>
  );
}
