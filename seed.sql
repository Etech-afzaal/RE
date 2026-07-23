-- Realistic Lahore demo seed for Dhalahore.
-- Safe to re-run: clears listing tables then inserts related data.
--
-- Usage:
--   mysql -u root -p real_estate < seed.sql
--
-- Images must exist under public/uploads/demo/ (paths below match your files).
-- All demo agents log in with password: demo1234

USE real_estate;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE property_images;
TRUNCATE TABLE properties;
TRUNCATE TABLE agents;
TRUNCATE TABLE signup_requests;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------------
-- Signup requests (approved) — mirrors the agents below
-- ---------------------------------------------------------------------------
INSERT INTO signup_requests (full_name, estate_name, email, phone, message, status) VALUES
('Bilal Ahmed',    'dha-homes',     'bilal@dhahomes.pk',      '+923001234501', 'DHA-focused brokerage', 'approved'),
('Sara Khan',      'bahria-estate', 'sara@bahriaestate.pk',   '+923001234502', 'Bahria Town specialist', 'approved'),
('Usman Malik',    'gulberg-props', 'usman@gulbergprops.pk',  '+923001234503', 'Gulberg & MM Alam', 'approved'),
('Ayesha Raza',    'johar-living',  'ayesha@joharliving.pk',  '+923001234504', 'Johar Town residential', 'approved'),
('Hamza Sheikh',   'model-town-re', 'hamza@modeltownre.pk',   '+923001234505', 'Model Town family homes', 'approved'),
('Nadia Hussain',  'cantt-homes',   'nadia@cantthomes.pk',    '+923001234506', 'Lahore Cantt listings', 'approved'),
('Omar Farooq',    'valencia-re',   'omar@valenciare.pk',     '+923001234507', 'Valencia Town sales', 'approved'),
('Fatima Ali',     'lake-city-re',  'fatima@lakecityre.pk',   '+923001234508', 'Lake City & outskirts', 'approved');

-- ---------------------------------------------------------------------------
-- Agents (estate_name = public URL slug /re/{estate_name})
-- password for all: demo1234
-- ---------------------------------------------------------------------------
INSERT INTO agents (estate_name, full_name, email, phone, password_hash, must_reset_password, status) VALUES
('dha-homes',     'Bilal Ahmed',   'bilal@dhahomes.pk',     '+923001234501', '$2a$10$KWiNUkqao2tKODRlMY7lMOKBOUY8Io4wUQeInJ42Lfm8glIVkP9R2', FALSE, 'active'),
('bahria-estate', 'Sara Khan',     'sara@bahriaestate.pk',  '+923001234502', '$2a$10$KWiNUkqao2tKODRlMY7lMOKBOUY8Io4wUQeInJ42Lfm8glIVkP9R2', FALSE, 'active'),
('gulberg-props', 'Usman Malik',   'usman@gulbergprops.pk', '+923001234503', '$2a$10$KWiNUkqao2tKODRlMY7lMOKBOUY8Io4wUQeInJ42Lfm8glIVkP9R2', FALSE, 'active'),
('johar-living',  'Ayesha Raza',   'ayesha@joharliving.pk', '+923001234504', '$2a$10$KWiNUkqao2tKODRlMY7lMOKBOUY8Io4wUQeInJ42Lfm8glIVkP9R2', FALSE, 'active'),
('model-town-re', 'Hamza Sheikh',  'hamza@modeltownre.pk',  '+923001234505', '$2a$10$KWiNUkqao2tKODRlMY7lMOKBOUY8Io4wUQeInJ42Lfm8glIVkP9R2', FALSE, 'active'),
('cantt-homes',   'Nadia Hussain', 'nadia@cantthomes.pk',   '+923001234506', '$2a$10$KWiNUkqao2tKODRlMY7lMOKBOUY8Io4wUQeInJ42Lfm8glIVkP9R2', FALSE, 'active'),
('valencia-re',   'Omar Farooq',   'omar@valenciare.pk',    '+923001234507', '$2a$10$KWiNUkqao2tKODRlMY7lMOKBOUY8Io4wUQeInJ42Lfm8glIVkP9R2', FALSE, 'active'),
('lake-city-re',  'Fatima Ali',    'fatima@lakecityre.pk',  '+923001234508', '$2a$10$KWiNUkqao2tKODRlMY7lMOKBOUY8Io4wUQeInJ42Lfm8glIVkP9R2', FALSE, 'active');

-- ---------------------------------------------------------------------------
-- Properties
-- Homepage Sale / Rent / Plots tabs match on title/description containing
-- "rent" or "plot" (everything else defaults to sale).
-- ---------------------------------------------------------------------------

-- SALE (8)
INSERT INTO properties (agent_id, title, description, size_value, size_unit, price, location, status)
SELECT id, '10 Marla House for Sale in DHA Phase 6',
  'Corner-facing 10 Marla double-storey house with 5 bedrooms, attached baths, drawing + dining, TV lounge, modern kitchen, servant quarter and double car porch. Ideal family home in a quiet DHA Phase 6 block.',
  10, 'marla', 42500000, 'DHA Phase 6, Lahore', 'active'
FROM agents WHERE estate_name = 'dha-homes';

INSERT INTO properties (agent_id, title, description, size_value, size_unit, price, location, status)
SELECT id, '5 Marla House for Sale in Bahria Town Sector C',
  'Well-maintained 5 Marla house with 3 bedrooms, tiled flooring, open kitchen, TV lounge and covered car porch. Near main boulevard and commercial area.',
  5, 'marla', 18500000, 'Bahria Town, Lahore', 'active'
FROM agents WHERE estate_name = 'bahria-estate';

INSERT INTO properties (agent_id, title, description, size_value, size_unit, price, location, status)
SELECT id, '1 Kanal Luxury House for Sale in Gulberg III',
  'Premium 1 Kanal bungalow near MM Alam Road with lawn, marble flooring, imported fittings, 6 bedrooms, double kitchen and servant quarters. Perfect for executive living.',
  1, 'kanal', 95000000, 'Gulberg III, Lahore', 'active'
FROM agents WHERE estate_name = 'gulberg-props';

INSERT INTO properties (agent_id, title, description, size_value, size_unit, price, location, status)
SELECT id, '7 Marla Brand New House for Sale in Johar Town',
  'Brand-new 7 Marla house in Block H with modern elevation, 4 bedrooms, solar-ready roof, spacious lounge and kitchen. Quiet residential street with park nearby.',
  7, 'marla', 26800000, 'Johar Town, Lahore', 'active'
FROM agents WHERE estate_name = 'johar-living';

INSERT INTO properties (agent_id, title, description, size_value, size_unit, price, location, status)
SELECT id, '10 Marla Double Storey for Sale in Model Town',
  'Classic Model Town 10 Marla double-storey with wide frontage, lawn, 5 bedrooms, separate drawing room and ample parking. Close to Model Town Link Road.',
  10, 'marla', 52000000, 'Model Town, Lahore', 'active'
FROM agents WHERE estate_name = 'model-town-re';

INSERT INTO properties (agent_id, title, description, size_value, size_unit, price, location, status)
SELECT id, '1 Kanal Bungalow for Sale in Lahore Cantt',
  'Spacious 1 Kanal Cantt bungalow with mature trees, 5 bedrooms, study, large kitchen and covered driveway. Secure neighbourhood with easy access to Saddar.',
  1, 'kanal', 78000000, 'Lahore Cantt', 'active'
FROM agents WHERE estate_name = 'cantt-homes';

INSERT INTO properties (agent_id, title, description, size_value, size_unit, price, location, status)
SELECT id, '5 Marla Modern House for Sale in Valencia Town',
  'Modern 5 Marla house with open-plan living, 3 bedrooms, modular kitchen and car porch. Gated community amenities including parks and commercial strip.',
  5, 'marla', 17200000, 'Valencia Town, Lahore', 'active'
FROM agents WHERE estate_name = 'valencia-re';

INSERT INTO properties (agent_id, title, description, size_value, size_unit, price, location, status)
SELECT id, '8 Marla Designer House for Sale in Lake City',
  'Designer 8 Marla house overlooking green belt with 4 bedrooms, glass elevation, imported tiles and smart lighting. Lake City Phase 2 location.',
  8, 'marla', 29500000, 'Lake City, Lahore', 'active'
FROM agents WHERE estate_name = 'lake-city-re';

-- RENT (6) — titles include "Rent" for homepage category
INSERT INTO properties (agent_id, title, description, size_value, size_unit, price, location, status)
SELECT id, '3 Bed Apartment for Rent in DHA Phase 5',
  'Bright 3-bed apartment for rent in a well-managed DHA Phase 5 building. Drawing room, two baths, kitchen and reserved parking. Ideal for professionals.',
  8, 'marla', 145000, 'DHA Phase 5, Lahore', 'active'
FROM agents WHERE estate_name = 'dha-homes';

INSERT INTO properties (agent_id, title, description, size_value, size_unit, price, location, status)
SELECT id, 'Fully Furnished House for Rent in Bahria Town',
  'Fully furnished 5 Marla house for rent with AC units, sofa set, beds and appliances. Ready to move. Near Bahria sports complex.',
  5, 'marla', 110000, 'Bahria Town, Lahore', 'active'
FROM agents WHERE estate_name = 'bahria-estate';

INSERT INTO properties (agent_id, title, description, size_value, size_unit, price, location, status)
SELECT id, '2 Bed Flat for Rent near MM Alam Road',
  '2-bed flat for rent a short walk from MM Alam Road. Lift access, backup generator, kitchen and balcony. Perfect for couples or small families.',
  900, 'sqft', 95000, 'Gulberg III, Lahore', 'active'
FROM agents WHERE estate_name = 'gulberg-props';

INSERT INTO properties (agent_id, title, description, size_value, size_unit, price, location, status)
SELECT id, 'Upper Portion for Rent in Johar Town Block H',
  'Independent upper portion for rent with 3 bedrooms, separate entrance, kitchen and terrace. Peaceful block with mosque and market nearby.',
  5, 'marla', 75000, 'Johar Town, Lahore', 'active'
FROM agents WHERE estate_name = 'johar-living';

INSERT INTO properties (agent_id, title, description, size_value, size_unit, price, location, status)
SELECT id, '5 Marla House for Rent in Model Town',
  'Semi-furnished 5 Marla house for rent on a wide street in Model Town. 3 bedrooms, TV lounge, kitchen and car porch. Family preferred.',
  5, 'marla', 125000, 'Model Town, Lahore', 'active'
FROM agents WHERE estate_name = 'model-town-re';

INSERT INTO properties (agent_id, title, description, size_value, size_unit, price, location, status)
SELECT id, 'Studio Apartment for Rent in Lahore Cantt',
  'Compact studio apartment for rent near Saddar Cantt. Open kitchenette, attached bath and 24/7 security. Ideal for singles or students.',
  450, 'sqft', 45000, 'Lahore Cantt', 'active'
FROM agents WHERE estate_name = 'cantt-homes';

-- PLOT (5) — titles include "Plot" for homepage category
INSERT INTO properties (agent_id, title, description, size_value, size_unit, price, location, status)
SELECT id, '10 Marla Residential Plot in Bahria Town',
  'Possession 10 Marla residential plot in a developed Bahria sector with metalled roads, sewerage and nearby parks. Ideal for custom home construction.',
  10, 'marla', 15500000, 'Bahria Town, Lahore', 'active'
FROM agents WHERE estate_name = 'bahria-estate';

INSERT INTO properties (agent_id, title, description, size_value, size_unit, price, location, status)
SELECT id, '1 Kanal Corner Plot in DHA Phase 7',
  'Prime 1 Kanal corner plot in DHA Phase 7 with dual road access. Clear title, ready for construction. Excellent investment or dream-home site.',
  1, 'kanal', 62000000, 'DHA Phase 7, Lahore', 'active'
FROM agents WHERE estate_name = 'dha-homes';

INSERT INTO properties (agent_id, title, description, size_value, size_unit, price, location, status)
SELECT id, '5 Marla Plot for Sale in Lake City',
  '5 Marla residential plot in Lake City with boulevard access and society amenities. Levelled ground, ready for foundation work.',
  5, 'marla', 6800000, 'Lake City, Lahore', 'active'
FROM agents WHERE estate_name = 'lake-city-re';

INSERT INTO properties (agent_id, title, description, size_value, size_unit, price, location, status)
SELECT id, '10 Marla Commercial Plot in Valencia Town',
  '10 Marla commercial plot facing main boulevard in Valencia Town. High footfall location suited for retail plaza or showroom.',
  10, 'marla', 28500000, 'Valencia Town, Lahore', 'active'
FROM agents WHERE estate_name = 'valencia-re';

INSERT INTO properties (agent_id, title, description, size_value, size_unit, price, location, status)
SELECT id, '7 Marla Residential Plot in Johar Town',
  '7 Marla residential plot in a settled Johar Town block with utilities on site. Quiet street, suitable for a modern family home.',
  7, 'marla', 21000000, 'Johar Town, Lahore', 'active'
FROM agents WHERE estate_name = 'johar-living';

-- ---------------------------------------------------------------------------
-- Property images (paths match files in public/uploads/demo/)
-- One featured image per listing; houses get extra gallery shots where useful.
-- ---------------------------------------------------------------------------

-- SALE galleries
INSERT INTO property_images (property_id, image_url, image_title, is_featured, sort_order)
SELECT id, '/uploads/demo/sale-1.jpg', 'Front elevation', TRUE, 0 FROM properties WHERE title = '10 Marla House for Sale in DHA Phase 6';
INSERT INTO property_images (property_id, image_url, image_title, is_featured, sort_order)
SELECT id, '/uploads/demo/dining-room.jpg', 'Dining room', FALSE, 1 FROM properties WHERE title = '10 Marla House for Sale in DHA Phase 6';
INSERT INTO property_images (property_id, image_url, image_title, is_featured, sort_order)
SELECT id, '/uploads/demo/washroom.jpg', 'Attached bath', FALSE, 2 FROM properties WHERE title = '10 Marla House for Sale in DHA Phase 6';

INSERT INTO property_images (property_id, image_url, image_title, is_featured, sort_order)
SELECT id, '/uploads/demo/sale-2.jpg', 'Street view', TRUE, 0 FROM properties WHERE title = '5 Marla House for Sale in Bahria Town Sector C';

INSERT INTO property_images (property_id, image_url, image_title, is_featured, sort_order)
SELECT id, '/uploads/demo/sale-3.jpg', 'Luxury exterior', TRUE, 0 FROM properties WHERE title = '1 Kanal Luxury House for Sale in Gulberg III';
INSERT INTO property_images (property_id, image_url, image_title, is_featured, sort_order)
SELECT id, '/uploads/demo/dining-room.jpg', 'Formal dining', FALSE, 1 FROM properties WHERE title = '1 Kanal Luxury House for Sale in Gulberg III';

INSERT INTO property_images (property_id, image_url, image_title, is_featured, sort_order)
SELECT id, '/uploads/demo/sale-3.jpeg', 'New build exterior', TRUE, 0 FROM properties WHERE title = '7 Marla Brand New House for Sale in Johar Town';

INSERT INTO property_images (property_id, image_url, image_title, is_featured, sort_order)
SELECT id, '/uploads/demo/sale-4.jpg', 'Double storey front', TRUE, 0 FROM properties WHERE title = '10 Marla Double Storey for Sale in Model Town';

INSERT INTO property_images (property_id, image_url, image_title, is_featured, sort_order)
SELECT id, '/uploads/demo/sale-6.jpeg', 'Cantt bungalow', TRUE, 0 FROM properties WHERE title = '1 Kanal Bungalow for Sale in Lahore Cantt';

INSERT INTO property_images (property_id, image_url, image_title, is_featured, sort_order)
SELECT id, '/uploads/demo/sale-7.jpeg', 'Modern Valencia home', TRUE, 0 FROM properties WHERE title = '5 Marla Modern House for Sale in Valencia Town';

INSERT INTO property_images (property_id, image_url, image_title, is_featured, sort_order)
SELECT id, '/uploads/demo/house-front.jpg', 'Lake City elevation', TRUE, 0 FROM properties WHERE title = '8 Marla Designer House for Sale in Lake City';
INSERT INTO property_images (property_id, image_url, image_title, is_featured, sort_order)
SELECT id, '/uploads/demo/dining-room.jpg', 'Dining area', FALSE, 1 FROM properties WHERE title = '8 Marla Designer House for Sale in Lake City';
INSERT INTO property_images (property_id, image_url, image_title, is_featured, sort_order)
SELECT id, '/uploads/demo/washroom.jpg', 'Bathroom', FALSE, 2 FROM properties WHERE title = '8 Marla Designer House for Sale in Lake City';

-- RENT
INSERT INTO property_images (property_id, image_url, image_title, is_featured, sort_order)
SELECT id, '/uploads/demo/rent-1.jpeg', 'Living area', TRUE, 0 FROM properties WHERE title = '3 Bed Apartment for Rent in DHA Phase 5';

INSERT INTO property_images (property_id, image_url, image_title, is_featured, sort_order)
SELECT id, '/uploads/demo/rent-2.jpeg', 'Furnished lounge', TRUE, 0 FROM properties WHERE title = 'Fully Furnished House for Rent in Bahria Town';

INSERT INTO property_images (property_id, image_url, image_title, is_featured, sort_order)
SELECT id, '/uploads/demo/rent-3.jpeg', 'Flat interior', TRUE, 0 FROM properties WHERE title = '2 Bed Flat for Rent near MM Alam Road';

INSERT INTO property_images (property_id, image_url, image_title, is_featured, sort_order)
SELECT id, '/uploads/demo/rent4.jpeg', 'Upper portion', TRUE, 0 FROM properties WHERE title = 'Upper Portion for Rent in Johar Town Block H';

INSERT INTO property_images (property_id, image_url, image_title, is_featured, sort_order)
SELECT id, '/uploads/demo/rent-5.jpeg', 'House exterior', TRUE, 0 FROM properties WHERE title = '5 Marla House for Rent in Model Town';

INSERT INTO property_images (property_id, image_url, image_title, is_featured, sort_order)
SELECT id, '/uploads/demo/rent-6.jpeg', 'Studio view', TRUE, 0 FROM properties WHERE title = 'Studio Apartment for Rent in Lahore Cantt';

-- PLOT
INSERT INTO property_images (property_id, image_url, image_title, is_featured, sort_order)
SELECT id, '/uploads/demo/plot-1.jpeg', 'Plot overview', TRUE, 0 FROM properties WHERE title = '10 Marla Residential Plot in Bahria Town';

INSERT INTO property_images (property_id, image_url, image_title, is_featured, sort_order)
SELECT id, '/uploads/demo/plot-2.jpeg', 'Corner plot', TRUE, 0 FROM properties WHERE title = '1 Kanal Corner Plot in DHA Phase 7';

INSERT INTO property_images (property_id, image_url, image_title, is_featured, sort_order)
SELECT id, '/uploads/demo/plot-3.jpeg', 'Levelled plot', TRUE, 0 FROM properties WHERE title = '5 Marla Plot for Sale in Lake City';

INSERT INTO property_images (property_id, image_url, image_title, is_featured, sort_order)
SELECT id, '/uploads/demo/plot-4.jpeg', 'Commercial frontage', TRUE, 0 FROM properties WHERE title = '10 Marla Commercial Plot in Valencia Town';

INSERT INTO property_images (property_id, image_url, image_title, is_featured, sort_order)
SELECT id, '/uploads/demo/plot-5.jpg', 'Residential plot', TRUE, 0 FROM properties WHERE title = '7 Marla Residential Plot in Johar Town';
