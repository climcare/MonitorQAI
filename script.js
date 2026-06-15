const SUPABASE_URL = 'https://iaylyacrzurcjwvtecpu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pkzx4u5U9Xr407syiBE9yA_G7hUvGaw';

let supabaseClient = null;

window.onload = async () => {
    inicializarGerenciadorTema();
    if (typeof supabase !== "undefined") {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        await processarCicloMonitoramento();
        setInterval(processarCicloMonitoramento, 15000); 
    }
};

function inicializarGerenciadorTema() {
    const btn = document.getElementById('btnAlternarTema');
    const ico = document.getElementById('icoTema');
    const txt = document.getElementById('txtTema');
    const htmlElement = document.documentElement;

    const temaSalvo = localStorage.getItem('qai-tema') || 'light';
    if (temaSalvo === 'dark') {
        htmlElement.classList.add('dark');
        ico.innerText = '☀️';
        txt.innerText = 'MODO DIURNO';
    }

    btn.addEventListener('click', () => {
        if (htmlElement.classList.contains('dark')) {
            htmlElement.classList.remove('dark');
            ico.innerText = '🌙';
            txt.innerText = 'MODO NOTURNO';
            localStorage.setItem('qai-tema', 'light');
        } else {
            htmlElement.classList.add('dark');
            ico.innerText = '☀️';
            txt.innerText = 'MODO DIURNO';
            localStorage.setItem('qai-tema', 'dark');
        }
    });
}

async function processarCicloMonitoramento() {
    if (!supabaseClient) return;
    try {
        const { data: leituraBruta, error } = await supabaseClient
            .from('sensor_readings')
            .select('*').order('created_at', { ascending: false }).limit(1).single();

        if (!error && leituraBruta) {
            const relatorio = analisarLeituraQAI(leituraBruta);
            atualizarInterfaceVisual(relatorio);
        }
    } catch (err) { console.error(err); }
}

function atualizarInterfaceVisual(relatorio) {
    const v = relatorio.valoresAtuais;
    const t = relatorio.telemetriaAvancada;
    document.getElementById('valPontoOrvalho').innerText = `${relatorio.pontoOrvalho ? relatorio.pontoOrvalho.toFixed(1) : '--.-'}°C`;
    // Telemetria Topo
    document.getElementById('txtDeviceId').innerText = relatorio.dispositivoId || '--';
    document.getElementById('txtSignal').innerText = `${t.sinalRede || '--'} dBm`;
    document.getElementById('txtTimestamp').innerText = `⏱️ LIDO EM: ${new Date(relatorio.carimbotempo).toLocaleTimeString('pt-BR')}`;

    // Valores Cards
    document.getElementById('valTemperature').innerHTML = `${v.temperature ? v.temperature.toFixed(1) : '--.-'}<span class="text-2xl font-light opacity-40">°C</span>`;
    document.getElementById('valHumidity').innerHTML = `${v.humidity ? v.humidity.toFixed(1) : '--.-'}<span class="text-2xl font-light opacity-40">%</span>`;
    document.getElementById('valCO2').innerHTML = `${v.co2 || '----'} <span class="text-xl font-light opacity-40">PPM</span>`;

    // Particulados Amigáveis (pt/cm3)
    document.getElementById('valNC05').innerText = t.contagemParticulas.nc0_5 ? t.contagemParticulas.nc0_5.toFixed(0) : '--';
    document.getElementById('valNC10').innerText = t.contagemParticulas.nc1_0 ? t.contagemParticulas.nc1_0.toFixed(0) : '--';
    document.getElementById('valNC25').innerText = t.contagemParticulas.nc2_5 ? t.contagemParticulas.nc2_5.toFixed(0) : '--';
    document.getElementById('valNC100').innerText = t.contagemParticulas.nc10_0 ? t.contagemParticulas.nc10_0.toFixed(0) : '--';

    // Logica Semafórica Individual de Cards
    pintarCard('cardTemp', 'statusTemp', relatorio.analiseIndividual.temperatura);
    pintarCard('cardHum', 'statusHum', relatorio.analiseIndividual.umidade);
    pintarCard('cardCO2', 'statusCO2', relatorio.analiseIndividual.co2);

    // Status Geral Semafórico (Barra Superior)
    const panelStatus = document.getElementById('panelStatusGeral');
    const txtStatus = document.getElementById('txtStatusGeral');
    
    if (relatorio.statusGeral === "CONFORME") {
        panelStatus.className = "rounded-2xl p-4 text-center shadow-md border-2 transition-all bg-emerald-500 text-white border-emerald-400";
        txtStatus.innerText = "🛡️ AMBIENTE EM CONFORMIDADE SANITÁRIA";
        document.getElementById('panelTriagem').innerHTML = `
            <div class="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-emerald-600 dark:text-emerald-400 font-bold text-xs text-center">
                ✅ Ar purificado. Nenhuma intervenção necessária.
            </div>`;
    } else {
        const critico = relatorio.statusGeral === "CRÍTICO";
        panelStatus.className = `rounded-2xl p-4 text-center shadow-md border-2 transition-all ${critico ? 'bg-rose-600 text-white border-rose-400 animate-pulse' : 'bg-amber-500 text-white border-amber-400'}`;
        txtStatus.innerText = critico ? "🚨 ALERTA CRÍTICO: RISCO BIOLÓGICO/ESTRUTURAL" : "⚠️ ATENÇÃO: AMBIENTE FORA DOS PADRÕES";

        // Gerador de Alertas OMS Dinâmico
        let htmlAlertas = "";
        relatorio.violacoes.forEach(erro => {
            htmlAlertas += `
                <div class="bg-white dark:bg-slate-900 border-l-8 ${erro.gravidade === 'CRÍTICO' ? 'border-rose-600' : 'border-amber-500'} rounded-2xl p-4 shadow-sm space-y-2">
                    <div class="flex justify-between items-center text-[10px] font-black uppercase tracking-tighter">
                        <span class="${erro.gravidade === 'CRÍTICO' ? 'text-rose-600' : 'text-amber-500'}">PROBLEMA: ${erro.parametro}</span>
                        <span class="text-slate-400">VALOR: ${erro.valor}${erro.unidade}</span>
                    </div>
                    <p class="text-xs font-bold text-slate-700 dark:text-slate-200">${obterMensagemOMS(erro.parametro, erro.valor)}</p>
                    <div class="text-[11px] font-mono font-bold text-sky-600 dark:text-sky-400 mt-2 uppercase underline">
                        👉 Ação: ${obterMitigacaoOMS(erro.parametro)}
                    </div>
                </div>
            `;
        });
        document.getElementById('panelTriagem').innerHTML = htmlAlertas;
    }
}

function pintarCard(cardId, statusId, nivel) {
    const card = document.getElementById(cardId);
    const status = document.getElementById(statusId);
    card.classList.remove('border-emerald-500', 'border-amber-500', 'border-rose-600', 'border-transparent');
    status.classList.remove('bg-emerald-500', 'bg-amber-500', 'bg-rose-600', 'text-white');

    if (nivel === "BOM") {
        card.classList.add('border-emerald-500');
        status.innerText = "🟢 EXCELENTE";
        status.classList.add('bg-emerald-500', 'text-white');
    } else if (nivel === "ALERTA") {
        card.classList.add('border-amber-500');
        status.innerText = "⚠️ ATENÇÃO";
        status.classList.add('bg-amber-500', 'text-white');
    } else {
        card.classList.add('border-rose-600');
        status.innerText = "🚨 CRÍTICO";
        status.classList.add('bg-rose-600', 'text-white');
    }
}

function obterMensagemOMS(param, valor) {
    const mensagens = {
        "CO2": `🚨 ALERTA OMS: Nível de ${valor} PPM é perigoso. Reduz o oxigênio no cérebro, causa sonolência e indica ar viciado e contaminado.`,
        "Temperatura": "Meta de Estabilidade: Temperatura fora da zona de conforto térmico e preservação biológica.",
        "Umidade": "Risco Sanitário: Umidade inadequada facilita a proliferação de ácaros e ressecamento de mucosas.",
        "PM2.5": "🚨 ALERTA OMS: Ar carregado de partículas finas que penetram diretamente nos pulmões e corrente sanguínea."
    };
    return mensagens[param] || "Ambiente fora dos padrões regulatórios de saúde.";
}

function obterMitigacaoOMS(param) {
    const acoes = {
        "CO2": "Abrir janelas ou forçar captação de ar externo no sistema HVAC imediatamente.",
        "Temperatura": "Ajustar termostato e verificar obstrução de dutos de ar.",
        "Umidade": "Ligar desumidificador ou ajustar vazão de ar condicionado.",
        "PM2.5": "Ativar purificador HEPA e verificar vedação de portas e janelas."
    };
    return acoes[param] || "Realizar vistoria técnica no ambiente.";
}
