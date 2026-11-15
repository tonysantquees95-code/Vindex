//! Formatos que dependem de bibliotecas de fora (RAR, BZ2 e XZ), isolados aqui para o resto do motor não depender delas.
use std::io::Read;
use std::path::{Path, PathBuf};

/// Descompacta BZ2 em fluxo.
pub fn bz2(base: Box<dyn Read>) -> Box<dyn Read> {
    Box::new(bzip2::read::BzDecoder::new(base))
}

/// Descompacta XZ em fluxo.
pub fn xz(base: Box<dyn Read>) -> Box<dyn Read> {
    Box::new(xz2::read::XzDecoder::new(base))
}

pub enum Evento<'a> {
    /// Chegou um item: devolva onde gravar (Some) ou None para pular
    Entrada { nome: &'a str, pasta: bool },
    /// O item acabou de ser gravado
    Pronto { tamanho: u64 },
}

fn abrir(origem: &Path, senha: &str) -> unrar::Archive<'static> {
    let p: PathBuf = origem.to_path_buf();
    if senha.is_empty() { unrar::Archive::new(&p) } else { unrar::Archive::with_password(&p, senha) }
}

/// (nome, tamanho, é pasta) de cada item do RAR.
pub fn rar_listar(origem: &Path, senha: &str) -> Result<Vec<(String, u64, bool)>, String> {
    let it = abrir(origem, senha).open_for_listing().map_err(|e| e.to_string())?;
    let mut v = Vec::new();
    for e in it {
        let e = e.map_err(|e| e.to_string())?;
        v.push((e.filename.to_string_lossy().to_string(), e.unpacked_size, e.is_directory()));
    }
    Ok(v)
}

pub fn rar_extrair(origem: &Path, senha: &str, cada: &mut dyn FnMut(Evento) -> Result<Option<PathBuf>, String>) -> Result<(), String> {
    let mut arq = abrir(origem, senha).open_for_processing().map_err(|e| e.to_string())?;
    while let Some(h) = arq.read_header().map_err(|e| e.to_string())? {
        let (nome, tamanho, pasta) = {
            let e = h.entry();
            (e.filename.to_string_lossy().to_string(), e.unpacked_size, e.is_directory())
        };
        arq = match cada(Evento::Entrada { nome: &nome, pasta })? {
            Some(alvo) => {
                let proximo = h.extract_to(&alvo).map_err(|e| e.to_string())?;
                cada(Evento::Pronto { tamanho })?;
                proximo
            }
            None => h.skip().map_err(|e| e.to_string())?,
        };
    }
    Ok(())
}
