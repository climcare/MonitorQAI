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

    // Telemetria do Topo
    document.getElementById('txtDeviceId').innerText = relatorio.dispositivoId || '--';
    document.getElementById('txtSignal').innerText = `${t.sinalRede || '--'} dBm`;
    document.getElementById('txtTimestamp').innerText = `⏱️ LIDO EM: ${new Date(relatorio.carimbotempo).toLocaleTimeString('pt-BR')}`;

    // Valores dos Cards Principais
    document.getElementById('valTemperature').innerHTML = `${v.temperature ? v.temperature.toFixed(1) : '--.-'}<span class="text-2xl font-light opacity-40">°C</span>`;
    document.getElementById('valHumidity').innerHTML = `${v.humidity ? v.humidity.toFixed(1) : '--.-'}<span class="text-2xl font-light opacity-40">%</span>`;
    document.getElementById('valCO2').innerHTML = `${v.co2 || '----'} <span class="text-xl font-light opacity-40">PPM</span>`;
    
    // Injeção do Ponto de Orvalho
    document.getElementById('valPontoOrvalho').innerText = `${relatorio.pontoOrvalho ? relatorio.pontoOrvalho.toFixed(1) : '--.-'}°C`;

    // Particulados Amigáveis (pt/cm3)
    document.getElementById('valNC05').innerText = t.contagemParticulas.nc0_5 ? t.contagemParticulas.nc0_5.toFixed(0) : '--';
    document.getElementById('valNC10').innerText = t.contagemParticulas.nc1_0 ? t.contagemParticulas.nc1_0.toFixed(0) : '--';
    document.getElementById('valNC25').innerText = t.contagemParticulas.nc2_5 ? t.contagemParticulas.nc2_5.toFixed(0) : '--';
    document.getElementById('valNC100').innerText = t.contagemParticulas.nc10_0 ? t.contagemParticulas.nc10_0.toFixed(0) : '--';

    // Lógica Semafórica Granular dos Cards Principais
    pintarCard('cardTemp', 'statusTemp', relatorio.analiseIndividual.temperatura);
    pintarCard('cardHum', 'statusHum', relatorio.analiseIndividual.umidade);
    pintarCard('cardCO2', 'statusCO2', relatorio.analiseIndividual.co2);

    // Lógica Semafórica Dinâmica das Sub-Partículas (Alteração de Cor de Texto na Grid)
    pintarMiniCard('valNC05', relatorio.analiseIndividual.nc05);
    pintarMiniCard('valNC10', relatorio.analiseIndividual.nc10);
    pintarMiniCard('valNC100', relatorio.analiseIndividual.nc100);

    // Controle do Alerta Físico de Relação Massa vs Quantidade
    const bannerInfo = document.getElementById('alertaInfoCritico');
    if (relatorio.statusGeral === "CRÍTICO") {
        bannerInfo.classList.remove('hidden');
    } else {
        bannerInfo.classList.add('hidden');
    }

    // Status Geral Semafórico (Barra Superior)
    const panelStatus = document.getElementById('panelStatusGeral');
    const txtStatus = document.getElementById('txtStatusGeral');
    
    if (relatorio.statusGeral === "CONFORME") {
        panelStatus.className = "rounded-2xl p-4 text-center shadow-md border-2 transition-all bg-emerald-500 text-white border-emerald-400";
        txtStatus.innerText = "🛡️ AMBIENTE EM CONFORMIDADE SANITÁRIA";
        document.getElementById('panelTriagem').innerHTML = `
            <div class="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-emerald-600 dark:text-emerald-400 font-bold text-xs text-center">
                ✅ Ar purificado dentro dos limites OMS. Nenhuma intervenção necessária.
            </div>`;
    } else {
        const critico = relatorio.statusGeral === "CRÍTICO";
        panelStatus.className = `rounded-2xl p-4 text-center shadow-md border-2 transition-all ${critico ? 'bg-rose-600 text-white border-rose-400 animate-pulse' : 'bg-amber-500 text-white border-amber-400'}`;
        txtStatus.innerText = critico ? "🚨 ALERTA CRÍTICO: RISCO BIOLÓGICO/SANITÁRIO DETECTADO" : "⚠️ ATENÇÃO: AMBIENTE FORA DOS PADRÕES OPERACIONAIS";

        // Gerador Dinâmico de Triagens com Mitigação Detalhada e Rótulos Clínicos Explicados
        let htmlAlertas = "";
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
        "VOC": "TVOC (Compostos Orgânicos Voláteis / Vapores Químicos)",
        "PM2.5": "PM2.5 (Massa de Partículas Finas / Fumaça e Vírus)",
        "PM10": "PM10 (Massa de Partículas Grossas / Poeira e Pólen)",
        "NC0.5": "NC 0.5 (Contagem de Vírus e Bactérias)",
        "NC1.0": "NC 1.0 (Contagem de Fumaça e Aerossóis)",
        "NC10.0": "NC 10.0 (Contagem de Poeira, Ácaros e Pólen)",
        "Temperatura": "Temperatura Ambiente",
        "Umidade": "Umidade Relativa"
    };
    return nomes[param] || param;
}

function obterMensagemOMS(param, valor) {
    const mensagens = {
        "CO2": `🚨 EXCESSO DE CO₂ (GÁS CARBÔNICO) EM ${valor} PPM: Limite seguro da OMS violado. Indica confinamento severo do ar, queda na capacidade cognitiva e alta probabilidade de proliferação de patógenos por vias aéreas.`,
        "CO": `💀 TOXICIDADE POR CO (MONÓXIDO DE CARBONO) EM ${valor} PPM: Gás asfixiante invisível e altamente tóxico. Risco letal iminente por saturação celular de hemoglobinas.`,
        "VOC": `⚠️ SATURAÇÃO DE TVOC (VAPORES QUÍMICOS) EM ${valor}: Concentração prejudicial decorrente de produtos de faxina concentrados, solventes ou tintas. Risco de intoxicação de vias aéreas superiores.`,
        "PM2.5": `😷 ALERTA DE MASSA PM2.5 (FUMAÇA E VÍRUS) EM ${valor} µg/m³: Peso total elevado de micropartículas com diâmetro molecular ultrafino capaz de transpor os alvéolos e invadir o fluxo sanguíneo.`,
        "PM10": `🍂 ALERTA DE MASSA PM10 (POEIRA E PÓLEN) EM ${valor} µg/m³: Excesso de massa volumétrica de poeiras grossas e alérgenos saturando o sistema mecânico de filtragem da sala.`,
        "NC0.5": `🦠 ALERTA BIOLÓGICO CRÍTICO (NC 0.5) EM ${valor} pt/cm³: Quantidade massiva de partículas correspondentes ao tamanho de vírus isolados (Influenza, Coronavírus) e colônias de bactérias em suspensão. Alto risco de contaminação cruzada aérea!`,
        "NC1.0": `🚬 ALERTA DE RISCO COGNITIVO (NC 1.0) EM ${valor} pt/cm³: Altíssima densidade de partículas com perfil físico de fumaça de cigarro/incêndio, fuligem urbana ou aerossóis secos pós-espirro.`,
        "NC10.0": `🌾 ALERTA DE ALÉRGENOS AGUDOS (NC 10.0) EM ${valor} pt/cm³: Concentração física extrema de fezes de ácaros microscópicos, esporos reprodutores de mofo ou grãos de pólen vegetal no recinto.`,
        "Temperatura": `🌡️ DESCONFORTO TÉRMICO EM ${valor}°C: Ambiente fora do padrão regulamentar estipulado para a estabilidade metabólica humana.`,
        "Umidade": `💧 ANOMALIA HIGROMÉTRICA EM ${valor}%: Níveis elevados aceleram bolores e fungos nas paredes; níveis baixos ressecam e ferem mucosas nasais.`
    };
    return mensagens[param] || "Substância operacional fora das metas sanitárias regulamentadas.";
}

function obterMitigacaoOMS(param) {
    const acoes = {
        "CO2": "EVACUAR PARCIALMENTE OU ABRIR TODAS AS JANELAS IMEDIATAMENTE. Ajustar abertura dos dampers de captação externa no painel do HVAC.",
        "CO": "EVACUAÇÃO COMPLETA IMEDIATA. Cortar fontes mecânicas de combustão e acionar Brigada de Emergência.",
        "VOC": "Ligar exaustores no modo de vazão máxima e interromper qualquer aplicação técnica de desinfetantes industriais no local.",
        "PM2.5": "Ativar purificadores autônomos com barreiras de filtragem absoluta HEPA. Verificar vedações de portas em relação a fumaças.",
        "PM10": "Realizar higienização úmida imediata do piso para decantação mecânica de poeiras e inspecionar filtros G4 do prédio.",
        "NC0.5": "LIGAR PURIFICADORES DE AR COM FILTRO ABSOLUTO HEPA NA VELOCIDADE MÁXIMA. Avaliar mascaramento emergencial de pacientes.",
        "NC1.0": "Ativar ciclos de renovação forçada para eliminação de vapores em suspensão e checar focos de queima ou infiltrações de fuligem.",
        "NC10.0": "Providenciar substituição imediata das mantas de teto do ar-condicionado e higienizar cortinas/carpetes.",
        "Temperatura": "Regular os setpoints de refrigeração no termostato central para retornar à faixa entre 20°C e 24°C.",
        "Umidade": "Se alta, acionar ciclo de desumidificação ativa por serpentina (HVAC). Se baixa, acionar umidificadores ultrassônicos prediais."
    };
    return acoes[param] || "Acionar corpo de engenharia predial técnica para intervenção operacional direta.";
}
