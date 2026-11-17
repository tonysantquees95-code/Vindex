package tech.vetorial.vindex;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.widget.RemoteViews;

import java.util.Locale;

/**
 * Widgets da tela inicial do Vindex (além do "Desempenho" clássico): Bateria, Memória, Armazenamento,
 * Super widget (quatro anéis) e Painel (barras). Tocar em qualquer parte atualiza na hora; o Android também
 * atualiza sozinho de tempos em tempos.
 */
public final class WidgetsVindex {
    private WidgetsVindex() { }

    static final String ACAO_ATUALIZAR = "tech.vetorial.vindex.WIDGET_ATUALIZAR";

    /** Cada modelo de widget sabe montar a própria aparência. */
    abstract static class Base extends AppWidgetProvider {
        abstract RemoteViews montar(Context c);

        @Override
        public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
            for (int id : ids) m.updateAppWidget(id, comToque(c, montar(c)));
        }

        @Override
        public void onReceive(Context c, Intent i) {
            if (ACAO_ATUALIZAR.equals(i.getAction())) {
                AppWidgetManager m = AppWidgetManager.getInstance(c);
                onUpdate(c, m, m.getAppWidgetIds(new ComponentName(c, getClass())));
                return;
            }
            super.onReceive(c, i);
        }

        private RemoteViews comToque(Context c, RemoteViews v) {
            Intent i = new Intent(c, getClass()).setAction(ACAO_ATUALIZAR);
            v.setOnClickPendingIntent(R.id.w_raiz, PendingIntent.getBroadcast(c, getClass().getName().hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
            return v;
        }
    }

    static int tempParaPercentual(double t) { return Double.isNaN(t) ? 0 : (int) Math.max(0, Math.min(100, Math.round(t * 100.0 / 60.0))); }

    public static class Bateria extends Base {
        @Override RemoteViews montar(Context c) {
            double[] b = Desempenho.bateria(c);
            int n = b[1] < 0 ? 0 : (int) Math.round(b[1]);
            RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_bateria);
            v.setProgressBar(R.id.w_anel, 100, n, false);
            v.setTextViewText(R.id.w_valor, b[1] < 0 ? "–" : n + "%");
            v.setTextViewText(R.id.w_linha1, Desempenho.estadoBateria(c));
            double tv = Desempenho.tensao(c);
            v.setTextViewText(R.id.w_linha2, Desempenho.temperaturaTexto(b[0]) + (Double.isNaN(tv) ? "" : String.format(Locale.US, " · %.2f V", tv)));
            return v;
        }
    }

    public static class Memoria extends Base {
        @Override RemoteViews montar(Context c) {
            long[] m = Desempenho.ram(c);
            int p = Desempenho.ramPercentual(c);
            RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_memoria);
            v.setProgressBar(R.id.w_anel, 100, p, false);
            v.setTextViewText(R.id.w_valor, p + "%");
            v.setTextViewText(R.id.w_linha1, Desempenho.gb(m[0] - m[1]) + " de " + Desempenho.gb(m[0]) + " GB");
            v.setTextViewText(R.id.w_linha2, Desempenho.gb(m[1]) + " GB livres");
            return v;
        }
    }

    public static class Armazenamento extends Base {
        @Override RemoteViews montar(Context c) {
            long[] a = Desempenho.armazenamento();
            int p = Desempenho.armazenamentoPercentual();
            RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_armazenamento);
            v.setProgressBar(R.id.w_anel, 100, p, false);
            v.setTextViewText(R.id.w_valor, p + "%");
            v.setTextViewText(R.id.w_linha1, Desempenho.gb(a[0] - a[1]) + " de " + Desempenho.gb(a[0]) + " GB");
            v.setTextViewText(R.id.w_linha2, Desempenho.gb(a[1]) + " GB livres");
            return v;
        }
    }

    public static class Super extends Base {
        @Override RemoteViews montar(Context c) {
            double[] b = Desempenho.bateria(c);
            int bat = b[1] < 0 ? 0 : (int) Math.round(b[1]);
            RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_super);
            v.setProgressBar(R.id.w_bat_anel, 100, bat, false);
            v.setTextViewText(R.id.w_bat_valor, b[1] < 0 ? "–" : bat + "%");
            int ram = Desempenho.ramPercentual(c);
            v.setProgressBar(R.id.w_ram_anel, 100, ram, false);
            v.setTextViewText(R.id.w_ram_valor, ram + "%");
            int arm = Desempenho.armazenamentoPercentual();
            v.setProgressBar(R.id.w_arm_anel, 100, arm, false);
            v.setTextViewText(R.id.w_arm_valor, arm + "%");
            v.setProgressBar(R.id.w_tmp_anel, 100, tempParaPercentual(b[0]), false);
            v.setTextViewText(R.id.w_tmp_valor, Double.isNaN(b[0]) ? "–" : String.format(Locale.US, "%.0f°", b[0]));
            return v;
        }
    }

    public static class Painel extends Base {
        @Override RemoteViews montar(Context c) {
            double[] b = Desempenho.bateria(c);
            long[] m = Desempenho.ram(c);
            long[] a = Desempenho.armazenamento();
            RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_painel);
            v.setTextViewText(R.id.w_sistema, "Android " + Build.VERSION.RELEASE);
            int arm = Desempenho.armazenamentoPercentual();
            v.setProgressBar(R.id.w_arm_barra, 100, arm, false);
            v.setTextViewText(R.id.w_arm_texto, Desempenho.gb(a[1]) + " GB livres");
            int ram = Desempenho.ramPercentual(c);
            v.setProgressBar(R.id.w_ram_barra, 100, ram, false);
            v.setTextViewText(R.id.w_ram_texto, Desempenho.gb(m[0] - m[1]) + " / " + Desempenho.gb(m[0]) + " GB");
            int bat = b[1] < 0 ? 0 : (int) Math.round(b[1]);
            v.setProgressBar(R.id.w_bat_barra, 100, bat, false);
            v.setTextViewText(R.id.w_bat_texto, (b[1] < 0 ? "–" : bat + "%") + " · " + Desempenho.estadoBateria(c));
            v.setProgressBar(R.id.w_tmp_barra, 100, tempParaPercentual(b[0]), false);
            v.setTextViewText(R.id.w_tmp_texto, Desempenho.temperaturaTexto(b[0]));
            return v;
        }
    }

    /** Pede ao Android para fixar o widget na tela inicial (Android 8+). Devolve uma mensagem para a pessoa. */
    static String fixar(Context c, String tipo) {
        Class<?> classe;
        switch (tipo == null ? "" : tipo) {
            case "bateria": classe = Bateria.class; break;
            case "memoria": classe = Memoria.class; break;
            case "armazenamento": classe = Armazenamento.class; break;
            case "super": classe = Super.class; break;
            case "painel": classe = Painel.class; break;
            case "desempenho": classe = VindexWidget.class; break;
            default: return "Esse widget não existe.";
        }
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        if (Build.VERSION.SDK_INT >= 26 && m.isRequestPinAppWidgetSupported()) {
            m.requestPinAppWidget(new ComponentName(c, classe), null, null);
            return "Confirme na tela do Android para colocar o widget na tela inicial.";
        }
        return "Seu launcher não deixa adicionar por aqui. Segure um espaço vazio da tela inicial, escolha Widgets e procure por Vindex.";
    }
}
