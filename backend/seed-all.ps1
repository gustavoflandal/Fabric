# Script para popular o banco de dados completo — todos os módulos do sistema
$ErrorActionPreference = "Stop"
Write-Host "🌱 FABRIC - Seed Completo do Banco de Dados" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

function Run-Step($stepLabel, $npmScript) {
    Write-Host "`n$stepLabel" -ForegroundColor Yellow
    npm run $npmScript
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erro em: $stepLabel" -ForegroundColor Red
        exit 1
    }
}

Run-Step "Passo  1/12: Limpando banco de dados (mantendo usuários)..." "prisma:seed-reset"
Run-Step "Passo  2/12: Criando estrutura básica (produtos, BOMs, roteiros, PCP)..." "prisma:seed"
Run-Step "Passo  3/12: Criando movimentações de estoque..." "prisma:seed-stock"
Run-Step "Passo  4/12: Criando ordens de produção adicionais..." "prisma:seed-production"
Run-Step "Passo  5/12: Criando apontamentos de produção..." "prisma:seed-pointings"
Run-Step "Passo  6/12: Criando orçamentos e pedidos de compra..." "prisma:seed-purchases"
Run-Step "Passo  7/12: Criando planos, sessões e itens de contagem de inventário..." "prisma:seed-counting"
Run-Step "Passo  8/12: Criando planos de contagem adicionais..." "prisma:seed-counting-plans"
Run-Step "Passo  9/12: Criando armazéns..." "prisma:seed-warehouses"
Run-Step "Passo 10/12: Criando ruas, posições e saldo endereçado (WMS)..." "prisma:seed-warehouse-structures"
Run-Step "Passo 11/12: Criando equipamentos, planos e ordens de manutenção..." "prisma:seed-maintenance"
Run-Step "Passo 12/12: Criando pátio, frota, motoristas e visitas (YMS)..." "prisma:seed-yms"

Write-Host "`n✅ Seed completo finalizado com sucesso!" -ForegroundColor Green
Write-Host "`nResumo dos dados criados:" -ForegroundColor Cyan
Write-Host "  - Unidades de medida, categorias, fornecedores, clientes" -ForegroundColor White
Write-Host "  - 14 produtos (acabados, semiacabados, materias-primas, embalagens)" -ForegroundColor White
Write-Host "  - 4 BOMs completas, 6 centros de trabalho, 4 roteiros de producao" -ForegroundColor White
Write-Host "  - Ordens de producao e apontamentos em varios status" -ForegroundColor White
Write-Host "  - Orcamentos e pedidos de compra em varios status, com recebimentos" -ForegroundColor White
Write-Host "  - Planos, sessoes e itens de contagem de inventario, com divergencias" -ForegroundColor White
Write-Host "  - Armazens, ruas, posicoes de armazenagem e saldo enderecado (WMS)" -ForegroundColor White
Write-Host "  - Equipamentos, planos preventivos e ordens de manutencao" -ForegroundColor White
Write-Host "  - Patio: areas, vagas, docas, frota, motoristas e visitas (YMS)" -ForegroundColor White
Write-Host "`nSistema pronto para avaliacao com dados reais em todas as telas!`n" -ForegroundColor Green
