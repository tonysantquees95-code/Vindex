//! Placa de vídeo, tela e conexão (Windows): GPU em uso, VRAM, temperatura da GPU (NVIDIA), taxa de atualização do monitor
//! e a rede ativa (Wi-Fi ou cabo, velocidade do link, sinal e ping). Lê pelo PowerShell; nada é alterado no sistema.
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct Video {
    pub suportado: bool,
    pub gpu_nome: String,
    /// uso do motor gráfico (0 a 100); None quando o Windows não informa
    pub gpu_uso: Option<f32>,
    pub vram_usada: Option<u64>,
    pub vram_total: Option<u64>,
    /// só a NVIDIA informa a temperatura da placa sem programa extra
    pub gpu_temp: Option<f32>,
    pub taxa_hz: Option<u32>,
    pub resolucao: Option<String>,
    /// "Wi-Fi" ou "Cabo"
    pub rede_tipo: Option<String>,
    pub rede_nome: Option<String>,
    pub rede_mbps: Option<u32>,
    /// qualidade do sinal Wi-Fi (0 a 100)
    pub sinal: Option<u32>,
    pub ping_ms: Option<u32>,
}

fn numero(v: &Value) -> Option<f64> {
    match v {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => s.trim().replace(',', ".").parse().ok(),
        _ => None,
    }
}

fn texto(v: &Value) -> String {
    v.as_str().unwrap_or("").trim().to_string()
}

/// "1 Gbps", "866.7 Mbps", "100 Mbps" → Mbps.
pub fn mbps_do_link(s: &str) -> Option<u32> {
    let t = s.trim().to_lowercase();
    let n: f64 = t.split_whitespace().next()?.replace(',', ".").parse().ok()?;
    let m = if t.contains("gbps") || t.contains("gb/s") { n * 1000.0 } else if t.contains("kbps") { n / 1000.0 } else { n };
    if m.is_finite() && m > 0.0 { Some(m.round() as u32) } else { None }
}

/// Linha do nvidia-smi: "nome, temperatura, uso, memória usada (MiB), memória total (MiB)".
pub fn linha_nvidia(l: &str) -> Option<(String, f32, f32, u64, u64)> {
    let p: Vec<&str> = l.split(',').map(str::trim).collect();
    if p.len() < 5 {
        return None;
    }
    let n = |i: usize| p[i].parse::<f64>().ok();
    Some((p[0].to_string(), n(1)? as f32, n(2)? as f32, (n(3)? * 1_048_576.0) as u64, (n(4)? * 1_048_576.0) as u64))
}

/// Junta as leituras cruas do PowerShell num resumo (separado do PowerShell para poder testar).
pub fn montar(bruto: &Value) -> Video {
    let mut v = Video { suportado: true, ..Default::default() };
    let placas: Vec<&Value> = match bruto.get("video") {
        Some(Value::Array(a)) => a.iter().collect(),
        Some(o @ Value::Object(_)) => vec![o],
        _ => Vec::new(),
    };
    // a placa "de verdade" costuma ser a de maior memória; a integrada fica em segundo
    let principal = placas.iter().max_by(|a, b| {
        let ra = a.get("ram").and_then(numero).unwrap_or(0.0);
        let rb = b.get("ram").and_then(numero).unwrap_or(0.0);
        ra.partial_cmp(&rb).unwrap_or(std::cmp::Ordering::Equal)
    });
    if let Some(p) = principal {
        v.gpu_nome = texto(&p["nome"]);
    }
    // a taxa e a resolução são do monitor em uso: a placa que está com tela ligada
    if let Some(p) = placas.iter().find(|p| p.get("hz").and_then(numero).unwrap_or(0.0) > 1.0) {
        v.taxa_hz = p.get("hz").and_then(numero).map(|h| h.round() as u32);
        let (w, h) = (p.get("w").and_then(numero).unwrap_or(0.0) as u32, p.get("h").and_then(numero).unwrap_or(0.0) as u32);
        if w > 0 && h > 0 {
            v.resolucao = Some(format!("{w}×{h}"));
        }
    }
    v.gpu_uso = bruto.get("uso").and_then(numero).map(|u| u.clamp(0.0, 100.0) as f32);
    v.vram_usada = bruto.get("vram").and_then(numero).filter(|x| *x > 0.0).map(|x| x as u64);
    v.vram_total = bruto.get("vram_total").and_then(numero).filter(|x| *x > 0.0).map(|x| x as u64);
    // NVIDIA: o nvidia-smi é mais exato que os contadores do Windows
    let linhas: Vec<String> = match bruto.get("nv") {
        Some(Value::Array(a)) => a.iter().filter_map(|x| x.as_str()).map(str::to_string).collect(),
        Some(Value::String(s)) => vec![s.clone()],
        _ => Vec::new(),
    };
    if let Some((nome, temp, uso, usada, total)) = linhas.iter().find_map(|l| linha_nvidia(l)) {
        v.gpu_nome = nome;
        v.gpu_temp = Some(temp);
        v.gpu_uso = Some(uso.clamp(0.0, 100.0));
        v.vram_usada = Some(usada);
        v.vram_total = Some(total);
    }
    if let Some(r) = bruto.get("rede").filter(|r| r.is_object()) {
        let media = texto(&r["tipo"]).to_lowercase();
        let desc = texto(&r["desc"]).to_lowercase();
        let wifi = media.contains("802.11") || media.contains("wireless") || desc.contains("wi-fi") || desc.contains("wireless") || desc.contains("wifi");
        v.rede_tipo = Some(if wifi { "Wi-Fi" } else { "Cabo" }.to_string());
        let nome = texto(&r["nome"]);
        if !nome.is_empty() {
            v.rede_nome = Some(nome);
        }
        v.rede_mbps = r.get("vel").and_then(|x| x.as_str()).and_then(mbps_do_link);
    }
    v.sinal = bruto.get("sinal").and_then(numero).map(|s| s.clamp(0.0, 100.0) as u32);
    v.ping_ms = bruto.get("ping").and_then(numero).filter(|p| *p >= 0.0).map(|p| p as u32);
    v
}

#[cfg(windows)]
const SCRIPT: &str = r#"
$v=@(Get-CimInstance Win32_VideoController | ForEach-Object { [pscustomobject]@{nome=[string]$_.Name;hz=[int]$_.CurrentRefreshRate;ram=[double]$_.AdapterRAM;w=[int]$_.CurrentHorizontalResolution;h=[int]$_.CurrentVerticalResolution} })
$uso=$null; try { $c=(Get-Counter '\GPU Engine(*)\Utilization Percentage' -ErrorAction Stop).CounterSamples; $uso=($c | Group-Object { ($_.InstanceName -split 'engtype_')[-1] } | ForEach-Object { ($_.Group | Measure-Object CookedValue -Sum).Sum } | Measure-Object -Maximum).Maximum } catch {}
$vram=$null; try { $m=(Get-Counter '\GPU Adapter Memory(*)\Dedicated Usage' -ErrorAction Stop).CounterSamples; $vram=($m | Measure-Object CookedValue -Maximum).Maximum } catch {}
$vt=$null; try { $vt=@(Get-ItemProperty 'HKLM:\SYSTEM\ControlSet001\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\0*' -ErrorAction SilentlyContinue | ForEach-Object { $_.'HardwareInformation.qwMemorySize' } | Where-Object { $_ } | Measure-Object -Maximum).Maximum } catch {}
$nv=$null; try { $nv=@(& nvidia-smi --query-gpu=name,temperature.gpu,utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits 2>$null) } catch {}
$rede=$null; try { $a=Get-NetAdapter -Physical -ErrorAction Stop | Where-Object { $_.Status -eq 'Up' } | Select-Object -First 1; if($a){ $rede=[pscustomobject]@{nome=[string]$a.Name;tipo=[string]$a.PhysicalMediaType;vel=[string]$a.LinkSpeed;desc=[string]$a.InterfaceDescription} } } catch {}
$sinal=$null; try { $m=(netsh wlan show interfaces) | Select-String -Pattern '^\s*(Signal|Sinal)\s*:\s*(\d+)\s*%'; if($m){ $sinal=[int]$m.Matches[0].Groups[2].Value } } catch {}
$ping=$null; try { $r=(New-Object Net.NetworkInformation.Ping).Send('1.1.1.1',1000); if($r.Status -eq 'Success'){ $ping=[int]$r.RoundtripTime } } catch {}
[pscustomobject]@{video=$v;uso=$uso;vram=$vram;vram_total=$vt;nv=$nv;rede=$rede;sinal=$sinal;ping=$ping} | ConvertTo-Json -Depth 5 -Compress
"#;

#[cfg(windows)]
pub fn ler() -> Result<Video, String> {
    let saida = crate::desempenho::powershell(SCRIPT)?;
    let bruto: Value = serde_json::from_str(saida.trim()).map_err(|e| format!("Não entendi a resposta do Windows: {e}"))?;
    Ok(montar(&bruto))
}
#[cfg(not(windows))]
pub fn ler() -> Result<Video, String> {
    Ok(Video::default())
}

#[cfg(test)]
mod testes {
    use super::*;
    use serde_json::json;

    #[test]
    fn velocidade_do_link() {
        assert_eq!(mbps_do_link("1 Gbps"), Some(1000));
        assert_eq!(mbps_do_link("866.7 Mbps"), Some(867));
        assert_eq!(mbps_do_link("100 Mbps"), Some(100));
        assert_eq!(mbps_do_link("2,5 Gbps"), Some(2500));
        assert_eq!(mbps_do_link(""), None);
    }

    #[test]
    fn linha_do_nvidia_smi() {
        let (n, t, u, usada, total) = linha_nvidia("NVIDIA GeForce RTX 3060, 45, 12, 1024, 12288").unwrap();
        assert_eq!(n, "NVIDIA GeForce RTX 3060");
        assert_eq!((t, u), (45.0, 12.0));
        assert_eq!(usada, 1024 * 1_048_576);
        assert_eq!(total, 12288 * 1_048_576);
        assert!(linha_nvidia("lixo").is_none());
    }

    #[test]
    fn monta_com_placa_integrada_e_dedicada() {
        let b = json!({
            "video": [
                {"nome": "Intel UHD", "hz": 144, "ram": 1073741824.0, "w": 1920, "h": 1080},
                {"nome": "NVIDIA GeForce GTX 1650", "hz": 0, "ram": 4294967296.0, "w": 0, "h": 0}
            ],
            "uso": 37.5, "vram": 900000000.0, "vram_total": 4294967296.0,
            "rede": {"nome": "Wi-Fi", "tipo": "Native 802.11", "vel": "866.7 Mbps", "desc": "Intel Wi-Fi 6"},
            "sinal": 82, "ping": 17
        });
        let v = montar(&b);
        assert!(v.suportado);
        assert_eq!(v.gpu_nome, "NVIDIA GeForce GTX 1650");
        assert_eq!(v.taxa_hz, Some(144));
        assert_eq!(v.resolucao.as_deref(), Some("1920×1080"));
        assert_eq!(v.gpu_uso, Some(37.5));
        assert_eq!(v.vram_total, Some(4294967296));
        assert_eq!(v.rede_tipo.as_deref(), Some("Wi-Fi"));
        assert_eq!(v.rede_mbps, Some(867));
        assert_eq!(v.sinal, Some(82));
        assert_eq!(v.ping_ms, Some(17));
    }

    #[test]
    fn nvidia_smi_vale_mais_que_os_contadores_e_cabo_nao_tem_sinal() {
        let b = json!({
            "video": {"nome": "NVIDIA GeForce RTX 4070", "hz": 165, "ram": 4294967296.0, "w": 2560, "h": 1440},
            "uso": 5.0, "nv": "NVIDIA GeForce RTX 4070, 61, 33, 2048, 12288",
            "rede": {"nome": "Ethernet", "tipo": "802.3", "vel": "1 Gbps", "desc": "Realtek PCIe GbE"}
        });
        let v = montar(&b);
        assert_eq!(v.gpu_uso, Some(33.0));
        assert_eq!(v.gpu_temp, Some(61.0));
        assert_eq!(v.vram_total, Some(12288 * 1_048_576));
        assert_eq!(v.rede_tipo.as_deref(), Some("Cabo"));
        assert_eq!(v.sinal, None);
        assert_eq!(v.ping_ms, None);
    }

    #[test]
    fn sem_nada_nao_quebra() {
        let v = montar(&json!({}));
        assert!(v.suportado && v.gpu_nome.is_empty() && v.gpu_uso.is_none() && v.rede_tipo.is_none());
    }
}
