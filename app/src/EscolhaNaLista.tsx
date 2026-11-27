import { createRoot } from "react-dom/client";
import { Dialogo } from "./leitor/Dialogo";
import { Icone } from "./icones";

/** Caixinha de escolha no visual do Vindex, chamada de qualquer lugar. Devolve a posição escolhida, ou null se a pessoa fechar. */
export function escolherNaLista(titulo: string, opcoes: string[]): Promise<number | null> {
  return new Promise((resolver) => {
    const casa = document.body.appendChild(document.createElement("div"));
    const raiz = createRoot(casa);
    let feito = false;
    const fim = (i: number | null) => {
      if (feito) return;
      feito = true;
      window.setTimeout(() => { raiz.unmount(); casa.remove(); }, 0);
      resolver(i);
    };
    raiz.render(
      <Dialogo titulo={titulo} aoFechar={() => fim(null)}>
        <div className="flex flex-col gap-2">
          {opcoes.map((o, i) => (
            <button key={o} onClick={() => fim(i)} className="flex min-h-12 items-center gap-3 rounded-xl border border-borda px-3 text-left text-sm hover:border-neon hover:bg-neon/10">
              <span className="text-neon"><Icone nome="arquivos" tam={20} /></span>{o}
            </button>
          ))}
          <button onClick={() => fim(null)} className="min-h-11 rounded-xl text-sm text-suave hover:bg-white/5">Cancelar</button>
        </div>
      </Dialogo>
    );
  });
}
