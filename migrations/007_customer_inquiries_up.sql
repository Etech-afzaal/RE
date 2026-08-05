CREATE TABLE IF NOT EXISTS customer_inquiries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  agent_id INT NOT NULL,
  property_id INT NULL,
  customer_name VARCHAR(150) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50) NULL,
  message TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL
);

CREATE INDEX idx_customer_inquiries_agent ON customer_inquiries(agent_id);
CREATE INDEX idx_customer_inquiries_property ON customer_inquiries(property_id);
CREATE INDEX idx_customer_inquiries_created ON customer_inquiries(created_at);
