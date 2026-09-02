import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // ============================================
  // MÓDULOS LICENCIADOS DESTA INSTALAÇÃO
  // ============================================
  // F0.8 do plano do WMS, implementando a seção 3.1 de
  // docs/fase-2026-09-modernizacao/04_ARQUITETURA_MODULAR_LICENCIAMENTO.md.
  //
  // O modelo de deploy é uma instalação por cliente, então a licença é
  // configurada aqui (seed/script de onboarding), sem UI de autoatendimento nem
  // chave criptográfica.
  //
  // - PCP é o NÚCLEO: sempre habilitado, nunca desligável.
  // - COMPRAS nasce habilitado NESTE ambiente (decisão de 02/09/2026, seção 3.5
  //   deste documento: compras é módulo próprio, não PCP-core) — as rotas
  //   /purchase-quotations, /purchase-orders e /purchase-receipts estão atrás
  //   de requireModule('COMPRAS') e já funcionam com teste; desabilitar aqui
  //   quebraria isso. Numa instalação de cliente sem compras formais, `false`.
  // - WMS nasce habilitado NESTE ambiente porque é o módulo em construção — as
  //   rotas /warehouses, /warehouse-structures e /storage-positions estão atrás
  //   de requireModule('WMS') e responderiam 404 se a linha viesse desabilitada.
  //   Numa instalação de cliente só-PCP, este valor é `false` (ou a linha nem
  //   existe: módulo ausente da tabela conta como não licenciado).
  // - YMS ainda não tem código nenhum — só o nome reservado. Nasce desabilitado.
  //
  // `update: {}` nos módulos opcionais é deliberado: rodar o seed de novo NÃO
  // reativa um módulo que o fornecedor desligou nesta instalação. O PCP é a
  // exceção — ele é reafirmado como habilitado, porque desligar o núcleo não é
  // um estado válido.
  console.log('🧩 Configurando módulos licenciados...');
  const licensedModules = [
    { code: 'PCP', enabled: true, core: true },
    { code: 'COMPRAS', enabled: true, core: false },
    { code: 'WMS', enabled: true, core: false },
    { code: 'YMS', enabled: false, core: false },
  ];

  for (const { code, enabled, core } of licensedModules) {
    await prisma.licensedModule.upsert({
      where: { code },
      update: core ? { enabled: true } : {},
      create: { code, enabled },
    });
  }
  console.log(
    `   - ${licensedModules
      .map((m) => `${m.code}=${m.enabled ? 'on' : 'off'}`)
      .join(', ')}`
  );

  // Criar permissões padrão
  console.log('📝 Criando permissões...');
  const permissions = [
    // Usuários
    { resource: 'users', action: 'create', description: 'Criar usuários' },
    { resource: 'users', action: 'read', description: 'Visualizar usuários' },
    { resource: 'users', action: 'update', description: 'Editar usuários' },
    { resource: 'users', action: 'delete', description: 'Excluir usuários' },
    
    // Perfis
    { resource: 'roles', action: 'create', description: 'Criar perfis' },
    { resource: 'roles', action: 'read', description: 'Visualizar perfis' },
    { resource: 'roles', action: 'update', description: 'Editar perfis' },
    { resource: 'roles', action: 'delete', description: 'Excluir perfis' },
    
    // Produtos
    { resource: 'products', action: 'create', description: 'Criar produtos' },
    { resource: 'products', action: 'read', description: 'Visualizar produtos' },
    { resource: 'products', action: 'update', description: 'Editar produtos' },
    { resource: 'products', action: 'delete', description: 'Excluir produtos' },
    
    // BOMs (Estruturas de Produto)
    { resource: 'boms', action: 'create', description: 'Criar BOMs' },
    { resource: 'boms', action: 'read', description: 'Visualizar BOMs' },
    { resource: 'boms', action: 'update', description: 'Editar BOMs' },
    { resource: 'boms', action: 'delete', description: 'Excluir BOMs' },
    
    // Roteiros de Produção
    { resource: 'routings', action: 'create', description: 'Criar roteiros' },
    { resource: 'routings', action: 'read', description: 'Visualizar roteiros' },
    { resource: 'routings', action: 'update', description: 'Editar roteiros' },
    { resource: 'routings', action: 'delete', description: 'Excluir roteiros' },
    
    // Ordens de Produção
    { resource: 'production_orders', action: 'create', description: 'Criar ordens de produção' },
    { resource: 'production_orders', action: 'read', description: 'Visualizar ordens de produção' },
    { resource: 'production_orders', action: 'update', description: 'Editar ordens de produção' },
    { resource: 'production_orders', action: 'delete', description: 'Excluir ordens de produção' },
    { resource: 'production_orders', action: 'execute', description: 'Executar ordens de produção' },
    
    // Apontamentos de Produção
    { resource: 'production_pointings', action: 'create', description: 'Criar apontamentos' },
    { resource: 'production_pointings', action: 'read', description: 'Visualizar apontamentos' },
    { resource: 'production_pointings', action: 'update', description: 'Editar apontamentos' },
    { resource: 'production_pointings', action: 'delete', description: 'Excluir apontamentos' },
    
    // Centros de Trabalho
    { resource: 'work_centers', action: 'create', description: 'Criar centros de trabalho' },
    { resource: 'work_centers', action: 'read', description: 'Visualizar centros de trabalho' },
    { resource: 'work_centers', action: 'update', description: 'Editar centros de trabalho' },
    { resource: 'work_centers', action: 'delete', description: 'Excluir centros de trabalho' },

    // Armazéns (rotas ja existiam, mas nunca tiveram permissao seedada -
    // ninguem, nem admin, conseguia acessar o modulo. Ver Fase 1 do cronograma)
    { resource: 'armazens', action: 'visualizar', description: 'Visualizar armazéns' },
    { resource: 'armazens', action: 'criar', description: 'Criar armazéns' },
    { resource: 'armazens', action: 'editar', description: 'Editar armazéns' },
    { resource: 'armazens', action: 'excluir', description: 'Excluir armazéns' },

    // Estruturas de Armazém e Posições de Armazenagem
    { resource: 'estruturas_armazem', action: 'visualizar', description: 'Visualizar estruturas de armazém' },
    { resource: 'estruturas_armazem', action: 'criar', description: 'Criar estruturas de armazém' },
    { resource: 'estruturas_armazem', action: 'editar', description: 'Editar estruturas de armazém' },
    { resource: 'estruturas_armazem', action: 'excluir', description: 'Excluir estruturas de armazém' },
    { resource: 'estruturas_armazem', action: 'gerar_posicoes', description: 'Gerar posições de armazenagem' },
    { resource: 'estruturas_armazem', action: 'excluir_posicoes', description: 'Excluir posições de armazenagem' },
    // Renomeada de `storage_positions:update` (único par em inglês de todo o
    // módulo de armazém, que já usa `armazens`/`estruturas_armazem` em
    // português). Fica sob `estruturas_armazem` porque a EXCLUSÃO de uma
    // posição individual (`DELETE /storage-positions/position/:id`) já usa
    // `estruturas_armazem:excluir_posicoes` — não faria sentido excluir uma
    // posição por um recurso e atualizar a mesma posição por outro.
    { resource: 'estruturas_armazem', action: 'atualizar_posicao', description: 'Atualizar posição de armazenagem (bloquear/desbloquear, transferir conteúdo)' },

    // Tarefas de Armazém (WMS - Fase 4b, F4.9/F4.11)
    // Recurso NOVO, e não reaproveitamento de `recebimentos_compra` como na
    // Fase 4a: tarefa de PICKING nasce de ordem de produção e tarefa de
    // REPLENISHMENT não nasce de documento nenhum - exigir permissão de
    // COMPRAS de um operador de separação obrigaria a instalação a dar acesso
    // a um módulo que ela pode nem ter licenciado.
    // Três ações porque são três poderes distintos: ver a fila, executar o
    // trabalho, e distribuir trabalho para os outros (supervisor).
    { resource: 'tarefas_armazem', action: 'visualizar', description: 'Visualizar tarefas de armazém' },
    { resource: 'tarefas_armazem', action: 'executar', description: 'Executar tarefas de armazém (iniciar, conferir leitura, concluir)' },
    { resource: 'tarefas_armazem', action: 'atribuir', description: 'Atribuir tarefas de armazém a operadores' },

    // Fornecedores
    { resource: 'suppliers', action: 'create', description: 'Criar fornecedores' },
    { resource: 'suppliers', action: 'read', description: 'Visualizar fornecedores' },
    { resource: 'suppliers', action: 'update', description: 'Editar fornecedores' },
    { resource: 'suppliers', action: 'delete', description: 'Excluir fornecedores' },
    
    // Clientes
    { resource: 'customers', action: 'create', description: 'Criar clientes' },
    { resource: 'customers', action: 'read', description: 'Visualizar clientes' },
    { resource: 'customers', action: 'update', description: 'Editar clientes' },
    { resource: 'customers', action: 'delete', description: 'Excluir clientes' },
    
    // Unidades de Medida (Fase 2 do cronograma - RBAC estendido)
    { resource: 'units_of_measure', action: 'create', description: 'Criar unidades de medida' },
    { resource: 'units_of_measure', action: 'read', description: 'Visualizar unidades de medida' },
    { resource: 'units_of_measure', action: 'update', description: 'Editar unidades de medida' },
    { resource: 'units_of_measure', action: 'delete', description: 'Excluir unidades de medida' },

    // Dashboard geral (Fase 2 do cronograma - RBAC estendido)
    { resource: 'dashboard', action: 'read', description: 'Visualizar dashboard geral' },

    // Estoque
    { resource: 'stock', action: 'read', description: 'Visualizar estoque' },
    { resource: 'stock', action: 'update', description: 'Movimentar estoque' },
    { resource: 'stock', action: 'entry', description: 'Registrar entrada de estoque' },
    { resource: 'stock', action: 'exit', description: 'Registrar saída de estoque' },
    { resource: 'stock', action: 'adjustment', description: 'Ajustar estoque' },
    
    // MRP (Planejamento de Materiais)
    { resource: 'mrp', action: 'read', description: 'Visualizar MRP' },
    { resource: 'mrp', action: 'execute', description: 'Executar MRP' },
    { resource: 'mrp', action: 'consolidate', description: 'Consolidar necessidades' },
    
    // Relatórios
    { resource: 'reports', action: 'read', description: 'Visualizar relatórios' },
    { resource: 'reports', action: 'export', description: 'Exportar relatórios' },
    { resource: 'reports', action: 'production', description: 'Relatório de produção' },
    { resource: 'reports', action: 'efficiency', description: 'Relatório de eficiência' },
    { resource: 'reports', action: 'quality', description: 'Relatório de qualidade' },

    // Módulos (usado pelo frontend para liberar navegação)
    { resource: 'modules', action: 'view_general', description: 'Acessar módulo geral' },
    { resource: 'modules', action: 'view_pcp', description: 'Acessar módulo PCP' },
    { resource: 'modules', action: 'view_wms', description: 'Acessar módulo WMS' },
    { resource: 'modules', action: 'view_yms', description: 'Acessar módulo YMS' },

    // Permissões específicas utilizadas no frontend
    { resource: 'pcp', action: 'dashboard.view', description: 'Visualizar dashboard do PCP' },
    { resource: 'counting', action: 'plans.print', description: 'Imprimir plano de contagem' },
    
    // Logs de Auditoria
    { resource: 'audit_logs', action: 'read', description: 'Visualizar logs de auditoria' },
    { resource: 'audit_logs', action: 'delete', description: 'Excluir logs de auditoria' },
    
    // Orçamentos de Compra
    { resource: 'orcamentos_compra', action: 'criar', description: 'Criar orçamentos de compra' },
    { resource: 'orcamentos_compra', action: 'visualizar', description: 'Visualizar orçamentos de compra' },
    { resource: 'orcamentos_compra', action: 'editar', description: 'Editar orçamentos de compra' },
    { resource: 'orcamentos_compra', action: 'excluir', description: 'Excluir orçamentos de compra' },
    { resource: 'orcamentos_compra', action: 'aprovar', description: 'Aprovar orçamentos de compra' },
    { resource: 'orcamentos_compra', action: 'rejeitar', description: 'Rejeitar orçamentos de compra' },
    
    // Pedidos de Compra
    { resource: 'pedidos_compra', action: 'criar', description: 'Criar pedidos de compra' },
    { resource: 'pedidos_compra', action: 'visualizar', description: 'Visualizar pedidos de compra' },
    { resource: 'pedidos_compra', action: 'editar', description: 'Editar pedidos de compra' },
    { resource: 'pedidos_compra', action: 'excluir', description: 'Excluir pedidos de compra' },
    { resource: 'pedidos_compra', action: 'aprovar', description: 'Aprovar pedidos de compra' },
    { resource: 'pedidos_compra', action: 'confirmar', description: 'Confirmar pedidos de compra' },
    { resource: 'pedidos_compra', action: 'cancelar', description: 'Cancelar pedidos de compra' },

    // Recebimentos de Compra
    { resource: 'recebimentos_compra', action: 'criar', description: 'Criar recebimentos de compra' },
    { resource: 'recebimentos_compra', action: 'visualizar', description: 'Visualizar recebimentos de compra' },
    { resource: 'recebimentos_compra', action: 'excluir', description: 'Excluir recebimentos de compra' },
    
    // Planos de Contagem
    { resource: 'planos_contagem', action: 'criar', description: 'Criar planos de contagem' },
    { resource: 'planos_contagem', action: 'visualizar', description: 'Visualizar planos de contagem' },
    { resource: 'planos_contagem', action: 'editar', description: 'Editar planos de contagem' },
    { resource: 'planos_contagem', action: 'excluir', description: 'Excluir planos de contagem' },
    { resource: 'planos_contagem', action: 'ativar', description: 'Ativar planos de contagem' },
    { resource: 'planos_contagem', action: 'pausar', description: 'Pausar planos de contagem' },
    
    // Sessões de Contagem
    { resource: 'sessoes_contagem', action: 'visualizar', description: 'Visualizar sessões de contagem' },
    { resource: 'sessoes_contagem', action: 'criar', description: 'Criar sessões de contagem' },
    { resource: 'sessoes_contagem', action: 'iniciar', description: 'Iniciar sessões de contagem' },
    { resource: 'sessoes_contagem', action: 'completar', description: 'Completar sessões de contagem' },
    { resource: 'sessoes_contagem', action: 'cancelar', description: 'Cancelar sessões de contagem' },
    
    // Contagem de Estoque
    { resource: 'contagem', action: 'executar', description: 'Executar contagem de estoque' },
    { resource: 'contagem', action: 'recontar', description: 'Recontar itens' },
    { resource: 'contagem', action: 'aprovar_divergencia', description: 'Aprovar divergências de contagem' },
    
    // Relatórios de Contagem
    { resource: 'relatorios_contagem', action: 'visualizar', description: 'Visualizar relatórios de contagem' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: {
        resource_action: {
          resource: perm.resource,
          action: perm.action,
        },
      },
      update: {},
      create: perm,
    });
  }

  console.log(`✅ ${permissions.length} permissões criadas`);

  // ============================================
  // PERMISSÕES OBSOLETAS (renomeadas/removidas)
  // ============================================
  // Pares que já existiram no catálogo e não são mais checados por rota
  // nenhuma. Precisam sair do banco: enquanto existirem, o seed do ADMIN
  // (que atribui `allPermissions`) continua devolvendo permissão morta, e a
  // tela de gestão de perfis oferece um par que não protege nada.
  //
  // A ordem importa: `role_permissions` referencia `permissions` por FK, então
  // as associações saem primeiro (mesmo cuidado das remoções de permissão
  // morta das rodadas anteriores de RBAC).
  const obsoletePermissions = [
    // Renomeada para `estruturas_armazem:atualizar_posicao` nesta rodada.
    { resource: 'storage_positions', action: 'update' },
  ];

  for (const obsolete of obsoletePermissions) {
    const found = await prisma.permission.findUnique({
      where: { resource_action: { resource: obsolete.resource, action: obsolete.action } },
    });

    if (!found) continue;

    await prisma.rolePermission.deleteMany({ where: { permissionId: found.id } });
    await prisma.permission.delete({ where: { id: found.id } });
    console.log(`🧹 Permissão obsoleta removida: ${obsolete.resource}:${obsolete.action}`);
  }

  // Criar perfis
  console.log('👥 Criando perfis...');
  
  const allPermissions = await prisma.permission.findMany();
  
  // Criar ou atualizar perfil ADMIN
  const adminRole = await prisma.role.upsert({
    where: { code: 'ADMIN' },
    update: {
      name: 'Administrador',
      description: 'Acesso total ao sistema',
    },
    create: {
      code: 'ADMIN',
      name: 'Administrador',
      description: 'Acesso total ao sistema',
    },
  });

  // Remover permissões antigas e adicionar todas as novas
  await prisma.rolePermission.deleteMany({
    where: { roleId: adminRole.id },
  });

  await prisma.rolePermission.createMany({
    data: allPermissions.map((p) => ({
      roleId: adminRole.id,
      permissionId: p.id,
    })),
  });

  const managerRoleRecord = await prisma.role.upsert({
    where: { code: 'MANAGER' },
    update: {},
    create: {
      code: 'MANAGER',
      name: 'Gerente',
      description: 'Gerente de produção com acesso a relatórios',
    },
  });

  const operatorRoleRecord = await prisma.role.upsert({
    where: { code: 'OPERATOR' },
    update: {},
    create: {
      code: 'OPERATOR',
      name: 'Operador',
      description: 'Operador de produção',
    },
  });

  console.log('✅ Perfis criados: ADMIN, MANAGER, OPERATOR');

  // ============================================
  // PERMISSÕES PADRÃO DE MANAGER E OPERATOR
  // ============================================
  // Conjuntos declarados como resource -> [ações]. Pares que não existirem na
  // tabela `permissions` são ignorados silenciosamente (ex.: recursos criados
  // por scripts avulsos que ainda não rodaram neste ambiente).
  //
  // Critério: MANAGER não recebe nenhuma ação de exclusão nem gestão de
  // usuários/perfis além de leitura (gerente não é administrador do sistema).
  // OPERATOR conta e reconta, mas o ajuste de estoque por divergência
  // (`stock:adjustment` / `contagem:aprovar_divergencia`) é aprovação e fica
  // apenas com o MANAGER.

  const managerPermissions: Record<string, string[]> = {
    products: ['create', 'read', 'update'],
    boms: ['create', 'read', 'update'],
    routings: ['create', 'read', 'update'],
    production_orders: ['create', 'read', 'update', 'execute'],
    production_pointings: ['read', 'update'],
    work_centers: ['create', 'read', 'update'],
    suppliers: ['create', 'read', 'update'],
    customers: ['create', 'read', 'update'],
    // Cadastros de apoio: `units_of_measure` e `dashboard` já eram exigidos
    // pelas rotas, mas nunca tinham entrado nestes mapas — MANAGER e OPERATOR
    // tomavam 403 no dashboard e na lista de unidades de medida.
    units_of_measure: ['create', 'read', 'update'],
    dashboard: ['read'],
    stock: ['read', 'update', 'entry', 'exit', 'adjustment'],
    mrp: ['read', 'execute', 'consolidate'],
    reports: ['read', 'export', 'production', 'efficiency', 'quality'],
    orcamentos_compra: ['visualizar', 'criar', 'editar', 'aprovar', 'rejeitar'],
    pedidos_compra: ['visualizar', 'criar', 'editar', 'aprovar', 'confirmar', 'cancelar'],
    recebimentos_compra: ['visualizar', 'criar'],
    armazens: ['visualizar', 'criar', 'editar'],
    estruturas_armazem: ['visualizar', 'criar', 'editar', 'gerar_posicoes', 'atualizar_posicao'],
    // F4.9: o MANAGER é quem distribui trabalho no armazém (`atribuir`), além
    // de ver e poder executar.
    tarefas_armazem: ['visualizar', 'executar', 'atribuir'],
    planos_contagem: ['visualizar', 'criar', 'editar', 'ativar', 'pausar'],
    sessoes_contagem: ['visualizar', 'criar', 'iniciar', 'completar', 'cancelar'],
    contagem: ['executar', 'recontar', 'aprovar_divergencia'],
    relatorios_contagem: ['visualizar'],
    modules: ['view_general', 'view_pcp', 'view_wms', 'view_yms'],
    audit_logs: ['read'],
    roles: ['read'],
    users: ['read'],
  };

  const operatorPermissions: Record<string, string[]> = {
    products: ['read'],
    boms: ['read'],
    routings: ['read'],
    production_orders: ['read', 'execute'],
    production_pointings: ['create', 'read', 'update'],
    work_centers: ['read'],
    suppliers: ['read'],
    customers: ['read'],
    // Só leitura: quem opera consulta a unidade de medida e o dashboard, mas
    // cadastro mestre continua sendo do MANAGER.
    units_of_measure: ['read'],
    dashboard: ['read'],
    stock: ['read', 'entry', 'exit'],
    mrp: ['read'],
    reports: ['read'],
    orcamentos_compra: ['visualizar'],
    pedidos_compra: ['visualizar'],
    recebimentos_compra: ['visualizar', 'criar'],
    armazens: ['visualizar'],
    estruturas_armazem: ['visualizar', 'atualizar_posicao'],
    // F4.9: o OPERATOR vê a fila e executa; NÃO atribui (mesmo critério que já
    // separa `contagem:executar` de `contagem:aprovar_divergencia` - distribuir
    // trabalho é decisão de supervisão, não de execução).
    tarefas_armazem: ['visualizar', 'executar'],
    planos_contagem: ['visualizar'],
    sessoes_contagem: ['visualizar', 'iniciar'],
    contagem: ['executar', 'recontar'],
    relatorios_contagem: ['visualizar'],
    modules: ['view_general', 'view_pcp', 'view_wms', 'view_yms'],
  };

  const permissionIdByKey = new Map(
    allPermissions.map((p) => [`${p.resource}:${p.action}`, p.id])
  );

  const assignRolePermissions = async (
    roleId: string,
    roleLabel: string,
    permissionMap: Record<string, string[]>
  ) => {
    const permissionIds: string[] = [];
    const missing: string[] = [];

    for (const [resource, actions] of Object.entries(permissionMap)) {
      for (const action of actions) {
        const permissionId = permissionIdByKey.get(`${resource}:${action}`);
        if (permissionId) {
          permissionIds.push(permissionId);
        } else {
          missing.push(`${resource}:${action}`);
        }
      }
    }

    await prisma.rolePermission.deleteMany({ where: { roleId } });
    await prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
    });

    console.log(`   - ${roleLabel}: ${permissionIds.length} permissões atribuídas`);
    if (missing.length > 0) {
      console.log(`     ⚠️  ignoradas (inexistentes): ${missing.join(', ')}`);
    }
  };

  console.log('🔐 Atribuindo permissões padrão a MANAGER e OPERATOR...');
  await assignRolePermissions(managerRoleRecord.id, 'MANAGER', managerPermissions);
  await assignRolePermissions(operatorRoleRecord.id, 'OPERATOR', operatorPermissions);

  // Criar usuário administrador
  console.log('🔑 Criando usuário administrador...');
  
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  await prisma.user.upsert({
    where: { email: 'admin@fabric.com' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@fabric.com',
      password: hashedPassword,
      roles: {
        create: {
          roleId: adminRole.id,
        },
      },
    },
  });

  console.log('✅ Usuário administrador criado');
  console.log('   Email: admin@fabric.com');
  console.log('   Senha: admin123');

  // Criar unidades de medida
  console.log('📏 Criando unidades de medida...');
  
  const units = [
    { code: 'UN', name: 'Unidade', type: 'quantity', symbol: 'un', active: true },
    { code: 'KG', name: 'Quilograma', type: 'weight', symbol: 'kg', active: true },
    { code: 'G', name: 'Grama', type: 'weight', symbol: 'g', active: true },
    { code: 'L', name: 'Litro', type: 'volume', symbol: 'L', active: true },
    { code: 'ML', name: 'Mililitro', type: 'volume', symbol: 'mL', active: true },
    { code: 'M', name: 'Metro', type: 'length', symbol: 'm', active: true },
    { code: 'CM', name: 'Centímetro', type: 'length', symbol: 'cm', active: true },
    { code: 'CX', name: 'Caixa', type: 'quantity', symbol: 'cx', active: true },
    { code: 'PC', name: 'Peça', type: 'quantity', symbol: 'pc', active: true },
  ];

  for (const unit of units) {
    await prisma.unitOfMeasure.upsert({
      where: { code: unit.code },
      update: {},
      create: unit,
    });
  }

  console.log(`✅ ${units.length} unidades de medida criadas`);

  // Criar categorias de produto
  console.log('📦 Criando categorias de produto...');
  
  const categories = [
    { code: 'ELETRO', name: 'Eletrônicos', description: 'Produtos eletrônicos' },
    { code: 'METAL', name: 'Metálicos', description: 'Componentes metálicos' },
    { code: 'PLAST', name: 'Plásticos', description: 'Componentes plásticos' },
    { code: 'QUIM', name: 'Químicos', description: 'Produtos químicos e reagentes' },
    { code: 'EMB', name: 'Embalagens', description: 'Materiais de embalagem' },
  ];

  for (const category of categories) {
    await prisma.productCategory.upsert({
      where: { code: category.code },
      update: {},
      create: category,
    });
  }

  console.log(`✅ ${categories.length} categorias de produto criadas`);

  // Criar produtos de exemplo
  console.log('📦 Criando produtos de exemplo...');
  
  // Buscar IDs das unidades e categorias
  const unitUN = await prisma.unitOfMeasure.findUnique({ where: { code: 'UN' } });
  const unitKG = await prisma.unitOfMeasure.findUnique({ where: { code: 'KG' } });
  const unitG = await prisma.unitOfMeasure.findUnique({ where: { code: 'G' } });
  const unitPC = await prisma.unitOfMeasure.findUnique({ where: { code: 'PC' } });
  const unitM = await prisma.unitOfMeasure.findUnique({ where: { code: 'M' } });
  
  const catEletro = await prisma.productCategory.findUnique({ where: { code: 'ELETRO' } });
  const catMetal = await prisma.productCategory.findUnique({ where: { code: 'METAL' } });
  const catPlast = await prisma.productCategory.findUnique({ where: { code: 'PLAST' } });
  const catQuim = await prisma.productCategory.findUnique({ where: { code: 'QUIM' } });
  const catEmb = await prisma.productCategory.findUnique({ where: { code: 'EMB' } });

  const products = [
    // Produtos Acabados
    {
      code: 'PA-001',
      name: 'Smartphone XPro',
      description: 'Smartphone de última geração',
      type: 'finished',
      unitId: unitUN!.id,
      categoryId: catEletro!.id,
      leadTime: 5,
      minStock: 10,
      safetyStock: 5,
      standardCost: 1500.00,
      active: true,
    },
    {
      code: 'PA-002',
      name: 'Notebook Ultra',
      description: 'Notebook profissional',
      type: 'finished',
      unitId: unitUN!.id,
      categoryId: catEletro!.id,
      leadTime: 7,
      minStock: 5,
      safetyStock: 3,
      standardCost: 3500.00,
      active: true,
    },
    
    // Semiacabados
    {
      code: 'SA-001',
      name: 'Placa Mãe Montada',
      description: 'Placa mãe com componentes soldados',
      type: 'semi_finished',
      unitId: unitUN!.id,
      categoryId: catEletro!.id,
      leadTime: 3,
      minStock: 20,
      safetyStock: 10,
      standardCost: 800.00,
      active: true,
    },
    {
      code: 'SA-002',
      name: 'Display LCD Montado',
      description: 'Display com touch screen',
      type: 'semi_finished',
      unitId: unitUN!.id,
      categoryId: catEletro!.id,
      leadTime: 2,
      minStock: 30,
      safetyStock: 15,
      standardCost: 300.00,
      active: true,
    },
    {
      code: 'SA-003',
      name: 'Carcaça Plástica',
      description: 'Carcaça injetada e pintada',
      type: 'semi_finished',
      unitId: unitUN!.id,
      categoryId: catPlast!.id,
      leadTime: 2,
      minStock: 50,
      safetyStock: 20,
      standardCost: 50.00,
      active: true,
    },
    
    // Matérias-primas
    {
      code: 'MP-001',
      name: 'Chip Processador A15',
      description: 'Processador de alta performance',
      type: 'raw_material',
      unitId: unitPC!.id,
      categoryId: catEletro!.id,
      leadTime: 15,
      minStock: 100,
      safetyStock: 50,
      standardCost: 250.00,
      active: true,
    },
    {
      code: 'MP-002',
      name: 'Memória RAM 8GB',
      description: 'Módulo de memória DDR4',
      type: 'raw_material',
      unitId: unitPC!.id,
      categoryId: catEletro!.id,
      leadTime: 10,
      minStock: 200,
      safetyStock: 100,
      standardCost: 120.00,
      active: true,
    },
    {
      code: 'MP-003',
      name: 'Bateria Li-Ion 4000mAh',
      description: 'Bateria de lítio recarregável',
      type: 'raw_material',
      unitId: unitUN!.id,
      categoryId: catEletro!.id,
      leadTime: 12,
      minStock: 150,
      safetyStock: 75,
      standardCost: 80.00,
      active: true,
    },
    {
      code: 'MP-004',
      name: 'Parafuso M2x5mm',
      description: 'Parafuso de fixação',
      type: 'raw_material',
      unitId: unitPC!.id,
      categoryId: catMetal!.id,
      leadTime: 5,
      minStock: 5000,
      safetyStock: 2000,
      standardCost: 0.05,
      active: true,
    },
    {
      code: 'MP-005',
      name: 'Resina ABS Natural',
      description: 'Resina plástica para injeção',
      type: 'raw_material',
      unitId: unitKG!.id,
      categoryId: catQuim!.id,
      leadTime: 20,
      minStock: 500,
      safetyStock: 200,
      standardCost: 15.00,
      active: true,
    },
    {
      code: 'MP-006',
      name: 'Tinta Spray Preta',
      description: 'Tinta para acabamento',
      type: 'raw_material',
      unitId: unitUN!.id,
      categoryId: catQuim!.id,
      leadTime: 7,
      minStock: 50,
      safetyStock: 20,
      standardCost: 25.00,
      active: true,
    },
    {
      code: 'MP-007',
      name: 'Cabo USB-C',
      description: 'Cabo de dados e carregamento',
      type: 'raw_material',
      unitId: unitUN!.id,
      categoryId: catEletro!.id,
      leadTime: 8,
      minStock: 200,
      safetyStock: 100,
      standardCost: 12.00,
      active: true,
    },
    
    // Embalagens
    {
      code: 'EMB-001',
      name: 'Caixa Papelão 30x20x10',
      description: 'Caixa para produto acabado',
      type: 'packaging',
      unitId: unitUN!.id,
      categoryId: catEmb!.id,
      leadTime: 3,
      minStock: 500,
      safetyStock: 200,
      standardCost: 3.50,
      active: true,
    },
    {
      code: 'EMB-002',
      name: 'Manual do Usuário',
      description: 'Manual impresso',
      type: 'packaging',
      unitId: unitUN!.id,
      categoryId: catEmb!.id,
      leadTime: 5,
      minStock: 1000,
      safetyStock: 500,
      standardCost: 1.20,
      active: true,
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { code: product.code },
      update: {},
      create: product,
    });
  }

  console.log(`✅ ${products.length} produtos criados`);

  // Criar BOMs para os produtos
  console.log('🔧 Criando BOMs...');

  // Verificar se BOMs já existem
  const existingBoms = await prisma.bOM.count();
  if (existingBoms > 0) {
    console.log('⚠️  BOMs já existem, pulando criação...');
  } else {
    // Buscar produtos criados
  const smartphone = await prisma.product.findUnique({ where: { code: 'PA-001' } });
  const notebook = await prisma.product.findUnique({ where: { code: 'PA-002' } });
  const placaMae = await prisma.product.findUnique({ where: { code: 'SA-001' } });
  const display = await prisma.product.findUnique({ where: { code: 'SA-002' } });
  const carcaca = await prisma.product.findUnique({ where: { code: 'SA-003' } });
  const processador = await prisma.product.findUnique({ where: { code: 'MP-001' } });
  const memoria = await prisma.product.findUnique({ where: { code: 'MP-002' } });
  const bateria = await prisma.product.findUnique({ where: { code: 'MP-003' } });
  const parafuso = await prisma.product.findUnique({ where: { code: 'MP-004' } });
  const resina = await prisma.product.findUnique({ where: { code: 'MP-005' } });
  const tinta = await prisma.product.findUnique({ where: { code: 'MP-006' } });
  const cabo = await prisma.product.findUnique({ where: { code: 'MP-007' } });
  const caixa = await prisma.product.findUnique({ where: { code: 'EMB-001' } });
  const manual = await prisma.product.findUnique({ where: { code: 'EMB-002' } });

  // BOM para SA-001 (Placa Mãe Montada)
  await prisma.bOM.create({
    data: {
      productId: placaMae!.id,
      version: 1,
      description: 'BOM da Placa Mãe Montada',
      active: true,
      items: {
        create: [
          {
            componentId: processador!.id,
            quantity: 1,
            unitId: unitPC!.id,
            scrapFactor: 0.02,
            sequence: 10,
            notes: 'Processador principal',
          },
          {
            componentId: memoria!.id,
            quantity: 2,
            unitId: unitPC!.id,
            scrapFactor: 0.01,
            sequence: 20,
            notes: 'Módulos de memória',
          },
          {
            componentId: parafuso!.id,
            quantity: 4,
            unitId: unitPC!.id,
            scrapFactor: 0.05,
            sequence: 30,
            notes: 'Fixação dos componentes',
          },
        ],
      },
    },
  });

  // BOM para SA-003 (Carcaça Plástica)
  const bomCarcaca = await prisma.bOM.create({
    data: {
      productId: carcaca!.id,
      version: 1,
      description: 'BOM da Carcaça Plástica',
      active: true,
      items: {
        create: [
          {
            componentId: resina!.id,
            quantity: 0.2,
            unitId: unitKG!.id,
            scrapFactor: 0.1,
            sequence: 10,
            notes: 'Matéria-prima para injeção',
          },
          {
            componentId: tinta!.id,
            quantity: 1,
            unitId: unitUN!.id,
            scrapFactor: 0.05,
            sequence: 20,
            notes: 'Acabamento superficial',
          },
        ],
      },
    },
  });

  // BOM para PA-001 (Smartphone XPro)
  const bomSmartphone = await prisma.bOM.create({
    data: {
      productId: smartphone!.id,
      version: 1,
      description: 'BOM do Smartphone XPro',
      active: true,
      items: {
        create: [
          {
            componentId: placaMae!.id,
            quantity: 1,
            unitId: unitUN!.id,
            scrapFactor: 0.01,
            sequence: 10,
            notes: 'Placa principal montada',
          },
          {
            componentId: display!.id,
            quantity: 1,
            unitId: unitUN!.id,
            scrapFactor: 0.02,
            sequence: 20,
            notes: 'Display touch screen',
          },
          {
            componentId: carcaca!.id,
            quantity: 1,
            unitId: unitUN!.id,
            scrapFactor: 0.01,
            sequence: 30,
            notes: 'Carcaça externa',
          },
          {
            componentId: bateria!.id,
            quantity: 1,
            unitId: unitUN!.id,
            scrapFactor: 0.01,
            sequence: 40,
            notes: 'Bateria recarregável',
          },
          {
            componentId: cabo!.id,
            quantity: 1,
            unitId: unitUN!.id,
            scrapFactor: 0.01,
            sequence: 50,
            notes: 'Cabo de carregamento',
          },
          {
            componentId: parafuso!.id,
            quantity: 8,
            unitId: unitPC!.id,
            scrapFactor: 0.1,
            sequence: 60,
            notes: 'Fixação da carcaça',
          },
          {
            componentId: caixa!.id,
            quantity: 1,
            unitId: unitUN!.id,
            scrapFactor: 0.02,
            sequence: 70,
            notes: 'Embalagem do produto',
          },
          {
            componentId: manual!.id,
            quantity: 1,
            unitId: unitUN!.id,
            scrapFactor: 0.01,
            sequence: 80,
            notes: 'Manual de instruções',
          },
        ],
      },
    },
  });

  // BOM para PA-002 (Notebook Ultra)
  const bomNotebook = await prisma.bOM.create({
    data: {
      productId: notebook!.id,
      version: 1,
      description: 'BOM do Notebook Ultra',
      active: true,
      items: {
        create: [
          {
            componentId: placaMae!.id,
            quantity: 1,
            unitId: unitUN!.id,
            scrapFactor: 0.01,
            sequence: 10,
            notes: 'Placa mãe principal',
          },
          {
            componentId: display!.id,
            quantity: 1,
            unitId: unitUN!.id,
            scrapFactor: 0.02,
            sequence: 20,
            notes: 'Display LCD 15.6"',
          },
          {
            componentId: memoria!.id,
            quantity: 2,
            unitId: unitPC!.id,
            scrapFactor: 0.01,
            sequence: 30,
            notes: 'Memória RAM adicional',
          },
          {
            componentId: bateria!.id,
            quantity: 1,
            unitId: unitUN!.id,
            scrapFactor: 0.01,
            sequence: 40,
            notes: 'Bateria de longa duração',
          },
          {
            componentId: cabo!.id,
            quantity: 1,
            unitId: unitUN!.id,
            scrapFactor: 0.01,
            sequence: 50,
            notes: 'Cabo de alimentação',
          },
          {
            componentId: parafuso!.id,
            quantity: 16,
            unitId: unitPC!.id,
            scrapFactor: 0.1,
            sequence: 60,
            notes: 'Fixação do gabinete',
          },
          {
            componentId: caixa!.id,
            quantity: 1,
            unitId: unitUN!.id,
            scrapFactor: 0.02,
            sequence: 70,
            notes: 'Embalagem do produto',
          },
          {
            componentId: manual!.id,
            quantity: 1,
            unitId: unitUN!.id,
            scrapFactor: 0.01,
            sequence: 80,
            notes: 'Manual de instruções',
          },
        ],
      },
    },
  });

    console.log('✅ 4 BOMs criadas:');
    console.log('   - SA-001 (Placa Mãe Montada)');
    console.log('   - SA-003 (Carcaça Plástica)');
    console.log('   - PA-001 (Smartphone XPro)');
    console.log('   - PA-002 (Notebook Ultra)');
  }

  // Criar centros de trabalho
  console.log('🏭 Criando centros de trabalho...');
  
  const workCenters = [
    {
      code: 'CT-001',
      name: 'Linha de Montagem 1',
      description: 'Linha principal de montagem de produtos eletrônicos',
      type: 'assembly',
      capacity: 100,
      efficiency: 0.95,
      costPerHour: 150.00,
      active: true,
    },
    {
      code: 'CT-002',
      name: 'Linha de Montagem 2',
      description: 'Linha secundária de montagem',
      type: 'assembly',
      capacity: 80,
      efficiency: 0.90,
      costPerHour: 120.00,
      active: true,
    },
    {
      code: 'CT-003',
      name: 'Injeção de Plásticos',
      description: 'Máquinas injetoras de plástico',
      type: 'manufacturing',
      capacity: 50,
      efficiency: 0.85,
      costPerHour: 200.00,
      active: true,
    },
    {
      code: 'CT-004',
      name: 'Pintura e Acabamento',
      description: 'Cabine de pintura e acabamento superficial',
      type: 'finishing',
      capacity: 60,
      efficiency: 0.88,
      costPerHour: 100.00,
      active: true,
    },
    {
      code: 'CT-005',
      name: 'Controle de Qualidade',
      description: 'Inspeção e testes de qualidade',
      type: 'quality',
      capacity: 120,
      efficiency: 1.0,
      costPerHour: 80.00,
      active: true,
    },
    {
      code: 'CT-006',
      name: 'Embalagem',
      description: 'Setor de embalagem final',
      type: 'packaging',
      capacity: 150,
      efficiency: 0.98,
      costPerHour: 60.00,
      active: true,
    },
  ];

  for (const wc of workCenters) {
    await prisma.workCenter.upsert({
      where: { code: wc.code },
      update: {},
      create: wc,
    });
  }

  console.log(`✅ ${workCenters.length} centros de trabalho criados`);

  // Criar fornecedores
  console.log('🚚 Criando fornecedores...');
  
  const suppliers = [
    {
      code: 'FOR-001',
      name: 'TechComponents Ltda',
      legalName: 'TechComponents Componentes Eletrônicos Ltda',
      document: '12.345.678/0001-90',
      email: 'vendas@techcomponents.com.br',
      phone: '(11) 3456-7890',
      address: 'Rua dos Componentes, 123',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01234-567',
      country: 'BR',
      paymentTerms: '30/60 dias',
      leadTime: 15,
      rating: 4.5,
      active: true,
    },
    {
      code: 'FOR-002',
      name: 'PlastiPro Indústria',
      legalName: 'PlastiPro Indústria de Plásticos S.A.',
      document: '23.456.789/0001-01',
      email: 'comercial@plastipro.com.br',
      phone: '(11) 2345-6789',
      address: 'Av. Industrial, 456',
      city: 'Guarulhos',
      state: 'SP',
      zipCode: '07012-345',
      country: 'BR',
      paymentTerms: '45 dias',
      leadTime: 20,
      rating: 4.2,
      active: true,
    },
    {
      code: 'FOR-003',
      name: 'EmbalaFácil',
      legalName: 'EmbalaFácil Embalagens ME',
      document: '34.567.890/0001-12',
      email: 'atendimento@embalafacil.com.br',
      phone: '(11) 4567-8901',
      address: 'Rua das Caixas, 789',
      city: 'Osasco',
      state: 'SP',
      zipCode: '06234-567',
      country: 'BR',
      paymentTerms: '30 dias',
      leadTime: 7,
      rating: 4.8,
      active: true,
    },
  ];

  for (const supplier of suppliers) {
    await prisma.supplier.upsert({
      where: { code: supplier.code },
      update: {},
      create: supplier,
    });
  }

  console.log(`✅ ${suppliers.length} fornecedores criados`);

  // Criar clientes
  console.log('👥 Criando clientes...');
  
  const customers = [
    {
      code: 'CLI-001',
      name: 'TechStore Varejo',
      legalName: 'TechStore Comércio de Eletrônicos Ltda',
      document: '45.678.901/0001-23',
      email: 'compras@techstore.com.br',
      phone: '(11) 5678-9012',
      address: 'Av. Paulista, 1000',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01310-100',
      country: 'BR',
      paymentTerms: '30/60/90 dias',
      creditLimit: 500000.00,
      active: true,
    },
    {
      code: 'CLI-002',
      name: 'MegaEletro Distribuidora',
      legalName: 'MegaEletro Distribuidora de Eletrônicos S.A.',
      document: '56.789.012/0001-34',
      email: 'pedidos@megaeletro.com.br',
      phone: '(21) 6789-0123',
      address: 'Rua do Comércio, 500',
      city: 'Rio de Janeiro',
      state: 'RJ',
      zipCode: '20040-020',
      country: 'BR',
      paymentTerms: '45/60 dias',
      creditLimit: 1000000.00,
      active: true,
    },
    {
      code: 'CLI-003',
      name: 'InfoShop Online',
      legalName: 'InfoShop Comércio Eletrônico Ltda',
      document: '67.890.123/0001-45',
      email: 'fornecedores@infoshop.com.br',
      phone: '(11) 7890-1234',
      address: 'Rua Virtual, 100',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '04567-890',
      country: 'BR',
      paymentTerms: '30 dias',
      creditLimit: 300000.00,
      active: true,
    },
  ];

  for (const customer of customers) {
    await prisma.customer.upsert({
      where: { code: customer.code },
      update: {},
      create: customer,
    });
  }

  console.log(`✅ ${customers.length} clientes criados`);

  // Criar usuários adicionais
  console.log('👤 Criando usuários adicionais...');
  
  const managerRole = await prisma.role.findUnique({ where: { code: 'MANAGER' } });
  const operatorRole = await prisma.role.findUnique({ where: { code: 'OPERATOR' } });
  
  const hashedPasswordManager = await bcrypt.hash('manager123', 10);
  const hashedPasswordOperator = await bcrypt.hash('operator123', 10);
  
  const manager = await prisma.user.upsert({
    where: { email: 'gerente@fabric.com' },
    update: {},
    create: {
      name: 'João Gerente',
      email: 'gerente@fabric.com',
      password: hashedPasswordManager,
      roles: {
        create: {
          roleId: managerRole!.id,
        },
      },
    },
  });

  const operator1 = await prisma.user.upsert({
    where: { email: 'operador1@fabric.com' },
    update: {},
    create: {
      name: 'Maria Operadora',
      email: 'operador1@fabric.com',
      password: hashedPasswordOperator,
      roles: {
        create: {
          roleId: operatorRole!.id,
        },
      },
    },
  });

  const operator2 = await prisma.user.upsert({
    where: { email: 'operador2@fabric.com' },
    update: {},
    create: {
      name: 'Pedro Operador',
      email: 'operador2@fabric.com',
      password: hashedPasswordOperator,
      roles: {
        create: {
          roleId: operatorRole!.id,
        },
      },
    },
  });

  console.log('✅ 3 usuários adicionais criados:');
  console.log('   - gerente@fabric.com / manager123');
  console.log('   - operador1@fabric.com / operator123');
  console.log('   - operador2@fabric.com / operator123');

  // Criar roteiros de produção
  console.log('🔧 Criando roteiros de produção...');

  // Buscar produtos e centros de trabalho
  const smartphone = await prisma.product.findUnique({ where: { code: 'PA-001' } });
  const notebook = await prisma.product.findUnique({ where: { code: 'PA-002' } });
  const placaMae = await prisma.product.findUnique({ where: { code: 'SA-001' } });
  const carcaca = await prisma.product.findUnique({ where: { code: 'SA-003' } });

  const ct001 = await prisma.workCenter.findUnique({ where: { code: 'CT-001' } });
  const ct002 = await prisma.workCenter.findUnique({ where: { code: 'CT-002' } });
  const ct003 = await prisma.workCenter.findUnique({ where: { code: 'CT-003' } });
  const ct004 = await prisma.workCenter.findUnique({ where: { code: 'CT-004' } });
  const ct005 = await prisma.workCenter.findUnique({ where: { code: 'CT-005' } });
  const ct006 = await prisma.workCenter.findUnique({ where: { code: 'CT-006' } });

  // Verificar se roteiros já existem
  const existingRoutings = await prisma.routing.count();
  if (existingRoutings > 0) {
    console.log('⚠️  Roteiros já existem, pulando criação...');
  } else {
    // Roteiro para SA-001 (Placa Mãe Montada)
    await prisma.routing.create({
      data: {
        productId: placaMae!.id,
        version: 1,
        description: 'Processo de montagem da placa mãe',
        active: true,
        operations: {
          create: [
            {
              sequence: 10,
              workCenterId: ct001!.id,
              description: 'Montagem de componentes na placa',
              setupTime: 15,
              runTime: 8,
              queueTime: 5,
              moveTime: 2,
              notes: 'Inserir processador e memórias',
            },
            {
              sequence: 20,
              workCenterId: ct005!.id,
              description: 'Teste de funcionamento',
              setupTime: 5,
              runTime: 3,
              queueTime: 2,
              moveTime: 1,
              notes: 'Verificar POST e funcionamento básico',
            },
          ],
        },
      },
    });

    // Roteiro para SA-003 (Carcaça Plástica)
    await prisma.routing.create({
      data: {
        productId: carcaca!.id,
        version: 1,
        description: 'Processo de fabricação da carcaça',
        active: true,
        operations: {
          create: [
            {
              sequence: 10,
              workCenterId: ct003!.id,
              description: 'Injeção do plástico',
              setupTime: 30,
              runTime: 5,
              queueTime: 10,
              moveTime: 2,
              notes: 'Temperatura: 200°C',
            },
            {
              sequence: 20,
              workCenterId: ct004!.id,
              description: 'Pintura e acabamento',
              setupTime: 20,
              runTime: 10,
              queueTime: 15,
              moveTime: 3,
              notes: 'Aplicar 2 camadas de tinta',
            },
            {
              sequence: 30,
              workCenterId: ct005!.id,
              description: 'Inspeção de qualidade',
              setupTime: 5,
              runTime: 2,
              queueTime: 2,
              moveTime: 1,
              notes: 'Verificar acabamento e dimensões',
            },
          ],
        },
      },
    });

    // Roteiro para PA-001 (Smartphone XPro)
    await prisma.routing.create({
      data: {
        productId: smartphone!.id,
        version: 1,
        description: 'Linha de montagem completa do smartphone',
        active: true,
        operations: {
          create: [
            {
              sequence: 10,
              workCenterId: ct001!.id,
              description: 'Montagem da estrutura principal',
              setupTime: 20,
              runTime: 15,
              queueTime: 5,
              moveTime: 2,
              notes: 'Fixar placa mãe na carcaça',
            },
            {
              sequence: 20,
              workCenterId: ct001!.id,
              description: 'Instalação de display e bateria',
              setupTime: 10,
              runTime: 12,
              queueTime: 3,
              moveTime: 1,
              notes: 'Conectar flat cables',
            },
            {
              sequence: 30,
              workCenterId: ct002!.id,
              description: 'Fechamento e fixação',
              setupTime: 5,
              runTime: 8,
              queueTime: 2,
              moveTime: 1,
              notes: 'Aparafusar e selar',
            },
            {
              sequence: 40,
              workCenterId: ct005!.id,
              description: 'Teste funcional completo',
              setupTime: 10,
              runTime: 10,
              queueTime: 5,
              moveTime: 2,
              notes: 'Testar todas as funções',
            },
            {
              sequence: 50,
              workCenterId: ct006!.id,
              description: 'Embalagem final',
              setupTime: 5,
              runTime: 5,
              queueTime: 2,
              moveTime: 1,
              notes: 'Embalar com acessórios',
            },
          ],
        },
      },
    });

    // Roteiro para PA-002 (Notebook Ultra)
    await prisma.routing.create({
      data: {
        productId: notebook!.id,
        version: 1,
        description: 'Linha de montagem completa do notebook',
        active: true,
        operations: {
          create: [
            {
              sequence: 10,
              workCenterId: ct001!.id,
              description: 'Montagem da base e placa mãe',
              setupTime: 25,
              runTime: 20,
              queueTime: 5,
              moveTime: 2,
              notes: 'Fixar placa e componentes na base',
            },
            {
              sequence: 20,
              workCenterId: ct001!.id,
              description: 'Instalação de memórias e bateria',
              setupTime: 10,
              runTime: 10,
              queueTime: 3,
              moveTime: 1,
              notes: 'Instalar módulos RAM adicionais',
            },
            {
              sequence: 30,
              workCenterId: ct002!.id,
              description: 'Montagem do display',
              setupTime: 15,
              runTime: 15,
              queueTime: 5,
              moveTime: 2,
              notes: 'Conectar e fixar tela LCD',
            },
            {
              sequence: 40,
              workCenterId: ct002!.id,
              description: 'Montagem do teclado e touchpad',
              setupTime: 10,
              runTime: 12,
              queueTime: 3,
              moveTime: 1,
              notes: 'Conectar flat cables',
            },
            {
              sequence: 50,
              workCenterId: ct005!.id,
              description: 'Teste funcional e burn-in',
              setupTime: 15,
              runTime: 30,
              queueTime: 10,
              moveTime: 2,
              notes: 'Teste completo de 30 minutos',
            },
            {
              sequence: 60,
              workCenterId: ct006!.id,
              description: 'Embalagem e etiquetagem',
              setupTime: 5,
              runTime: 8,
              queueTime: 2,
              moveTime: 1,
              notes: 'Embalar com acessórios e manual',
            },
          ],
        },
      },
    });

    console.log('✅ 4 roteiros criados:');
    console.log('   - SA-001 (Placa Mãe) - 2 operações');
    console.log('   - SA-003 (Carcaça) - 3 operações');
    console.log('   - PA-001 (Smartphone) - 5 operações');
    console.log('   - PA-002 (Notebook) - 6 operações');
  }

  // Criar ordens de produção
  console.log('📋 Criando ordens de produção...');

  // Verificar se ordens já existem
  const existingOrders = await prisma.productionOrder.count();
  if (existingOrders > 0) {
    console.log('⚠️  Ordens de produção já existem, pulando criação...');
  } else {
    const smartphone = await prisma.product.findUnique({ where: { code: 'PA-001' } });
    const notebook = await prisma.product.findUnique({ where: { code: 'PA-002' } });
    const adminUser = await prisma.user.findUnique({ where: { email: 'admin@fabric.com' } });

    // Ordem 1: Smartphone - Planejada
    const order1 = await prisma.productionOrder.create({
      data: {
        orderNumber: 'OP-2025-001',
        productId: smartphone!.id,
        quantity: 50,
        producedQty: 0,
        scrapQty: 0,
        priority: 7,
        status: 'PLANNED',
        scheduledStart: new Date('2025-01-15T08:00:00'),
        scheduledEnd: new Date('2025-01-20T18:00:00'),
        notes: 'Ordem para atender pedido da TechStore',
        createdBy: adminUser!.id,
      },
    });

    // Calcular operações para ordem 1
    const routing1 = await prisma.routing.findFirst({
      where: { productId: smartphone!.id, active: true },
      include: { operations: true },
    });

    if (routing1) {
      for (const op of routing1.operations) {
        await prisma.productionOrderOperation.create({
          data: {
            productionOrderId: order1.id,
            sequence: op.sequence,
            workCenterId: op.workCenterId,
            description: op.description,
            plannedQty: order1.quantity,
            setupTime: op.setupTime,
            runTime: op.runTime,
            totalPlannedTime: op.setupTime + (op.runTime * order1.quantity),
            status: 'PENDING',
          },
        });
      }
    }

    // Ordem 2: Notebook - Liberada
    const order2 = await prisma.productionOrder.create({
      data: {
        orderNumber: 'OP-2025-002',
        productId: notebook!.id,
        quantity: 20,
        producedQty: 0,
        scrapQty: 0,
        priority: 5,
        status: 'RELEASED',
        scheduledStart: new Date('2025-01-10T08:00:00'),
        scheduledEnd: new Date('2025-01-18T18:00:00'),
        notes: 'Ordem para MegaEletro Distribuidora',
        createdBy: adminUser!.id,
      },
    });

    // Calcular operações para ordem 2
    const routing2 = await prisma.routing.findFirst({
      where: { productId: notebook!.id, active: true },
      include: { operations: true },
    });

    if (routing2) {
      for (const op of routing2.operations) {
        await prisma.productionOrderOperation.create({
          data: {
            productionOrderId: order2.id,
            sequence: op.sequence,
            workCenterId: op.workCenterId,
            description: op.description,
            plannedQty: order2.quantity,
            setupTime: op.setupTime,
            runTime: op.runTime,
            totalPlannedTime: op.setupTime + (op.runTime * order2.quantity),
            status: 'PENDING',
          },
        });
      }
    }

    // Ordem 3: Smartphone - Em Progresso
    const order3 = await prisma.productionOrder.create({
      data: {
        orderNumber: 'OP-2025-003',
        productId: smartphone!.id,
        quantity: 100,
        producedQty: 45,
        scrapQty: 3,
        priority: 10,
        status: 'IN_PROGRESS',
        scheduledStart: new Date('2025-01-05T08:00:00'),
        scheduledEnd: new Date('2025-01-12T18:00:00'),
        actualStart: new Date('2025-01-05T08:15:00'),
        notes: 'Ordem urgente - Cliente InfoShop',
        createdBy: adminUser!.id,
      },
    });

    // Calcular operações para ordem 3
    if (routing1) {
      for (const op of routing1.operations) {
        await prisma.productionOrderOperation.create({
          data: {
            productionOrderId: order3.id,
            sequence: op.sequence,
            workCenterId: op.workCenterId,
            description: op.description,
            plannedQty: order3.quantity,
            completedQty: op.sequence <= 30 ? order3.quantity : 45,
            setupTime: op.setupTime,
            runTime: op.runTime,
            totalPlannedTime: op.setupTime + (op.runTime * order3.quantity),
            actualTime: op.sequence <= 30 ? op.setupTime + (op.runTime * order3.quantity) : 0,
            status: op.sequence <= 30 ? 'COMPLETED' : op.sequence === 40 ? 'IN_PROGRESS' : 'PENDING',
          },
        });
      }
    }

    // Ordem 4: Notebook - Concluída
    const order4 = await prisma.productionOrder.create({
      data: {
        orderNumber: 'OP-2024-099',
        productId: notebook!.id,
        quantity: 30,
        producedQty: 30,
        scrapQty: 2,
        priority: 5,
        status: 'COMPLETED',
        scheduledStart: new Date('2024-12-20T08:00:00'),
        scheduledEnd: new Date('2024-12-28T18:00:00'),
        actualStart: new Date('2024-12-20T08:00:00'),
        actualEnd: new Date('2024-12-27T16:30:00'),
        notes: 'Ordem concluída com sucesso',
        createdBy: adminUser!.id,
      },
    });

    // Calcular operações para ordem 4
    if (routing2) {
      for (const op of routing2.operations) {
        await prisma.productionOrderOperation.create({
          data: {
            productionOrderId: order4.id,
            sequence: op.sequence,
            workCenterId: op.workCenterId,
            description: op.description,
            plannedQty: order4.quantity,
            completedQty: order4.quantity,
            setupTime: op.setupTime,
            runTime: op.runTime,
            totalPlannedTime: op.setupTime + (op.runTime * order4.quantity),
            actualTime: op.setupTime + (op.runTime * order4.quantity) * 1.05,
            status: 'COMPLETED',
          },
        });
      }
    }

    // Ordem 5: Smartphone - Cancelada
    await prisma.productionOrder.create({
      data: {
        orderNumber: 'OP-2024-095',
        productId: smartphone!.id,
        quantity: 25,
        producedQty: 0,
        scrapQty: 0,
        priority: 3,
        status: 'CANCELLED',
        scheduledStart: new Date('2024-12-15T08:00:00'),
        scheduledEnd: new Date('2024-12-20T18:00:00'),
        notes: 'Ordem cancelada - Cliente cancelou pedido',
        createdBy: adminUser!.id,
      },
    });

    console.log('✅ 5 ordens de produção criadas:');
    console.log('   - OP-2025-001: 50 Smartphones (Planejada)');
    console.log('   - OP-2025-002: 20 Notebooks (Liberada)');
    console.log('   - OP-2025-003: 100 Smartphones (Em Progresso - 45%)');
    console.log('   - OP-2024-099: 30 Notebooks (Concluída)');
    console.log('   - OP-2024-095: 25 Smartphones (Cancelada)');
  }

  console.log('\n🎉 Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
