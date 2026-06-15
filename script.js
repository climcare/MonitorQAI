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
    document.getElementById('txtTimestamp').innerText = `⏱️ ANÁLISE EM: ${new Date(relatorio.carimbotempo || dadosBanco.created_at).toLocaleTimeString('pt-BR')}`;

    // Valores dos Cards Principais
    document.getElementById('valTemperature').innerHTML = `${v.temperature ? v.temperature.toFixed(1) : (dadosBanco.temperature ? Number(dadosBanco.temperature).toFixed(1) : '--.-')}<span class="text-2xl font-light opacity-40">°C</span>`;
    document.getElementById('valHumidity').innerHTML = `${v.humidity ? v.humidity.toFixed(1) : (dadosBanco.humidity ? Number(dadosBanco.humidity).toFixed(1) : '--.-')}<span class="text-2xl font-light opacity-40">%</span>`;
    document.getElementById('valCO2').innerHTML = `${v.co2 || dadosBanco.co2 || '----'} <span class="text-xl font-light opacity-40">PPM</span>`;
    
    // Injeção do Ponto de Orvalho no Card Exclusivo Lateral
    const elOrvalho = document.getElementById('valPontoOrvalho');
    if (elOrvalho) {
        elOrvalho.innerHTML = `${relatorio.pontoOrvalho ? relatorio.pontoOrvalho.toFixed(1) : '--.-'}<span class="text-xl font-light opacity-40">°C</span>`;
    }

    // =========================================================================
    // CORREÇÃO: Mapeamento de chaves com Fallback direto ao Banco de Dados
    // =========================================================================
    
    // 1. Massa Viral / Partículas Ultrafinas (PM 1.0)
    const m10 = dadosBanco.pm1_0 || v.pm1_0 || v["PM1.0"];
    document.getElementById('valNC05').innerHTML = m10 ? `${Number(m10).toFixed(2)}<span class="text-xs font-light opacity-60"> µg/m³</span>` : '--';
    
    // 2. Massa de Fumaça e Vapores (PM 2.5)
    const m25 = dadosBanco.pm25 || v.pm25 || v["PM2.5"];
    document.getElementById('valNC10').innerHTML = m25 ? `${Number(m25).toFixed(2)}<span class="text-xs font-light opacity-60"> µg/m³</span>` : '--';
    
    // 3. Massa de Poeira Atmosférica (PM 4.0)
    const m40 = dadosBanco.pm4_0 || v.pm4_0 || v["PM4.0"] || v.pm40;
    document.getElementById('valNC25').innerHTML = m40 ? `${Number(m40).toFixed(2)}<span class="text-xs font-light opacity-60"> µg/m³</span>` : '--';
    
    // 4. Massa de Alérgenos (PM 10 ou PM 10.0)
    const m100 = dadosBanco.pm10 || v.pm10 || v["PM10"];
    document.getElementById('valNC100').innerHTML = m100 ? `${Number(m100).toFixed(2)}<span class="text-xs font-light opacity-60"> µg/m³</span>` : '--';

    // =========================================================================

    // Lógica Semafórica Granular dos Cards
    pintarCard('cardTemp', 'statusTemp', relatorio.analiseIndividual.temperatura);
    pintarCard('cardHum', 'statusHum', relatorio.analiseIndividual.umidade);
    pintarCard('cardCO2', 'statusCO2', relatorio.analiseIndividual.co2);
    
    if (document.getElementById('cardOrvalho')) {
        pintarCard('cardOrvalho', 'statusOrvalho', relatorio.analiseIndividual.umidade);
    }

    // Cores dinâmicas nos textos das massas da grid
    pintarMiniCard('valNC05', relatorio.analiseIndividual.pm10 || "BOM");
    pintarMiniCard('valNC10', relatorio.analiseIndividual.pm25 || "BOM");
    pintarMiniCard('valNC25', relatorio.analiseIndividual.pm40 || "BOM");
    pintarMiniCard('valNC100', relatorio.analiseIndividual.pm100 || "BOM");

    // Controle do Alerta Físico
    const bannerInfo = document.getElementById('alertaInfoCritico');
    if (bannerInfo) {
        if (relatorio.statusGeral === "CRÍTICO") bannerInfo.classList.remove('hidden');
        else bannerInfo.classList.add('hidden');
    }

    // Status Geral Semafórico (Barra Superior)
    const panelStatus = document.getElementById('panelStatusGeral');
    const txtStatus = document.getElementById('txtStatusGeral');
    
    if (relatorio.statusGeral === "CONFORME") {
        panelStatus.className = "rounded-2xl p-4 text-center shadow-md border-2 transition-all bg-emerald-500 text-white border-emerald-400";
        txtStatus.innerText = "🛡️ AMBIENTE EM CONFORMIDADE";
        document.getElementById('panelTriagem').innerHTML = `
            <div class="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-emerald-600 dark:text-emerald-400 font-bold text-xs text-center">
                ✅ Ar purificado dentro dos limites protetivos. Nenhuma intervenção necessária.
            </div>`;
    } else {
        const critico = relatorio.statusGeral === "CRÍTICO";
        panelStatus.className = `rounded-2xl p-4 text-center shadow-md border-2 transition-all ${critico ? 'bg-rose-600 text-white border-rose-400 animate-pulse' : 'bg-amber-500 text-white border-amber-400'}`;
        txtStatus.innerText = critico ? "🚨 ALERTA CRÍTICO: RISCO BIOLÓGICO/SANITÁRIO DETECTADO" : "⚠️ ATENÇÃO: AMBIENTE FORA DOS PADRÕES OPERACIONAIS";

        let htmlAlertas = "";
        if (relatorio.violacoes && relatorio.violacoes.length > 0) {
            relatorio.violacoes.forEach(erro => {
                htmlAlertas += `
                    <div class="bg-white dark:bg-slate-900 border-l-8 ${erro.gravidade === 'CRÍTICO' ? 'border-rose-600' : 'border-amber-500'} rounded-2xl p-4 shadow-sm space-y-2">
                        <div class="flex justify-between items-center text-[10px] font-black uppercase tracking-tighter">
                            <span class="${erro.gravidade === 'CRÍTICO' ? 'text-rose-600' : 'text-amber-500'}">ANOMALIA: ${obterNomeTraduzido(erro.parametro)}</span>
                            <span class="text-slate-400">VALOR: ${erro.valor}${erro.unidade}</span>
                        </div>
                        <p class="text-xs font-bold text-slate-700 dark:text-slate-200">${obterMensagemOMS(erro.parametro, erro.valor)}</p>
                        <div class="text-[11px] font-mono font-bold text-sky-600 dark:text-sky-400 mt-2 uppercase underline">
                            👉 Protocolo Técnico: ${obterMitigacaoOMS(erro.parametro)}
                        </div>
                    </div>
                `;
            });
        }
        document.getElementById('panelTriagem').innerHTML = htmlAlertas;
    }

    // EXIBIÇÃO DA QUANTIDADE E TAMANHO TÍPICO DE PARTÍCULA NO QUADRO DE CORRELAÇÃO INTELIGENTE
    const quadroCorrelacao = document.getElementById('panelTriagemMassaQuantidade');
    if (quadroCorrelacao) {
        const contagem = t.contagemParticulas || {};
        
        // Mapeamento e fallback para o tamanho típico da partícula (tps ou bpt)
        const tpsRaw = dadosBanco.tps || dadosBanco.bpt || t.tamanhoTipico || 0.45;
        const tamanhoTipicoFormatado = `${Number(tpsRaw).toFixed(2)} µm`;

        quadroCorrelacao.innerHTML = `
            <div class="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200/60 dark:border-slate-800">
                <div class="flex justify-between items-center mb-3">
                    <h2 class="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">📊 Concentração Volumétrica (Contagem de Partículas no Ar)</h2>
                    <span class="bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-400 text-[10px] font-mono px-2 py-0.5 rounded font-bold">
                        📐 TAMANHO TÍPICO: ${tamanhoTipicoFormatado}
                    </span>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div class="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800">
                        <p class="text-[10px] text-slate-400 uppercase font-bold">Vírus e Bactérias</p>
                        <p class="text-lg font-black text-sky-600 dark:text-sky-400 mt-1">${contagem.nc0_5 ? contagem.nc0_5.toFixed(0) : (dadosBanco.nc0_5 ? Number(dadosBanco.nc0_5).toFixed(0) : '--')} <span class="text-[10px] font-normal opacity-70">pt/cm³</span></p>
                    </div>
                    <div class="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800">
                        <p class="text-[10px] text-slate-400 uppercase font-bold">Fumaça e Aerossóis</p>
                        <p class="text-lg font-black text-sky-600 dark:text-sky-400 mt-1">${contagem.nc1_0 ? contagem.nc1_0.toFixed(0) : (dadosBanco.nc1_0 ? Number(dadosBanco.nc1_0).toFixed(0) : '--')} <span class="text-[10px] font-normal opacity-70">pt/cm³</span></p>
                    </div>
                    <div class="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800">
                        <p class="text-[10px] text-slate-400 uppercase font-bold">Poeira Fina</p>
                        <p class="text-lg font-black text-sky-600 dark:text-sky-400 mt-1">${contagem.nc2_5 ? contagem.nc2_5.toFixed(0) : (dadosBanco.nc2_5 ? Number(dadosBanco.nc2_5).toFixed(0) : '--')} <span class="text-[10px] font-normal opacity-70">pt/cm³</span></p>
                    </div>
                    <div class="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800">
                        <p class="text-[10px] text-slate-400 uppercase font-bold">Pólen e Alérgenos</p>
                        <p class="text-lg font-black text-sky-600 dark:text-sky-400 mt-1">${contagem.nc10_0 ? contagem.nc10_0.toFixed(0) : (dadosBanco.nc10_0 ? Number(dadosBanco.nc10_0).toFixed(0) : '--')} <span class="text-[10px] font-normal opacity-70">pt/cm³</span></p>
                    </div>
                </div>
                <p class="text-[9px] text-slate-400 font-medium mt-3 italic text-center">💡 Entendimento Prático: Os cards superiores monitoram o peso (Massa) exigido pelas normas regulamentadoras, enquanto esta área detalha o número exato de micropartículas isoladas flutuando por centímetro cubic do ambiente.</p>
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
        "CO2": "CO₂ (Gás Carbônico)",
        "CO": "CO (Monóxido de Carbono)",
        "VOC": "TVOC (Compostos Orgânicos Voláteis)",
        "PM1.0": "Massa Biológica (Fração de Vírus/Bactérias)",
        "PM2.5": "Massa Respirável (Fumaças e Aerossóis)",
        "PM4.0": "Massa Torácica (Poeira Atmosférica)",
        "PM10": "Massa Inalável (Pólen e Ácaros)",
        "Temperatura": "Temperatura Ambiente",
        "Umidade": "Umidade Relativa"
    };
    return nomes[param] || param;
}

function obterMensagemOMS(param, valor) {
    const mensagens = {
        "CO2": `🚨 EXCESSO DE CO₂: Concentração de ${valor} PPM violou o limite recomendado. Indica confinamento do ar ambiente e maior probabilidade de dispersão de patógenos aéreos.`,
        "CO": `💀 TOXICIDADE POR CO: Nível perigoso detectado em ${valor} PPM. Risco mecânico para a respiração celular.`,
        "VOC": `⚠️ SATURAÇÃO DE TVOC: Índice em ${valor}. Elevada dispersão de resíduos químicos ou saneantes industriais.`,
        "PM1.0": `🦠 ALERTA DE MASSA VIRAL: Peso molecular na faixa crítica em ${valor} µg/m³. Elevado potencial de transporte microbiano.`,
        "PM2.5": `😷 ALERTA DE PARTÍCULAS FINAS: Concentração de ${valor} µg/m³ ultrapassa metas seguras, facilitando a penetração pulmonar profunda.`,
        "PM4.0": `🌬️ POEIRA RESPIRÁVEL ACIMA DA META: Registrado ${valor} µg/m³ em suspensão.`,
        "PM10": `🍂 ALERTA DE ALÉRGENOS CRÍTICO: Acúmulo de partículas grossas em ${valor} µg/m³, saturando as vias aéreas superiores.`,
        "Temperatura": `🌡️ GRADIENTE TÉRMICO FORA DA META: Registrado ${valor}°C. Prejudicial para o conforto térmico de pacientes oncológicos.`,
        "Umidade": `💧 ANOMALIA HIGROMÉTRICA: Índice em ${valor}%. Fora dos padrões para a inibição de colônias fúngicas e preservação de mucosas.`
    };
    return mensagens[param] || "Substância operacional fora das metas sanitárias regulamentadas.";
}

function obterMitigacaoOMS(param) {
    const acoes = {
        "CO2": "Abrir janelas periféricas imediatamente ou elevar os níveis de captação externa (dampers) do sistema HVAC.",
        "CO": "EVACUAÇÃO COMPLETA DA SALA. Desligar geradores/motores próximos e contatar segurança operacional.",
        "VOC": "Interromper a aplicação local de produtos químicos voláteis e acionar a exaustão mecânica forçada.",
        "PM1.0": "Ativar purificadores absolutos HEPA na vazão máxima operacional. Inspecionar vedações das portas.",
        "PM2.5": "Verificar se há focos externos de fumaça invadindo o ambiente e ligar barreiras de filtragem secundárias.",
        "PM4.0": "Efetuar limpeza úmida imediata do piso para decantação mecânica da poeira suspensa.",
        "PM10": "Inspecionar e substituir os filtros plissados G4 integrados nas caixas de ventilação do setor.",
        "Temperatura": "Ajustar os comandos centrais do termostato para estabilizar o ambiente entre 20°C e 24°C.",
        "Umidade": "Se elevada, acionar ciclos de desumidificação ativa por condensação. Se baixa, ligar umidificação ultrassônica."
    };
    return acoes[param] || "Acionar a equipe de engenharia e manutenção predial para intervenção direta.";
}
