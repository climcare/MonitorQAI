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

    // Valores dos Cards Principais (Compactados)
    document.getElementById('valTemperature').innerHTML = `${v.temperature ? v.temperature.toFixed(1) : (dadosBanco.temperature ? Number(dadosBanco.temperature).toFixed(1) : '--.-')}<span class="text-xl font-light opacity-40">°C</span>`;
    document.getElementById('valHumidity').innerHTML = `${v.humidity ? v.humidity.toFixed(1) : (dadosBanco.humidity ? Number(dadosBanco.humidity).toFixed(1) : '--.-')}<span class="text-xl font-light opacity-40">%</span>`;
    document.getElementById('valCO2').innerHTML = `${v.co2 || dadosBanco.co2 || '----'} <span class="text-base font-light opacity-40">PPM</span>`;
    
    const elOrvalho = document.getElementById('valPontoOrvalho');
    if (elOrvalho) {
        elOrvalho.innerHTML = `${relatorio.pontoOrvalho ? relatorio.pontoOrvalho.toFixed(1) : '--.-'}<span class="text-base font-light opacity-40">°C</span>`;
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

    // =========================================================================
    // MOTORES DE CORRELAÇÃO INTEGRADA (MASSA X CONTAGEM SEGUNDO DIRETRIZES OMS)
    // =========================================================================
    const avaliarAnomaliaParticula = (massa, contagem, limiteMassaCritico, limiteContagemCritico) => {
        if (!massa && !contagem) return "BOM";
        // Cenário Crítico: Massa pesada ou saturação severa por quantidade discreta (Invisível)
        if (massa > limiteMassaCritico || contagem > limiteContagemCritico) {
            return "CRITICO";
        }
        // Cenário de Alerta Preventivo por aproximação de limites higiênicos
        if (massa > (limiteMassaCritico * 0.5) || contagem > (limiteContagemCritico * 0.6)) {
            return "ALERTA";
        }
        return "BOM";
    };

    // Avaliações de Correlação Física por amostragem ambiental cruzada
    const statusC05  = avaliarAnomaliaParticula(m10, q10, 25, 80);   // Vírus e Bactérias 
    const statusC10  = avaliarAnomaliaParticula(m25, q25, 25, 90);   // Fumaça e Aerossóis
    const statusC25  = avaliarAnomaliaParticula(m40, q40, 35, 100);  // Poeira Atmosférica
    const statusC100 = avaliarAnomaliaParticula(m100, q100, 50, 100); // Pólen e Alérgenos

    // Lógica Semafórica dos Cards Principais
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

    // Status Geral Semafórico Superior (Texto Forçado para Cor Branca)
    const panelStatus = document.getElementById('panelStatusGeral');
    const txtStatus = document.getElementById('txtStatusGeral');
    
    if (relatorio.statusGeral === "CONFORME") {
        panelStatus.className = "rounded-2xl p-4 text-center shadow-md border-2 transition-all bg-emerald-500 text-white border-emerald-400";
        txtStatus.innerText = "🛡️ O AR DO AMBIENTE ESTÁ SEGURO E LIMPO";
        document.getElementById('panelTriagem').innerHTML = `
            <div class="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-emerald-600 dark:text-emerald-400 font-bold text-xs text-center">
                ✅ Tudo certo! O ar está ótimo para permanência. Nenhuma ação de mitigação é necessária agora.
            </div>`;
    } else {
        const critico = relatorio.statusGeral === "CRÍTICO";
        panelStatus.className = `rounded-2xl p-4 text-center shadow-md border-2 transition-all text-white ${critico ? 'bg-rose-600 border-rose-400 animate-pulse' : 'bg-amber-500 border-amber-400'}`;
        txtStatus.innerText = critico ? "🚨 ATENÇÃO: AR IMPRÓPRIO OU POLUÍDO DETECTADO NESTE AMBIENTE" : "⚠️ AVISO: O AR DO AMBIENTE PODE MELHORAR";

        // Geração dos Accordions na Lateral Direita
        let htmlAlertas = `
            <div class="bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-300/10 rounded-2xl p-3 space-y-2.5">
                <h3 class="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1">📋 Diretrizes Ativas</h3>
        `;

        if (relatorio.violacoes && relatorio.violacoes.length > 0) {
            relatorio.violacoes.forEach(erro => {
                const corBorda = erro.gravidade === 'CRÍTICO' ? 'border-rose-600' : 'border-amber-500';
                const corTexto = erro.gravidade === 'CRÍTICO' ? 'text-rose-600' : 'text-amber-500';

                htmlAlertas += `
                    <div class="bg-white dark:bg-slate-900 border-l-4 ${corBorda} rounded-xl p-3 shadow-sm">
                        <details class="group">
                            <summary class="flex justify-between items-center cursor-pointer list-none focus:outline-none">
                                <div class="space-y-0.5">
                                    <p class="text-[11px] font-black ${corTexto} uppercase tracking-tight">⚠️ ${obterNomeTraduzido(erro.parametro)}</p>
                                    <p class="text-[10px] text-slate-400 font-mono">Atual: ${erro.valor}${erro.unidade}</p>
                                </div>
                                <span class="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded font-bold text-slate-500 dark:text-slate-400 group-open:hidden">👉 Solução</span>
                                <span class="text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded font-bold text-slate-600 dark:text-slate-300 hidden group-open:inline">▲ Ocultar</span>
                            </summary>
                            <div class="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                                <p class="text-xs font-bold text-slate-700 dark:text-slate-300">${obterMensagemOMS(erro.parametro, erro.valor)}</p>
                                <div class="bg-sky-50 dark:bg-sky-950/30 rounded-lg p-2.5 border border-sky-100 dark:border-sky-900/40">
                                    <p class="text-[10px] font-mono font-bold text-sky-700 dark:text-sky-400 uppercase">🛠️ PLANO DE MITIGAÇÃO:</p>
                                    <p class="text-xs text-slate-700 dark:text-slate-200 font-medium mt-0.5">${obterMitigacaoOMS(erro.parametro)}</p>
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

    // =========================================================================
    // 3. FUSÃO COMPLETA: SEÇÃO UNIFICADA DE PESO E QUANTIDADE DE PARTÍCULAS
    // =========================================================================
    const quadroCorrelacao = document.getElementById('panelTriagemMassaQuantidade');
    if (quadroCorrelacao) {
        const tpsRaw = dadosBanco.tps || dadosBanco.bpt || t.tamanhoTipico || 0.45;
        const tamanhoTipicoFormatado = `${Number(tpsRaw).toFixed(2)} µm`;

        const obterClasseCor = (status) => {
            if (status === "ALERTA") return "text-amber-500";
            if (status === "CRITICO") return "text-rose-500";
            return "text-emerald-500";
        };

        // Altera as cores de contorno dos mini-cards dinamicamente baseando-se no cruzamento físico
        const obterClasseBorda = (status) => {
            if (status === "ALERTA") return "border-amber-500/70 bg-amber-500/5 dark:bg-amber-500/[0.02]";
            if (status === "CRITICO") return "border-rose-500 bg-rose-500/5 dark:bg-rose-500/[0.02] animate-pulse shadow-md shadow-rose-500/10";
            return "border-slate-100 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/50";
        };

        quadroCorrelacao.innerHTML = `
            <div class="space-y-3">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <h2 class="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">🔬 Análise Física de Partículas (Peso vs. Quantidade Real)</h2>
                    <span class="bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-400 text-[10px] font-mono px-2 py-0.5 rounded font-bold">
                        📐 TAMANHO MÉDIO RELEVANTE: ${tamanhoTipicoFormatado}
                    </span>
                </div>
                
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                    
                    <div class="p-3 border rounded-xl flex flex-col justify-between text-center transition-all duration-300 ${obterClasseBorda(statusC05)}">
                        <p class="text-[10px] text-slate-400 font-black uppercase tracking-tight">Vírus e Bactérias<br><span class="text-[8px] opacity-60 lowercase font-normal">(Partículas Extremamente Leves)</span></p>
                        <div class="my-2 space-y-1">
                            <p class="text-xs font-mono font-bold text-slate-500">Massa: <span class="text-sm font-black ${obterClasseCor(statusC05)}">${m10 > 0 ? m10.toFixed(2) : '--'} µg/m³</span></p>
                            <p class="text-xs font-mono font-bold text-slate-500">Contagem: <span class="text-sm font-black text-sky-600 dark:text-sky-400">${q10 > 0 ? q10.toFixed(0) : '--'} pt/cm³</span></p>
                        </div>
                    </div>

                    <div class="p-3 border rounded-xl flex flex-col justify-between text-center transition-all duration-300 ${obterClasseBorda(statusC10)}">
                        <p class="text-[10px] text-slate-400 font-black uppercase tracking-tight">Fumaça e Aerossóis<br><span class="text-[8px] opacity-60 lowercase font-normal">(Combustão e Suspensões Finas)</span></p>
                        <div class="my-2 space-y-1">
                            <p class="text-xs font-mono font-bold text-slate-500">Massa: <span class="text-sm font-black ${obterClasseCor(statusC10)}">${m25 > 0 ? m25.toFixed(2) : '--'} µg/m³</span></p>
                            <p class="text-xs font-mono font-bold text-slate-500">Contagem: <span class="text-sm font-black text-sky-600 dark:text-sky-400">${q25 > 0 ? q25.toFixed(0) : '--'} pt/cm³</span></p>
                        </div>
                    </div>

                    <div class="p-3 border rounded-xl flex flex-col justify-between text-center transition-all duration-300 ${obterClasseBorda(statusC25)}">
                        <p class="text-[10px] text-slate-400 font-black uppercase tracking-tight">Poeira Atmosférica<br><span class="text-[8px] opacity-60 lowercase font-normal">(Filtros Saturados e Poeira Fina)</span></p>
                        <div class="my-2 space-y-1">
                            <p class="text-xs font-mono font-bold text-slate-500">Massa: <span class="text-sm font-black ${obterClasseCor(statusC25)}">${m40 > 0 ? m40.toFixed(2) : '--'} µg/m³</span></p>
                            <p class="text-xs font-mono font-bold text-slate-500">Contagem: <span class="text-sm font-black text-sky-600 dark:text-sky-400">${q40 > 0 ? q40.toFixed(0) : '--'} pt/cm³</span></p>
                        </div>
                    </div>

                    <div class="p-3 border rounded-xl flex flex-col justify-between text-center transition-all duration-300 ${obterClasseBorda(statusC100)}">
                        <p class="text-[10px] text-slate-400 font-black uppercase tracking-tight">Pólen e Alérgenos<br><span class="text-[8px] opacity-60 lowercase font-normal">(Ácaros e Macropatrógenos)</span></p>
                        <div class="my-2 space-y-1">
                            <p class="text-xs font-mono font-bold text-slate-500">Massa: <span class="text-sm font-black ${obterClasseCor(statusC100)}">${m100 > 0 ? m100.toFixed(2) : '--'} µg/m³</span></p>
                            <p class="text-xs font-mono font-bold text-slate-500">Contagem: <span class="text-sm font-black text-sky-600 dark:text-sky-400">${q100 > 0 ? q100.toFixed(0) : '--'} pt/cm³</span></p>
                        </div>
                    </div>

                </div>
                <p class="text-[9px] text-slate-400 font-medium italic text-center block mt-1">💡 Entendimento Prático Integrado: O indicador de Massa aponta o peso total da sujidade acumulada por metro cúbico. A Contagem detalha exatamente quantas micropartículas discretas estão flutuando de forma invisível por centímetro cúbico (pt/cm³) no ambiente.</p>
            </div>
        `;
    }
}

function pintarCard(cardId, statusId, nivel) {
    const card = document.getElementById(cardId);
    const status = document.getElementById(statusId);
    if (!card || !status) return;
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

function obterNomeTraduzido(param) {
    const nomes = {
        "CO2": "Gás Carbônico (Ar Abafado)",
        "CO": "Monóxido de Carbono (Gás Tóxico)",
        "VOC": "Vapores Químicos (Cheiros/Produtos)",
        "PM1.0": "Partículas de Vírus e Bactérias (PM1.0)",
        "PM2.5": "Partículas de Fumaça e Aerossóis (PM2.5)",
        "PM4.0": "Partículas de Poeira Atmosférica (PM4.0)",
        "PM10": "Partículas de Pólen e Alérgenos (PM10)",
        "NC0.5": "Contagem de Vírus e Bactérias",
        "NC1.0": "Contagem de Fumaça e Aerossóis",
        "NC2.5": "Contagem de Poeira Fina",
        "NC10.0": "Contagem de Pólen e Alérgenos",
        "Temperatura": "Temperatura do Ambiente",
        "Umidade": "Umidade do Ar"
    };
    return nomes[param] || param;
}

function obterMensagemOMS(param, valor) {
    const mensagens = {
        "CO2": `⚠️ O ar está ficando abafado por falta de circulação externa. Isso pode induzir sonolência, queda de rendimento intelectual e aumentar a persistência de aerossóis biológicos no ambiente.`,
        "CO": `🚨 Gás altamente tóxico detectado! Risco iminente e severo à integridade do sistema respiratório de todos os ocupantes.`,
        "VOC": `⚠️ Concentração de compostos voláteis orgânicos detectada (produtos químicos suspensos, solventes ou sprays sanitizantes).`,
        "PM1.0": `🚨 Concentração crítica de partículas ultrafinas. Esses microrganismos conseguem penetrar profundamente os alvéolos pulmonares.`,
        "PM2.5": `🚨 Nível elevado de fumaça, fuligem ou suspensões industriais finas que ultrapassam as barreiras de filtragem naturais das vias superiores.`,
        "PM4.0": `🌬️ Excesso de poeira e material particulado mineral em suspensão direta no ambiente.`,
        "PM10": `🍂 Elevada presença de poeiras macroscópicas, alérgenos fúngicos ou ácaros, altamente prejudicial para indivíduos com quadros asmáticos ou rinite.`,
        "NC0.5": `🚨 Alta quantidade de micropartículas discretas na faixa de vírus flutuando no espaço físico.`,
        "NC1.0": `🚨 Densidade volumétrica de partículas associadas à fumaça e microaerossóis fora dos limites de segurança recomendados.`,
        "NC2.5": `⚠️ Contagem de partículas finas de poeira flutuando de forma dispersa pelo ambiente.`,
        "NC10.0": `🍂 Quantidade excessiva de macropartículas flutuantes (como pólen ou ácaros) atuando como gatilhos alérgicos activos.`,
        "Temperatura": `🌡️ O nível térmico registrado encontra-se fora dos parâmetros de estabilidade de conforto recomendados para permanência prolongada.`,
        "Umidade": `💧 Balanço higrométrico inadequado (ar excessivamente seco ou muito saturado), facilitando a propagação de patógenos ou proliferação de mofo.`
    };
    return mensagens[param] || "Um dos indicadores ambientais desestabilizou e saiu da zona segura recomendada.";
}

function obterMitigacaoOMS(param) {
    const acoes = {
        "CO2": "Promova abertura imediata de portas e janelas periféricas para promover renovação de ar externa, ou eleve a taxa de captação forçada do sistema de ventilação mecânica.",
        "CO": "EVACUE O AMBIENTE IMEDIATAMENTE. Abra todas as saídas e acione os protocolos de emergência/manutenção predial.",
        "VOC": "Interrompa a manipulação de produtos químicos ou sprays no local e ative exaustores ou purificadores de ar dedicados.",
        "PM1.0": "Ligue purificadores equipados com filtragem absoluta HEPA em potência máxima e assegure circulação de ar limpo no recinto.",
        "PM2.5": "Se houver fumaça externa infiltrando, feche as janelas frontais e acione recirculação com purificação forçada de ar imediatamente.",
        "PM4.0": "Recomenda-se realizar higienização de superfícies com pano úmido para capturar o particulado decantado.",
        "PM10": "Abra as passagens de ar para diluição de alérgenos e providencie a limpeza imediata de filtros de climatização.",
        "NC0.5": "Eleve a renovação volumétrica de ar externo e certifique-se de que os purificadores estejam com os filtros ativos na velocidade máxima.",
        "NC1.0": "Ligue sistemas de filtragem imediata e bloqueie fontes geradoras de fumaça próximas às entradas de ar.",
        "NC2.5": "Monitore os filtros do ambiente e limpe o piso com pano úmido para mitigar o levantamento de poeira suspensa.",
        "NC10.0": "Ative ciclos de filtragem e mantenha janelas fechadas caso esteja ocorrendo picos de pólen externo trazidos pelo vento.",
        "Temperatura": "Ajuste o controle central de climatização/termostato de modo a trazer e estabilizar o ambiente estritamente entre 20°C e 24°C.",
        "Umidade": "Se o ar estiver seco, utilize umidificação controlada; se estiver saturado, ative a função de desumidificação do sistema mecânico ou ar-condicionado."
    };
    return acoes[param] || "Comunique a equipe técnica de manutenção ou alterne aberturas de ventilação para renovação do ar.";
}
