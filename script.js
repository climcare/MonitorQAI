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

    // Valores dos Cards Principais
    document.getElementById('valTemperature').innerHTML = `${v.temperature ? v.temperature.toFixed(1) : (dadosBanco.temperature ? Number(dadosBanco.temperature).toFixed(1) : '--.-')}<span class="text-2xl font-light opacity-40">°C</span>`;
    document.getElementById('valHumidity').innerHTML = `${v.humidity ? v.humidity.toFixed(1) : (dadosBanco.humidity ? Number(dadosBanco.humidity).toFixed(1) : '--.-')}<span class="text-2xl font-light opacity-40">%</span>`;
    document.getElementById('valCO2').innerHTML = `${v.co2 || dadosBanco.co2 || '----'} <span class="text-xl font-light opacity-40">PPM</span>`;
    
    const elOrvalho = document.getElementById('valPontoOrvalho');
    if (elOrvalho) {
        elOrvalho.innerHTML = `${relatorio.pontoOrvalho ? relatorio.pontoOrvalho.toFixed(1) : '--.-'}<span class="text-xl font-light opacity-40">°C</span>`;
    }

    // Tratamento das Massas
    const m10 = Number(dadosBanco.pm1_0 || v.pm1_0 || v["PM1.0"] || 0);
    const m25 = Number(dadosBanco.pm25 || v.pm25 || v["PM2.5"] || 0);
    const m40 = Number(dadosBanco.pm4_0 || v.pm4_0 || v["PM4.0"] || v.pm40 || 0);
    const m100 = Number(dadosBanco.pm10 || v.pm10 || v["PM10"] || 0);

    // Injeção de valores das Massas
    document.getElementById('valNC05').innerHTML = m10 > 0 ? `${m10.toFixed(2)}<span class="text-xs font-light opacity-60"> µg/m³</span>` : '--';
    document.getElementById('valNC10').innerHTML = m25 > 0 ? `${m25.toFixed(2)}<span class="text-xs font-light opacity-60"> µg/m³</span>` : '--';
    document.getElementById('valNC25').innerHTML = m40 > 0 ? `${m40.toFixed(2)}<span class="text-xs font-light opacity-60"> µg/m³</span>` : '--';
    document.getElementById('valNC100').innerHTML = m100 > 0 ? `${m100.toFixed(2)}<span class="text-xs font-light opacity-60"> µg/m³</span>` : '--';

    // Semáforo das Massas
    const calcularNivelMassa = (valor, limiteAlerta, limiteCritico) => {
        if (!valor || valor === 0) return "BOM";
        if (valor > limiteCritico) return "CRITICO";
        if (valor > limiteAlerta) return "ALERTA";
        return "BOM";
    };

    pintarMiniCard('valNC05', calcularNivelMassa(m10, 15, 30));
    pintarMiniCard('valNC10', calcularNivelMassa(m25, 15, 35));
    pintarMiniCard('valNC25', calcularNivelMassa(m40, 25, 50));
    pintarMiniCard('valNC100', calcularNivelMassa(m100, 45, 80));

    // Lógica Semafórica dos Cards Principais
    pintarCard('cardTemp', 'statusTemp', relatorio.analiseIndividual.temperatura);
    pintarCard('cardHum', 'statusHum', relatorio.analiseIndividual.umidade);
    pintarCard('cardCO2', 'statusCO2', relatorio.analiseIndividual.co2);
    
    if (document.getElementById('cardOrvalho')) {
        pintarCard('cardOrvalho', 'statusOrvalho', relatorio.analiseIndividual.umidade);
    }

    // Banner Físico de Crítico
    const bannerInfo = document.getElementById('alertaInfoCritico');
    if (bannerInfo) {
        if (relatorio.statusGeral === "CRÍTICO") bannerInfo.classList.remove('hidden');
        else bannerInfo.classList.add('hidden');
    }

    // Status Geral (Barra Superior)
    const panelStatus = document.getElementById('panelStatusGeral');
    const txtStatus = document.getElementById('txtStatusGeral');
    
    if (relatorio.statusGeral === "CONFORME") {
        panelStatus.className = "rounded-2xl p-4 text-center shadow-md border-2 transition-all bg-emerald-500 text-white border-emerald-400";
        txtStatus.innerText = "🛡️ O AR DA SALA ESTÁ SEGURO E LIMPO";
        document.getElementById('panelTriagem').innerHTML = `
            <div class="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-emerald-600 dark:text-emerald-400 font-bold text-xs text-center">
                ✅ Tudo certo! O ar está ótimo para permanência. Nenhuma ação é necessária agora.
            </div>`;
    } else {
        const critico = relatorio.statusGeral === "CRÍTICO";
        panelStatus.className = `rounded-2xl p-4 text-center shadow-md border-2 transition-all ${critico ? 'bg-rose-600 text-white border-rose-400 animate-pulse' : 'bg-amber-500 text-white border-amber-400'}`;
        txtStatus.innerText = critico ? "🚨 ATENÇÃO: AR IMPRÓPRIO OU POLUÍDO DETECTADO NESTA SALA" : "⚠️ AVISO: O AR DA SALA PODE MELHORAR";

        // =========================================================================
        // REESTRUTURAÇÃO COMPACTA PARA CELULAR: Triagem Otimizada (Accordion)
        // =========================================================================
        let htmlAlertas = `
            <div class="bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-300/10 rounded-2xl p-3 space-y-2.5">
                <h3 class="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1">📋 Triagem de Mitigações</h3>
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
                                <span class="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded font-bold text-slate-500 dark:text-slate-400 group-open:hidden">👉 Ver Mitigação</span>
                                <span class="text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded font-bold text-slate-600 dark:text-slate-300 hidden group-open:inline">▲ Fechar</span>
                            </summary>
                            <div class="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2 transition-all duration-300">
                                <p class="text-xs font-bold text-slate-700 dark:text-slate-300">${obterMensagemOMS(erro.parametro, erro.valor)}</p>
                                <div class="bg-sky-50 dark:bg-sky-950/30 rounded-lg p-2.5 border border-sky-100 dark:border-sky-900/40">
                                    <p class="text-[10px] font-mono font-bold text-sky-700 dark:text-sky-400 uppercase">🛠️ AÇÃO RECOMENDADA:</p>
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

    // Quadro Inferior de Correlação Inteligente
    const quadroCorrelacao = document.getElementById('panelTriagemMassaQuantidade');
    if (quadroCorrelacao) {
        const contagem = t.contagemParticulas || {};
        const tpsRaw = dadosBanco.tps || dadosBanco.bpt || t.tamanhoTipico || 0.45;
        const tamanhoTipicoFormatado = `${Number(tpsRaw).toFixed(2)} µm`;

        quadroCorrelacao.innerHTML = `
            <div class="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200/60 dark:border-slate-800">
                <div class="flex justify-between items-center mb-3">
                    <h2 class="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">📊 Detalhes das Micropartículas (Quantidade flutuando no ar)</h2>
                    <span class="bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-400 text-[10px] font-mono px-2 py-0.5 rounded font-bold">
                        📐 TAMANHO MÉDIO: ${tamanhoTipicoFormatado}
                    </span>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div class="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800">
                        <p class="text-[10px] text-slate-400 uppercase font-bold">Vírus e Bactérias</p>
                        <p class="text-lg font-black text-sky-600 dark:text-sky-400 mt-1">${contagem.nc0_5 ? contagem.nc0_5.toFixed(0) : (dadosBanco.nc0_5 ? Number(dadosBanco.nc0_5).toFixed(0) : '--')} <span class="text-[10px] font-normal opacity-70">unidades</span></p>
                    </div>
                    <div class="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800">
                        <p class="text-[10px] text-slate-400 uppercase font-bold">Fumaça e Aerossóis</p>
                        <p class="text-lg font-black text-sky-600 dark:text-sky-400 mt-1">${contagem.nc1_0 ? contagem.nc1_0.toFixed(0) : (dadosBanco.nc1_0 ? Number(dadosBanco.nc1_0).toFixed(0) : '--')} <span class="text-[10px] font-normal opacity-70">unidades</span></p>
                    </div>
                    <div class="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800">
                        <p class="text-[10px] text-slate-400 uppercase font-bold">Poeira Fina</p>
                        <p class="text-lg font-black text-sky-600 dark:text-sky-400 mt-1">${contagem.nc2_5 ? contagem.nc2_5.toFixed(0) : (dadosBanco.nc2_5 ? Number(dadosBanco.nc2_5).toFixed(0) : '--')} <span class="text-[10px] font-normal opacity-70">unidades</span></p>
                    </div>
                    <div class="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800">
                        <p class="text-[10px] text-slate-400 uppercase font-bold">Pólen (Alergias)</p>
                        <p class="text-lg font-black text-sky-600 dark:text-sky-400 mt-1">${contagem.nc10_0 ? contagem.nc10_0.toFixed(0) : (dadosBanco.nc10_0 ? Number(dadosBanco.nc10_0).toFixed(0) : '--')} <span class="text-[10px] font-normal opacity-70">unidades</span></p>
                    </div>
                </div>
                <p class="text-[9px] text-slate-400 font-medium mt-3 italic text-center">💡 Entendimento Prático: Os cards superiores mostram o peso total da sujeira no ar. Esta área de baixo mostra a quantidade exata de micropartículas invisíveis flutuando na sala por centímetro cúbico.</p>
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

function pintarMiniCard(elementId, nivel) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.classList.remove('text-emerald-500', 'text-amber-500', 'text-rose-500', 'text-slate-900', 'dark:text-white');
    if (nivel === "BOM") el.classList.add('text-emerald-500');
    else if (nivel === "ALERTA") el.classList.add('text-amber-500');
    else el.classList.add('text-rose-500');
}

function obterNomeTraduzido(param) {
    const nomes = {
        "CO2": "Gás Carbônico (Ar Abafado)",
        "CO": "Monóxido de Carbono (Gás Tóxico)",
        "VOC": "Vapores Químicos (Cheiros/Produtos)",
        "PM1.0": "Micropartículas (Vírus e Bactérias)",
        "PM2.5": "Partículas Finas (Fumaça e Aerossóis)",
        "PM4.0": "Poeira Atmosférica (Sujeira em Suspensão)",
        "PM10": "Partículas Grossas (Pólen e Ácaros)",
        "Temperatura": "Temperatura da Sala",
        "Umidade": "Umidade do Ar"
    };
    return nomes[param] || param;
}

function obterMensagemOMS(param, valor) {
    const mensagens = {
        "CO2": `⚠️ O ar está ficando abafado por falta de circulação. Isso pode dar sono, dor de cabeça e aumentar a chance de transmissão de resfriados na sala.`,
        "CO": `🚨 Gás perigoso detectado! Risco imediato para a respiração de todos no recinto.`,
        "VOC": `⚠️ Cheiro forte de produtos de limpeza, tintas ou sprays químicos flutuando no ambiente.`,
        "PM1.0": `🚨 O ar está muito carregado com partículas minúsculas invisíveis (como vírus flutuantes). Perigo invisível para os pulmões.`,
        "PM2.5": `🚨 Concentração alta de fumaça ou fuligem fina. Essas partículas passam direto pelas defesas do nariz.`,
        "PM4.0": `🌬️ Há muita poeira flutuando no ar da sala neste exato momento.`,
        "PM10": `🍂 Nível alto de pólen, poeira de giz ou ácaros. Péssimo para quem tem asma, rinite ou alergias.`,
        "Temperatura": `🌡️ A temperatura está fora da faixa de conforto ideal para uma sala de aula.`,
        "Umidade": `💧 O ar está seco demais ou úmido demais, facilitando problemas respiratórios ou mofo.`
    };
    return mensagens[param] || "Um dos indicadores do ar saiu do limite seguro recomendado.";
}

function obterMitigacaoOMS(param) {
    const acoes = {
        "CO2": "Abra as portas e janelas imediatamente para o ar renovar, ou aumente a ventilação mecânica.",
        "CO": "SAIA DA SALA IMEDIATAMENTE. Abra tudo, saia para o pátio e avise a equipe de manutenção.",
        "VOC": "Pare de usar o produto químico/spray e ligue os ventiladores ou purificadores de ar.",
        "PM1.0": "Ligue o purificador de ar (filtro HEPA) na potência máxima ou ventile bem o espaço.",
        "PM2.5": "Feche janelas se houver fumaça vindo de fora e ative o purificador de ar imediatamente.",
        "PM4.0": "Recomenda-se passar um pano úmido no chão e superfícies para ajudar a poeira a baixar.",
        "PM10": "Abra as janelas para circular o ar e verifique se os filtros dos aparelhos de ar-condicionado estão limpos.",
        "Temperatura": "Ajuste o controle do ar-condicionado ou aquecedor para manter a sala entre 20°C e 24°C.",
        "Umidade": "Se estiver seco, use um umidificador ou coloque uma bacia de água na sala. Se estiver muito úmido, ative o modo desumidificar."
    };
    return acoes[param] || "Comunique a equipe responsável pela manutenção ou abra janelas para renovar o ar.";
}
