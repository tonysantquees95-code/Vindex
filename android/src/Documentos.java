package tech.vetorial.vindex;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Environment;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.webkit.MimeTypeMap;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Locale;

/** Leitor de documentos do Vindex: recebe arquivos de outros apps, guarda cópias, compartilha e imprime. Sem permissão ampla: usa o que o sistema entrega. */
final class Documentos {
    private Documentos() {}

    static final long LIMITE = 120L * 1024 * 1024;
    private static final String[] TIPOS = {"pdf", "docx", "xlsx", "xlsm", "pptx", "csv", "tsv", "txt", "md", "log", "json", "xml", "ini", "rtf", "xltx", "dotx", "png", "jpg", "jpeg", "webp", "gif", "bmp"};
    /** WebView da impressão fica guardado até o serviço de impressão terminar de usá-lo. */
    private static WebView paraImprimir;

    /** Arquivo que outro app mandou abrir (o Android entrega um endereço content://). */
    static volatile Uri pedido = null;

    static boolean tipoPermitido(String nome) {
        String n = nome == null ? "" : nome.toLowerCase(Locale.ROOT);
        int p = n.lastIndexOf('.');
        if (p < 0) return false;
        String e = n.substring(p + 1);
        for (String t : TIPOS) if (t.equals(e)) return true;
        return false;
    }

    /** Guarda o endereço que veio no Intent (abrir ou compartilhar para o Vindex). */
    static void lerIntent(Intent i) {
        if (i == null) return;
        String a = i.getAction();
        Uri u = null;
        if (Intent.ACTION_VIEW.equals(a)) u = i.getData();
        else if (Intent.ACTION_SEND.equals(a)) u = i.getParcelableExtra(Intent.EXTRA_STREAM);
        if (u != null && ("content".equals(u.getScheme()) || "file".equals(u.getScheme()))) pedido = u;
    }

    static String nomeDe(ContentResolver cr, Uri u) {
        String nome = null;
        if ("content".equals(u.getScheme())) {
            try (Cursor c = cr.query(u, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
                if (c != null && c.moveToFirst()) nome = c.getString(0);
            } catch (Exception ignorado) { /* cai no nome do endereço */ }
        }
        if (nome == null || nome.trim().isEmpty()) nome = u.getLastPathSegment();
        if (nome == null) nome = "documento";
        nome = nome.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").trim();
        int barra = nome.lastIndexOf('/');
        if (barra >= 0) nome = nome.substring(barra + 1);
        if (nome.isEmpty()) nome = "documento";
        // alguns apps mandam sem extensão: deduz pelo tipo
        if (!nome.contains(".")) {
            String mime = cr.getType(u);
            String ext = mime == null ? null : MimeTypeMap.getSingleton().getExtensionFromMimeType(mime);
            if (ext != null) nome = nome + "." + ext;
        }
        return nome.length() > 120 ? nome.substring(nome.length() - 120) : nome;
    }

    static File pastaDeAbertos(Context ctx) {
        File d = new File(ctx.getCacheDir(), "abertos");
        if (!d.isDirectory()) d.mkdirs();
        // limpa o que ficou de dias atrás
        File[] velhos = d.listFiles();
        if (velhos != null) for (File f : velhos) if (System.currentTimeMillis() - f.lastModified() > 2L * 24 * 3600 * 1000) f.delete();
        return d;
    }

    /** Copia o arquivo recebido para o cache do app (o original não é tocado). Devolve [caminho, nome]. */
    static String[] copiarParaCache(Context ctx, Uri uri) throws IOException {
        ContentResolver cr = ctx.getContentResolver();
        String nome = nomeDe(cr, uri);
        if (!tipoPermitido(nome)) throw new IOException("O Vindex ainda não abre esse tipo de arquivo (" + nome + ").");
        File destino = new File(pastaDeAbertos(ctx), System.currentTimeMillis() + "-" + nome);
        try (InputStream in = cr.openInputStream(uri)) {
            if (in == null) throw new IOException("Não consegui ler o arquivo que o outro app enviou.");
            try (OutputStream out = new FileOutputStream(destino)) {
                byte[] b = new byte[64 * 1024];
                long total = 0;
                int n;
                while ((n = in.read(b)) > 0) {
                    total += n;
                    if (total > LIMITE) { out.close(); destino.delete(); throw new IOException("O arquivo é grande demais para abrir aqui (mais de 120 MB)."); }
                    out.write(b, 0, n);
                }
            }
        } catch (SecurityException e) {
            throw new IOException("O Android não deixou o Vindex ler esse arquivo. Abra-o de novo pelo outro app.");
        }
        return new String[]{destino.getAbsolutePath(), nome};
    }

    static byte[] ler(File f) throws IOException {
        if (f.length() > LIMITE) throw new IOException("O arquivo é grande demais para abrir aqui (mais de 120 MB).");
        byte[] r = new byte[(int) f.length()];
        try (FileInputStream in = new FileInputStream(f)) {
            int off = 0;
            while (off < r.length) { int n = in.read(r, off, r.length - off); if (n < 0) break; off += n; }
        }
        return r;
    }

    /** Grava num arquivo ao lado e troca: se algo falhar no meio, o original continua inteiro. */
    static void gravar(File alvo, byte[] dados) throws IOException {
        if (!tipoPermitido(alvo.getName())) throw new IOException("Esse tipo de arquivo não pode ser gravado pelo leitor.");
        File tmp = new File(alvo.getParentFile(), alvo.getName() + ".vindex-tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) { out.write(dados); }
        if (!tmp.renameTo(alvo)) {
            tmp.delete();
            throw new IOException("Não consegui salvar o arquivo.");
        }
    }

    static String mimeDe(String nome) {
        String n = nome.toLowerCase(Locale.ROOT);
        int p = n.lastIndexOf('.');
        String ext = p < 0 ? "" : n.substring(p + 1);
        String m = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        if (m != null) return m;
        switch (ext) {
            case "docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            case "xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            case "pptx": return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
            case "csv": return "text/csv";
            default: return "application/octet-stream";
        }
    }

    /** Guarda a cópia em Downloads/Vindex. No Android 10+ não precisa de permissão (MediaStore). Devolve o lugar para mostrar à pessoa. */
    static String salvarCopia(Context ctx, String nome, byte[] dados) throws IOException {
        if (!tipoPermitido(nome)) throw new IOException("Esse tipo de arquivo não pode ser salvo pelo leitor.");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues v = new ContentValues();
            v.put(MediaStore.Downloads.DISPLAY_NAME, nome);
            v.put(MediaStore.Downloads.MIME_TYPE, mimeDe(nome));
            v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Vindex");
            v.put(MediaStore.Downloads.IS_PENDING, 1);
            ContentResolver cr = ctx.getContentResolver();
            Uri uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
            if (uri == null) throw new IOException("O Android não deixou criar o arquivo em Downloads.");
            try (OutputStream out = cr.openOutputStream(uri)) {
                if (out == null) throw new IOException("Não consegui gravar em Downloads.");
                out.write(dados);
            } catch (IOException e) { cr.delete(uri, null, null); throw e; }
            ContentValues pronto = new ContentValues();
            pronto.put(MediaStore.Downloads.IS_PENDING, 0);
            cr.update(uri, pronto, null, null);
            String final_ = nome;
            try (Cursor c = cr.query(uri, new String[]{MediaStore.Downloads.DISPLAY_NAME}, null, null, null)) {
                if (c != null && c.moveToFirst() && c.getString(0) != null) final_ = c.getString(0);
            } catch (Exception ignorado) { /* mostra o nome pedido */ }
            return "Downloads/Vindex/" + final_;
        }
        File pasta = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "Vindex");
        if (!pasta.isDirectory() && !pasta.mkdirs()) throw new IOException("Não consegui criar a pasta Downloads/Vindex. Libere o acesso a arquivos para o Vindex.");
        File alvo = new File(pasta, nome);
        int n = 1;
        while (alvo.exists()) {
            int p = nome.lastIndexOf('.');
            alvo = new File(pasta, (p < 0 ? nome : nome.substring(0, p)) + " (" + n++ + ")" + (p < 0 ? "" : nome.substring(p)));
        }
        try (FileOutputStream out = new FileOutputStream(alvo)) { out.write(dados); }
        return "Downloads/Vindex/" + alvo.getName();
    }

    /** Abre a folha de compartilhar do Android com o arquivo (WhatsApp, e-mail, Drive…). */
    static void compartilhar(Activity act, String nome, String mime, byte[] dados) throws IOException {
        File pasta = new File(act.getCacheDir(), "compartilhar");
        if (!pasta.isDirectory()) pasta.mkdirs();
        File[] velhos = pasta.listFiles();
        if (velhos != null) for (File f : velhos) f.delete();
        File f = new File(pasta, nome);
        try (FileOutputStream out = new FileOutputStream(f)) { out.write(dados); }
        Uri uri = androidx.core.content.FileProvider.getUriForFile(act, act.getPackageName() + ".fileprovider", f);
        Intent i = new Intent(Intent.ACTION_SEND);
        i.setType(mime == null || mime.isEmpty() ? mimeDe(nome) : mime);
        i.putExtra(Intent.EXTRA_STREAM, uri);
        i.putExtra(Intent.EXTRA_SUBJECT, nome);
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        act.startActivity(Intent.createChooser(i, "Compartilhar " + nome));
    }

    /** Imprime um PDF pelo serviço de impressão do Android (impressora, "Salvar como PDF"…). */
    static void imprimirPdf(final Activity act, final String nome, byte[] dados) throws IOException {
        File pasta = new File(act.getCacheDir(), "imprimir");
        if (!pasta.isDirectory()) pasta.mkdirs();
        final File f = new File(pasta, "impressao.pdf");
        try (FileOutputStream out = new FileOutputStream(f)) { out.write(dados); }
        act.runOnUiThread(new Runnable() {
            @Override public void run() {
                PrintManager pm = (PrintManager) act.getSystemService(Context.PRINT_SERVICE);
                if (pm == null) return;
                pm.print(nome, new PrintDocumentAdapter() {
                    @Override public void onLayout(PrintAttributes antigo, PrintAttributes novo, CancellationSignal cancelar, LayoutResultCallback cb, Bundle extras) {
                        if (cancelar.isCanceled()) { cb.onLayoutCancelled(); return; }
                        cb.onLayoutFinished(new PrintDocumentInfo.Builder(nome).setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT).setPageCount(PrintDocumentInfo.PAGE_COUNT_UNKNOWN).build(), true);
                    }
                    @Override public void onWrite(PageRange[] paginas, ParcelFileDescriptor destino, CancellationSignal cancelar, WriteResultCallback cb) {
                        try (InputStream in = new FileInputStream(f); OutputStream out = new FileOutputStream(destino.getFileDescriptor())) {
                            byte[] b = new byte[64 * 1024];
                            int n;
                            while ((n = in.read(b)) > 0) {
                                if (cancelar.isCanceled()) { cb.onWriteCancelled(); return; }
                                out.write(b, 0, n);
                            }
                            cb.onWriteFinished(new PageRange[]{PageRange.ALL_PAGES});
                        } catch (IOException e) {
                            cb.onWriteFailed(e.getMessage());
                        }
                    }
                }, new PrintAttributes.Builder().build());
            }
        });
    }

    /** Imprime uma página HTML (Word, Excel, PowerPoint e texto viram HTML antes). */
    static void imprimirHtml(final Activity act, final String nome, final String html) {
        act.runOnUiThread(new Runnable() {
            @Override public void run() {
                final WebView w = new WebView(act);
                paraImprimir = w;
                w.getSettings().setJavaScriptEnabled(false);
                w.setWebViewClient(new WebViewClient() {
                    @Override public void onPageFinished(WebView v, String url) {
                        PrintManager pm = (PrintManager) act.getSystemService(Context.PRINT_SERVICE);
                        if (pm != null) pm.print(nome, v.createPrintDocumentAdapter(nome), new PrintAttributes.Builder().build());
                    }
                });
                w.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
            }
        });
    }

    static String paraBase64(byte[] d) { return Base64.encodeToString(d, Base64.NO_WRAP); }
    static byte[] deBase64(String t) { return Base64.decode(t, Base64.DEFAULT); }
}
