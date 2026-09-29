-- Adds 30 more characters and their evolution paths, filling in types that
-- had few or no characters (Steel, Ground, Poison, Ice, Dark, Fairy).
-- INSERT OR IGNORE leaves any existing rows untouched. Each character has at
-- most one outgoing evolution path, which the collection and evolve queries assume.

INSERT OR IGNORE INTO characters (id, external_id, name, slug, type_primary, type_secondary, image_url, price, rarity) VALUES
  ('char_oddish', '43', 'Oddish', 'oddish', 'Grass', 'Poison', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/43.png', 350, 'COMMON'),
  ('char_gloom', '44', 'Gloom', 'gloom', 'Grass', 'Poison', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/44.png', 0, 'RARE'),
  ('char_vileplume', '45', 'Vileplume', 'vileplume', 'Grass', 'Poison', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/45.png', 0, 'EPIC'),
  ('char_poliwag', '60', 'Poliwag', 'poliwag', 'Water', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/60.png', 350, 'COMMON'),
  ('char_poliwhirl', '61', 'Poliwhirl', 'poliwhirl', 'Water', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/61.png', 0, 'RARE'),
  ('char_poliwrath', '62', 'Poliwrath', 'poliwrath', 'Water', 'Fighting', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/62.png', 0, 'EPIC'),
  ('char_sandshrew', '27', 'Sandshrew', 'sandshrew', 'Ground', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/27.png', 350, 'COMMON'),
  ('char_sandslash', '28', 'Sandslash', 'sandslash', 'Ground', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/28.png', 0, 'RARE'),
  ('char_ekans', '23', 'Ekans', 'ekans', 'Poison', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/23.png', 300, 'COMMON'),
  ('char_arbok', '24', 'Arbok', 'arbok', 'Poison', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/24.png', 0, 'RARE'),
  ('char_onix', '95', 'Onix', 'onix', 'Rock', 'Ground', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/95.png', 450, 'COMMON'),
  ('char_steelix', '208', 'Steelix', 'steelix', 'Steel', 'Ground', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/208.png', 0, 'EPIC'),
  ('char_magnemite', '81', 'Magnemite', 'magnemite', 'Electric', 'Steel', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/81.png', 400, 'COMMON'),
  ('char_magneton', '82', 'Magneton', 'magneton', 'Electric', 'Steel', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/82.png', 0, 'RARE'),
  ('char_cubone', '104', 'Cubone', 'cubone', 'Ground', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/104.png', 400, 'COMMON'),
  ('char_marowak', '105', 'Marowak', 'marowak', 'Ground', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/105.png', 0, 'RARE'),
  ('char_horsea', '116', 'Horsea', 'horsea', 'Water', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/116.png', 300, 'COMMON'),
  ('char_seadra', '117', 'Seadra', 'seadra', 'Water', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/117.png', 0, 'RARE'),
  ('char_scyther', '123', 'Scyther', 'scyther', 'Bug', 'Flying', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/123.png', 700, 'RARE'),
  ('char_scizor', '212', 'Scizor', 'scizor', 'Bug', 'Steel', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/212.png', 0, 'EPIC'),
  ('char_swinub', '220', 'Swinub', 'swinub', 'Ice', 'Ground', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/220.png', 350, 'COMMON'),
  ('char_piloswine', '221', 'Piloswine', 'piloswine', 'Ice', 'Ground', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/221.png', 0, 'RARE'),
  ('char_houndour', '228', 'Houndour', 'houndour', 'Dark', 'Fire', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/228.png', 450, 'COMMON'),
  ('char_houndoom', '229', 'Houndoom', 'houndoom', 'Dark', 'Fire', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/229.png', 0, 'EPIC'),
  ('char_treecko', '252', 'Treecko', 'treecko', 'Grass', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/252.png', 400, 'COMMON'),
  ('char_grovyle', '253', 'Grovyle', 'grovyle', 'Grass', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/253.png', 0, 'RARE'),
  ('char_sceptile', '254', 'Sceptile', 'sceptile', 'Grass', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/254.png', 0, 'EPIC'),
  ('char_togepi', '175', 'Togepi', 'togepi', 'Fairy', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/175.png', 400, 'COMMON'),
  ('char_togetic', '176', 'Togetic', 'togetic', 'Fairy', 'Flying', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/176.png', 0, 'RARE'),
  ('char_absol', '359', 'Absol', 'absol', 'Dark', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/359.png', 800, 'RARE');

INSERT OR IGNORE INTO evolution_paths (id, from_character_id, to_character_id, point_cost) VALUES
  ('evo_oddish_gloom', 'char_oddish', 'char_gloom', 600),
  ('evo_gloom_vileplume', 'char_gloom', 'char_vileplume', 1000),
  ('evo_poliwag_poliwhirl', 'char_poliwag', 'char_poliwhirl', 600),
  ('evo_poliwhirl_poliwrath', 'char_poliwhirl', 'char_poliwrath', 1000),
  ('evo_sandshrew_sandslash', 'char_sandshrew', 'char_sandslash', 800),
  ('evo_ekans_arbok', 'char_ekans', 'char_arbok', 800),
  ('evo_onix_steelix', 'char_onix', 'char_steelix', 1200),
  ('evo_magnemite_magneton', 'char_magnemite', 'char_magneton', 800),
  ('evo_cubone_marowak', 'char_cubone', 'char_marowak', 800),
  ('evo_horsea_seadra', 'char_horsea', 'char_seadra', 800),
  ('evo_scyther_scizor', 'char_scyther', 'char_scizor', 1200),
  ('evo_swinub_piloswine', 'char_swinub', 'char_piloswine', 800),
  ('evo_houndour_houndoom', 'char_houndour', 'char_houndoom', 1000),
  ('evo_treecko_grovyle', 'char_treecko', 'char_grovyle', 600),
  ('evo_grovyle_sceptile', 'char_grovyle', 'char_sceptile', 1000),
  ('evo_togepi_togetic', 'char_togepi', 'char_togetic', 800);
