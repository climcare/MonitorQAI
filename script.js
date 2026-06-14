const SUPABASE_URL = 'https://iaylyacrzurcjwvtecpu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pkzx4u5U9Xr407syiBE9yA_G7hUvGaw';

let supabaseClient = null;

window.onload = async () => {
    inicializarGerenciadorTema();
    inicializarGavetaAvancada();

    if (typeof supabase !== "undefined") {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        await processarCicloMonitoramento();
        setInterval(processarCicloMonitoramento, 15000); 
    }
};

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

    const temaSalvo = localStorage.getItem('qai-tema') || 'light';
    if (temaSalvo === 'dark') {
        htmlElement.classList.add('dark');
        ico.innerText = '☀️';
        txt.innerText = 'Modo Diurno';
    } else {
        htmlElement.classList.remove('dark');
        ico.innerText = '🌙';
        txt.innerText = 'Modo Noturno';
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

    // Atualização de carimbo de hora simplificado
    document.getElementById('txtTimestamp').innerText = `⏱️ ATUALIZADO EM: ${new Date(relatorio.carimbotempo).toLocaleTimeString('pt-BR')}`;

    // Valores gigantescos na tela
    document.getElementById('valTemperature').innerHTML = `${v.temperature ? v.temperature.toFixed(1) : '--.-'}<span class="text-2xl font-normal text-slate-400">°C</span>`;
    document.getElementById('valHumidity').innerHTML = `${v.humidity ? v.humidity.toFixed(1) : '--.-'}<span class="text-2xl font-normal text-slate-400">%</span>`;
    document.getElementById('valDewPoint').innerHTML = `${relatorio.pontoOrvalho ? relatorio.pontoOrvalho.toFixed(1) : '--.-'}<span class="text-xl font-normal text-sky-400">°C</span>`;

    document.getElementById('valCO2').innerHTML = `${v.co2 || '----'}<span class="text-xs font-normal text-slate-400"> ppm</span>`;
    document.getElementById('valCO').innerHTML = `${v.co ? v.co.toFixed(1) : '--.-'}<span class="text-xs font-normal text-slate-400"> ppm</span>`;
    document.getElementById('valPM25').innerHTML = `${v.pm25 ? v.pm25.toFixed(1) : '--.-'}<span class="text-xs font-normal text-slate-400"> µg</span>`;

    // Dados frios para manutenção escondidos na gaveta técnica
    document.getElementById('txtDeviceId').innerText = relatorio.dispositivoId || '--';
    document.getElementById('txtSignal').innerText = `${t.sinalRede || '--'} dBm`;
    document.getElementById('valNC05').innerText = t.contagemParticulas.nc0_5 ? t.contagemParticulas.nc0_5.toFixed(0) : '--';
    document.getElementById('valNC10').innerText = t.contagemParticulas.nc1_0 ? t.contagemParticulas.nc1_0.toFixed(0) : '--';
    document.getElementById('valNC25').innerText = t.contagemParticulas.nc2_5 ? t.contagemParticulas.nc2_5.toFixed(0) : '--';
    document.getElementById('valNC100').innerText = t.contagemParticulas.nc10_0 ? t.contagemParticulas.nc10_0.toFixed(0) : '--';

    const panelStatus = document.getElementById('panelStatusGeral');
    const txtStatus = document.getElementById('txtStatusGeral');
    const panelTriagem = document.getElementById('panelTriagem');

    // Modificadores de legenda rápida nos cards principais
    const lblTemp = document.getElementById('lblStatusTemp');
    const lblHum = document.getElementById('lblStatusHum');

    // Resetar estilos padrão para evitar duplicação de classes
    lblTemp.className = "text-[11px] font-bold uppercase tracking-wider";
    lblHum.className = "text-[11px] font-bold uppercase tracking-wider";

    if (relatorio.statusGeral === "CONFORME") {
        panelStatus.className = "rounded-2xl p-4 text-center shadow-sm border transition-all bg-emerald-500 text-white border-emerald-600";
        txtStatus.innerText = "🟢 Ambiente Seguro e Normalizado";
        lblTemp.innerText = "✅ Temperatura Ideal"; lblTemp.classList.add("text-emerald-600");
        lblHum.innerText = "✅ Umidade Ideal"; lblHum.classList.add("text-emerald-600");
        
        panelTriagem.innerHTML = `
            <div class="bg-emerald-500 text-white font-bold rounded-2xl p-4 text-sm flex items-center gap-3 shadow-md">
                <span class="text-xl">👍</span>
                <span>Nenhuma ação necessária. Todos os sistemas operando perfeitamente.</span>
            </div>
        `;
    } else {
        const isCritico = relatorio.statusGeral === "CRÍTICO";
        
        if (isCritico) {
            panelStatus.className = "rounded-2xl p-4 text-center shadow-sm border transition-all bg-rose-600 text-white border-rose-700 animate-pulse";
            txtStatus.innerText = "🚨 Alerta Crítico Detectado";
        } else {
            panelStatus.className = "rounded-2xl p-4 text-center shadow-sm border transition-all bg-amber-500 text-white border-amber-600";
            txtStatus.innerText = "⚠️ Atenção Operacional Solicitada";
        }

        let htmlAlertas = "";
        relatorio.violacoes.forEach(erro => {
            const criticoErro = erro.gravidade === "CRÍTICO";
            const bgBadge = criticoErro ? "bg-rose-600 text-white" : "bg-amber-500 text-white";
            
            if(erro.parametro === "Temperatura") {
                lblTemp.innerText = "❌ Alvo Inadequado";
                lblTemp.classList.add(criticoErro ? "text-rose-600" : "text-amber-500");
            }
            if(erro.parametro === "Umidade") {
                lblHum.innerText = "❌ Alvo Inadequado";
                lblHum.classList.add(criticoErro ? "text-rose-600" : "text-amber-500");
            }

            htmlAlertas += `
                <div class="bg-white dark:bg-slate-900 rounded-2xl p-4 border-l-8 ${criticoErro ? 'border-rose-600' : 'border-amber-500'} shadow-sm space-y-2">
                    <div class="flex justify-between items-center">
                        <span class="text-xs font-black uppercase tracking-wider ${criticoErro ? 'text-rose-600' : 'text-amber-500'}">PROBLEMA: ${erro.parametro.toUpperCase()}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-md font-bold ${bgBadge}">LIDO: ${erro.valor}${erro.unidade}</span>
                    </div>
                    <div class="text-sm font-bold text-slate-800 dark:text-slate-100">
                        👉 Solução Rápida: <span class="text-sky-600 dark:text-sky-400 underline">${obterInstrucaoDireta(erro.parametro)}</span>
                    </div>
                </div>
            `;
        });
        panelTriagem.innerHTML = htmlAlertas;
    }
}

function obterInstrucaoDireta(parametro) {
    switch (parametro) {
        case "CO2": return "Abra a captação de ar externo ou janelas do local.";
        case "CO": return "Evacue o local imediatamente e desligue máquinas externas.";
        case "VOC": return "Pare o uso de produtos de limpeza fortes e ligue os exaustores.";
        case "PM2.5":
        case "PM10": return "Troque ou limpe os filtros de ar do aparelho de ventilação.";
        case "Temperatura": return "Regule o controle do ar-condicionado para esfriar o ambiente.";
        case "Umidade": return "Regule a ventilação mecânica para extrair o excesso de umidade.";
        default: return "Realizar checagem mecânica preventiva na infraestrutura.";
    }
}
