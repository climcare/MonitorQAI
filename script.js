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
            atualizarInterfaceVisual(relatorio, leituraBruta);
        }
    } catch (err) { console.error(err); }
}

function atualizarInterfaceVisual(relatorio, leituraBruta = {}) {
    const v = relatorio.valoresAtuais || {};
    const t = relatorio.telemetriaAvancada || {};
    const dadosBanco = leituraBruta || {};

    // Telemetria do Topo
    document.getElementById('txtDeviceId').innerText = relatorio.dispositivoId || dadosBanco.device_id || '--';
    document.getElementById('txtSignal').innerText = `${t.sinalRede || dadosBanco.signal || '--'} dBm`;
    document.getElementById('txtTimestamp').innerText = `⏱️ ATUALIZADO EM: ${new Date(relatorio.carimbotempo || dadosBanco.created_at).toLocaleTimeString('pt-BR')}`;

    // Valores dos Cards Principais (Padrão de Cores Nativo de Cada Tema Restaurado)
    document.getElementById('valTemperature').innerHTML = `${v.temperature ? v.temperature.toFixed(1) : (dadosBanco.temperature ? Number(dadosBanco.temperature).toFixed(1) : '--.-')}<span class="text-xl font-light opacity-40">°C</span>`;
    document.getElementById('valHumidity').innerHTML = `${v.humidity ? v.humidity.toFixed(1) : (dadosBanco.humidity ? Number(dadosBanco.humidity).toFixed(1) : '--.-')}<span class="text-xl font-light opacity-40">%</span>`;
    
    // CO2 mantendo estritamente a cor padrão do tema (Preto/Branco conforme ambiente)
    const valorCO2fleshy = v.co2 || dadosBanco.co2 || '----';
    document.getElementById('valCO2').innerHTML = `<span class="text-slate-900 dark:text-white font-black text-3xl sm:text-4xl">${valorCO2fleshy}</span> <span class="text-base font-light opacity-40">PPM</span>`;
    
    // Ponto de Orvalho limpo e sem elementos obstrutivos internos
    const elOrvalho = document.getElementById('valPontoOrvalho');
    if (elOrvalho) {
        const valorOrvalho = relatorio.pontoOrvalho ? relatorio.pontoOrvalho.toFixed(1) : '--.-';
        elOrvalho.innerHTML = `<span class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">${valorOrvalho}</span><span class="text-xl font-light opacity-40">°C</span>`;
    }

    // Coleta dos dados brutos de Massa
    const m10 = Number(dadosBanco.pm1_0 || v.pm1_0 || v["PM1.0"] || 0);
    const m25 = Number(dadosBanco.pm25 || v.pm25 || v["PM2.5"] || 0);
    const m40 = Number(dadosBanco.pm4_0 || v.pm4_0 || v["PM4.0"] || v.pm40 || 0);
    const m100 = Number(dadosBanco.pm10 || v.pm10 || v["PM10"] || 0);

    // Coleta dos dados brutos de Contagem Quantitativa
    const contagem = t.contagemParticulas || {};
    const q10 = contagem.nc0_5 ? contagem.nc0_5 : (dadosBanco.nc0_5 ? Number(dadosBanco.nc0_5) : 0);
    const q25 = contagem.nc1_0 ? contagem.nc1_0 : (dadosBanco.nc1_0 ? Number(dadosBanco.nc1_0) : 0);
    const q40 = contagem.nc2_5 ? contagem.nc2_5 : (dadosBanco.nc2_5 ? Number(dadosBanco.nc2_5) : 0);
    const q100 = contagem.nc10_0 ? contagem.nc10_0 : (dadosBanco.nc10_0 ? Number(dadosBanco.nc10_0) : 0);

    // Motores de Correlação de Partículas
    const avaliarAnomaliaParticula = (massa, contagem, statusIndividualContagem, limiteMassaCritico) => {
        if (!massa && !contagem) return "BOM";
        if (statusIndividualContagem === "CRÍTICO" || massa > limiteMassaCritico) return "CRITICO";
        if (statusIndividualContagem === "ALERTA" || massa > (limiteMassaCritico * 0.5)) return "ALERTA";
        return "BOM";
    };

    const statusC05  = avaliarAnomaliaParticula(m10, q10, relatorio.analiseIndividual.nc05, 25);
    const statusC10  = avaliarAnomaliaParticula(m25, q25, relatorio.analiseIndividual.nc10, 15);
    const statusC25  = avaliarAnomaliaParticula(m40, q40, "BOM", 40);
    const statusC100 = avaliarAnomaliaParticula(m100, q100, relatorio.analiseIndividual.nc100, 50);

    // Lógica Semafórica dos Cards Principais (Muda apenas a borda e o badge inferior)
    pintarCard('cardTemp', 'statusTemp', relatorio.analiseIndividual.temperatura);
    pintarCard('cardHum', 'statusHum', relatorio.analiseIndividual.umidade);
    pintarCard('cardCO2', 'statusCO2', relatorio.analiseIndividual.co2);
    
    if (document.getElementById('cardOrvalho')) {
        pintarCard('cardOrvalho', 'statusOrvalho', relatorio.analiseIndividual.umidade);
    }

    // Banner de Alerta Crítico Físico
    const bannerInfo = document.getElementById('alertaInfoCritico');
    if (bannerInfo) {
        if (relatorio.statusGeral === "CRÍTICO") bannerInfo.classList.remove('hidden');
        else bannerInfo.classList.add('hidden');
    }

    // Status Geral Semafórico Superior
    const panelStatus = document.getElementById('panelStatusGeral');
    const txtStatus = document.getElementById('txtStatusGeral');
    
    if (relatorio.statusGeral === "CONFORME") {
        panelStatus.className = "rounded-2xl p-4 text-center shadow-md border-2 transition-all bg-emerald-500 text-white border-emerald-400";
        txtStatus.className = "text-base font-black uppercase tracking-wider text-white";
        txtStatus.innerText = "🛡️ AMBIENTE EM CONFORMIDADE COM A ANVISA & NBR 17037";
        document.getElementById('panelTriagem').innerHTML = `
            <div class="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-emerald-600 dark:text-emerald-400 font-bold text-xs text-center">
                ✅ Parâmetros em conformidade normativa. Nenhuma ação corretiva é necessária para este ambiente climatizado.
            </div>`;
    } else {
        const critico = relatorio.statusGeral === "CRÍTICO";
        panelStatus.className = `rounded-2xl p-4 text-center shadow-md border-2 transition-all text-white ${critico ? 'bg-rose-600 border-rose-400 animate-pulse' : 'bg-amber-500 border-amber-400'}`;
        txtStatus.className = "text-base font-black uppercase tracking-wider text-white";
        txtStatus.innerText = critico ? "🚨 DESVIOS CRÍTICOS DETECTADOS RELATIVOS ÀS NORMAS ANVISA" : "⚠️ AVISO: PARÂMETROS HIGIÊNICOS EM ATENÇÃO PREVENTIVA";

        // Geração da Triagem Lateral Direita
        let htmlAlertas = `
            <div class="bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-300/10 rounded-2xl p-3 space-y-2.5">
                <h3 class="text-[11px] font-black uppercase text-slate-500 dark:text-slate-500 tracking-wider mb-1">📋 Diretrizes Técnicas Ativas</h3>
        `;

        if (relatorio.violacoes && relatorio.violacoes.length > 0) {
            // [MUDANÇA ESSENCIAL]: Se a umidade estiver em atenção ou crítico, injetamos o Ponto de Orvalho na Triagem
            const possuiDesvioUmidade = relatorio.violacoes.some(e => e.parametro === "Umidade");
            const jaPossuiOrvalho = relatorio.violacoes.some(e => e.parametro === "PontoOrvalho");
            
            if (possuiDesvioUmidade && !jaPossuiOrvalho) {
                relatorio.violacoes.push({
                    parametro: "PontoOrvalho",
                    valor: relatorio.pontoOrvalho ? relatorio.pontoOrvalho.toFixed(1) : '--',
                    unidade: "°C",
                    gravidade: relatorio.analiseIndividual.umidade
                });
            }

            relatorio.violacoes.forEach(erro => {
                const corBorda = erro.gravidade === 'CRÍTICO' ? 'border-rose-600' : 'border-amber-500';
                const corTexto = erro.gravidade === 'CRÍTICO' ? 'text-rose-600' : 'text-amber-500';

                htmlAlertas += `
                    <div class="bg-white dark:bg-slate-900 border-l-4 ${corBorda} rounded-xl p-3 shadow-sm">
                        <details class="group">
                            <summary class="flex justify-between items-center cursor-pointer list-none focus:outline-none">
                                <div class="space-y-0.5">
                                    <p class="text-[11px] font-black ${corTexto} uppercase tracking-tight">⚠️ ${obterNomeTraduzido(erro.parametro)}</p>
                                    <p class="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Atual: ${erro.valor}${erro.unidade}</p>
                                </div>
                                <span class="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded font-bold text-slate-500 dark:text-slate-400 group-open:hidden">👉 Solução</span>
                                <span class="text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded font-bold text-slate-600 dark:text-slate-300 hidden group-open:inline">▲ Ocultar</span>
                            </summary>
                            <div class="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                                <p class="text-xs font-bold text-slate-700 dark:text-slate-300">${obterMensagemAnvisa(erro.parametro, erro.valor)}</p>
                                <div class="bg-sky-50 dark:bg-sky-950/30 rounded-lg p-2.5 border border-sky-100 dark:border-sky-900/40">
                                    <p class="text-[10px] font-mono font-bold text-sky-700 dark:text-sky-400 uppercase">🛠️ PROTOCOLO DE MITIGAÇÃO HIGIÊNICA:</p>
                                    <p class="text-xs text-slate-700 dark:text-slate-200 font-medium mt-0.5">${obterMitigacaoAnvisa(erro.parametro)}</p>
                                </div>
                            </div>
                        </details>
                    </div>
                `;
            });
        }
        htmlAlertas += `</div>`;
        document.getElementById('panelTriagem').innerHTML = htmlAlertas;
    }

    // Seção de Partículas (Peso vs Quantidade Real)
    const quadroCorrelacao = document.getElementById('panelTriagemMassaQuantidade');
    if (quadroCorrelacao) {
        const tpsRaw = dadosBanco.tps || dadosBanco.bpt || t.tamanhoTipico || 0.45;
        const tamanhoTipicoFormatado = `${Number(tpsRaw).toFixed(2)} µm`;

        const obtenerClasseCor = (status) => {
            if (status === "ALERTA") return "text-amber-500 dark:text-amber-400";
            if (status === "CRITICO") return "text-rose-500 dark:text-rose-400";
            return "text-emerald-500 dark:text-emerald-400";
        };

        const obtenerClasseBorda = (status) => {
            if (status === "ALERTA") return "border-amber-500/70 bg-amber-500/5 dark:bg-amber-500/[0.02]";
            if (status === "CRITICO") return "border-rose-500 bg-rose-500/5 dark:bg-rose-500/[0.02] animate-pulse";
            return "border-slate-200 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/50";
        };

        quadroCorrelacao.innerHTML = `
            <div class="space-y-4">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 px-1">
                    <h2 class="text-sm sm:text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        🔬 Análise Física de Partículas (Peso vs. Quantidade Real - NBR 17037)
                    </h2>
                    <span class="bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-400 text-xs sm:text-[10px] font-mono px-2.5 py-1 rounded-md font-bold border border-sky-200/50 dark:border-sky-900/30 text-center">
                        📐 TAMANHO MÉDIO RELEVANTE: ${tamanhoTipicoFormatado}
                    </span>
                </div>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div class="p-4 border rounded-2xl flex flex-col justify-between text-center ${obtenerClasseBorda(statusC05)}">
                        <div><p class="text-xs text-slate-900 dark:text-white font-black uppercase tracking-tight">Bioaerossóis flutuantes</p></div>
                        <div class="my-2 py-2 bg-slate-50 dark:bg-slate-900/80 rounded-xl space-y-1">
                            <p class="text-xs font-mono font-bold">Massa: <span class="${obtenerClasseCor(statusC05)}">${m10 > 0 ? m10.toFixed(2) : '--'} µg/m³</span></p>
                            <p class="text-xs font-mono font-bold">Contagem: <span class="text-sky-600">${q10 > 0 ? q10.toFixed(0) : '--'} pt/cm³</span></p>
                        </div>
                    </div>
                    <div class="p-4 border rounded-2xl flex flex-col justify-between text-center ${obtenerClasseBorda(statusC10)}">
                        <div><p class="text-xs text-slate-900 dark:text-white font-black uppercase tracking-tight">Aerossóis e Fumaças</p></div>
                        <div class="my-2 py-2 bg-slate-50 dark:bg-slate-900/80 rounded-xl space-y-1">
                            <p class="text-xs font-mono font-bold">Massa: <span class="${obtenerClasseCor(statusC10)}">${m25 > 0 ? m25.toFixed(2) : '--'} µg/m³</span></p>
                            <p class="text-xs font-mono font-bold">Contagem: <span class="text-sky-600">${q25 > 0 ? q25.toFixed(0) : '--'} pt/cm³</span></p>
                        </div>
                    </div>
                    <div class="p-4 border rounded-2xl flex flex-col justify-between text-center ${obtenerClasseBorda(statusC25)}">
                        <div><p class="text-xs text-slate-900 dark:text-white font-black uppercase tracking-tight">Poeira Inalável Fina</p></div>
                        <div class="my-2 py-2 bg-slate-50 dark:bg-slate-900/80 rounded-xl space-y-1">
                            <p class="text-xs font-mono font-bold">Massa: <span class="${obtenerClasseCor(statusC25)}">${m40 > 0 ? m40.toFixed(2) : '--'} µg/m³</span></p>
                            <p class="text-xs font-mono font-bold">Contagem: <span class="text-sky-600">${q40 > 0 ? q40.toFixed(0) : '--'} pt/cm³</span></p>
                        </div>
                    </div>
                    <div class="p-4 border rounded-2xl flex flex-col justify-between text-center ${obtenerClasseBorda(statusC100)}">
                        <div><p class="text-xs text-slate-900 dark:text-white font-black uppercase tracking-tight">Particulado Macroscópico</p></div>
                        <div class="my-2 py-2 bg-slate-50 dark:bg-slate-900/80 rounded-xl space-y-1">
                            <p class="text-xs font-mono font-bold">Massa: <span class="${obtenerClasseCor(statusC100)}">${m100 > 0 ? m100.toFixed(2) : '--'} µg/m³</span></p>
                            <p class="text-xs font-mono font-bold">Contagem: <span class="text-sky-600">${q100 > 0 ? q100.toFixed(0) : '--'} pt/cm³</span></p>
                        </div>
                    </div>
                </div>

                <div class="bg-slate-100 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60 p-3 rounded-xl">
                    <p class="text-xs sm:text-[11px] text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                        <span class="font-bold text-slate-900 dark:text-white">💡 Entendimento Prático:</span> 
                        A <span class="underline decoration-emerald-500 decoration-2">Massa</span> indica a concentração acumulada no metro cúbico. A <span class="underline decoration-sky-500 decoration-2">Contagem</span> detalha o perfil volumétrico discreto (pt/cm³) de impurezas dinâmicas no ar interior, conforme a regulamentação higiênica nacional.
                    </p>
                </div>
            </div>
        `;
    }
}

function pintarCard(cardId, statusId, nivel) {
    const card = document.getElementById(cardId);
    const status = document.getElementById(statusId);
    if (!card || !status) return;
    card.className = card.className.replace(/(border-\S+)/g, '');
    status.className = status.className.replace(/(bg-\S+|text-\S+)/g, '');

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

function obterNomeTraduzido(param) {
    const nomes = {
        "CO2": "Dióxido de Carbono (Renovação do Ar)",
        "CO": "Monóxido de Carbono (Gás Tóxico)",
        "VOC": "Compostos Orgânicos Voláteis (Precursores Químicos)",
        "PM1.0": "Massa de Bioaerossóis Submicrométricos (PM1.0)",
        "PM2.5": "Massa de Partículas Finas Inaláveis (PM2.5)",
        "PM4.0": "Massa de Material Particulado Isocinético (PM4.0)",
        "PM10": "Concentração Gravimétrica Total (PM10)",
        "Temperatura": "Temperatura Operacional Local",
        "Umidade": "Umidade Relativa do Ar Interior",
        "PontoOrvalho": "Perigo de Condensação (Ponto de Orvalho)"
    };
    return nomes[param] || param;
}

function obterMensagemAnvisa(param, valor) {
    const mensagens = {
        "CO2": `⚠️ Renovação do ar inadequada. Concentração de CO₂ excedendo a meta estipulada de 1000 PPM.`,
        "Temperatura": `🌡️ Temperatura fora da faixa de conforto térmico recomendada pela ANVISA (20°C a 24°C).`,
        "Umidade": `💧 Desvio higrométrico: Umidade fora da banda ideal de conformidade (40% a 65%).`,
        "PontoOrvalho": `🚨 Risco iminente de saturação: A alta umidade indica que o ar pode condensar em superfícies frias, gerando gotículas de água que estragam eletroeletrônicos e causam mofo.`
    };
    return mensagens[param] || "Parâmetro ambiental em desconformidade amostral mecânica.";
}

function obterMitigacaoAnvisa(param) {
    const acoes = {
        "CO2": "Incremente o volume de captação de ar externo do ambiente ou force aberturas localizadas em janelas.",
        "Temperatura": "Ajuste o termostato para estabilizar a temperatura operacional rigorosamente entre 20°C e 24°C.",
        "Umidade": "Ative os estágios mecânicos de desumidificação do sistema ou verifique se há infiltrações externas.",
        "PontoOrvalho": "Ative imediatamente a função de desumidificação do sistema de climatização ou ligue um desumidificador mecânico no recinto para conter a umidade."
    };
    return acoes[param] || "Consulte o técnico responsável pelo PMOC do edifício.";
}
