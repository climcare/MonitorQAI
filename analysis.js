// ====================================================================
// CONFIGURAÇÃO DOS LIMITES OPERACIONAIS TÉCNICOS (ANVISA / NBR)
// ====================================================================
const NORMAS_QAI = {
    gases: {
        co2: { max: 1000 },    // ppm - Renovação do ar
        co: { max: 9.0 },      // ppm - Toxicidade imediata
        vocIndex: { max: 300 } // Índice - Carga química volátil
    },
    particulados: {
        pm25: { max: 15.0 },   // µg/m³ - Partículas finas respiráveis (OMS)
        pm10: { max: 50.0 }    // µg/m³ - Partículas grossas
    },
    conforto: {
        temperature: { min: 20.0, max: 24.0 }, // °C - Faixa operacional padrão
        humidity: { min: 40.0, max: 65.0 }     // % - Controle microbiológico
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
// ENGINE DE AVALIAÇÃO E FILTRAGEM DE VIOLAÇÕES SANITÁRIAS
// ====================================================================
function analisarLeituraQAI(leitura) {
    const diagnostico = {
        dispositivoId: leitura.deviceId,
        carimbotempo: leitura.created_at || new Date().toISOString(),
        statusGeral: "CONFORME", 
        pontoOrvalho: 0,
        violacoes: [],
        telemetriaAvancada: {}
    };

    if (leitura.temperature && leitura.humidity) {
        diagnostico.pontoOrvalho = calcularPontoOrvalho(leitura.temperature, leitura.humidity);
    }

    // Validações - Gases
    if (leitura.co2 > NORMAS_QAI.gases.co2.max) {
        diagnostico.violacoes.push({
            parametro: "CO2",
            valor: leitura.co2,
            limite: NORMAS_QAI.gases.co2.max,
            unidade: "ppm",
            gravidade: "ATENÇÃO",
            mensagem: "Taxa de renovação de ar insuficiente. Alta concentração de bioefluentes humanos no ambiente."
        });
    }

    if (leitura.co > NORMAS_QAI.gases.co.max) {
        diagnostico.violacoes.push({
            parametro: "CO",
            valor: leitura.co,
            limite: NORMAS_QAI.gases.co.max,
            unidade: "ppm",
            gravidade: "CRÍTICO",
            mensagem: "Monóxido de Carbono acima do limite de segurança. Risco severo de asfixia química e toxicidade arterial."
        });
    }

    if (leitura.vocIndex > NORMAS_QAI.gases.vocIndex.max) {
        diagnostico.violacoes.push({
            parametro: "VOC",
            valor: leitura.vocIndex,
            limite: NORMAS_QAI.gases.vocIndex.max,
            unidade: "",
            gravidade: "ATENÇÃO",
            mensagem: "Concentração elevada de Compostos Orgânicos Voláteis. Indício de saturação por produtos de limpeza ou solventes."
        });
    }

    // Validações - Particulados (Massa)
    if (leitura.pm25 > NORMAS_QAI.particulados.pm25.max) {
        diagnostico.violacoes.push({
            parametro: "PM2.5",
            valor: leitura.pm25,
            limite: NORMAS_QAI.particulados.pm25.max,
            unidade: "µg/m³",
            gravidade: "CRÍTICO",
            mensagem: "Partículas ultrafinas em nível perigoso. Risco de transporte de patógenos e saturação de vias respiratórias."
        });
    }

    if (leitura.pm10 > NORMAS_QAI.particulados.pm10.max) {
        diagnostico.violacoes.push({
            parametro: "PM10",
            valor: leitura.pm10,
            limite: NORMAS_QAI.particulados.pm10.max,
            unidade: "µg/m³",
            gravidade: "ATENÇÃO",
            mensagem: "Partículas grossas em suspensão acima do limite normativo de purificação mecânica diária."
        });
    }

    // Validações - Conforto e Segurança Biológica
    const temp = leitura.temperature;
    const hum = leitura.humidity;

    if (temp < NORMAS_QAI.conforto.temperature.min || temp > NORMAS_QAI.conforto.temperature.max) {
        diagnostico.violacoes.push({
            parametro: "Temperatura",
            valor: temp,
            limite: `${NORMAS_QAI.conforto.temperature.min}-${NORMAS_QAI.conforto.temperature.max}`,
            unidade: "°C",
            gravidade: "ATENÇÃO",
            mensagem: "Gradiente térmico fora da faixa operacional recomendada para estabilidade metabólica e conforto."
        });
    }

    if (hum < NORMAS_QAI.conforto.humidity.min || hum > NORMAS_QAI.conforto.humidity.max) {
        diagnostico.violacoes.push({
            parametro: "Umidade",
            valor: hum,
            limite: `${NORMAS_QAI.conforto.humidity.min}-${NORMAS_QAI.conforto.humidity.max}`,
            unidade: "%",
            gravidade: "ATENÇÃO",
            mensagem: "Umidade relativa inadequada. Níveis altos aceleram mofo/fungos; níveis baixos ressecam mucosas protetoras."
        });
    }

    // Consolidação de Gravidade
    const possuiCritico = diagnostico.violacoes.some(v => v.gravidade === "CRÍTICO");
    const possuiAtencao = diagnostico.violacoes.some(v => v.gravidade === "ATENÇÃO");

    if (possuiCritico) {
        diagnostico.statusGeral = "CRÍTICO";
    } else if (possuiAtencao) {
        diagnostico.statusGeral = "ATENÇÃO";
    }

    // Mapeamento dos Valores Atuais Estáveis
    diagnostico.valoresAtuais = {
        temperature: leitura.temperature,
        humidity: leitura.humidity,
        co2: leitura.co2,
        co: leitura.co,
        vocIndex: leitura.vocIndex,
        pm25: leitura.pm25,
        pm10: leitura.pm10
    };

    // Estruturação da Telemetria Avançada para Engenharia
    diagnostico.telemetriaAvancada = {
        contagemParticulas: {
            nc0_5: leitura.nc0_5,
            nc1_0: leitura.nc1_0,
            nc2_5: leitura.nc2_5,
            nc10_0: leitura.nc10_0
        },
        tamanhoTipico: leitura.typicalSize,
        sinalRede: leitura.signalStrength,
        nox: leitura.noxIndex
    };

    return diagnostico;
}
