const SUPABASE_URL = 'https://iaylyacrzurcjwvtecpu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pkzx4u5U9Xr407syiBE9yA_G7hUvGaw';

let supabaseClient = null;

window.onload = async () => {
    console.log("🏥 Inicializando Monitoramento QAI Clínico...");
    
    inicializarGerenciadorTema();
    inicializarGavetaAvancada();

    if (typeof supabase !== "undefined") {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("✅ Conexão estável com barramento Supabase estabelecida.");
        
        await processarCicloMonitoramento();
        setInterval(processarCicloMonitoramento, 15000); 
    }
};

// ====================================================================
// MOTOR DA GAVETA COLAPSÁVEL DE TELEMETRIA
// ====================================================================
function inicializarGavetaAvancada() {
    const btn = document.getElementById('btnToggleAvancado');
    const gaveta = document.getElementById('gavetaAvancada');
    const seta = document.getElementById('setaAvancado');

    btn.addEventListener('click', () => {
        if (gaveta.classList.contains('hidden')) {
            gaveta.classList.remove('hidden');
            seta.innerText = '▲';
        } else {
            gaveta.classList.add('hidden');
            seta.innerText = '▼';
        }
    });
}

function inicializarGerenciadorTema() {
    const btn = document.getElementById('btnAlternarTema');
    const ico = document.getElementById('icoTema');
    const txt = document.getElementById('txtTema');
    const htmlElement = document.documentElement;

    const temaSalvo = localStorage.getItem('qai-tema');
    
    if (temaSalvo === 'dark') {
        htmlElement.classList.add('dark');
        ico.innerText = '☀️';
        txt.innerText = 'Modo Diurno';
    } else {
        htmlElement.classList.remove('dark');
        ico.innerText = '🌙';
        txt.innerText = 'Modo Noturno';
        localStorage.setItem('qai-tema', 'light');
    }

    btn.addEventListener('click', () => {
        if (htmlElement.classList.contains('dark')) {
            htmlElement.classList.remove('dark');
            ico.innerText = '🌙';
            txt.innerText = 'Modo Noturno';
            localStorage.setItem('qai-tema', 'light');
        } else {
            htmlElement.classList.add('dark');
            ico.innerText = '☀️';
            txt.innerText = 'Modo Diurno';
            localStorage.setItem('qai-tema', 'dark');
        }
    });
}

async function processarCicloMonitoramento() {
    if (!supabaseClient) return;
    try {
        const { data: leituraBruta, error } = await supabaseClient
            .from('sensor_readings')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!error && leituraBruta) {
            const relatorioClinico = analisarLeituraQAI(leituraBruta);
            atualizarInterfaceVisual(relatorioClinico);
        }
    } catch (err) {
        console.error(err);
    }
}

function atualizarInterfaceVisual(relatorio) {
    const v = relatorio.valoresAtuais;
    const t = relatorio.telemetriaAvancada;

    document.getElementById('txtDeviceId').innerText = relatorio.dispositivoId || '--';
    document.getElementById('txtSignal').innerText = `${t.sinalRede || '--'} dBm`;
    document.getElementById('txtTimestamp').innerText = new Date(relatorio.carimbotempo).toLocaleTimeString('pt-BR');

    document.getElementById('valTemperature').innerHTML = `${v.temperature ? v.temperature.toFixed(1) : '--.-'}<span class="text-sm font-normal text-slate-400 ml-0.5">°C</span>`;
    document.getElementById('valHumidity').innerHTML = `${v.humidity ? v.humidity.toFixed(1) : '--.-'}<span class="text-sm font-normal text-slate-400 ml-0.5">%</span>`;
    document.getElementById('valDewPoint').innerHTML = `${relatorio.pontoOrvalho ? relatorio.pontoOrvalho.toFixed(1) : '--.-'}<span class="text-sm font-normal text-sky-400 ml-0.5">°C</span>`;

    document.getElementById('valCO2').innerText = v.co2 || '----';
    document.getElementById('valCO').innerText = v.co ? v.co.toFixed(1) : '--.-';
    document.getElementById('valVOC').innerText = v.vocIndex || '---';

    document.getElementById('valPM25').innerText = v.pm25 ? v.pm25.toFixed(1) : '--.-';
    document.getElementById('valPM10').innerText = v.pm10 ? v.pm10.toFixed(1) : '--.-';
    document.getElementById('valNC05').innerText = t.contagemParticulas.nc0_5 ? t.contagemParticulas.nc0_5.toFixed(1) : '--.-';
    document.getElementById('valNC10').innerText = t.contagemParticulas.nc1_0 ? t.contagemParticulas.nc1_0.toFixed(1) : '--.-';
    document.getElementById('valNC25').innerText = t.contagemParticulas.nc2_5 ? t.contagemParticulas.nc2_5.toFixed(1) : '--.-';
    document.getElementById('valNC100').innerText = t.contagemParticulas.nc10_0 ? t.contagemParticulas.nc10_0.toFixed(1) : '--.-';
    document.getElementById('valTypicalSize').innerText = `${t.tamanhoTipico ? t.tamanhoTipico.toFixed(2) : '--.-'} µm`;

    const badge = document.getElementById('badgeStatusGeral');
    const painelTriagem = document.getElementById('panelTriagem');

    if (relatorio.statusGeral === "CONFORME") {
        badge.innerText = "SALA CONFORME";
        badge.className = "px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/40";
        
        painelTriagem.innerHTML = `
            <div class="bg-emerald-50/40 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-4 text-center">
                <span class="text-lg block">🛡️</span>
                <h3 class="text-xs font-bold text-emerald-700 dark:text-emerald-400 mt-1 uppercase">Ambiente Estável</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">Ar interno purificado e em conformidade sanitária plena.</p>
            </div>
        `;
    } else {
        if (relatorio.statusGeral === "CRÍTICO") {
            badge.innerText = "ALERTA CRÍTICO";
            badge.className = "px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40";
        } else {
            badge.innerText = "ATENÇÃO";
            badge.className = "px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40";
        }

        let htmlErros = "";
        relatorio.violacoes.forEach(erro => {
            const isCritico = erro.gravidade === "CRÍTICO";
            const corTexto = isCritico ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400";
            const corBorda = isCritico ? "border-rose-100 dark:border-rose-900/30" : "border-amber-100 dark:border-amber-900/30";
            const corFundo = isCritico ? "bg-rose-50/30 dark:bg-rose-950/50" : "bg-amber-50/30 dark:bg-amber-950/50";

            htmlErros += `
                <div class="border ${corBorda} ${corFundo} rounded-xl p-3.5 space-y-2 transition-all">
                    <div class="flex justify-between items-center border-b border-black/5 dark:border-white/5 pb-1.5">
                        <span class="text-[11px] font-bold ${corTexto}">⚠️ ${erro.parametro.toUpperCase()} FORA DA META</span>
                        <span class="text-[10px] text-slate-500 font-medium">Lido: ${erro.valor}${erro.unidade}</span>
                    </div>
                    <p class="text-xs text-slate-600 dark:text-slate-300 leading-snug font-medium">${erro.mensagem}</p>
                    <div class="bg-white/80 dark:bg-slate-900 p-2.5 rounded-xl border border-black/5 dark:border-white/5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        <span class="font-bold text-sky-600 dark:text-sky-400 block mb-0.5">💡 Ação Recomendada:</span>
                        ${gerarScriptMitigacaoOperacional(erro.parametro)}
                    </div>
                </div>
            `;
        });
        painelTriagem.innerHTML = htmlErros;
    }
}

function gerarScriptMitigacaoOperacional(parametro) {
    switch (parametro) {
        case "CO2": return `• Forçar captação de ar externo no painel HVAC.<br>• Reduzir ocupação imediata da sala.`;
        case "CO": return `• EVACUAÇÃO imediata se os níveis persistirem.<br>• Desligar geradores próximos à captação.`;
        case "VOC": return `• Suspender uso de solventes/produtos de limpeza.<br>• Ativar exaustão mecânica máxima.`;
        case "PM2.5":
        case "PM10": return `• Avaliar saturação física dos filtros HEPA.<br>• Ligar purificador auxiliar móvel.`;
        case "Temperatura": return `• Corrigir setpoint no termostato central.`;
        case "Umidade": return `• Ativar desumidificação (HVAC) / umidificador.`;
        default: return `• Executar varredura técnica preventiva na área.`;
    }
}
