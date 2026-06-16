// ====================================================================
// CONFIGURAÇÃO DOS LIMITES OPERACIONAIS TÉCNICOS (ANVISA / NBR)
// ====================================================================
const NORMAS_QAI = {
    gases: {
        co2: { max: 1000 },    // ppm - Renovação do ar (Gás Carbônico)
        co: { max: 9.0 },      // ppm - Toxicidade imediata (Monóxido de Carbono)
        vocIndex: { max: 300 } // Índice - Carga química volátil (TVOC)
    },
    particulados: {
        pm25: { max: 15.0 },   // µg/m³ - Partículas finas respiráveis (OMS)
        pm10: { max: 50.0 }    // µg/m³ - Partículas grossas
    },
    contagem: {
        nc0_5: { max: 100 },   // pt/cm³ - Alerta para Carga Viral/Bacteriana (Vírus e Bactérias)
        nc1_0: { max: 150 },   // pt/cm³ - Alerta para Fumaça/Aerossóis (Fumaça e Fuligem)
        nc10_0: { max: 50 }    // pt/cm³ - Alerta para Alérgenos Grandes (Poeira, Ácaros e Pólen)
    },
    conforto: {
        temperature: { min: 20.0, max: 24.0 }, // °C - Faixa operacional padrão
        humidity: { min: 40.0, max: 65.0 }      // % - Controle microbiológico
    }
};

// ====================================================================
// MOTOR DE CÁLCULO: MATRIZ DE MAGNUS-TETENS (PONTO DE ORVALHO)
// ====================================================================
function calcularPontoOrvalho(t, rh) {
    const a = 17.625;
    const b = 243.04;

    if (rh <= 0 || rh > 100 || isNaN(t) || isNaN(rh)) return 0;

    const alfa = ((a * t) / (b + t)) + Math.log(rh / 100);
    const pontoOrvalho = (b * alfa) / (a - alfa);

    return parseFloat(pontoOrvalho.toFixed(1));
}

// ====================================================================
// NOVO ALGORITMO PONDERADO DO SCORE DE QUALIDADE (IAQ SCORE 0-100)
// ====================================================================
function calcularScoreQAI(leitura, analiseIndividual) {
    let scoreGases = 25;
    let scoreMassa = 25;
    let scoreContagem = 25;
    let scoreConforto = 25;

    // 1. Penalidade de Gases (CO2, CO, VOC)
    if (analiseIndividual.co2 === "CRÍTICO" || leitura.co > NORMAS_QAI.gases.co.max) {
        scoreGases = 5;
    } else if (analiseIndividual.co2 === "ALERTA" || leitura.vocIndex > NORMAS_QAI.gases.vocIndex.max) {
        scoreGases = 15;
    }

    // 2. Penalidade de Massa de Particulados (PM2.5 e PM10)
    if (leitura.pm25 > NORMAS_QAI.particulados.pm25.max || leitura.pm10 > NORMAS_QAI.particulados.pm10.max) {
        scoreMassa = 5;
    } else if (leitura.pm25 > (NORMAS_QAI.particulados.pm25.max / 2) || leitura.pm10 > (NORMAS_QAI.particulados.pm10.max / 2)) {
        scoreMassa = 15;
    }

    // 3. Penalidade de Contagem Clínica (NC0.5, NC1.0, NC10.0)
    if (analiseIndividual.nc05 === "CRÍTICO") {
        scoreContagem = 5;
    } else if (analiseIndividual.nc10 === "ALERTA" || analiseIndividual.nc100 === "ALERTA") {
        scoreContagem = 15;
    }

    // 4. Penalidade de Conforto Térmico (Temperatura e Umidade)
    let desviosConforto = 0;
    if (analiseIndividual.temperatura !== "BOM") desviosConforto++;
    if (analiseIndividual.umidade !== "BOM") desviosConforto++;
    
    if (desviosConforto === 2) scoreConforto = 5;
    else if (desviosConforto === 1) scoreConforto = 15;

    // Retorna a soma matemática limitada entre 0 e 100
    return Math.max(0, Math.min(100, scoreGases + scoreMassa + scoreContagem + scoreConforto));
}

// ====================================================================
// ENGINE DE AVALIAÇÃO E FILTRAGEM DE VIOLAÇÕES SANITÁRIAS
// ====================================================================
function analisarLeituraQAI(leitura) {
    const diagnostico = {
        dispositivoId: leitura.deviceId || leitura.device_id,
        carimbotempo: leitura.created_at || new Date().toISOString(),
        statusGeral: "CONFORME", 
        pontoOrvalho: 0,
        violacoes: [],
        valoresAtuais: {},
        telemetriaAvancada: {},
        analiseIndividual: {},
        scoreGeral: 100,
        corStatus: "bg-emerald-500/10 border-emerald-500/20 text-emerald-500",
        mensagemTexto: "Ambiente Conforme. Todos os parâmetros operam dentro dos limites sanitários ideais."
    };

    const temp = Number(leitura.temperature);
    const hum = Number(leitura.humidity);

    if (!isNaN(temp) && !isNaN(hum)) {
        diagnostico.pontoOrvalho = calcularPontoOrvalho(temp, hum);
    }

    // ==========================================
    // 1. VALIDAÇÕES - GASES
    // ==========================================
    if (leitura.co2 > NORMAS_QAI.gases.co2.max) {
        diagnostico.violacoes.push({
            parametro: "CO2", valor: leitura.co2, limite: NORMAS_QAI.gases.co2.max, unidade: "ppm", gravidade: "ATENÇÃO",
            mensagem: "Taxa de renovação de ar insuficiente. Alta concentração de bioefluentes humanos no ambiente."
        });
    }

    if (leitura.co > NORMAS_QAI.gases.co.max) {
        diagnostico.violacoes.push({
            parametro: "CO", valor: leitura.co, limite: NORMAS_QAI.gases.co.max, unidade: "ppm", gravidade: "CRÍTICO",
            mensagem: "Monóxido de Carbono acima do limite de segurança. Risco severo de asfixia química e toxicidade arterial."
        });
    }

    if (leitura.vocIndex > NORMAS_QAI.gases.vocIndex.max) {
        diagnostico.violacoes.push({
            parametro: "VOC", valor: leitura.vocIndex, limite: NORMAS_QAI.gases.vocIndex.max, unidade: "", gravidade: "ATENÇÃO",
            mensagem: "Concentração elevada de Compostos Orgânicos Voláteis. Indício de saturação por produtos de limpeza ou solventes."
        });
    }

    // ==========================================
    // 2. VALIDAÇÕES - MASSA
    // ==========================================
    if (leitura.pm25 > NORMAS_QAI.particulados.pm25.max) {
        diagnostico.violacoes.push({
            parametro: "PM2.5", valor: leitura.pm25, limite: NORMAS_QAI.particulados.pm25.max, unidade: "µg/m³", gravidade: "CRÍTICO",
            mensagem: "Partículas ultrafinas em nível perigoso. Risco de transporte de patógenos e saturação de vias respiratórias."
        });
    }

    if (leitura.pm10 > NORMAS_QAI.particulados.pm10.max) {
        diagnostico.violacoes.push({
            parametro: "PM10", valor: leitura.pm10, limite: NORMAS_QAI.particulados.pm10.max, unidade: "µg/m³", gravidade: "ATENÇÃO",
            mensagem: "Partículas grossas em suspensão acima do limite normativo de purificação mecânica diária."
        });
    }

    // ==========================================
    // 3. VALIDAÇÕES CLÍNICAS - QUANTIDADE DE MICRO-PARTÍCULAS
    // ==========================================
    if (leitura.nc0_5 > NORMAS_QAI.contagem.nc0_5.max) {
        diagnostico.violacoes.push({
            parametro: "NC0.5", valor: Number(leitura.nc0_5).toFixed(0), limite: NORMAS_QAI.contagem.nc0_5.max, unidade: " pt/cm³", gravidade: "CRÍTICO",
            mensagem: "Altíssima quantidade de micropartículas compatíveis com tamanho de vírus e bactérias em suspensão aeroespacial."
        });
    }

    if (leitura.nc1_0 > NORMAS_QAI.contagem.nc1_0.max) {
        diagnostico.violacoes.push({
            parametro: "NC1.0", valor: Number(leitura.nc1_0).toFixed(0), limite: NORMAS_QAI.contagem.nc1_0.max, unidade: " pt/cm³", gravidade: "ATENÇÃO",
            mensagem: "Densidade excessiva de partículas com o perfil molecular de fumaça, fuligem industrial ou aerosóis secos."
        });
    }

    if (leitura.nc10_0 > NORMAS_QAI.contagem.nc10_0.max) {
        diagnostico.violacoes.push({
            parametro: "NC10.0", valor: Number(leitura.nc10_0).toFixed(0), limite: NORMAS_QAI.contagem.nc10_0.max, unidade: " pt/cm³", gravidade: "ATENÇÃO",
            mensagem: "Presença física massiva de alérgenos pesados como fezes de ácaros domésticos, esporos de mofo ou grãos de pólen."
        });
    }

    // ==========================================
    // 4. VALIDAÇÕES - CONFORTO
    // ==========================================
    if (temp < NORMAS_QAI.conforto.temperature.min || temp > NORMAS_QAI.conforto.temperature.max) {
        diagnostico.violacoes.push({
            parametro: "Temperatura", valor: temp, limite: `${NORMAS_QAI.conforto.temperature.min}-${NORMAS_QAI.conforto.temperature.max}`, unidade: "°C", gravidade: "ATENÇÃO",
            mensagem: "Gradiente térmico fora da faixa operacional recomendada para estabilidade metabólica e conforto."
        });
    }

    if (hum < NORMAS_QAI.conforto.humidity.min || hum > NORMAS_QAI.conforto.humidity.max) {
        diagnostico.violacoes.push({
            parametro: "Umidade", valor: hum, limite: `${NORMAS_QAI.conforto.humidity.min}-${NORMAS_QAI.conforto.humidity.max}`, unidade: "%", gravidade: "ATENÇÃO",
            mensagem: "Umidade relativa inadequada. Níveis altos aceleram mofo/fungos; níveis baixos ressecam mucosas protetoras."
        });
    }

    // ====================================================================
    // CONSOLIDAÇÃO DE GRAVIDADE GERAL
    // ====================================================================
    const possuiCritico = diagnostico.violacoes.some(v => v.gravidade === "CRÍTICO");
    const possuiAtencao = diagnostico.violacoes.some(v => v.gravidade === "ATENÇÃO");

    if (possuiCritico) {
        diagnostico.statusGeral = "CRÍTICO";
        diagnostico.corStatus = "bg-rose-500/10 border-rose-500/20 text-rose-500 dark:text-rose-400";
        diagnostico.mensagemTexto = "🔴 VIOLAÇÃO SANITÁRIA IMEDIATA: Parâmetros críticos detectados. Risco iminente à saúde e fadiga severa.";
    } else if (possuiAtencao) {
        diagnostico.statusGeral = "ATENÇÃO";
        diagnostico.corStatus = "bg-amber-500/10 border-amber-500/20 text-amber-500 dark:text-amber-400";
        diagnostico.mensagemTexto = "⚠️ ALERTA OPERACIONAL: Desvios preventivos detectados. Recomenda-se acionar renovação de ar forçada.";
    }

    // Mapeamento dos Dados de Saída Originais
    diagnostico.valoresAtuais = {
        temperature: temp,
        humidity: hum,
        co2: leitura.co2,
        co: leitura.co,
        vocIndex: leitura.vocIndex,
        pm25: leitura.pm25,
        pm10: leitura.pm10
    };

    diagnostico.telemetriaAvancada = {
        contagemParticulas: {
            nc0_5: leitura.nc0_5,
            nc1_0: leitura.nc1_0,
            nc2_5: leitura.nc2_5,
            nc10_0: leitura.nc10_0
        },
        tamanhoTipico: leitura.typicalSize || leitura.typical_size || leitura.tps || leitura.bpt,
        sinalRede: leitura.signalStrength || leitura.signal,
        nox: leitura.noxIndex || leitura.nox_index
    };

    diagnostico.analiseIndividual = {
        temperatura: (temp >= NORMAS_QAI.conforto.temperature.min && temp <= NORMAS_QAI.conforto.temperature.max) ? "BOM" : (temp > 26) ? "CRÍTICO" : "ALERTA",
        umidade: (hum >= NORMAS_QAI.conforto.humidity.min && hum <= NORMAS_QAI.conforto.humidity.max) ? "BOM" : "ALERTA",
        co2: (leitura.co2 <= 800) ? "BOM" : (leitura.co2 > NORMAS_QAI.gases.co2.max) ? "CRÍTICO" : "ALERTA",
        nc05: (leitura.nc0_5 <= NORMAS_QAI.contagem.nc0_5.max) ? "BOM" : "CRÍTICO",
        nc10: (leitura.nc1_0 <= NORMAS_QAI.contagem.nc1_0.max) ? "BOM" : "ALERTA",
        nc100: (leitura.nc10_0 <= NORMAS_QAI.contagem.nc10_0.max) ? "BOM" : "ALERTA"
    };

    // Injeta o cálculo dinâmico do Score Geral baseado nas regras originais
    diagnostico.scoreGeral = calcularScoreQAI(leitura, diagnostico.analiseIndividual);

    return diagnostico;
}
