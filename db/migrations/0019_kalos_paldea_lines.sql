-- Adds 20 more characters: five starter lines from Kalos and Paldea (Chesnaught,
-- Delphox, Meowscarada, Skeledirge, Quaquaval), the Goomy dragon line, and
-- Rockruff -> Lycanroc. Base forms are sold in the shop; evolved forms are
-- evolution-only (price 0). INSERT OR IGNORE leaves existing rows untouched, and
-- each character has at most one outgoing evolution path.

INSERT OR IGNORE INTO characters (id, external_id, name, slug, type_primary, type_secondary, image_url, price, rarity) VALUES
  ('char_chespin', '650', 'Chespin', 'chespin', 'Grass', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/650.png', 450, 'COMMON'),
  ('char_quilladin', '651', 'Quilladin', 'quilladin', 'Grass', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/651.png', 0, 'RARE'),
  ('char_chesnaught', '652', 'Chesnaught', 'chesnaught', 'Grass', 'Fighting', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/652.png', 0, 'EPIC'),
  ('char_fennekin', '653', 'Fennekin', 'fennekin', 'Fire', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/653.png', 450, 'COMMON'),
  ('char_braixen', '654', 'Braixen', 'braixen', 'Fire', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/654.png', 0, 'RARE'),
  ('char_delphox', '655', 'Delphox', 'delphox', 'Fire', 'Psychic', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/655.png', 0, 'EPIC'),
  ('char_sprigatito', '906', 'Sprigatito', 'sprigatito', 'Grass', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/906.png', 450, 'COMMON'),
  ('char_floragato', '907', 'Floragato', 'floragato', 'Grass', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/907.png', 0, 'RARE'),
  ('char_meowscarada', '908', 'Meowscarada', 'meowscarada', 'Grass', 'Dark', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/908.png', 0, 'EPIC'),
  ('char_fuecoco', '909', 'Fuecoco', 'fuecoco', 'Fire', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/909.png', 450, 'COMMON'),
  ('char_crocalor', '910', 'Crocalor', 'crocalor', 'Fire', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/910.png', 0, 'RARE'),
  ('char_skeledirge', '911', 'Skeledirge', 'skeledirge', 'Fire', 'Ghost', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/911.png', 0, 'EPIC'),
  ('char_quaxly', '912', 'Quaxly', 'quaxly', 'Water', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/912.png', 450, 'COMMON'),
  ('char_quaxwell', '913', 'Quaxwell', 'quaxwell', 'Water', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/913.png', 0, 'RARE'),
  ('char_quaquaval', '914', 'Quaquaval', 'quaquaval', 'Water', 'Fighting', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/914.png', 0, 'EPIC'),
  ('char_goomy', '704', 'Goomy', 'goomy', 'Dragon', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/704.png', 600, 'RARE'),
  ('char_sliggoo', '705', 'Sliggoo', 'sliggoo', 'Dragon', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/705.png', 0, 'EPIC'),
  ('char_goodra', '706', 'Goodra', 'goodra', 'Dragon', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/706.png', 0, 'LEGENDARY'),
  ('char_rockruff', '744', 'Rockruff', 'rockruff', 'Rock', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/744.png', 400, 'COMMON'),
  ('char_lycanroc', '745', 'Lycanroc', 'lycanroc', 'Rock', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/745.png', 0, 'RARE');

INSERT OR IGNORE INTO evolution_paths (id, from_character_id, to_character_id, point_cost) VALUES
  ('evo_chespin_quilladin', 'char_chespin', 'char_quilladin', 600),
  ('evo_quilladin_chesnaught', 'char_quilladin', 'char_chesnaught', 1000),
  ('evo_fennekin_braixen', 'char_fennekin', 'char_braixen', 600),
  ('evo_braixen_delphox', 'char_braixen', 'char_delphox', 1000),
  ('evo_sprigatito_floragato', 'char_sprigatito', 'char_floragato', 600),
  ('evo_floragato_meowscarada', 'char_floragato', 'char_meowscarada', 1000),
  ('evo_fuecoco_crocalor', 'char_fuecoco', 'char_crocalor', 600),
  ('evo_crocalor_skeledirge', 'char_crocalor', 'char_skeledirge', 1000),
  ('evo_quaxly_quaxwell', 'char_quaxly', 'char_quaxwell', 600),
  ('evo_quaxwell_quaquaval', 'char_quaxwell', 'char_quaquaval', 1000),
  ('evo_goomy_sliggoo', 'char_goomy', 'char_sliggoo', 1000),
  ('evo_sliggoo_goodra', 'char_sliggoo', 'char_goodra', 1500),
  ('evo_rockruff_lycanroc', 'char_rockruff', 'char_lycanroc', 800);
