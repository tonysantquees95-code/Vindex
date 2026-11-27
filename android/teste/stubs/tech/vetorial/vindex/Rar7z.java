package tech.vetorial.vindex;

import net.sf.sevenzipjbinding.simple.ISimpleInArchiveItem;
import java.io.File;

/** Substituto só para o teste no computador: o RAR de verdade usa uma biblioteca nativa do Android. */
final class Rar7z {
    interface Item { void item(String nome, boolean pasta, long tamanho, ISimpleInArchiveItem it) throws Exception; }
    static void percorrer(File f, String senha, Item i) throws Exception { throw new UnsupportedOperationException(); }
    static long extrair(ISimpleInArchiveItem it, File alvo, String senha) throws Exception { throw new UnsupportedOperationException(); }
}
