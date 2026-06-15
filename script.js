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

    // Lógica Semafórica Granular dos Cards
    pintarCard('cardTemp', 'statusTemp', relatorio.analiseIndividual.temperatura);
    pintarCard('cardHum', 'statusHum', relatorio.analiseIndividual.umidade);
    pintarCard('cardCO2', 'statusCO2', relatorio.analiseIndividual.co2);

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

        // Gerador Dinâmico de Triagens com Mitigação Detalhada
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

function obterNomeTraduzido(param) {
    const nomes = {
        "CO2": "CO₂ (Gás Carbônico)",
        "CO": "CO (Monóxido de Carbono)",
        "VOC": "TVOC (Compostos Orgânicos Voláteis / Químicos)",
        "PM2.5": "PM2.5 (Partículas Finas / Fumaça e Vírus)",
        "PM10": "PM10 (Partículas Grossas / Poeira e Pólen)",
        "Temperatura": "Temperatura Ambiente",
        "Umidade": "Umidade Relativa"
    };
    return nomes[param] || param;
}

function obterMensagemOMS(param, valor) {
    const mensagens = {
        "CO2": `🚨 EXCESSO DE CO₂ (GÁS CARBÔNICO) EM ${valor} PPM: O limite seguro da OMS foi violado. Indica confinamento severo do ar ambiente, queda na saturação de oxigênio cognitivo e alta probabilidade de proliferação cruzada de patógenos aéreos.`,
        "CO": `💀 TOXICIDADE POR CO (MONÓXIDO DE CARBONO) EM ${valor} PPM: Gás asfixiante mecânico invisível e inodoro. Risco letal iminente por saturação celular de hemoglobinas.`,
        "VOC": `⚠️ SATURAÇÃO DE TVOC (QUÍMICOS VOLÁTEIS) EM ${valor}: Saturação química oriunda de desinfetantes pesados, tintas ou solventes. Risco de cefaleia química e irritação de mucosas respiratórias.`,
        "PM2.5": `😷 ALERTA PM2.5 (VÍRUS, BACTÉRIAS E FUMAÇA) EM ${valor} µg/m³: Partículas com diâmetro molecular ultrafino capaz de romper a barreira alveolar e circular livremente no fluxo sanguíneo do paciente.`,
        "PM10": `🍂 ALERTA PM10 (POEIRA ATMOSFÉRICA E PÓLEN) EM ${valor} µg/m³: Massa volumétrica de poeiras grossas e alérgenos em suspensão saturando o sistema filtrante do local.`,
        "Temperatura": `🌡️ DESCONFORTO TÉRMICO EM ${valor}°C: Ambiente fora do padrão operacional estipulado para a estabilidade metabólica humana e preservação de insumos.`,
        "Umidade": `💧 ANOMALIA HIGROMÉTRICA EM ${valor}%: Índices elevados aceleram esporos de fungos/mofo; índices secos comprometem a barreira mucosa protetora nasal.`
    };
    return mensagens[param] || "Substância operacional fora das metas sanitárias regulamentadas.";
}

function obterMitigacaoOMS(param) {
    const acoes = {
        "CO2": "EVACUAR PARCIALMENTE OU ABRIR TODAS AS JANELAS IMEDIATAMENTE. Ativar admissão de ar externo nas centrais HVAC.",
        "CO": "EVACUAÇÃO COMPLETA IMEDIATA. Cortar fontes de combustão e acionar Brigada de Emergência.",
        "VOC": "Ligar sistemas de exaustão forçada no nível máximo e interromper aplicação de produtos de limpeza industriais.",
        "PM2.5": "Ativar purificadores autônomos equipados com barreiras de filtragem absoluta HEPA. Verificar vedações de janelas.",
        "PM10": "Realizar higienização úmida imediata do piso para decantação de poeiras e inspecionar filtros mecânicos G4 do prédio.",
        "Temperatura": "Regular os parâmetros de setpoint no termostato central ou checar janelas abertas sabotando o sistema.",
        "Umidade": "Se alta, acionar o ciclo de desumidificação ativa por serpentina do HVAC. Se baixa, acionar umidificadores ultrassônicos."
    };
    return acoes[param] || "Acionar corpo de engenharia predial técnica para intervenção direta.";
}
