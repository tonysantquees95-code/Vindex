package tech.vetorial.vindex;

import java.io.File;
import java.nio.file.Files;

/** Confere os testes de desempenho no computador: dão número e não deixam arquivo para trás. */
public class TestesTeste {
    static void ok(boolean c, String oque) { System.out.println((c ? "ok    " : "FALHOU ") + oque); if (!c) System.exit(1); }

    public static void main(String[] args) throws Exception {
        double um = Testes.processador(1, 200), dois = Testes.processador(2, 200);
        ok(um > 0 && dois > 0, "processador mede com 1 e com 2 núcleos");
        ok(Testes.memoria(200) > 0, "memória mede");
        File d = Files.createTempDirectory("teste").toFile();
        ok(Testes.gravacao(d, 8) > 0, "armazenamento mede");
        ok(d.listFiles().length == 0, "o arquivo de teste é apagado");
    }
}
