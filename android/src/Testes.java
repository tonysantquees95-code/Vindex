package tech.vetorial.vindex;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.util.Random;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Testes de desempenho curtos, feitos no próprio aparelho. Não usam nada do Android (dá para testar no computador).
 * Os números servem para comparar o MESMO aparelho em dias diferentes, não para comparar celulares.
 */
final class Testes {
    private Testes() { }

    private static final int BLOCO = 1 << 20;

    private static byte[] aleatorio(int n) { byte[] b = new byte[n]; new Random(1).nextBytes(b); return b; }

    /** Quantos MB por segundo o processador calcula (SHA-256) usando `fios` núcleos ao mesmo tempo. */
    static double processador(int fios, final long ms) throws Exception {
        final AtomicLong blocos = new AtomicLong();
        final byte[] dados = aleatorio(64 * 1024);
        final long inicio = System.nanoTime(), fim = inicio + ms * 1_000_000L;
        Thread[] t = new Thread[Math.max(1, fios)];
        for (int i = 0; i < t.length; i++) {
            t[i] = new Thread(new Runnable() {
                @Override public void run() {
                    try {
                        MessageDigest d = MessageDigest.getInstance("SHA-256");
                        do { d.update(dados); blocos.incrementAndGet(); } while (System.nanoTime() < fim);
                        d.digest();
                    } catch (Exception ignora) { }
                }
            }, "vindex-teste-" + i);
            t[i].start();
        }
        for (Thread x : t) x.join();
        return blocos.get() * (dados.length / 1048576.0) / ((System.nanoTime() - inicio) / 1e9);
    }

    /** GB por segundo copiando um bloco de memória de um lugar para outro. */
    static double memoria(long ms) {
        byte[] de = aleatorio(16 * BLOCO), para = new byte[de.length];
        long copias = 0, inicio = System.nanoTime(), fim = inicio + ms * 1_000_000L;
        do { System.arraycopy(de, 0, para, 0, de.length); copias++; } while (System.nanoTime() < fim);
        return copias * (double) de.length / 1073741824.0 / ((System.nanoTime() - inicio) / 1e9);
    }

    /**
     * MB por segundo gravando no armazenamento interno, esperando o aparelho confirmar que gravou. O arquivo de teste é apagado no fim.
     * A leitura não é medida: o Android guarda o arquivo na memória e o número sairia irreal.
     */
    static double gravacao(File pasta, int megas) throws IOException {
        byte[] bloco = aleatorio(BLOCO);
        File f = File.createTempFile("vindex-teste", ".tmp", pasta);
        try {
            long inicio = System.nanoTime();
            try (FileOutputStream out = new FileOutputStream(f)) {
                for (int i = 0; i < megas; i++) out.write(bloco);
                out.getFD().sync();
            }
            return megas / ((System.nanoTime() - inicio) / 1e9);
        } finally {
            f.delete();
        }
    }
}
