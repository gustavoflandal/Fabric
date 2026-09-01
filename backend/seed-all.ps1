# Script para popular o banco de dados completo
Write-Host "🌱 FABRIC - Seed Completo do Banco de Dados" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

Write-Host "Passo 1/5: Limpando banco de dados (mantendo usuários)..." -ForegroundColor Yellow
npm run prisma:seed -- --file=seed-reset-complete.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao limpar banco de dados" -ForegroundColor Red
    exit 1
}

Write-Host "`nPasso 2/5: Criando estrutura básica (produtos, BOMs, roteiros)..." -ForegroundColor Yellow
npm run prisma:seed
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao criar estrutura básica" -ForegroundColor Red
    exit 1
}

Write-Host "`nPasso 3/5: Criando movimentações de estoque..." -ForegroundColor Yellow
npm run prisma:seed-stock
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao criar movimentações de estoque" -ForegroundColor Red
    exit 1
}

Write-Host "`nPasso 4/5: Criando ordens de produção adicionais..." -ForegroundColor Yellow
npm run prisma:seed-production
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao criar ordens de produção" -ForegroundColor Red
    exit 1
}

Write-Host "`nPasso 5/5: Criando apontamentos de produção..." -ForegroundColor Yellow
npm run prisma:seed-pointings
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao criar apontamentos" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Seed completo finalizado com sucesso!" -ForegroundColor Green
Write-Host "`nResumo dos dados criados:" -ForegroundColor Cyan
Write-Host "  - Unidades de medida, categorias, fornecedores, clientes" -ForegroundColor White
Write-Host "  - 14 produtos (acabados, semiacabados, materias-primas, embalagens)" -ForegroundColor White
Write-Host "  - 4 BOMs completas" -ForegroundColor White
Write-Host "  - 6 centros de trabalho" -ForegroundColor White
Write-Host "  - 4 roteiros de producao" -ForegroundColor White
Write-Host "  - 5+ ordens de producao em diferentes status" -ForegroundColor White
Write-Host "  - Movimentacoes de estoque (entradas, saidas, ajustes)" -ForegroundColor White
Write-Host "  - Apontamentos de producao" -ForegroundColor White
Write-Host "`nSistema pronto para demonstracao!`n" -ForegroundColor Green
