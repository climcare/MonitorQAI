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
    // MOTORES DE CORRELAÇÃO INTEGRADA - EQUALIZADO COM NORMAS_QAI DO ANALYSIS
    // =========================================================================
    const avaliarAnomaliaParticula = (massa, contagem, statusIndividualContagem, limiteMassaCritico) => {
        if (!massa && !contagem) return "BOM";
        
        // Se a contagem disparou CRÍTICO ou ALERTA no analysis, o card acompanha imediatamente
        if (statusIndividualContagem === "CRÍTICO" || massa > limiteMassaCritico) {
            return "CRITICO";
        }
        if (statusIndividualContagem === "ALERTA" || massa > (limiteMassaCritico * 0.5)) {
            return "ALERTA";
        }
        return "BOM";
    };

    // Ajuste fino mapeando diretamente os status validados de cada faixa do modulo semafórico do analysis
    const statusC05  = avaliarAnomaliaParticula(m10, q10, relatorio.analiseIndividual.nc05, 25);   // Vírus e Bactérias
    const statusC10  = avaliarAnomaliaParticula(m25, q25, relatorio.analiseIndividual.nc10, 15);   // Aerossóis e Fumaças (Alinhado a PM2.5 max: 15)
    const statusC25  = avaliarAnomaliaParticula(m40, q40, "BOM", 40);                              // Poeira Inalável Fina
    const statusC100 = avaliarAnomaliaParticula(m100, q100, relatorio.analiseIndividual.nc100, 50); // Particulado Macroscópico (Pólen alinhado a PM10 max: 50)

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

        // Geração dos Accordions na Lateral Direita
        let htmlAlertas = `
            <div class="bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-300/10 rounded-2xl p-3 space-y-2.5">
                <h3 class="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1">📋 Diretrizes Técnicas Ativas</h3>
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

    // =========================================================================
    // 3. SEÇÃO UNIFICADA DE PESO E QUANTIDADE DE PARTÍCULAS
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

        const obterClasseBorda = (status) => {
            if (status === "ALERTA") return "border-amber-500/70 bg-amber-500/5 dark:bg-amber-500/[0.02]";
            if (status === "CRITICO") return "border-rose-500 bg-rose-500/5 dark:bg-rose-500/[0.02] animate-pulse shadow-md shadow-rose-500/10";
            return "border-slate-100 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/50";
        };

        quadroCorrelacao.innerHTML = `
            <div class="space-y-3">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <h2 class="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">🔬 Análise Física de Partículas (Peso vs. Quantidade Real - NBR 17037)</h2>
                    <span class="bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-400 text-[10px] font-mono px-2 py-0.5 rounded font-bold">
                        📐 TAMANHO MÉDIO RELEVANTE: ${tamanhoTipicoFormatado}
                    </span>
                </div>
                
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                    
                    <div class="p-3 border rounded-xl flex flex-col justify-between text-center transition-all duration-300 ${obterClasseBorda(statusC05)}">
                        <p class="text-[10px] text-slate-400 font-black uppercase tracking-tight">Bioaerossóis flutuantes<br><span class="text-[8px] opacity-60 lowercase font-normal">(Indicadores microscópicos leves)</span></p>
                        <div class="my-2 space-y-1">
                            <p class="text-xs font-mono font-bold text-slate-500">Massa: <span class="text-sm font-black ${obterClasseCor(statusC05)}">${m10 > 0 ? m10.toFixed(2) : '--'} µg/m³</span></p>
                            <p class="text-xs font-mono font-bold text-slate-500">Contagem: <span class="text-sm font-black text-sky-600 dark:text-sky-400">${q10 > 0 ? q10.toFixed(0) : '--'} pt/cm³</span></p>
                        </div>
                    </div>

                    <div class="p-3 border rounded-xl flex flex-col justify-between text-center transition-all duration-300 ${obterClasseBorda(statusC10)}">
                        <p class="text-[10px] text-slate-400 font-black uppercase tracking-tight">Aerossóis e Fumaças<br><span class="text-[8px] opacity-60 lowercase font-normal">(Combustões e Frações Finas)</span></p>
                        <div class="my-2 space-y-1">
                            <p class="text-xs font-mono font-bold text-slate-500">Massa: <span class="text-sm font-black ${obterClasseCor(statusC10)}">${m25 > 0 ? m25.toFixed(2) : '--'} µg/m³</span></p>
                            <p class="text-xs font-mono font-bold text-slate-500">Contagem: <span class="text-sm font-black text-sky-600 dark:text-sky-400">${q25 > 0 ? q25.toFixed(0) : '--'} pt/cm³</span></p>
                        </div>
                    </div>

                    <div class="p-3 border rounded-xl flex flex-col justify-between text-center transition-all duration-300 ${obterClasseBorda(statusC25)}">
                        <p class="text-[10px] text-slate-400 font-black uppercase tracking-tight">Poeira Inalável Fina<br><span class="text-[8px] opacity-60 lowercase font-normal">(Sedimentáveis e Suspensões)</span></p>
                        <div class="my-2 space-y-1">
                            <p class="text-xs font-mono font-bold text-slate-500">Massa: <span class="text-sm font-black ${obterClasseCor(statusC25)}">${m40 > 0 ? m40.toFixed(2) : '--'} µg/m³</span></p>
                            <p class="text-xs font-mono font-bold text-slate-500">Contagem: <span class="text-sm font-black text-sky-600 dark:text-sky-400">${q40 > 0 ? q40.toFixed(0) : '--'} pt/cm³</span></p>
                        </div>
                    </div>

                    <div class="p-3 border rounded-xl flex flex-col justify-between text-center transition-all duration-300 ${obterClasseBorda(statusC100)}">
                        <p class="text-[10px] text-slate-400 font-black uppercase tracking-tight">Particulado Macroscópico<br><span class="text-[8px] opacity-60 lowercase font-normal">(Alérgenos e Frações Grossas)</span></p>
                        <div class="my-2 space-y-1">
                            <p class="text-xs font-mono font-bold text-slate-500">Massa: <span class="text-sm font-black ${obterClasseCor(statusC100)}">${m100 > 0 ? m100.toFixed(2) : '--'} µg/m³</span></p>
                            <p class="text-xs font-mono font-bold text-slate-500">Contagem: <span class="text-sm font-black text-sky-600 dark:text-sky-400">${q100 > 0 ? q100.toFixed(0) : '--'} pt/cm³</span></p>
                        </div>
                    </div>

                </div>
                <p class="text-[9px] text-slate-400 font-medium italic text-center block mt-1">💡 Entendimento Prático Integrado: A Massa indica a concentração gravimétrica ponderada acumulada no metro cúbico. A Contagem detalha o perfil volumétrico discreto (pt/cm³) de impurezas dinâmicas no ar interior, conforme preconiza a regulamentação higiênica nacional.</p>
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
        "CO2": "Dióxido de Carbono (Renovação do Ar)",
        "CO": "Monóxido de Carbono (Gás Tóxico)",
        "VOC": "Compostos Orgânicos Voláteis (Precursores Químicos)",
        "PM1.0": "Massa de Bioaerossóis Submicrométricos (PM1.0)",
        "PM2.5": "Massa de Partículas Finas Inaláveis (PM2.5)",
        "PM4.0": "Massa de Material Particulado Isocinético (PM4.0)",
        "PM10": "Concentração Gravimétrica Total (PM10)",
        "NC0.5": "Contagem de Bioaerossóis",
        "NC1.0": "Contagem de Frações de Queima",
        "NC2.5": "Contagem de Particulado Fino Interior",
        "NC10.0": "Contagem de Alérgenos e Macrofrações",
        "Temperatura": "Temperatura Operacional Local",
        "Umidade": "Umidade Relativa do Ar Interior"
    };
    return nomes[param] || param;
}

function obterMensagemAnvisa(param, valor) {
    const mensagens = {
        "CO2": `⚠️ Renovação do ar inadequada. Concentração de CO₂ excedendo a meta estipulada de 1000 PPM, gerando saturação antropogênica corporativa.`,
        "CO": `🚨 Condição crítica: presença de Monóxido de Carbono (CO) acima dos limiares higiênicos, indicando contaminação ou refluxo de gases externos.`,
        "VOC": `⚠️ Concentração de Compostos Orgânicos Voláteis superior às taxas recomendadas pela NBR 17037 para ambientes climatizados artificiais.`,
        "PM1.0": `🚨 Bioaerossóis em patamares instáveis. Alta concentração de micropartículas finas com capacidade de retenção suspensa.`,
        "PM2.5": `🚨 Material particulado fino inalável acima dos limites higiênicos ideais de pureza e filtragem ambiental.`,
        "PM4.0": `🌬️ Concentração de poeira e aerodispersoides em elevação na zona respiratória dos ocupantes.`,
        "PM10": `🍂 Nível de particulado total em suspensão (PM10) inadequado, favorecendo o transporte de alérgenos e ácaros no recinto.`,
        "NC0.5": `🚨 Densidade de contagem microscópica elevada, superando a taxa de atenuação passiva do fluxo de ar local.`,
        "NC1.0": `🚨 Contagem de micropartículas na curva de fumaça ou queima acima das taxas aceitáveis de pureza interna.`,
        "NC2.5": `⚠️ Distribuição de micropartículas finas dispersas extrapolando as faixas ideais de controle isocinético.`,
        "NC10.0": `🍂 Quantidade excessiva de macropartículas em suspensão atuando diretamente como agentes de estresse alérgico respiratório.`,
        "Temperatura": `🌡️ Temperatura fora da faixa operacional estipulada pela ANVISA (20°C a 24°C para ciclo de verão), prejudicando o bem-estar e o rendimento térmico.`,
        "Umidade": `💧 Desvio higrométrico: Umidade relativa fora da banda ideal (40% a 65%), impactando as condições de conforto ambiental e facilitando proliferações microbiológicas.`
    };
    return mensagens[param] || "Parâmetro ambiental em inconformidade com os padrões de amostragem da NBR 17037.";
}

function obterMitigacaoAnvisa(param) {
    const acoes = {
        "CO2": "Incremente imediatamente o volume de ar externo captado através do sistema mecânico ou realize aberturas localizadas de janelas para forçar a renovação do ar e diluição do CO₂.",
        "CO": "PROTOCOLO DE EMERGÊNCIA: Evacue a área técnica imediatamente, localize a fonte de combustão ou refluxo e isole as tomadas de ar externas contaminadas.",
        "VOC": "Suspenda imediatamente o uso de saneantes químicos, tintas ou sprays, e opere a renovação forçada em vazão máxima para exaustão dos precursores voláteis.",
        "PM1.0": "Ative os purificadores auxiliares e certifique-se da estanqueidade e integridade operacional dos filtros de classe absoluta dispostos no fancoil.",
        "PM2.5": "Avalie se há infiltração de ar externo sem filtragem prévia; mantenha barreiras físicas limpas e opere o sistema em modo de filtragem de alta eficiência.",
        "PM4.0": "Providencie limpeza corretiva de superfícies por método úmido (vedando varrição a seco) para mitigar a ressuscitação do material particulado.",
        "PM10": "Verifique o estado de colmatação dos pré-filtros (filtros grossos G4) do condicionador de ar e providencie substituição ou higienização imediata.",
        "NC0.5": "Eleve a velocidade dos ciclos de filtragem e mantenha a taxa de recirculação passando continuamente pela barreira HEPA.",
        "NC1.0": "Mitigue as fontes internas de emanação de fumaça e isole os acessos periféricos se houver focos externos de queimada.",
        "NC2.5": "Execute o plano de manutenção e higienização programada dos dutos e caixas de mistura do ambiente climatizado.",
        "NC10.0": "Restrinja a abertura de vãos externos se houver arraste de pólen urbano e assegure a limpeza imediata das grelhas de retorno.",
        "Temperatura": "Ajuste o setpoint do termostato central para realinhar a temperatura operacional à faixa mandatória da ANVISA, mantendo o ambiente estritamente entre 20°C e 24°C.",
        "Umidade": "Se a umidade estiver excessiva, ative os estágios de desumidificação do sistema de refrigeração; se estiver abaixo de 40%, acione os umidificadores de linha."
    };
    return acoes[param] || "Acione a equipe de manutenção predial para verificação do PMOC (Plano de Manutenção, Operação e Controle).";
}
