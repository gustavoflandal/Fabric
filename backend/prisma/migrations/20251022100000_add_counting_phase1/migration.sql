-- Adicionar tabela de produtos em planos de contagem
CREATE TABLE counting_plan_products (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    plan_id CHAR(36) NOT NULL,
    product_id CHAR(36) NOT NULL,
    priority INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (plan_id) REFERENCES counting_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE (plan_id, product_id)
);

-- Adicionar tabela de atribuição de contadores
CREATE TABLE counting_assignments (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    session_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    role ENUM('PRIMARY', 'SECONDARY', 'VALIDATOR', 'SUPERVISOR') NOT NULL,
    assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES counting_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (session_id, user_id)
);

-- Adicionar campo de sequência na tabela de itens de contagem
ALTER TABLE counting_items
ADD COLUMN sequence INT DEFAULT 0 AFTER recounted_at;
