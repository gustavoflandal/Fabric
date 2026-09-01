-- Execute os comandos abaixo no banco `fabric`

-- =====================================================================
-- Base de Segurança
-- =====================================================================

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL,
  email VARCHAR(191) NOT NULL,
  password VARCHAR(191) NOT NULL,
  name VARCHAR(191) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  lastLogin DATETIME NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY users_email_key (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS roles (
  id CHAR(36) NOT NULL,
  code VARCHAR(191) NOT NULL,
  name VARCHAR(191) NOT NULL,
  description VARCHAR(191) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY roles_code_key (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permissions (
  id CHAR(36) NOT NULL,
  resource VARCHAR(191) NOT NULL,
  action VARCHAR(191) NOT NULL,
  description VARCHAR(191) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY permissions_resource_action_key (resource, action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_roles (
  userId CHAR(36) NOT NULL,
  roleId CHAR(36) NOT NULL,
  assignedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (userId, roleId),
  CONSTRAINT user_roles_userId_fkey FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT user_roles_roleId_fkey FOREIGN KEY (roleId) REFERENCES roles (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
  roleId CHAR(36) NOT NULL,
  permissionId CHAR(36) NOT NULL,
  PRIMARY KEY (roleId, permissionId),
  CONSTRAINT role_permissions_roleId_fkey FOREIGN KEY (roleId) REFERENCES roles (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT role_permissions_permissionId_fkey FOREIGN KEY (permissionId) REFERENCES permissions (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id CHAR(36) NOT NULL,
  userId CHAR(36) NULL,
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  resourceId VARCHAR(191) NULL,
  description TEXT NULL,
  ipAddress VARCHAR(45) NULL,
  userAgent TEXT NULL,
  method VARCHAR(10) NULL,
  endpoint VARCHAR(500) NULL,
  statusCode INT NULL,
  requestBody JSON NULL,
  responseBody JSON NULL,
  oldValues JSON NULL,
  newValues JSON NULL,
  errorMessage TEXT NULL,
  durationMs INT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY audit_logs_userId_idx (userId),
  KEY audit_logs_resource_idx (resource),
  KEY audit_logs_action_idx (action),
  KEY audit_logs_createdAt_idx (createdAt),
  CONSTRAINT audit_logs_userId_fkey FOREIGN KEY (userId) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- Cadastros Básicos
-- =====================================================================

CREATE TABLE IF NOT EXISTS work_centers (
  id CHAR(36) NOT NULL,
  code VARCHAR(191) NOT NULL,
  name VARCHAR(191) NOT NULL,
  description TEXT NULL,
  type VARCHAR(191) NOT NULL,
  capacity DOUBLE NULL,
  efficiency DOUBLE NOT NULL DEFAULT 1.0,
  costPerHour DOUBLE NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY work_centers_code_key (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS units_of_measure (
  id CHAR(36) NOT NULL,
  code VARCHAR(191) NOT NULL,
  name VARCHAR(191) NOT NULL,
  type VARCHAR(191) NOT NULL,
  symbol VARCHAR(191) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY units_of_measure_code_key (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS suppliers (
  id CHAR(36) NOT NULL,
  code VARCHAR(191) NOT NULL,
  name VARCHAR(191) NOT NULL,
  legalName VARCHAR(191) NULL,
  document VARCHAR(191) NULL,
  email VARCHAR(191) NULL,
  phone VARCHAR(191) NULL,
  address VARCHAR(191) NULL,
  city VARCHAR(191) NULL,
  state VARCHAR(191) NULL,
  zipCode VARCHAR(20) NULL,
  country VARCHAR(5) NOT NULL DEFAULT 'BR',
  paymentTerms VARCHAR(191) NULL,
  leadTime INT NULL,
  rating DOUBLE NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY suppliers_code_key (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customers (
  id CHAR(36) NOT NULL,
  code VARCHAR(191) NOT NULL,
  name VARCHAR(191) NOT NULL,
  legalName VARCHAR(191) NULL,
  document VARCHAR(191) NULL,
  email VARCHAR(191) NULL,
  phone VARCHAR(191) NULL,
  address VARCHAR(191) NULL,
  city VARCHAR(191) NULL,
  state VARCHAR(191) NULL,
  zipCode VARCHAR(20) NULL,
  country VARCHAR(5) NOT NULL DEFAULT 'BR',
  paymentTerms VARCHAR(191) NULL,
  creditLimit DOUBLE NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY customers_code_key (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- Engenharia de Produtos
-- =====================================================================

CREATE TABLE IF NOT EXISTS product_categories (
  id CHAR(36) NOT NULL,
  code VARCHAR(191) NOT NULL,
  name VARCHAR(191) NOT NULL,
  description VARCHAR(191) NULL,
  parentId CHAR(36) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY product_categories_code_key (code),
  KEY product_categories_parentId_idx (parentId),
  CONSTRAINT product_categories_parentId_fkey FOREIGN KEY (parentId) REFERENCES product_categories (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id CHAR(36) NOT NULL,
  code VARCHAR(191) NOT NULL,
  name VARCHAR(191) NOT NULL,
  description MEDIUMTEXT NULL,
  type VARCHAR(191) NOT NULL,
  unitId CHAR(36) NOT NULL,
  categoryId CHAR(36) NULL,
  leadTime INT NOT NULL DEFAULT 0,
  lotSize DOUBLE NULL,
  minStock DOUBLE NOT NULL DEFAULT 0,
  maxStock DOUBLE NULL,
  safetyStock DOUBLE NOT NULL DEFAULT 0,
  reorderPoint DOUBLE NULL,
  standardCost DOUBLE NULL,
  lastCost DOUBLE NULL,
  averageCost DOUBLE NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY products_code_key (code),
  KEY products_type_idx (type),
  KEY products_active_idx (active),
  CONSTRAINT products_unitId_fkey FOREIGN KEY (unitId) REFERENCES units_of_measure (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT products_categoryId_fkey FOREIGN KEY (categoryId) REFERENCES product_categories (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS boms (
  id CHAR(36) NOT NULL,
  productId CHAR(36) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  description VARCHAR(191) NULL,
  validFrom DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  validTo DATETIME(3) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY boms_productId_version_key (productId, version),
  KEY boms_productId_active_idx (productId, active),
  CONSTRAINT boms_productId_fkey FOREIGN KEY (productId) REFERENCES products (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bom_items (
  id CHAR(36) NOT NULL,
  bomId CHAR(36) NOT NULL,
  componentId CHAR(36) NOT NULL,
  quantity DOUBLE NOT NULL,
  unitId CHAR(36) NOT NULL,
  scrapFactor DOUBLE NOT NULL DEFAULT 0,
  sequence INT NOT NULL,
  notes VARCHAR(191) NULL,
  PRIMARY KEY (id),
  KEY bom_items_bomId_idx (bomId),
  CONSTRAINT bom_items_bomId_fkey FOREIGN KEY (bomId) REFERENCES boms (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT bom_items_componentId_fkey FOREIGN KEY (componentId) REFERENCES products (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT bom_items_unitId_fkey FOREIGN KEY (unitId) REFERENCES units_of_measure (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS routings (
  id CHAR(36) NOT NULL,
  productId CHAR(36) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  description VARCHAR(191) NULL,
  validFrom DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  validTo DATETIME(3) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY routings_productId_version_key (productId, version),
  KEY routings_productId_active_idx (productId, active),
  CONSTRAINT routings_productId_fkey FOREIGN KEY (productId) REFERENCES products (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS routing_operations (
  id CHAR(36) NOT NULL,
  routingId CHAR(36) NOT NULL,
  sequence INT NOT NULL,
  workCenterId CHAR(36) NOT NULL,
  description VARCHAR(191) NOT NULL,
  setupTime DOUBLE NOT NULL,
  runTime DOUBLE NOT NULL,
  queueTime DOUBLE NOT NULL DEFAULT 0,
  moveTime DOUBLE NOT NULL DEFAULT 0,
  notes VARCHAR(191) NULL,
  PRIMARY KEY (id),
  KEY routing_operations_routingId_idx (routingId),
  KEY routing_operations_workCenterId_idx (workCenterId),
  CONSTRAINT routing_operations_routingId_fkey FOREIGN KEY (routingId) REFERENCES routings (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT routing_operations_workCenterId_fkey FOREIGN KEY (workCenterId) REFERENCES work_centers (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- Produção
-- =====================================================================

CREATE TABLE IF NOT EXISTS production_orders (
  id CHAR(36) NOT NULL,
  orderNumber VARCHAR(191) NOT NULL,
  productId CHAR(36) NOT NULL,
  quantity DOUBLE NOT NULL,
  producedQty DOUBLE NOT NULL DEFAULT 0,
  scrapQty DOUBLE NOT NULL DEFAULT 0,
  priority INT NOT NULL DEFAULT 5,
  status VARCHAR(191) NOT NULL DEFAULT 'PLANNED',
  scheduledStart DATETIME(3) NOT NULL,
  scheduledEnd DATETIME(3) NOT NULL,
  actualStart DATETIME(3) NULL,
  actualEnd DATETIME(3) NULL,
  plannedCost DOUBLE NULL,
  actualCost DOUBLE NULL,
  notes MEDIUMTEXT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL,
  createdBy VARCHAR(191) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY production_orders_orderNumber_key (orderNumber),
  KEY production_orders_status_idx (status),
  KEY production_orders_scheduledStart_idx (scheduledStart),
  KEY production_orders_productId_idx (productId),
  CONSTRAINT production_orders_productId_fkey FOREIGN KEY (productId) REFERENCES products (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS production_order_operations (
  id CHAR(36) NOT NULL,
  productionOrderId CHAR(36) NOT NULL,
  sequence INT NOT NULL,
  workCenterId CHAR(36) NOT NULL,
  description VARCHAR(191) NOT NULL,
  plannedQty DOUBLE NOT NULL,
  completedQty DOUBLE NOT NULL DEFAULT 0,
  scrapQty DOUBLE NOT NULL DEFAULT 0,
  setupTime DOUBLE NOT NULL,
  runTime DOUBLE NOT NULL,
  totalPlannedTime DOUBLE NOT NULL,
  actualTime DOUBLE NOT NULL DEFAULT 0,
  status VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  scheduledStart DATETIME(3) NULL,
  scheduledEnd DATETIME(3) NULL,
  actualStart DATETIME(3) NULL,
  actualEnd DATETIME(3) NULL,
  PRIMARY KEY (id),
  KEY production_order_operations_productionOrderId_idx (productionOrderId),
  KEY production_order_operations_workCenterId_idx (workCenterId),
  KEY production_order_operations_status_idx (status),
  CONSTRAINT production_order_operations_productionOrderId_fkey FOREIGN KEY (productionOrderId) REFERENCES production_orders (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT production_order_operations_workCenterId_fkey FOREIGN KEY (workCenterId) REFERENCES work_centers (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS production_pointings (
  id CHAR(36) NOT NULL,
  productionOrderId CHAR(36) NOT NULL,
  operationId CHAR(36) NOT NULL,
  userId CHAR(36) NOT NULL,
  quantityGood DOUBLE NOT NULL,
  quantityScrap DOUBLE NOT NULL DEFAULT 0,
  setupTime DOUBLE NOT NULL DEFAULT 0,
  runTime DOUBLE NOT NULL,
  startTime DATETIME(3) NOT NULL,
  endTime DATETIME(3) NOT NULL,
  notes VARCHAR(191) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY production_pointings_productionOrderId_idx (productionOrderId),
  KEY production_pointings_operationId_idx (operationId),
  KEY production_pointings_userId_idx (userId),
  KEY production_pointings_startTime_idx (startTime),
  CONSTRAINT production_pointings_productionOrderId_fkey FOREIGN KEY (productionOrderId) REFERENCES production_orders (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT production_pointings_operationId_fkey FOREIGN KEY (operationId) REFERENCES production_order_operations (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT production_pointings_userId_fkey FOREIGN KEY (userId) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
