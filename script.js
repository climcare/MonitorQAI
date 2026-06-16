const SUPABASE_URL = 'https://iaylyacrzurcjwvtecpu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pkzx4u5U9Xr407syiBE9yA_G7hUvGaw';

let supabaseClient = null;
let domElements = {}; // Cache para otimização de performance do DOM

window.onload = async () => {
    inicializarGerenciadorTema();
    if (typeof supabase !== "undefined") {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        inicializarCacheDOM();
        await processarCicloMonitoramento();
        setInterval(processarCicloMonitoramento, 15000); 
    }
};

function inicializarGerenciadorTema() {
    const btn = document.getElementById('btnAlternarTema');
    const ico = document.getElementById('icoTema');
    const txt = document.getElementById('txtTema');
    const htmlElement = document.documentElement;

    const atualizarTemaUI = (isDark) => {
        htmlElement.classList.toggle('dark', isDark);
        if (ico) ico.innerText = isDark ? '☀️' : '🌙';
        if (txt) txt.innerText = isDark ? 'MODO DIURNO' : 'MODO NOTURNO';
    };

    const temaSalvo = localStorage.getItem('qai-tema') || 'dark';
    atualizarTemaUI(temaSalvo === 'dark');

    if (btn) {
        btn.addEventListener('click', () => {
            const ficarEscuro = !htmlElement.classList.contains('dark');
            atualizarTemaUI(ficarEscuro);
            localStorage.setItem('qai-tema', ficarEscuro ? 'dark' : 'light');
        });
    }
}

// Mapeia e armazena os elementos uma única vez para evitar buscas repetitivas (Reflow/Repaint)
function inicializarCacheDOM() {
    const ids = [
        'txtDeviceId', 'txtSignal', 'txtTimestamp', 'lblScoreNumero', 'lblScoreStatus', 
        'barScoreProgresso', 'scoreContainer', 'txtPctFadiga', 'txtPctAlergia', 'txtPctDesconforto',
        'barSintomaFadiga', 'barSintomaAlergia', 'barSintomaDesconforto', 'icoSintomaFadiga', 
        'icoSintomaAlergia', 'icoSintomaDesconforto', 'valTemperature', 'valHumidity', 'valCO2', 
        'valPontoOrvalho', 'cardTemp', 'statusTemp', 'cardHum', 'statusHum', 'cardCO2', 'statusCO2',
        'cardOrvalho', 'statusOrvalho', 'alertaInfoCritico', 'panelStatusGeral', 'txtStatusGeral', 
        'panelTriagem', 'panelTriagemMassaQuantidade'
    ];
    ids.forEach(id => {
        domElements[id] = document.getElementById(id);
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
            // Fallback preventivo caso a função contida em 'analysis.js' possua algum atraso de escopo
            const relatorio = typeof analisarLeituraQAI === "function" 
                ? analisarLeituraQAI(leituraBruta) 
                : { valoresAtuais: leituraBruta, statusGeral: "CONFORME", scoreGeral: 100 };
                
            atualizarInterfaceVisual(relatorio, leituraBruta);
        }
    } catch (err) { 
        console.error("Erro no ciclo de monitoramento:", err); 
    }
}

function atualizarInterfaceVisual(relatorio, leituraBruta = {}) {
    const v = relatorio.valoresAtuais || {};
    const t = relatorio.telemetriaAvancada || {};
    const dadosBanco = leituraBruta || {};

    // Telemetria do Topo
    if (domElements.txtDeviceId) domElements.txtDeviceId.innerText = relatorio.dispositivoId || dadosBanco.device_id || '--';
    if (domElements.txtSignal) domElements.txtSignal.innerText = `${t.sinalRede || dadosBanco.signal || '--'} dBm`;
    if (domElements.txtTimestamp) {
        const dataFormatada = new Date(relatorio.carimbotempo || dadosBanco.created_at).toLocaleTimeString('pt-BR');
        domElements.txtTimestamp.innerText = `⏱️ ATUALIZADO EM: ${dataFormatada}`;
    }

    // Score de Qualidade Geral GAI
    const scoreVal = relatorio.scoreGeral !== undefined ? relatorio.scoreGeral : 100;
    const { lblScoreNumero, lblScoreStatus, barScoreProgresso, scoreContainer } = domElements;

    if (lblScoreNumero && lblScoreStatus && barScoreProgresso && scoreContainer) {
        lblScoreNumero.innerText = scoreVal;
        barScoreProgresso.style.width = `${scoreVal}%`;

        scoreContainer.classList.remove('border-emerald-500', 'bg-emerald-500/5', 'border-amber-500', 'bg-amber-500/5', 'border-rose-500', 'bg-rose-500/5');
        lblScoreStatus.classList.remove('text-emerald-500', 'text-amber-500', 'text-rose-500');
        barScoreProgresso.classList.remove('bg-emerald-500', 'bg-amber-500', 'bg-rose-500');

        if (scoreVal >= 80) {
            lblScoreStatus.innerText = "EXCELENTE";
            lblScoreStatus.classList.add('text-emerald-500');
            scoreContainer.classList.add('border-emerald-500', 'bg-emerald-500/5');
            barScoreProgresso.classList.add('bg-emerald-500');
        } else if (scoreVal >= 50) {
            lblScoreStatus.innerText = "ALERTA";
            lblScoreStatus.classList.add('text-amber-500');
            scoreContainer.classList.add('border-amber-500', 'bg-amber-500/5');
            barScoreProgresso.classList.add('bg-amber-500');
        } else {
            lblScoreStatus.innerText = "CRÍTICO";
            lblScoreStatus.classList.add('text-rose-500');
            scoreContainer.classList.add('border-rose-500', 'bg-rose-500/5');
            barScoreProgresso.classList.add('bg-rose-500');
        }
    }

    // Sintomas Clínicos - Ícone Corrigido de Termômetro para Pulmão/Máscara no Desconforto Respiratório
    if (relatorio.sintomas) {
        const s = relatorio.sintomas;
        const atualizarSintoma = (idPct, idBar, idIco, valor, emojiAlto, emojiBaixo) => {
            if (domElements[idPct]) domElements[idPct].innerText = `${valor}%`;
            if (domElements[idBar]) domElements[idBar].style.width = `${valor}%`;
            if (domElements[idIco]) domElements[idIco].innerText = valor > 40 ? emojiAlto : emojiBaixo;
        };
        atualizarSintoma('txtPctFadiga', 'barSintomaFadiga', 'icoSintomaFadiga', s.fadiga, "🥱", "💤");
        atualizarSintoma('txtPctAlergia', 'barSintomaAlergia', 'icoSintomaAlergia', s.alergia, "🚨", "🤧");
        atualizarSintoma('txtPctDesconforto', 'barSintomaDesconforto', 'icoSintomaDesconforto', s.desconforto, "🥵", "🫁");
    }

    // Valores dos Cards Principais
    if (domElements.valTemperature) {
        const temp = v.temperature ? v.temperature.toFixed(1) : (dadosBanco.temperature ? Number(dadosBanco.temperature).toFixed(1) : '--.-');
        domElements.valTemperature.innerHTML = `${temp}<span class="text-xl font-light opacity-40">°C</span>`;
    }
    if (domElements.valHumidity) {
        const hum = v.humidity ? v.humidity.toFixed(1) : (dadosBanco.humidity ? Number(dadosBanco.humidity).toFixed(1) : '--.-');
        domElements.valHumidity.innerHTML = `${hum}<span class="text-xl font-light opacity-40">%</span>`;
    }
    if (domElements.valCO2) {
        domElements.valCO2.innerHTML = `<span class="text-slate-900 dark:text-white font-black text-3xl sm:text-4xl">${v.co2 || dadosBanco.co2 || '----'}</span> <span class="text-base font-light opacity-40">PPM</span>`;
    }
    if (domElements.valPontoOrvalho) {
        const valorOrvalho = relatorio.pontoOrvalho ? relatorio.pontoOrvalho.toFixed(1) : '--.-';
        domElements.valPontoOrvalho.innerHTML = `<span class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">${valorOrvalho}</span><span class="text-xl font-light opacity-40">°C</span>`;
    }

    // Processamento e Correlação de Partículas
    const m10 = Number(dadosBanco.pm1_0 || v.pm1_0 || v["PM1.0"] || 0);
    const m25 = Number(dadosBanco.pm25 || v.pm25 || v["PM2.5"] || 0);
    const m40 = Number(dadosBanco.pm4_0 || v.pm4_0 || v["PM4.0"] || v.pm40 || 0);
    const m100 = Number(dadosBanco.pm10 || v.pm10 || v["PM10"] || 0);

    const contagem = t.contagemParticulas || {};
    const q10 = contagem.nc0_5 || dadosBanco.nc0_5 || 0;
    const q25 = contagem.nc1_0 || dadosBanco.nc1_0 || 0;
    const q40 = contagem.nc2_5 || dadosBanco.nc2_5 || 0;
    const q100 = contagem.nc10_0 || dadosBanco.nc10_0 || 0;

    const avaliarAnomaliaParticula = (massa, contagem, statusContagem, limiteCritico) => {
        if (!massa && !contagem) return "BOM";
        if (statusContagem === "CRÍTICO" || massa > limiteCritico) return "CRITICO";
        if (statusContagem === "ALERTA" || massa > (limiteCritico * 0.5)) return "ALERTA";
        return "BOM";
    };

    const statusC05  = avaliarAnomaliaParticula(m10, q10, relatorio.analiseIndividual?.nc05, 25);
    const statusC10  = avaliarAnomaliaParticula(m25, q25, relatorio.analiseIndividual?.nc10, 15);
    const statusC25  = avaliarAnomaliaParticula(m40, q40, relatorio.analiseIndividual?.nc25 || "BOM", 40);
    const statusC100 = avaliarAnomaliaParticula(m100, q100, relatorio.analiseIndividual?.nc100, 50);

    // Pintar Cards Semafóricos
    if (relatorio.analiseIndividual) {
        pintarCard('cardTemp', 'statusTemp', relatorio.analiseIndividual.temperatura);
        pintarCard('cardHum', 'statusHum', relatorio.analiseIndividual.umidade);
        pintarCard('cardCO2', 'statusCO2', relatorio.analiseIndividual.co2);
        pintarCard('cardOrvalho', 'statusOrvalho', relatorio.analiseIndividual.umidade);
    }

    // Banner Crítico
    if (domElements.alertaInfoCritico) {
        domElements.alertaInfoCritico.classList.toggle('hidden', relatorio.statusGeral !== "CRÍTICO");
    }

    // Painel de Status Geral e Triagem Normativa (Otimização de paddings py-1.5 e remoção de redundância de emojis)
    const { panelStatusGeral, txtStatusGeral, panelTriagem } = domElements;
    if (panelStatusGeral && txtStatusGeral && panelTriagem) {
        if (relatorio.statusGeral === "CONFORME") {
            panelStatusGeral.className = "md:col-span-7 rounded-2xl py-1.5 px-4 text-center md:text-left shadow-sm border-2 transition-all bg-emerald-500 text-white border-emerald-400 font-bold flex items-center justify-center md:justify-start min-h-[44px]";
            txtStatusGeral.className = "text-xs sm:text-sm font-black uppercase tracking-wider text-white w-full";
            txtStatusGeral.innerText = "AMBIENTE EM CONFORMIDADE COM A ANVISA & NBR 17037";
            panelTriagem.innerHTML = `
                <div class="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-emerald-600 dark:text-emerald-400 font-medium text-xs text-center leading-relaxed">
                    ✅ Parâmetros operacionais em total conformidade normative. Nenhuma ação corretiva ou mitigação técnica é necessária para este ambiente climatizado.
                </div>`;
        } else {
            const critico = relatorio.statusGeral === "CRÍTICO";
            panelStatusGeral.className = `md:col-span-7 rounded-2xl py-1.5 px-4 text-center md:text-left shadow-sm border-2 transition-all text-white font-bold flex items-center justify-center md:justify-start min-h-[44px] ${critico ? 'bg-rose-600 border-rose-500 animate-pulse' : 'bg-amber-500 border-amber-400'}`;
            txtStatusGeral.className = "text-xs sm:text-sm font-black uppercase tracking-wider text-white w-full";
            
            // Texto limpo sem emojis repetidos (o HTML ou CSS já cuida do ícone do container se houver)
            txtStatusGeral.innerText = critico ? "DESVIOS CRÍTICOS DETECTADOS RELATIVOS ÀS NORMAS ANVISA" : "AVISO: PARÂMETROS EM ATENÇÃO PREVENTIVA";

            let htmlAlertas = `
                <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl space-y-3 shadow-sm">
                    <h3 class="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">📋 Diretrizes Técnicas Ativas</h3>`;

            if (relatorio.violacoes && relatorio.violacoes.length > 0) {
                if (relatorio.violacoes.some(e => e.parametro === "Umidade") && !relatorio.violacoes.some(e => e.parametro === "PontoOrvalho")) {
                    relatorio.violacoes.push({
                        parametro: "PontoOrvalho",
                        valor: relatorio.pontoOrvalho ? relatorio.pontoOrvalho.toFixed(1) : '--',
                        unidade: "°C",
                        gravidade: relatorio.analiseIndividual?.umidade
                    });
                }

                relatorio.violacoes.forEach(erro => {
                    const eCritico = erro.gravidade === 'CRÍTICO';
                    const corBorda = eCritico ? 'border-rose-500' : 'border-amber-500';
                    const corTexto = eCritico ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400';

                    htmlAlertas += `
                        <div class="bg-slate-50 dark:bg-slate-950/40 border-l-4 ${corBorda} rounded-xl p-3 shadow-sm transition-all">
                            <details class="group">
                                <summary class="flex justify-between items-center cursor-pointer list-none focus:outline-none select-none">
                                    <div class="space-y-0.5">
                                        <p class="text-xs font-bold ${corTexto} uppercase tracking-tight">⚠️ ${obterNomeTraduzido(erro.parametro)}</p>
                                        <p class="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Atual: ${erro.valor}${erro.unidade}</p>
                                    </div>
                                    <span class="text-[10px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-1 rounded font-bold text-slate-500 dark:text-slate-400 group-open:hidden transition-all shadow-sm">👉 Solução</span>
                                    <span class="text-[10px] bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded font-bold text-slate-600 dark:text-slate-300 hidden group-open:inline transition-all">▲ Ocultar</span>
                                </summary>
                                <div class="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/80 space-y-2">
                                    <p class="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">${obterMensagemAnvisa(erro.parametro, erro.valor)}</p>
                                    <div class="bg-sky-500/[0.06] rounded-xl p-3 border border-sky-500/10">
                                        <p class="text-[9px] font-mono font-black text-sky-600 dark:text-sky-400 uppercase tracking-wider">🛠️ PROTOCOLO DE MITIGAÇÃO :</p>
                                        <p class="text-xs text-slate-600 dark:text-slate-300 font-medium mt-1 leading-relaxed">${obterMitigacaoAnvisa(erro.parametro)}</p>
                                    </div>
                                </div>
                            </details>
                        </div>`;
                });
            }
            htmlAlertas += `</div>`;
            panelTriagem.innerHTML = htmlAlertas;
        }
    }

    // Seção Física de Partículas (Bloco Inferior)
    if (domElements.panelTriagemMassaQuantidade) {
        const tpsRaw = dadosBanco.typical_size || dadosBanco.typicalSize || dadosBanco.tps || t.tamanhoTipico || 0.45;
        
        const getClassColor = (status) => status === "CRITICO" ? "text-rose-500 font-black" : (status === "ALERTA" ? "text-amber-500 font-black" : "text-emerald-500 font-black");
        const getClassBorder = (status) => status === "CRITICO" ? "border-rose-500/50 bg-rose-500/[0.02]" : (status === "ALERTA" ? "border-amber-500/40 bg-amber-500/[0.02]" : "border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20");

        domElements.panelTriagemMassaQuantidade.innerHTML = `
            <div class="space-y-4">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 px-1">
                    <h2 class="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">🔬 Análise Física de Partículas (Peso vs. Quantidade Real - NBR 17037)</h2>
                    <span class="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[10px] font-mono px-2.5 py-1 rounded-md font-bold border border-slate-200 dark:border-slate-700 text-center tracking-tight">📐 TAMANHO MÉDIO RELEVANTE: ${Number(tpsRaw).toFixed(2)} µm</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    ${renderParticulaCard("Bioaerossóis flutuantes", m10, q10, getClassBorder(statusC05), getClassColor(statusC05))}
                    ${renderParticulaCard("Aerossóis e Fumaças", m25, q25, getClassBorder(statusC10), getClassColor(statusC10))}
                    ${renderParticulaCard("Poeira Inalável Fina", m40, q40, getClassBorder(statusC25), getClassColor(statusC25))}
                    ${renderParticulaCard("Particulado Macroscópico", m100, q100, getClassBorder(statusC100), getClassColor(statusC100))}
                </div>
            </div>`;
    }
}

function renderParticulaCard(titulo, massa, contagem, classeBorda, classeCorMassa) {
    return `
        <div class="p-3.5 border rounded-xl flex flex-col justify-between text-center ${classeBorda}">
            <div><p class="text-xs text-slate-800 dark:text-slate-200 font-bold uppercase tracking-tight">${titulo}</p></div>
            <div class="mt-2 py-2 bg-white dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/80 rounded-xl space-y-1">
                <p class="text-[11px] text-slate-400 font-medium">Massa: <span class="${classeCorMassa}">${massa > 0 ? massa.toFixed(2) : '--'} µg/m³</span></p>
                <p class="text-[11px] text-slate-400 font-medium">Contagem: <span class="text-sky-500 font-bold">${contagem > 0 ? contagem.toFixed(0) : '--'} pt/cm³</span></p>
            </div>
        </div>`;
}

function pintarCard(cardId, statusId, nivel) {
    const card = domElements[cardId] || document.getElementById(cardId);
    const status = domElements[statusId] || document.getElementById(statusId);
    if (!card || !status) return;
    
    card.classList.remove('border-emerald-500', 'border-amber-500', 'border-rose-600', 'border-transparent');
    status.className = "text-[9px] font-black uppercase py-0.5 px-2 rounded w-fit text-white";

    if (nivel === "BOM") {
        card.classList.add('border-emerald-500');
        status.innerText = "🟢 EXCELENTE";
        status.classList.add('bg-emerald-500');
    } else if (nivel === "ALERTA") {
        card.classList.add('border-amber-500');
        status.innerText = "⚠️ ATENÇÃO";
        status.classList.add('bg-amber-500');
    } else {
        card.classList.add('border-rose-600');
        status.innerText = "🚨 CRÍTICO";
        status.classList.add('bg-rose-600');
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
        "Umidade": "Umidade Relativa do Ar Interior",
        "PontoOrvalho": "Perigo de Condensação (Ponto de Orvalho)"
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
        "NC0.5": `🚨 Densidade de contagem microscópica elevada, superando a taxa de amostragem passiva do fluxo de ar local.`,
        "NC1.0": `🚨 Contagem de micropartículas na curva de fumaça ou queima acima das taxas aceitáveis de pureza interna.`,
        "NC2.5": `⚠️ Distribuição de micropartículas finas dispersas extrapolando as faixas ideais de controle isocinético.`,
        "NC10.0": `🍂 Quantidade excessiva de macropartículas em suspensão atuando diretamente como agentes de estresse alérgico respiratório.`,
        "Temperatura": `🌡️ Temperatura fora da faixa operacional estipulada pela ANVISA (20°C a 24°C para ciclo de verão), prejudicando o bem-estar e o rendimento térmico.`,
        "Umidade": `💧 Desvio higrométrico: Umidade relativa fora da banda ideal (40% a 65%), impactando as condições de conforto ambiental e facilitando proliferações microbiológicas.`,
        "PontoOrvalho": `🚨 Perigo de Condensação: A alta umidade indica que o ar pode condensar em superfícies frias, gerando gotículas de água que estragam eletroeletrônicos, mofo e fungos.`
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
        "NC0.5": "Eleve a velocidade dos ciclos de filtragem and mantenha a taxa de recirculação passando continuamente pela barreira HEPA.",
        "NC1.0": "Mitigue as fontes internas de emanação de fumaça e isole os acessos periféricos se houver focos externos de queimada.",
        "NC2.5": "Execute o plano de manutenção e higienização programada dos dutos e caixas de mistura do ambiente climatizado.",
        "NC10.0": "Restrinja a abertura de vãos externos se houver arraste de pólen urbano e assegure a limpeza imediata das grelhas de retorno.",
        "Temperatura": "Ajuste o setpoint do termostato central para realinhar a temperatura operacional à faixa mandatória da ANVISA, mantendo o ambiente estritamente entre 20°C e 24°C.",
        "Umidade": "Se a umidade estiver excessiva, ative os estágios de desumidificação do sistema de refrigeração; se estiver abaixo de 40%, acione os umidificadores de linha.",
        "PontoOrvalho": "Ative imediatamente a função de desumidificação do sistema de climatização ou ligue um desumidificador mecânico no recinto para conter a umidade."
    };
    return acoes[param] || "Acione a equipe de manutenção predial para verificação do PMOC (Plano de Manutenção, Operação e Controle).";
}
