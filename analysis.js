/**
 * Motor de Análise Sanitária e Normativa - QAI Clínico
 * Analisa os dados brutos e gera o diagnóstico em conformidade com as regras estabelecidas.
 */

function calcularScoreQAI(leitura, analiseIndividual) {
    let scoreCO2 = 25;
    let scoreMassa = 25;
    let scoreContagem = 25;
    let scoreConforto = 25;

    // 1. Avaliação de Renovação (CO2)
    if (analiseIndividual.co2 === "CRÍTICO") scoreCO2 = 5;
    else if (analiseIndividual.co2 === "ALERTA") scoreCO2 = 15;

    // 2. Avaliação de Particulados por Massa (PM2.5 e PM10)
    if (leitura.pm25 > 15 || leitura.pm10 > 50) scoreMassa = 5;
    else if (leitura.pm25 > 7.5 || leitura.pm10 > 25) scoreMassa = 15;

    // 3. Avaliação de Particulados por Contagem Clínica (NC0.5 e NC1.0)
    if (analiseIndividual.nc05 === "CRÍTICO") scoreContagem = 5;
    else if (analiseIndividual.nc10 === "ALERTA") scoreContagem = 15;

    // 4. Avaliação de Conforto Térmico (Temperatura e Umidade)
    let desvios = 0;
    if (analiseIndividual.temperatura !== "BOM") desvios++;
    if (analiseIndividual.umidade !== "BOM") desvios++;
    
    if (desvios === 2) scoreConforto = 5;
    else if (desvios === 1) scoreConforto = 15;

    // Retorna a soma travada nos limites seguros de engenharia de software
    return Math.max(0, Math.min(100, scoreCO2 + scoreMassa + scoreContagem + scoreConforto));
}

function analisarLeituraQAI(leitura) {
    const diagnostico = {
        statusGeral: "NORMAL",
        corStatus: "bg-emerald-500/10 border-emerald-500/20 text-emerald-500",
        mensagemTexto: "Ambiente Conforme. Todos os parâmetros operam dentro dos limites sanitários ideais.",
        analiseIndividual: {
            co2: "BOM",
            pm25: "BOM",
            pm10: "BOM",
            nc05: "BOM",
            nc10: "BOM",
            temperatura: "BOM",
            umidade: "BOM"
        }
    };

    // 1. Triagem de CO2 (Regra ANVISA RE 09)
    if (leitura.co2 > 1000) {
        diagnostico.analiseIndividual.co2 = "CRÍTICO";
        diagnostico.statusGeral = "CRÍTICO";
    } else if (leitura.co2 > 800) {
        diagnostico.analiseIndividual.co2 = "ALERTA";
        if (diagnostico.statusGeral !== "CRÍTICO") diagnostico.statusGeral = "ALERTA";
    }

    // 2. Triagem de PM 2.5 (Massa - Diretriz de Saúde da OMS)
    if (leitura.pm25 > 15.0) {
        diagnostico.analiseIndividual.pm25 = "CRÍTICO";
        diagnostico.statusGeral = "CRÍTICO";
    } else if (leitura.pm25 > 7.5) {
        diagnostico.analiseIndividual.pm25 = "ALERTA";
        if (diagnostico.statusGeral !== "CRÍTICO") diagnostico.statusGeral = "ALERTA";
    }

    // 3. Triagem de PM 10 (Massa - Teto Normativo ANVISA)
    if (leitura.pm10 > 50.0) {
        diagnostico.analiseIndividual.pm10 = "CRÍTICO";
        diagnostico.statusGeral = "CRÍTICO";
    } else if (leitura.pm10 > 25.0) {
        diagnostico.analiseIndividual.pm10 = "ALERTA";
        if (diagnostico.statusGeral !== "CRÍTICO") diagnostico.statusGeral = "ALERTA";
    }

    // 4. Triagem de Contagem Numérica NC 0.5 (Aerossóis em Suspensão)
    if (leitura.nc05 > 500) {
        diagnostico.analiseIndividual.nc05 = "CRÍTICO";
        diagnostico.statusGeral = "CRÍTICO";
    } else if (leitura.nc05 > 250) {
        diagnostico.analiseIndividual.nc05 = "ALERTA";
        if (diagnostico.statusGeral !== "CRÍTICO") diagnostico.statusGeral = "ALERTA";
    }

    // 5. Triagem de Contagem Numérica NC 1.0 (Microgotículas de Carga Viral)
    if (leitura.nc10 > 100) {
        diagnostico.analiseIndividual.nc10 = "CRÍTICO";
        diagnostico.statusGeral = "CRÍTICO";
    } else if (leitura.nc10 > 50) {
        diagnostico.analiseIndividual.nc10 = "ALERTA";
        if (diagnostico.statusGeral !== "CRÍTICO") diagnostico.statusGeral = "ALERTA";
    }

    // 6. Triagem de Temperatura (Faixa de Conforto Térmico)
    if (leitura.temperature < 18.0 || leitura.temperature > 26.0) {
        diagnostico.analiseIndividual.temperatura = "CRÍTICO";
        diagnostico.statusGeral = "CRÍTICO";
    } else if (leitura.temperature < 20.0 || leitura.temperature > 24.0) {
        diagnostico.analiseIndividual.temperatura = "ALERTA";
        if (diagnostico.statusGeral !== "CRÍTICO") diagnostico.statusGeral = "ALERTA";
    }

    // 7. Triagem de Umidade Relativa do Ar (Prevenção de Esporos e Ressecamento)
    if (leitura.humidity < 35 || leitura.humidity > 65) {
        diagnostico.analiseIndividual.umidade = "CRÍTICO";
        diagnostico.statusGeral = "CRÍTICO";
    } else if (leitura.humidity < 40 || leitura.humidity > 60) {
        diagnostico.analiseIndividual.umidade = "ALERTA";
        if (diagnostico.statusGeral !== "CRÍTICO") diagnostico.statusGeral = "ALERTA";
    }

    // Configuração dos Textos de Alertas Combinados
    if (diagnostico.statusGeral === "CRÍTICO") {
        diagnostico.corStatus = "bg-rose-500/10 border-rose-500/20 text-rose-500 dark:text-rose-400";
        diagnostico.mensagemTexto = "🔴 QUALIDADE DO AR COMPROMETIDA: Parâmetros críticos detectados. Risco iminente à saúde e fadiga severa.";
    } else if (diagnostico.statusGeral === "ALERTA") {
        diagnostico.corStatus = "bg-amber-500/10 border-amber-500/20 text-amber-500 dark:text-amber-400";
        diagnostico.mensagemTexto = "⚠️ ALERTA OPERACIONAL: Desvios preventivos detectados. Recomenda-se acionar renovação de ar forçada.";
    }

    // Injeta o cálculo dinâmico ponderado do Score Geral de Qualidade
    diagnostico.scoreGeral = calcularScoreQAI(leitura, diagnostico.analiseIndividual);

    return diagnostico;
}
