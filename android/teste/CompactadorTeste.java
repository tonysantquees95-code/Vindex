package tech.vetorial.vindex;

import org.json.JSONObject;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Random;

/** Testa compactar e extrair (com e sem senha) no computador. Se algo falhar, sai com erro. */
public class CompactadorTeste {
    static int falhas = 0;

    static void ok(boolean c, String oque) { System.out.println((c ? "ok    " : "FALHOU ") + oque); if (!c) falhas++; }

    static String erroDe(Callable c) { try { c.run(); return ""; } catch (Exception e) { return String.valueOf(e.getMessage()); } }
    interface Callable { void run() throws Exception; }

    static int contar(File d) { if (d.isFile()) return 1; int n = 0; File[] fs = d.listFiles(); if (fs != null) for (File f : fs) n += contar(f); return n; }

    public static void main(String[] args) throws Exception {
        File base = Files.createTempDirectory("compactar").toFile();
        File origem = new File(base, "Fotos da loja");
        new File(origem, "sub").mkdirs();
        byte[] texto = "conteúdo secreto com acentuação\n".getBytes(StandardCharsets.UTF_8);
        byte[] bruto = new byte[3_000_000]; new Random(7).nextBytes(bruto);
        Files.write(new File(origem, "anotação.txt").toPath(), texto);
        Files.write(new File(origem, "sub/dados.bin").toPath(), bruto);
        Files.write(new File(origem, "sub/vazio.txt").toPath(), new byte[0]);
        final String senha = "Segredo 123 ção";

        for (final String fmt : new String[]{"zip", "7z"}) {
            JSONObject r = Compactador.compactar(Collections.singletonList(origem), new File(base, "com-senha." + fmt), fmt, senha);
            final File arq = new File(r.getString("destino"));
            ok(r.getInt("arquivos") == 3 && arq.length() > 0, fmt + ": cria com senha");
            ok(Compactador.listar(arq, senha).getLong("itens") == 3, fmt + ": lista o conteúdo");
            if (fmt.equals("zip")) ok(Compactador.listar(arq, "").getBoolean("protegido"), "zip: avisa que tem senha antes de extrair");

            final File certo = new File(base, "certo-" + fmt);
            Compactador.extrair(arq, certo, senha);
            ok(Arrays.equals(Files.readAllBytes(new File(certo, "Fotos da loja/anotação.txt").toPath()), texto)
                    && Arrays.equals(Files.readAllBytes(new File(certo, "Fotos da loja/sub/dados.bin").toPath()), bruto)
                    && new File(certo, "Fotos da loja/sub/vazio.txt").length() == 0, fmt + ": volta igual com a senha certa");

            final File semSenha = new File(base, "sem-" + fmt);
            String e = erroDe(() -> Compactador.extrair(arq, semSenha, ""));
            ok(e.toLowerCase().contains("senha") && contar(semSenha) == 0, fmt + ": sem senha pede a senha e não deixa arquivo (" + e + ")");
            final File errada = new File(base, "errada-" + fmt);
            e = erroDe(() -> Compactador.extrair(arq, errada, "outra"));
            ok(e.toLowerCase().contains("senha") && contar(errada) == 0, fmt + ": senha errada avisa e não deixa arquivo (" + e + ")");

            // o 7-Zip (programa de fora) abre o que o Vindex criou, e só com a senha
            if (new File("/usr/bin/7z").exists()) {
                int certa = new ProcessBuilder("7z", "t", "-p" + senha, arq.getPath()).inheritIO().redirectOutput(ProcessBuilder.Redirect.DISCARD).start().waitFor();
                int outra = new ProcessBuilder("7z", "t", "-poutra", arq.getPath()).redirectErrorStream(true).redirectOutput(ProcessBuilder.Redirect.DISCARD).start().waitFor();
                ok(certa == 0 && outra != 0, fmt + ": o 7-Zip confere o arquivo criado pelo Vindex");
                File de7 = new File(base, "do7zip-aes." + fmt);
                // o 7-Zip não cria ZIP com senha acentuada: neste caminho a senha vai sem acento
                final String s7 = fmt.equals("zip") ? "Segredo 123" : senha;
                ProcessBuilder pb = fmt.equals("zip")
                        ? new ProcessBuilder("7z", "a", "-tzip", "-mem=AES256", "-p" + s7, de7.getPath(), origem.getPath())
                        : new ProcessBuilder("7z", "a", "-mhe=on", "-p" + senha, de7.getPath(), origem.getPath());
                ok(pb.redirectOutput(ProcessBuilder.Redirect.DISCARD).start().waitFor() == 0, fmt + ": 7-Zip cria arquivo com senha");
                File dest = new File(base, "de7-" + fmt);
                String er = erroDe(() -> Compactador.extrair(de7, dest, s7));
                ok(er.isEmpty() && contar(dest) == 3, fmt + ": o Vindex abre o arquivo do 7-Zip " + er);
                if (fmt.equals("zip")) {
                    File velho = new File(base, "do7zip-antigo.zip");
                    new ProcessBuilder("7z", "a", "-tzip", "-mem=ZipCrypto", "-p" + senha.replace("ção", ""), velho.getPath(), origem.getPath()).redirectOutput(ProcessBuilder.Redirect.DISCARD).start().waitFor();
                    File dv = new File(base, "velho");
                    String ev = erroDe(() -> Compactador.extrair(velho, dv, senha.replace("ção", "")));
                    ok(ev.isEmpty() && Arrays.equals(Files.readAllBytes(new File(dv, "Fotos da loja/sub/dados.bin").toPath()), bruto), "zip: abre o tipo antigo de senha (ZipCrypto) " + ev);
                    File dv2 = new File(base, "velho-errada");
                    String ev2 = erroDe(() -> Compactador.extrair(velho, dv2, "errada"));
                    ok(ev2.toLowerCase().contains("senha") && contar(dv2) == 0, "zip antigo: senha errada avisa (" + ev2 + ")");
                }
            }

            // só os marcados
            File parte = new File(base, "parte-" + fmt);
            Compactador.extrair(arq, parte, senha, new HashSet<String>(Collections.singletonList("Fotos da loja/anotação.txt")));
            ok(contar(parte) == 1, fmt + ": extrai só o que foi marcado");
        }

        // sem senha continua como antes
        for (String fmt : new String[]{"zip", "7z", "tgz"}) {
            JSONObject r = Compactador.compactar(Collections.singletonList(origem), new File(base, "livre." + (fmt.equals("tgz") ? "tar.gz" : fmt)), fmt, "");
            File d = new File(base, "livre-" + fmt);
            Compactador.extrair(new File(r.getString("destino")), d, "");
            ok(contar(d) == 3, fmt + ": sem senha cria e extrai");
        }
        ok(erroDe(() -> Compactador.compactar(Collections.singletonList(origem), new File(base, "x.tar.gz"), "tgz", "abc")).contains("não tem senha"), "tgz: recusa senha");
        ok(erroDe(() -> Compactador.compactar(Collections.singletonList(origem), new File(base, "x.rar"), "rar", "")).contains("não suportado"), "não cria .rar");

        // espaço livre
        ok(!erroDe(() -> Compactador.conferirEspaco(5L << 30, 1L << 30)).isEmpty(), "espaço: recusa o que não cabe");
        ok(erroDe(() -> Compactador.conferirEspaco(5L << 30, 1L << 30)).contains("5,0 GB"), "espaço: diz quanto precisa");
        ok(erroDe(() -> Compactador.conferirEspaco(100, 1L << 30)).isEmpty(), "espaço: aceita o que cabe");
        ok(!erroDe(() -> Compactador.conferirEspaco(1L << 30, (1L << 30) + 1000)).isEmpty(), "espaço: guarda uma folga");
        ok(erroDe(() -> Compactador.conferirEspaco(0, 0)).isEmpty(), "espaço: tamanho desconhecido não bloqueia");

        System.out.println(falhas == 0 ? "Compactador: tudo certo" : "Compactador: " + falhas + " falha(s)");
        System.exit(falhas == 0 ? 0 : 1);
    }
}
