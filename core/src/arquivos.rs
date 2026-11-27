//! Pastas conhecidas do usuário, descompactação (ZIP, 7z, RAR, TAR, TAR.GZ/BZ2/XZ, GZ, BZ2, XZ; com senha, itens marcados, andamento e cancelar) e compactação (ZIP, 7z, TAR.GZ).
//! Segurança: nenhum item sai da pasta de destino (caminhos com ".." ou absolutos são pulados),
//! nada é sobrescrito (nome repetido ganha " (1)"), e há limites contra "bombas de compactação".
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs::{self, File};
use std::io::{self, BufReader, Read, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;

pub const LIMITE_ITENS: usize = 200_000;
pub const LIMITE_BYTES: u64 = 40 * 1024 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PastaConhecida {
    pub id: String,
    pub rotulo: String,
    pub caminho: PathBuf,
}

/// Downloads, Documentos, Imagens… do usuário (só as que existem).
pub fn pastas_conhecidas() -> Vec<PastaConhecida> {
    let base = std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).filter(|v| !v.is_empty()).map(PathBuf::from);
    let Some(base) = base else { return Vec::new() };
    let lista = [
        ("downloads", "Downloads", "Downloads"),
        ("documentos", "Documentos", "Documents"),
        ("imagens", "Imagens", "Pictures"),
        ("videos", "Vídeos", "Videos"),
        ("musicas", "Músicas", "Music"),
        ("desktop", "Área de trabalho", "Desktop"),
    ];
    lista.iter().map(|(id, rotulo, pasta)| PastaConhecida { id: (*id).into(), rotulo: (*rotulo).into(), caminho: base.join(pasta) }).filter(|p| p.caminho.is_dir()).collect()
}

const MSG_FORMATOS: &str = "Formato não suportado. Funciona com ZIP, 7z, RAR, TAR, TAR.GZ, TAR.BZ2, TAR.XZ, GZ, BZ2 e XZ.";
const LIMITE_LISTA: usize = 2000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Formato {
    Zip,
    SevenZ,
    Rar,
    Tar,
    TarGz,
    TarBz2,
    TarXz,
    Gz,
    Bz2,
    Xz,
}

impl Formato {
    pub fn nome(self) -> &'static str {
        match self {
            Formato::Zip => "zip",
            Formato::SevenZ => "7z",
            Formato::Rar => "rar",
            Formato::Tar => "tar",
            Formato::TarGz => "tgz",
            Formato::TarBz2 => "tbz2",
            Formato::TarXz => "txz",
            Formato::Gz => "gz",
            Formato::Bz2 => "bz2",
            Formato::Xz => "xz",
        }
    }
    fn so_um_arquivo(self) -> bool {
        matches!(self, Formato::Gz | Formato::Bz2 | Formato::Xz)
    }
    fn eh_tar(self) -> bool {
        matches!(self, Formato::Tar | Formato::TarGz | Formato::TarBz2 | Formato::TarXz)
    }
    /// Formatos em que dá para saber o tamanho de cada item sem descompactar tudo (o andamento conta bytes extraídos).
    fn tamanhos_conhecidos(self) -> bool {
        matches!(self, Formato::Zip | Formato::SevenZ | Formato::Rar)
    }
}

/// Lê o começo do arquivo e diz se é ZIP, 7z ou RAR de verdade (o nome pode estar errado, como um .rar renomeado para .zip).
fn formato_pelo_conteudo(caminho: &Path) -> Option<Formato> {
    let mut b = [0u8; 8];
    let n = File::open(caminho).ok()?.read(&mut b).ok()?;
    let b = &b[..n];
    if b.starts_with(b"PK\x03\x04") || b.starts_with(b"PK\x05\x06") {
        Some(Formato::Zip)
    } else if b.starts_with(&[0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C]) {
        Some(Formato::SevenZ)
    } else if b.starts_with(b"Rar!\x1A\x07") {
        Some(Formato::Rar)
    } else {
        None
    }
}

pub fn formato_de(caminho: &Path) -> Option<Formato> {
    let pelo_nome = formato_pelo_nome(caminho);
    // ZIP, 7z e RAR: vale o que o arquivo realmente é, mesmo que a extensão esteja trocada
    if matches!(pelo_nome, Some(Formato::Zip) | Some(Formato::SevenZ) | Some(Formato::Rar)) {
        if let Some(real) = formato_pelo_conteudo(caminho) {
            return Some(real);
        }
    }
    pelo_nome
}

fn formato_pelo_nome(caminho: &Path) -> Option<Formato> {
    let n = caminho.file_name()?.to_string_lossy().to_lowercase();
    let fim = |e: &[&str]| e.iter().any(|x| n.ends_with(x));
    if fim(&[".tar.gz", ".tgz"]) {
        Some(Formato::TarGz)
    } else if fim(&[".tar.bz2", ".tbz2", ".tbz"]) {
        Some(Formato::TarBz2)
    } else if fim(&[".tar.xz", ".txz"]) {
        Some(Formato::TarXz)
    } else if fim(&[".zip", ".jar", ".cbz", ".apk"]) {
        Some(Formato::Zip)
    } else if fim(&[".7z"]) {
        Some(Formato::SevenZ)
    } else if fim(&[".rar", ".cbr"]) {
        Some(Formato::Rar)
    } else if fim(&[".tar"]) {
        Some(Formato::Tar)
    } else if fim(&[".gz"]) {
        Some(Formato::Gz)
    } else if fim(&[".bz2"]) {
        Some(Formato::Bz2)
    } else if fim(&[".xz"]) {
        Some(Formato::Xz)
    } else {
        None
    }
}

/// Nome da pasta sugerida para extrair: o nome do arquivo sem a extensão de compactação.
pub fn pasta_sugerida(origem: &Path) -> PathBuf {
    let nome = origem.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| "extraido".into());
    let baixo = nome.to_lowercase();
    let corte = [".tar.gz", ".tar.bz2", ".tar.xz", ".tgz", ".tbz2", ".tbz", ".txz", ".zip", ".jar", ".cbz", ".cbr", ".apk", ".7z", ".rar", ".tar", ".gz", ".bz2", ".xz"]
        .iter()
        .find(|e| baixo.ends_with(*e))
        .map(|e| nome.len() - e.len())
        .unwrap_or(nome.len());
    let limpo = nome[..corte].trim().to_string();
    let limpo = if limpo.is_empty() { "extraido".to_string() } else { limpo };
    origem.parent().unwrap_or_else(|| Path::new(".")).join(limpo)
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct Conteudo {
    pub itens: usize,
    pub bytes: u64,
    pub nomes: Vec<String>,
    /// tamanho de cada nome da lista (mesma ordem)
    pub tamanhos: Vec<u64>,
    pub formato: String,
    /// ZIP com senha: a tela pede a senha antes de extrair
    pub protegido: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct ResultadoExtracao {
    pub destino: PathBuf,
    pub arquivos: usize,
    pub bytes: u64,
    pub pulados: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct ResultadoCompactacao {
    pub destino: PathBuf,
    pub arquivos: usize,
    pub bytes: u64,
}

// ---------------------------------------------------------------- andamento e cancelamento
static CANCELAR: AtomicBool = AtomicBool::new(false);
static FEITOS: AtomicU64 = AtomicU64::new(0);
static TOTAL: AtomicU64 = AtomicU64::new(0);
static ANDAMENTO: Mutex<(String, String)> = Mutex::new((String::new(), String::new()));

#[derive(Debug, Clone, Serialize, Default, PartialEq)]
pub struct Progresso {
    pub fase: String,
    pub atual: String,
    pub feitos: u64,
    pub total: u64,
}

pub fn progresso() -> Progresso {
    let a = ANDAMENTO.lock().map(|g| g.clone()).unwrap_or_default();
    Progresso { fase: a.0, atual: a.1, feitos: FEITOS.load(Ordering::Relaxed), total: TOTAL.load(Ordering::Relaxed) }
}

pub fn cancelar() {
    CANCELAR.store(true, Ordering::SeqCst);
}

fn cancelado() -> bool {
    CANCELAR.load(Ordering::SeqCst)
}

fn iniciar(fase: &str, atual: &str, total: u64) {
    CANCELAR.store(false, Ordering::SeqCst);
    FEITOS.store(0, Ordering::Relaxed);
    TOTAL.store(total, Ordering::Relaxed);
    if let Ok(mut g) = ANDAMENTO.lock() {
        *g = (fase.to_string(), atual.to_string());
    }
}

fn marcar_atual(nome: &str) {
    if let Ok(mut g) = ANDAMENTO.lock() {
        g.1 = nome.to_string();
    }
}

fn encerrar() {
    if let Ok(mut g) = ANDAMENTO.lock() {
        g.0.clear();
    }
}

/// Conta os bytes lidos do arquivo compactado (andamento dos formatos em que o tamanho de dentro não é conhecido).
struct Conta<R>(R);
impl<R: Read> Read for Conta<R> {
    fn read(&mut self, b: &mut [u8]) -> io::Result<usize> {
        if cancelado() {
            return Err(io::Error::new(io::ErrorKind::Other, "Cancelado."));
        }
        let n = self.0.read(b)?;
        FEITOS.fetch_add(n as u64, Ordering::Relaxed);
        Ok(n)
    }
}

/// Caminho relativo seguro: sem raiz, sem "..", sem letra de unidade.
fn seguro(nome: &str) -> Option<PathBuf> {
    let p = PathBuf::from(nome.replace('\\', "/"));
    let mut saida = PathBuf::new();
    for c in p.components() {
        match c {
            Component::Normal(x) => saida.push(x),
            Component::CurDir => {}
            _ => return None,
        }
    }
    if saida.as_os_str().is_empty() {
        None
    } else {
        Some(saida)
    }
}

fn livre(alvo: PathBuf) -> PathBuf {
    if !alvo.exists() {
        return alvo;
    }
    let pasta = alvo.parent().map(Path::to_path_buf).unwrap_or_default();
    let nome = alvo.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
    let ext = alvo.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
    (1..10_000).map(|n| pasta.join(format!("{nome} ({n}){ext}"))).find(|p| !p.exists()).unwrap_or(alvo)
}

/// Folga que precisa sobrar no disco além do tamanho dos arquivos.
const FOLGA: u64 = 20 << 20;

fn tamanho_legivel(b: u64) -> String {
    if b >= 1 << 30 {
        format!("{:.1} GB", b as f64 / (1u64 << 30) as f64).replace('.', ",")
    } else {
        format!("{} MB", ((b + (1 << 19)) >> 20).max(1))
    }
}

/// Falha ANTES de gravar quando o que vai ser criado não cabe. `precisa == 0` quer dizer "tamanho desconhecido".
fn conferir_espaco(precisa: u64, livres: u64) -> Result<(), String> {
    if precisa > 0 && precisa > livres.saturating_sub(FOLGA) {
        return Err(format!("Falta espaço no disco: precisa de {} e há {} livres. Libere espaço ou escolha outro destino.", tamanho_legivel(precisa), tamanho_legivel(livres)));
    }
    Ok(())
}

/// Espaço livre no disco onde `caminho` vai ficar. `None` quando não dá para saber (pasta de rede, por exemplo): aí não bloqueia.
fn espaco_livre(caminho: &Path) -> Option<u64> {
    let alvo = std::path::absolute(caminho).ok()?;
    sysinfo::Disks::new_with_refreshed_list()
        .list()
        .iter()
        .filter(|d| alvo.starts_with(d.mount_point()))
        .max_by_key(|d| d.mount_point().as_os_str().len())
        .map(|d| d.available_space())
}

/// Mensagem amigável quando o problema é senha (faltando ou errada).
fn trata_senha(m: String, senha: &str) -> String {
    let b = m.to_lowercase();
    if b.contains("password") || b.contains("encrypted") || b.contains("senha") {
        if senha.is_empty() {
            "O arquivo tem senha. Informe a senha e tente de novo.".into()
        } else {
            "Senha incorreta. Confira e tente de novo.".into()
        }
    } else {
        m
    }
}

fn explicar(e: impl std::fmt::Display, senha: &str) -> String {
    let t = e.to_string();
    if t.contains("Cancelado") {
        return "Cancelado.".into();
    }
    let baixo = t.to_lowercase();
    if baixo.contains("eocd") || baixo.contains("invalid zip archive") || baixo.contains("end of central directory") {
        return "Esse ZIP está incompleto ou corrompido (o final dele não foi encontrado). Se veio da internet, o download pode ter parado no meio: baixe de novo e tente outra vez.".into();
    }
    trata_senha(format!("Não consegui ler o arquivo compactado: {t}"), senha)
}

fn senha_7z(senha: &str) -> sevenz_rust::Password {
    if senha.is_empty() {
        sevenz_rust::Password::empty()
    } else {
        sevenz_rust::Password::from(senha)
    }
}

/// Abre o arquivo como fluxo já descompactado (tar, gz, bz2, xz). Com `contar`, o andamento anda com os bytes lidos.
fn fluxo(origem: &Path, f: Formato, contar: bool) -> Result<Box<dyn Read>, String> {
    let arq = File::open(origem).map_err(|e| e.to_string())?;
    let leitor = BufReader::with_capacity(256 * 1024, arq);
    let base: Box<dyn Read> = if contar { Box::new(Conta(leitor)) } else { Box::new(leitor) };
    Ok(match f {
        Formato::TarGz | Formato::Gz => Box::new(flate2::read::GzDecoder::new(base)),
        Formato::TarBz2 | Formato::Bz2 => crate::extras::bz2(base),
        Formato::TarXz | Formato::Xz => crate::extras::xz(base),
        _ => base,
    })
}

/// (nome, tamanho, é pasta) de cada item do arquivo.
fn itens(origem: &Path, f: Formato, senha: &str) -> Result<Vec<(String, u64, bool)>, String> {
    let mut v = Vec::new();
    match f {
        Formato::Zip => {
            let mut z = zip::ZipArchive::new(File::open(origem).map_err(|e| e.to_string())?).map_err(|e| explicar(e, senha))?;
            for i in 0..z.len() {
                let e = z.by_index_raw(i).map_err(|e| explicar(e, senha))?;
                v.push((e.name().to_string(), e.size(), e.is_dir()));
            }
        }
        Formato::SevenZ => {
            let ar = sevenz_rust::Archive::open_with_password(origem, &senha_7z(senha)).map_err(|e| explicar(e, senha))?;
            for e in &ar.files {
                v.push((e.name().to_string(), e.size, e.is_directory));
            }
        }
        Formato::Rar => v = crate::extras::rar_listar(origem, senha).map_err(|e| explicar(e, senha))?,
        Formato::Tar | Formato::TarGz | Formato::TarBz2 | Formato::TarXz => {
            let mut t = tar::Archive::new(fluxo(origem, f, false)?);
            for e in t.entries().map_err(|e| explicar(e, senha))? {
                let e = e.map_err(|e| explicar(e, senha))?;
                let tipo = e.header().entry_type();
                if !(tipo.is_dir() || tipo.is_file()) {
                    continue;
                }
                v.push((e.path().map(|p| p.to_string_lossy().to_string()).unwrap_or_default(), e.size(), tipo.is_dir()));
            }
        }
        Formato::Gz | Formato::Bz2 | Formato::Xz => {
            v.push((pasta_sugerida(origem).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(), 0, false));
        }
    }
    Ok(v)
}

pub fn listar(origem: &Path, senha: &str) -> Result<Conteudo, String> {
    let f = formato_de(origem).ok_or(MSG_FORMATOS)?;
    let mut c = Conteudo { formato: f.nome().into(), ..Default::default() };
    if matches!(f, Formato::Zip) {
        let mut z = zip::ZipArchive::new(File::open(origem).map_err(|e| e.to_string())?).map_err(|e| explicar(e, senha))?;
        for i in 0..z.len() {
            if z.by_index_raw(i).map_err(|e| explicar(e, senha))?.encrypted() {
                c.protegido = true;
                break;
            }
        }
    }
    let lidos = itens(origem, f, senha).map_err(|m| if matches!(f, Formato::SevenZ) && !senha.is_empty() { "Não consegui abrir: confira a senha (ou o arquivo está estragado).".into() } else { m })?;
    for (nome, tam, pasta) in lidos {
        if pasta {
            continue;
        }
        c.itens += 1;
        c.bytes += tam;
        if c.nomes.len() < LIMITE_LISTA {
            c.nomes.push(nome);
            c.tamanhos.push(tam);
        }
    }
    Ok(c)
}

struct Contador {
    arquivos: usize,
    bytes: u64,
}

/// Copia com andamento e cancelamento. `somar`: conta os bytes gravados no andamento (quando o total é a soma dos itens).
fn gravar(destino: &Path, relativo: &Path, leitor: &mut dyn Read, r: &mut ResultadoExtracao, c: &mut Contador, somar: bool) -> Result<(), String> {
    if c.arquivos >= LIMITE_ITENS {
        return Err("Arquivo com itens demais; parei por segurança.".into());
    }
    let alvo = livre(destino.join(relativo));
    if let Some(pai) = alvo.parent() {
        fs::create_dir_all(pai).map_err(|e| e.to_string())?;
    }
    marcar_atual(&relativo.to_string_lossy());
    let mut f = File::create(&alvo).map_err(|e| format!("{}: {e}", alvo.display()))?;
    let restante = LIMITE_BYTES.saturating_sub(c.bytes);
    let mut buf = vec![0u8; 256 * 1024];
    let mut gravados: u64 = 0;
    let falhar = |f: File, alvo: &Path, msg: String| -> Result<(), String> {
        drop(f);
        let _ = fs::remove_file(alvo);
        Err(msg)
    };
    loop {
        if cancelado() {
            return falhar(f, &alvo, "Cancelado.".into());
        }
        let n = match leitor.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => n,
            Err(e) => return falhar(f, &alvo, e.to_string()),
        };
        gravados += n as u64;
        if gravados > restante {
            return falhar(f, &alvo, "O conteúdo é grande demais (mais de 40 GB); parei por segurança.".into());
        }
        if let Err(e) = f.write_all(&buf[..n]) {
            return falhar(f, &alvo, format!("{}: {e}", alvo.display()));
        }
        if somar {
            FEITOS.fetch_add(n as u64, Ordering::Relaxed);
        }
    }
    c.arquivos += 1;
    c.bytes += gravados;
    r.arquivos = c.arquivos;
    r.bytes = c.bytes;
    Ok(())
}

/// Lê e joga fora o que sobrou de um item (num 7z sólido o próximo item depende de ter lido este).
fn descartar(leitor: &mut dyn Read) -> io::Result<()> {
    let mut buf = vec![0u8; 256 * 1024];
    loop {
        if cancelado() {
            return Err(io::Error::new(io::ErrorKind::Other, "Cancelado."));
        }
        if leitor.read(&mut buf)? == 0 {
            return Ok(());
        }
    }
}

pub fn extrair(origem: &Path, destino: &Path, senha: &str, so: Option<&HashSet<String>>) -> Result<ResultadoExtracao, String> {
    if !origem.is_file() {
        return Err("Escolha um arquivo compactado que exista.".into());
    }
    let f = formato_de(origem).ok_or(MSG_FORMATOS)?;
    if destino.parent().is_none() {
        return Err("Escolha uma pasta de destino, não a raiz do disco.".into());
    }
    let quer = |nome: &str| so.map_or(true, |s| s.contains(nome));
    let total = if f.tamanhos_conhecidos() {
        itens(origem, f, senha)?.iter().filter(|(n, _, p)| !*p && quer(n)).map(|(_, t, _)| *t).sum()
    } else {
        fs::metadata(origem).map(|m| m.len()).unwrap_or(0)
    };
    if let Some(l) = espaco_livre(destino) {
        conferir_espaco(total, l)?;
    }
    fs::create_dir_all(destino).map_err(|e| format!("Não consegui criar a pasta de destino: {e}"))?;
    iniciar("extraindo", &origem.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(), total);
    let r = extrair_dentro(origem, destino, senha, f, &quer);
    encerrar();
    r.map_err(|m| {
        // no 7z não há como distinguir senha errada de arquivo estragado: o erro aparece como dado corrompido
        if matches!(f, Formato::SevenZ) && !senha.is_empty() && m != "Cancelado." {
            "Não consegui abrir: confira a senha (ou o arquivo está estragado).".into()
        } else {
            trata_senha(m, senha)
        }
    })
}

fn extrair_dentro(origem: &Path, destino: &Path, senha: &str, f: Formato, quer: &dyn Fn(&str) -> bool) -> Result<ResultadoExtracao, String> {
    let mut r = ResultadoExtracao { destino: destino.to_path_buf(), ..Default::default() };
    let mut c = Contador { arquivos: 0, bytes: 0 };
    match f {
        Formato::Zip => {
            let mut z = zip::ZipArchive::new(File::open(origem).map_err(|e| e.to_string())?).map_err(|e| explicar(e, senha))?;
            for i in 0..z.len() {
                if cancelado() {
                    return Err("Cancelado.".into());
                }
                let (nome, pasta) = {
                    let e = z.by_index_raw(i).map_err(|e| explicar(e, senha))?;
                    (e.name().to_string(), e.is_dir())
                };
                let Some(rel) = seguro(&nome) else {
                    r.pulados.push(format!("{nome} (caminho inseguro)"));
                    continue;
                };
                if pasta {
                    fs::create_dir_all(destino.join(&rel)).map_err(|e| e.to_string())?;
                    continue;
                }
                if !quer(&nome) {
                    continue;
                }
                let mut e = if senha.is_empty() { z.by_index(i) } else { z.by_index_decrypt(i, senha.as_bytes()) }.map_err(|e| explicar(e, senha))?;
                gravar(destino, &rel, &mut e, &mut r, &mut c, true)?;
            }
        }
        Formato::SevenZ => {
            let mut sz = sevenz_rust::SevenZReader::open(origem, senha_7z(senha)).map_err(|e| explicar(e, senha))?;
            let mut falha: Option<String> = None;
            let res = sz.for_each_entries(|ent, leitor| {
                if cancelado() {
                    return Err(sevenz_rust::Error::other("Cancelado."));
                }
                let nome = ent.name().to_string();
                let Some(rel) = seguro(&nome) else {
                    r.pulados.push(format!("{nome} (caminho inseguro)"));
                    descartar(leitor).map_err(sevenz_rust::Error::io)?;
                    return Ok(true);
                };
                if ent.is_directory {
                    fs::create_dir_all(destino.join(&rel)).map_err(sevenz_rust::Error::io)?;
                    return Ok(true);
                }
                if !quer(&nome) {
                    descartar(leitor).map_err(sevenz_rust::Error::io)?;
                    return Ok(true);
                }
                match gravar(destino, &rel, leitor, &mut r, &mut c, true) {
                    Ok(()) => Ok(true),
                    Err(m) => {
                        falha = Some(m.clone());
                        Err(sevenz_rust::Error::other(m))
                    }
                }
            });
            if let Some(m) = falha {
                return Err(m);
            }
            res.map_err(|e| explicar(e, senha))?;
        }
        Formato::Rar => {
            use crate::extras::Evento;
            crate::extras::rar_extrair(origem, senha, &mut |ev| match ev {
                Evento::Entrada { nome, pasta } => {
                    if cancelado() {
                        return Err("Cancelado.".into());
                    }
                    let Some(rel) = seguro(nome) else {
                        r.pulados.push(format!("{nome} (caminho inseguro)"));
                        return Ok(None);
                    };
                    if pasta {
                        fs::create_dir_all(destino.join(&rel)).map_err(|e| e.to_string())?;
                        return Ok(None);
                    }
                    if !quer(nome) {
                        return Ok(None);
                    }
                    if c.arquivos >= LIMITE_ITENS {
                        return Err("Arquivo com itens demais; parei por segurança.".into());
                    }
                    let alvo = livre(destino.join(&rel));
                    if let Some(pai) = alvo.parent() {
                        fs::create_dir_all(pai).map_err(|e| e.to_string())?;
                    }
                    marcar_atual(&rel.to_string_lossy());
                    Ok(Some(alvo))
                }
                Evento::Pronto { tamanho } => {
                    c.arquivos += 1;
                    c.bytes += tamanho;
                    r.arquivos = c.arquivos;
                    r.bytes = c.bytes;
                    FEITOS.fetch_add(tamanho, Ordering::Relaxed);
                    Ok(None)
                }
            })
            .map_err(|e| explicar(e, senha))?;
        }
        Formato::Tar | Formato::TarGz | Formato::TarBz2 | Formato::TarXz => {
            let mut t = tar::Archive::new(fluxo(origem, f, true)?);
            for e in t.entries().map_err(|e| explicar(e, senha))? {
                let mut e = e.map_err(|e| explicar(e, senha))?;
                let tipo = e.header().entry_type();
                let nome = e.path().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
                let Some(rel) = seguro(&nome) else {
                    r.pulados.push(format!("{nome} (caminho inseguro)"));
                    continue;
                };
                if tipo.is_dir() {
                    fs::create_dir_all(destino.join(&rel)).map_err(|e| e.to_string())?;
                } else if tipo.is_file() {
                    if quer(&nome) {
                        gravar(destino, &rel, &mut e, &mut r, &mut c, false)?;
                    }
                } else {
                    r.pulados.push(format!("{nome} (atalho ou item especial)"));
                }
            }
        }
        Formato::Gz | Formato::Bz2 | Formato::Xz => {
            debug_assert!(f.so_um_arquivo());
            let nome = pasta_sugerida(origem).file_name().map(PathBuf::from).unwrap_or_else(|| PathBuf::from("extraido"));
            let mut d = fluxo(origem, f, true)?;
            gravar(destino, &nome, &mut d, &mut r, &mut c, false).map_err(|e| trata_senha(e, senha))?;
        }
    }
    let _ = f.eh_tar();
    Ok(r)
}

// ---------------------------------------------------------------- compactar
struct Entrada {
    caminho: PathBuf,
    nome: String,
    pasta: bool,
    tamanho: u64,
}

fn juntar(origens: &[PathBuf]) -> Result<Vec<Entrada>, String> {
    let mut v = Vec::new();
    for o in origens {
        let base = o.file_name().map(|n| n.to_string_lossy().to_string()).ok_or("Escolha arquivos ou pastas para compactar.")?;
        if o.is_dir() {
            for e in walkdir::WalkDir::new(o).follow_links(false).into_iter().filter_map(Result::ok) {
                let rel = e.path().strip_prefix(o).unwrap_or(e.path());
                let nome = if rel.as_os_str().is_empty() { base.clone() } else { format!("{}/{}", base, rel.to_string_lossy().replace('\\', "/")) };
                let pasta = e.file_type().is_dir();
                if !pasta && !e.file_type().is_file() {
                    continue;
                }
                let tamanho = if pasta { 0 } else { e.metadata().map(|m| m.len()).unwrap_or(0) };
                v.push(Entrada { caminho: e.path().to_path_buf(), nome, pasta, tamanho });
            }
        } else if o.is_file() {
            v.push(Entrada { caminho: o.clone(), nome: base, pasta: false, tamanho: fs::metadata(o).map(|m| m.len()).unwrap_or(0) });
        }
        if v.len() > LIMITE_ITENS {
            return Err("Itens demais para compactar de uma vez.".into());
        }
    }
    if v.is_empty() {
        return Err("Não há nada para compactar.".into());
    }
    Ok(v)
}

fn copiar(leitor: &mut dyn Read, saida: &mut dyn Write) -> Result<(), String> {
    let mut buf = vec![0u8; 256 * 1024];
    loop {
        if cancelado() {
            return Err("Cancelado.".into());
        }
        let n = leitor.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            return Ok(());
        }
        saida.write_all(&buf[..n]).map_err(|e| e.to_string())?;
        FEITOS.fetch_add(n as u64, Ordering::Relaxed);
    }
}

/// `formato`: "zip", "7z" ou "tgz". `senha` vazia = sem senha (só ZIP e 7z têm). O arquivo criado nunca sobrescreve outro (ganha " (1)").
pub fn compactar(origens: &[PathBuf], destino: &Path, formato: &str, senha: &str) -> Result<ResultadoCompactacao, String> {
    if !senha.is_empty() && formato != "zip" && formato != "7z" {
        return Err("TAR.GZ não tem senha. Escolha ZIP ou 7z.".into());
    }
    let lista = juntar(origens)?;
    let total: u64 = lista.iter().map(|e| e.tamanho).sum();
    let alvo = livre(destino.to_path_buf());
    // conta o pior caso (foto, vídeo e instalador quase não diminuem)
    if let Some(l) = espaco_livre(&alvo) {
        conferir_espaco(total, l)?;
    }
    if let Some(pai) = alvo.parent() {
        fs::create_dir_all(pai).map_err(|e| e.to_string())?;
    }
    iniciar("compactando", &alvo.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(), total);
    let feito = compactar_dentro(&lista, &alvo, formato, senha);
    encerrar();
    if let Err(e) = feito {
        let _ = fs::remove_file(&alvo);
        return Err(e);
    }
    let arquivos = lista.iter().filter(|e| !e.pasta).count();
    Ok(ResultadoCompactacao { destino: alvo, arquivos, bytes: total })
}

fn compactar_dentro(lista: &[Entrada], alvo: &Path, formato: &str, senha: &str) -> Result<(), String> {
    match formato {
        "zip" => {
            let mut w = zip::ZipWriter::new(File::create(alvo).map_err(|e| e.to_string())?);
            for e in lista {
                if cancelado() {
                    return Err("Cancelado.".into());
                }
                let opc = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated).large_file(e.tamanho >= u32::MAX as u64);
                if e.pasta {
                    w.add_directory(e.nome.clone(), opc).map_err(|x| x.to_string())?;
                } else {
                    marcar_atual(&e.nome);
                    if senha.is_empty() {
                        w.start_file(e.nome.clone(), opc).map_err(|x| x.to_string())?;
                    } else {
                        w.start_file(e.nome.clone(), opc.with_aes_encryption(zip::AesMode::Aes256, senha)).map_err(|x| x.to_string())?;
                    }
                    let mut arq = File::open(&e.caminho).map_err(|x| format!("{}: {x}", e.caminho.display()))?;
                    copiar(&mut arq, &mut w)?;
                }
            }
            w.finish().map_err(|e| e.to_string())?;
        }
        "tgz" => {
            let gz = flate2::write::GzEncoder::new(File::create(alvo).map_err(|e| e.to_string())?, flate2::Compression::default());
            let mut b = tar::Builder::new(gz);
            for e in lista {
                if cancelado() {
                    return Err("Cancelado.".into());
                }
                if e.pasta {
                    b.append_dir(&e.nome, &e.caminho).map_err(|x| x.to_string())?;
                } else {
                    marcar_atual(&e.nome);
                    b.append_path_with_name(&e.caminho, &e.nome).map_err(|x| format!("{}: {x}", e.caminho.display()))?;
                    FEITOS.fetch_add(e.tamanho, Ordering::Relaxed);
                }
            }
            b.into_inner().map_err(|e| e.to_string())?.finish().map_err(|e| e.to_string())?;
        }
        "7z" => {
            let mut sz = sevenz_rust::SevenZWriter::create(alvo).map_err(|e| e.to_string())?;
            if !senha.is_empty() {
                sz.set_content_methods(vec![sevenz_rust::AesEncoderOptions::new(senha.into()).into(), sevenz_rust::SevenZMethod::LZMA2.into()]);
            }
            for e in lista {
                if cancelado() {
                    return Err("Cancelado.".into());
                }
                let ent = sevenz_rust::SevenZArchiveEntry::from_path(&e.caminho, e.nome.clone());
                if e.pasta {
                    sz.push_archive_entry::<File>(ent, None).map_err(|x| x.to_string())?;
                } else {
                    marcar_atual(&e.nome);
                    let arq = File::open(&e.caminho).map_err(|x| format!("{}: {x}", e.caminho.display()))?;
                    sz.push_archive_entry(ent, Some(arq)).map_err(|x| x.to_string())?;
                    FEITOS.fetch_add(e.tamanho, Ordering::Relaxed);
                }
            }
            sz.finish().map_err(|e| e.to_string())?;
        }
        _ => return Err("Formato de compactação não suportado. Use ZIP, 7z ou TAR.GZ.".into()),
    }
    Ok(())
}

#[cfg(test)]
mod testes {
    use super::*;
    use std::io::Write;

    fn zip_de_teste(caminho: &Path, itens: &[(&str, &[u8])]) {
        let mut z = zip::ZipWriter::new(File::create(caminho).unwrap());
        for (nome, dados) in itens {
            z.start_file(*nome, zip::write::SimpleFileOptions::default()).unwrap();
            z.write_all(dados).unwrap();
        }
        z.finish().unwrap();
    }

    #[test]
    fn caminhos_seguros() {
        assert_eq!(seguro("a/b.txt"), Some(PathBuf::from("a/b.txt")));
        assert_eq!(seguro("a\\b.txt"), Some(PathBuf::from("a/b.txt")));
        assert_eq!(seguro("../fora.txt"), None);
        assert_eq!(seguro("/etc/passwd"), None);
        assert_eq!(seguro("a/../../x"), None);
    }

    #[test]
    fn sugere_pasta_pelo_nome() {
        assert_eq!(pasta_sugerida(Path::new("/d/projeto.zip")), PathBuf::from("/d/projeto"));
        assert_eq!(pasta_sugerida(Path::new("/d/dados.tar.gz")), PathBuf::from("/d/dados"));
        assert_eq!(pasta_sugerida(Path::new("/d/jogo.7z")), PathBuf::from("/d/jogo"));
        assert_eq!(formato_de(Path::new("x.TGZ")), Some(Formato::TarGz));
        assert_eq!(formato_de(Path::new("x.rar")), Some(Formato::Rar));
        assert_eq!(formato_de(Path::new("x.7z")), Some(Formato::SevenZ));
        assert_eq!(formato_de(Path::new("x.tar.xz")), Some(Formato::TarXz));
        assert_eq!(formato_de(Path::new("x.tar.bz2")), Some(Formato::TarBz2));
        assert_eq!(formato_de(Path::new("x.xyz")), None);
    }

    #[test]
    fn extrai_zip_sem_sobrescrever_e_sem_sair_da_pasta() {
        let t = tempfile::tempdir().unwrap();
        let z = t.path().join("a.zip");
        zip_de_teste(&z, &[("pasta/um.txt", b"1"), ("../fora.txt", b"x"), ("dois.txt", b"2")]);
        let c = listar(&z, "").unwrap();
        assert_eq!(c.itens, 3);
        let dest = t.path().join("saida");
        fs::create_dir_all(&dest).unwrap();
        fs::write(dest.join("dois.txt"), b"ja existia").unwrap();
        let r = extrair(&z, &dest, "", None).unwrap();
        assert_eq!(r.arquivos, 2);
        assert_eq!(r.pulados.len(), 1);
        assert_eq!(fs::read(dest.join("pasta/um.txt")).unwrap(), b"1");
        assert_eq!(fs::read(dest.join("dois.txt")).unwrap(), b"ja existia");
        assert_eq!(fs::read(dest.join("dois (1).txt")).unwrap(), b"2");
        assert!(!t.path().join("fora.txt").exists());
    }

    #[test]
    fn extrai_so_os_itens_marcados() {
        let t = tempfile::tempdir().unwrap();
        let z = t.path().join("a.zip");
        zip_de_teste(&z, &[("a.txt", b"1"), ("b.txt", b"2"), ("c/d.txt", b"3")]);
        let so: HashSet<String> = ["b.txt".to_string(), "c/d.txt".to_string()].into_iter().collect();
        let r = extrair(&z, &t.path().join("o"), "", Some(&so)).unwrap();
        assert_eq!(r.arquivos, 2);
        assert!(!t.path().join("o/a.txt").exists());
        assert!(t.path().join("o/c/d.txt").exists());
    }

    #[test]
    fn extrai_tar_gz_e_gz() {
        let t = tempfile::tempdir().unwrap();
        let tgz = t.path().join("b.tar.gz");
        {
            let gz = flate2::write::GzEncoder::new(File::create(&tgz).unwrap(), flate2::Compression::default());
            let mut b = tar::Builder::new(gz);
            let mut h = tar::Header::new_gnu();
            h.set_size(3);
            h.set_mode(0o644);
            h.set_cksum();
            b.append_data(&mut h, "dir/x.txt", &b"abc"[..]).unwrap();
            b.into_inner().unwrap().finish().unwrap();
        }
        let r = extrair(&tgz, &t.path().join("o"), "", None).unwrap();
        assert_eq!(r.arquivos, 1);
        assert_eq!(fs::read(t.path().join("o/dir/x.txt")).unwrap(), b"abc");

        let g = t.path().join("nota.txt.gz");
        {
            let mut e = flate2::write::GzEncoder::new(File::create(&g).unwrap(), flate2::Compression::default());
            e.write_all(b"texto").unwrap();
            e.finish().unwrap();
        }
        let r = extrair(&g, &t.path().join("o2"), "", None).unwrap();
        assert_eq!(r.arquivos, 1);
        assert_eq!(fs::read(t.path().join("o2/nota.txt")).unwrap(), b"texto");
    }

    #[test]
    fn zip_sem_fim_vira_mensagem_clara() {
        let m = explicar("invalid Zip archive: Could not find EOCD", "");
        assert!(m.contains("incompleto ou corrompido"), "{m}");
    }

    #[test]
    fn extensao_trocada_vale_o_conteudo() {
        let t = tempfile::tempdir().unwrap();
        let f = t.path().join("jogo.zip");
        std::fs::write(&f, b"Rar!\x1A\x07\x01\x00resto").unwrap();
        assert_eq!(formato_de(&f), Some(Formato::Rar));
        let g = t.path().join("outro.zip");
        std::fs::write(&g, b"PK\x03\x04resto").unwrap();
        assert_eq!(formato_de(&g), Some(Formato::Zip));
    }

    #[test]
    fn formato_desconhecido_e_arquivo_inexistente() {
        assert!(extrair(Path::new("/nao/existe.zip"), Path::new("/tmp/x"), "", None).unwrap_err().contains("exista"));
        let t = tempfile::tempdir().unwrap();
        let x = t.path().join("a.xyz");
        fs::write(&x, b"x").unwrap();
        assert!(extrair(&x, &t.path().join("o"), "", None).unwrap_err().contains("não suportado"));
    }

    #[test]
    fn compacta_e_extrai_em_todos_os_formatos() {
        let t = tempfile::tempdir().unwrap();
        let orig = t.path().join("dados");
        fs::create_dir_all(orig.join("sub")).unwrap();
        fs::write(orig.join("a.txt"), b"alfa").unwrap();
        fs::write(orig.join("sub/b.txt"), b"beta").unwrap();
        for (fmt, ext) in [("zip", "zip"), ("7z", "7z"), ("tgz", "tar.gz")] {
            let dest = t.path().join(format!("pacote.{ext}"));
            let r = compactar(&[orig.clone()], &dest, fmt, "").unwrap();
            assert_eq!(r.arquivos, 2, "{fmt}");
            let c = listar(&dest, "").unwrap();
            assert_eq!(c.itens, 2, "{fmt}");
            let saida = t.path().join(format!("saida-{fmt}"));
            extrair(&dest, &saida, "", None).unwrap();
            assert_eq!(fs::read(saida.join("dados/sub/b.txt")).unwrap(), b"beta", "{fmt}");
        }
        // não sobrescreve um pacote que já existe
        let de_novo = compactar(&[orig.clone()], &t.path().join("pacote.zip"), "zip", "").unwrap();
        assert!(de_novo.destino.to_string_lossy().contains("(1)"));
        assert!(compactar(&[orig], &t.path().join("x.rar"), "rar", "").is_err());
    }

    #[test]
    fn zip_com_senha_pede_e_confere() {
        let t = tempfile::tempdir().unwrap();
        let z = t.path().join("s.zip");
        {
            let mut w = zip::ZipWriter::new(File::create(&z).unwrap());
            let o = zip::write::SimpleFileOptions::default().with_aes_encryption(zip::AesMode::Aes256, "segredo");
            w.start_file("a.txt", o).unwrap();
            w.write_all(b"oi").unwrap();
            w.finish().unwrap();
        }
        let e = extrair(&z, &t.path().join("o"), "", None).unwrap_err();
        assert!(e.to_lowercase().contains("senha"), "{e}");
        let e = extrair(&z, &t.path().join("o"), "errada", None).unwrap_err();
        assert!(e.to_lowercase().contains("senha"), "{e}");
        extrair(&z, &t.path().join("o"), "segredo", None).unwrap();
        assert_eq!(fs::read(t.path().join("o/a.txt")).unwrap(), b"oi");
    }

    #[test]
    fn cria_com_senha_e_so_abre_com_ela() {
        let t = tempfile::tempdir().unwrap();
        let orig = t.path().join("Fotos da loja");
        fs::create_dir_all(orig.join("sub")).unwrap();
        fs::write(orig.join("anotação.txt"), "conteúdo secreto").unwrap();
        fs::write(orig.join("sub/dados.bin"), (0..200_000u32).map(|i| (i % 251) as u8).collect::<Vec<_>>()).unwrap();
        let senha = "Segredo 123 ção";
        for fmt in ["zip", "7z"] {
            let r = compactar(&[orig.clone()], &t.path().join(format!("com-senha.{fmt}")), fmt, senha).unwrap();
            // para conferir de fora (7-Zip e Android): VINDEX_AMOSTRAS=pasta
            if let Ok(d) = std::env::var("VINDEX_AMOSTRAS") {
                fs::copy(&r.destino, Path::new(&d).join(format!("windows.{fmt}"))).unwrap();
            }
            let certo = t.path().join(format!("certo-{fmt}"));
            extrair(&r.destino, &certo, senha, None).unwrap();
            assert_eq!(fs::read_to_string(certo.join("Fotos da loja/anotação.txt")).unwrap(), "conteúdo secreto");
            assert_eq!(fs::metadata(certo.join("Fotos da loja/sub/dados.bin")).unwrap().len(), 200_000);
            for errada in ["", "outra"] {
                let d = t.path().join(format!("errada-{fmt}-{}", errada.len()));
                let e = extrair(&r.destino, &d, errada, None).unwrap_err();
                assert!(e.to_lowercase().contains("senha"), "{fmt}: {e}");
                assert!(!d.join("Fotos da loja/anotação.txt").exists(), "{fmt}: sobrou arquivo");
            }
        }
        assert!(listar(&t.path().join("com-senha.zip"), "").unwrap().protegido);
        assert!(compactar(&[orig.clone()], &t.path().join("x.tar.gz"), "tgz", "abc").unwrap_err().contains("não tem senha"));
    }

    #[test]
    fn confere_o_espaco_livre() {
        let gb = 1u64 << 30;
        assert!(conferir_espaco(5 * gb, gb).unwrap_err().contains("5,0 GB"));
        assert!(conferir_espaco(100, gb).is_ok());
        assert!(conferir_espaco(gb, gb + 1000).is_err(), "guarda uma folga");
        assert!(conferir_espaco(0, 0).is_ok(), "tamanho desconhecido não bloqueia");
        let t = tempfile::tempdir().unwrap();
        assert!(espaco_livre(&t.path().join("ainda/nao/existe")).map_or(true, |l| l > 0));
    }
}
