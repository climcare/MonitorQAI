// ====================================================================
// INFRAESTRUTURA DE REDE E CHAVES DE SEGURANÇA (SUPABASE ANON PROTOCOL)
// ====================================================================
const SUPABASE_URL = 'https://iaylyacrzurcjwvtecpu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pkzx4u5U9Xr407syiBE9yA_G7hUvGaw';

let supabaseClient = null;

// ====================================================================
// INICIALIZADOR ASSÍNCRONO DA INTERFACE CLINICA
// ====================================================================
window.onload = async () => {
    console.log("🏥 Inicializando Monitoramento QAI Clínico...");

    if (typeof supabase !== "undefined") {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("✅ Conexão estável com barramento Supabase estabelecida.");
        
        // Ciclo de Pooling Executável (1ª Carga Imediata + Loop de 15s)
        await processarCicloMonitoramento();
        setInterval(processarCicloMonitoramento, 15000); 
    } else {
        console.error("❌ Falha crítica: Biblioteca Supabase inacessível (CDN offline).");
        document.getElementById('panelTriagem').innerHTML = `
            <div class="bg-rose-950/40 border border-rose-900 p-4 rounded-lg text-rose-400 text-xs font-mono text-center">
                ERRO CRÍTICO DE SISTEMA: Falha de conexão física com os servidores de telemetria.
            </div>
        `;
    }
};

// ====================================================================
// CONSUMO DO DATASTREAM (CONTRATO DE FLUXO)
// ====================================================================
async function processarCicloMonitoramento() {
    if (!supabaseClient) return;

    try {
        const { data: leituraBruta, error } = await supabaseClient
            .from('sensor_readings')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            console.error("Erro na busca de telemetria:", error);
            return;
        }

        if (leituraBruta) {
            // Processamento do Motor Lógico (analysis.js)
            const relatorioClinico = analisarLeituraQAI(leituraBruta);
            // Carga do renderizador visual
            atualizarInterfaceVisual(relatorioClinico);
        }
    } catch (err) {
        console.error("Exceção detectada no ciclo de pooling de dados:", err);
    }
}

// ====================================================================
// ENGINE DE RENDERIZAÇÃO E PROCESSAMENTO DE TRIAGEM HUMANA (UX NOBRE)
// ====================================================================
function atualizarInterfaceVisual(relatorio) {
    const v = relatorio.valoresAtuais;
    const t = relatorio.telemetriaAvancada;

    // 1. Telemetria Base de Infraestrutura
    document.getElementById('txtDeviceId').innerText = relatorio.dispositivoId || 'DESCONHECIDO';
    document.getElementById('txtSignal').innerText = `${t.sinalRede || '--'} dBm`;
    document.getElementById('txtTimestamp').innerText = new Date(relatorio.carimbotempo).toLocaleTimeString('pt-BR');

    // 2. Mapeamento - Climatização
    document.getElementById('valTemperature').innerHTML = `${v.temperature ? v.temperature.toFixed(1) : '--.-'} <span class="text-base font-normal text-slate-500">°C</span>`;
    document.getElementById('valHumidity').innerHTML = `${v.humidity ? v.humidity.toFixed(1) : '--.-'} <span class="text-base font-normal text-slate-500">%</span>`;
    document.getElementById('valDewPoint').innerHTML = `${relatorio.pontoOrvalho ? relatorio.pontoOrvalho.toFixed(1) : '--.-'} <span class="text-base font-normal text-sky-600">°C</span>`;

    // 3. Mapeamento - Gases Invisíveis
    document.getElementById('valCO2').innerHTML = `${v.co2 || '----'} <span class="text-xs text-slate-500 font-normal">ppm</span>`;
    document.getElementById('valCO').innerHTML = `${v.co ? v.co.toFixed(1) : '--.-'} <span class="text-xs text-slate-500 font-normal">ppm</span>`;
    document.getElementById('valVOC').innerText = v.vocIndex || '---';

    // 4. Mapeamento - Particulados Instrumentais
    document.getElementById('valPM25').innerText = v.pm25 ? v.pm25.toFixed(1) : '--.-';
    document.getElementById('valPM10').innerText = v.pm10 ? v.pm10.toFixed(1) : '--.-';
    document.getElementById('valNC05').innerText = t.contagemParticulas.nc0_5 ? t.contagemParticulas.nc0_5.toFixed(1) : '--.-';
    document.getElementById('valNC10').innerText = t.contagemParticulas.nc1_0 ? t.contagemParticulas.nc1_0.toFixed(1) : '--.-';
    document.getElementById('valNC25').innerText = t.contagemParticulas.nc2_5 ? t.contagemParticulas.nc2_5.toFixed(1) : '--.-';
    document.getElementById('valNC100').innerText = t.contagemParticulas.nc10_0 ? t.contagemParticulas.nc10_0.toFixed(1) : '--.-';
    document.getElementById('valTypicalSize').innerText = `${t.tamanhoTipico ? t.tamanhoTipico.toFixed(2) : '--.-'} µm`;

    // 5. Bloco de Triagem Avançada de Erros Explicativos
    const badge = document.getElementById('badgeStatusGeral');
    const painelTriagem = document.getElementById('panelTriagem');

    if (relatorio.statusGeral === "CONFORME") {
        badge.innerText = "ESTÁVEL / CONFORME";
        badge.className = "px-3 py-1 rounded text-xs font-mono font-bold border bg-emerald-950/50 text-emerald-400 border-emerald-800";
        
        painelTriagem.innerHTML = `
            <div class="flex items-start gap-4 bg-emerald-950/20 border border-emerald-900/60 rounded-lg p-5">
                <div class="text-2xl mt-0.5">🛡️</div>
                <div>
                    <h3 class="text-sm font-bold text-emerald-400 font-mono uppercase tracking-wide">Estabilidade Sanitária Detectada</h3>
                    <p class="text-xs text-slate-300 mt-1 leading-relaxed">
                        Todos os parâmetros físico-químicos e particulados atmosféricos analisados encontram-se rigorosamente dentro dos limites estabelecidos pelas normas ANVISA RE 09 e ABNT NBR 17037. O ar interno apresenta excelentes taxas de renovação e filtração.
                    </p>
                    <div class="mt-3 text-[11px] font-mono text-slate-500">NENHUMA AÇÃO DE MITIGAÇÃO É REQUERIDA NO MOMENTO.</div>
                </div>
            </div>
        `;
    } else {
        if (relatorio.statusGeral === "CRÍTICO") {
            badge.innerText = "ALERTA CRÍTICO SANITÁRIO";
            badge.className = "px-3 py-1 rounded text-xs font-mono font-bold border bg-rose-950/50 text-rose-400 border-rose-800 animate-pulse";
        } else {
            badge.innerText = "ATENÇÃO OPERACIONAL";
            badge.className = "px-3 py-1 rounded text-xs font-mono font-bold border bg-amber-950/50 text-amber-400 border-amber-800";
        }

        let htmlErros = "";
        
        relatorio.violacoes.forEach(erro => {
            const isCritico = erro.gravidade === "CRÍTICO";
            // Injeção limpa de classes sem interpolação de strings parciais do Tailwind
            const classeBorda = isCritico ? "border-rose-900/60" : "border-amber-900/60";
            const classeFundo = isCritico ? "bg-rose-950/20" : "bg-amber-950/20";
            const classeTexto = isCritico ? "text-rose-400" : "text-amber-400";
            const classeSubBorda = isCritico ? "border-rose-900/40" : "border-amber-900/40";

            htmlErros += `
                <div class="border ${classeBorda} ${classeFundo} rounded-lg p-4 space-y-3">
                    <div class="flex justify-between items-center border-b ${classeSubBorda} pb-1.5">
                        <div class="flex items-center gap-2 font-mono text-xs font-bold ${classeTexto}">
                            <span>⚠️ [${erro.gravidade}]</span>
                            <span>ANOMALIA NO PARÂMETRO: ${erro.parametro.toUpperCase()}</span>
                        </div>
                        <span class="font-mono text-xs text-slate-400">LIDO: ${erro.valor}${erro.unidade} (LIMITE: ${erro.limite}${erro.unidade})</span>
                    </div>
                    
                    <div>
                        <span class="text-[10px] font-mono tracking-wider text-slate-400 block uppercase">Cenário Clínico / Impacto Técnico:</span>
                        <p class="text-xs text-slate-200 mt-0.5 leading-relaxed font-sans">${erro.mensagem}</p>
                    </div>

                    <div class="bg-slate-950/60 p-2.5 rounded border border-slate-900">
                        <span class="text-[10px] font-mono tracking-wider text-sky-400 block uppercase">💡 Protocolo de Mitigação Imediata:</span>
                        <ul class="text-xs text-slate-300 mt-1 space-y-1 font-mono">
                            ${gerarScriptMitigacaoOperacional(erro.parametro)}
                        </ul>
                    </div>
                </div>
            `;
        });

        painelTriagem.innerHTML = htmlErros;
    }
}

// ====================================================================
// DATA ENGINE DE AÇÃO RÁPIDA (CHECKLISTS OPERACIONAIS)
// ====================================================================
function gerarScriptMitigacaoOperacional(parametro) {
    switch (parametro) {
        case "CO2":
            return `<li>[ ] 1. Forçar acionamento manual dos dumpers de captação de ar externo do sistema HVAC.</li>
                    <li>[ ] 2. Avaliar taxa de ocupação nominal da sala (reduzir densidade de pessoas/acompanhantes).</li>`;
        case "CO":
            return `<li>[ ] 1. EVACUAÇÃO PREVENTIVA se níveis subirem. Investigar fontes de queima interna.</li>
                    <li>[ ] 2. Desligar geradores ou maquinários de combustão próximos às tomadas de ar externas.</li>`;
        case "VOC":
            return `<li>[ ] 1. Interromper imediatamente aplicação de agentes químicos sanitizantes voláteis ou solventes.</li>
                    <li>[ ] 2. Incrementar a taxa de exaustão mecânica e purificação para dispersão dos gases.</li>`;
        case "PM2.5":
        case "PM10":
            return `<li>[ ] 1. Verificar integridade física e vedação das gavetas de filtros multibolsa/HEPA na AHU.</li>
                    <li>[ ] 2. Ativar purificadores de ar autônomos auxiliares em vazão máxima de filtragem.</li>`;
        case "Temperatura":
            return `<li>[ ] 1. Regular setpoint de refrigeração no termostato central (verificar fluxo de água gelada).</li>
                    <li>[ ] 2. Auditar fontes térmicas internas anômalas (equipamentos médicos em superaquecimento).</li>`;
        case "Umidade":
            return `<li>[ ] 1. Se ALTA: Ativar ciclo de desumidificação ativa (by-pass de serpentina fria no fan-coil).</li>
                    <li>[ ] 2. Se BAIXA: Inspecionar bicos injetores de vapor do sistema umidificador mecânico.</li>`;
        default:
            return `<li>[ ] 1. Realizar inspeção técnica preventiva e conferência civil das vedações da sala.</li>`;
    }
}