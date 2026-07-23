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

-- Demo / realistic listings live in seed.sql (agents, sale/rent/plot properties, images).
-- After creating tables, run:
--   mysql -u root -p real_estate < seed.sql