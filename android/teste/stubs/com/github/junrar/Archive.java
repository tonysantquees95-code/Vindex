package com.github.junrar;

import com.github.junrar.rarfile.FileHeader;
import java.io.File;
import java.io.OutputStream;
import java.util.List;

/** Substituto só para o teste no computador. */
public class Archive implements AutoCloseable {
    public Archive(File f) { throw new UnsupportedOperationException(); }
    public Archive(File f, String senha) { throw new UnsupportedOperationException(); }
    public List<FileHeader> getFileHeaders() { return null; }
    public void extractFile(FileHeader h, OutputStream out) { }
    @Override public void close() { }
}
