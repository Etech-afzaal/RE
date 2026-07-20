-- Run this once against your MySQL database (e.g. `mysql -u root -p real_estate < schema.sql`)

CREATE DATABASE IF NOT EXISTS real_estate CHARACTER SET utf8mb4;
USE real_estate;

-- Requests submitted via the public "Sign up as agent" form.
-- Nothing here can log in yet — this is just a request for admin to review.
CREATE TABLE IF NOT EXISTS signup_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  estate_name VARCHAR(20) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  message TEXT,
  status ENUM('pending','approved','rejected','revoked') DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Approved agents who can log in to the admin app.
CREATE TABLE IF NOT EXISTS agents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  estate_name VARCHAR(20) UNIQUE NOT NULL,          -- used in /re/{estate_name}
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  password_hash VARCHAR(255) NOT NULL,
  must_reset_password BOOLEAN DEFAULT TRUE,
  status ENUM('active','disabled') DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS properties (
  id INT AUTO_INCREMENT PRIMARY KEY,
  agent_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  size_value DECIMAL(10,2),
  size_unit ENUM('marla','kanal','sqft') DEFAULT 'marla',
  price DECIMAL(15,2),
  location VARCHAR(255),
  status ENUM('active','sold','draft') DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS property_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL,
  image_url VARCHAR(500) NOT NULL,          -- watermarked, public-facing
  image_title VARCHAR(255),                -- optional title for the property detail gallery
  is_featured BOOLEAN DEFAULT FALSE,       -- marked as the main image for the property page
  sort_order INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

CREATE INDEX idx_properties_agent ON properties(agent_id);
CREATE INDEX idx_images_property ON property_images(property_id);

-- dummy data

-- sign up requests
INSERT INTO signup_requests (
    full_name,
    estate_name,
    email,
    phone,
    message,
    status
)
VALUES
('Test Agent 1',  'estate1',  'test@example.com',  '+923001111001', 'Demo account', 'approved'),
('Test Agent 2',  'estate2',  'test1@example.com', '+923001111002', 'Demo account', 'approved'),
('Test Agent 3',  'estate3',  'test2@example.com', '+923001111003', 'Demo account', 'approved'),
('Test Agent 4',  'estate4',  'test3@example.com', '+923001111004', 'Demo account', 'approved'),
('Test Agent 5',  'estate5',  'test4@example.com', '+923001111005', 'Demo account', 'approved'),
('Test Agent 6',  'estate6',  'test5@example.com', '+923001111006', 'Demo account', 'approved'),
('Test Agent 7',  'estate7',  'test6@example.com', '+923001111007', 'Demo account', 'approved'),
('Test Agent 8',  'estate8',  'test7@example.com', '+923001111008', 'Demo account', 'approved'),
('Test Agent 9',  'estate9',  'test8@example.com', '+923001111009', 'Demo account', 'approved'),
('Test Agent 10', 'estate10', 'test9@example.com', '+923001111010', 'Demo account', 'approved');


-- agents
INSERT INTO agents (
    estate_name,
    full_name,
    email,
    phone,
    password_hash,
    must_reset_password,
    status
)
VALUES
('estate1',  'Test Agent 1',  'test@example.com',  '+923001111001', '$2a$10$ctmCaiDVmG7HuJUNeVs.2.xeZpsYrhClLmL7ya8k9piuimYx8CXW2', FALSE, 'active'),
('estate2',  'Test Agent 2',  'test1@example.com', '+923001111002', '$2a$10$ctmCaiDVmG7HuJUNeVs.2.xeZpsYrhClLmL7ya8k9piuimYx8CXW2', FALSE, 'active'),
('estate3',  'Test Agent 3',  'test2@example.com', '+923001111003', '$2a$10$ctmCaiDVmG7HuJUNeVs.2.xeZpsYrhClLmL7ya8k9piuimYx8CXW2', FALSE, 'active'),
('estate4',  'Test Agent 4',  'test3@example.com', '+923001111004', '$2a$10$ctmCaiDVmG7HuJUNeVs.2.xeZpsYrhClLmL7ya8k9piuimYx8CXW2', FALSE, 'active'),
('estate5',  'Test Agent 5',  'test4@example.com', '+923001111005', '$2a$10$ctmCaiDVmG7HuJUNeVs.2.xeZpsYrhClLmL7ya8k9piuimYx8CXW2', FALSE, 'active'),
('estate6',  'Test Agent 6',  'test5@example.com', '+923001111006', '$2a$10$ctmCaiDVmG7HuJUNeVs.2.xeZpsYrhClLmL7ya8k9piuimYx8CXW2', FALSE, 'active'),
('estate7',  'Test Agent 7',  'test6@example.com', '+923001111007', '$2a$10$ctmCaiDVmG7HuJUNeVs.2.xeZpsYrhClLmL7ya8k9piuimYx8CXW2', FALSE, 'active'),
('estate8',  'Test Agent 8',  'test7@example.com', '+923001111008', '$2a$10$ctmCaiDVmG7HuJUNeVs.2.xeZpsYrhClLmL7ya8k9piuimYx8CXW2', FALSE, 'active'),
('estate9',  'Test Agent 9',  'test8@example.com', '+923001111009', '$2a$10$ctmCaiDVmG7HuJUNeVs.2.xeZpsYrhClLmL7ya8k9piuimYx8CXW2', FALSE, 'active'),
('estate10', 'Test Agent 10', 'test9@example.com', '+923001111010', '$2a$10$ctmCaiDVmG7HuJUNeVs.2.xeZpsYrhClLmL7ya8k9piuimYx8CXW2', FALSE, 'active');


-- properties
INSERT INTO properties (
    agent_id, title, description, size_value, size_unit, price, location, status
)
SELECT id,
       CONCAT('Modern 5 Marla House in Bahria Town - ', estate_name),
       'A well-designed 5 Marla house with 3 bedrooms, attached baths, drawing room, TV lounge, kitchen, and car porch.',
       5, 'marla', 18500000, 'Bahria Town Lahore', 'active'
FROM agents

UNION ALL
SELECT id,
       CONCAT('10 Marla Luxury House in DHA Phase 6 - ', estate_name),
       'A luxury 10 Marla house with modern elevation, imported fittings, spacious bedrooms, double kitchen, and servant quarter.',
       10, 'marla', 42500000, 'DHA Phase 6 Lahore', 'active'
FROM agents

UNION ALL
SELECT id,
       CONCAT('1 Kanal Corner House in Gulberg - ', estate_name),
       'A premium 1 Kanal corner house with wide road access, elegant interior, lawn, double kitchen, and ideal family living space.',
       1, 'kanal', 95000000, 'Gulberg Lahore', 'active'
FROM agents;

-- properties images
INSERT INTO property_images (
    property_id,
    image_url,
    image_title,
    is_featured,
    sort_order
)
SELECT
    p.id,
    img.image_url,
    img.image_title,
    img.is_featured,
    img.sort_order
FROM properties p
JOIN (
    SELECT '/uploads/demo/house-front.jpg' AS image_url, 'Front View' AS image_title, TRUE AS is_featured, 0 AS sort_order
    UNION ALL
    SELECT '/uploads/demo/dining-room.jpg', 'Dining Room', FALSE, 1
    UNION ALL
    SELECT '/uploads/demo/washroom.jpg', 'Washroom', FALSE, 2
) img
WHERE NOT EXISTS (
    SELECT 1
    FROM property_images pi
    WHERE pi.property_id = p.id
);