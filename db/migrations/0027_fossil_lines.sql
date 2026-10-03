-- 16 more characters: the eight fossil lines that were still missing.
-- Omanyte, Kabuto, Lileep, Anorith, Cranidos, Shieldon, Tirtouga and Archen join
-- Tyrunt and Amaura, so every fossil Pokémon that evolves is now in the game.
-- Like Tyrunt and Amaura, each base form is a RARE shop character at 600 and evolves
-- into an EPIC for 1000.
-- Names and types were checked against PokeAPI. Evolved forms are evolution-only
-- (price 0). INSERT OR IGNORE leaves existing rows untouched, and each character has
-- at most one outgoing evolution path.

INSERT OR IGNORE INTO characters (id, external_id, name, slug, type_primary, type_secondary, image_url, price, rarity) VALUES
  ('char_omanyte', '138', 'Omanyte', 'omanyte', 'Rock', 'Water', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/138.png', 600, 'RARE'),
  ('char_omastar', '139', 'Omastar', 'omastar', 'Rock', 'Water', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/139.png', 0, 'EPIC'),
  ('char_kabuto', '140', 'Kabuto', 'kabuto', 'Rock', 'Water', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/140.png', 600, 'RARE'),
  ('char_kabutops', '141', 'Kabutops', 'kabutops', 'Rock', 'Water', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/141.png', 0, 'EPIC'),
  ('char_lileep', '345', 'Lileep', 'lileep', 'Rock', 'Grass', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/345.png', 600, 'RARE'),
  ('char_cradily', '346', 'Cradily', 'cradily', 'Rock', 'Grass', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/346.png', 0, 'EPIC'),
  ('char_anorith', '347', 'Anorith', 'anorith', 'Rock', 'Bug', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/347.png', 600, 'RARE'),
  ('char_armaldo', '348', 'Armaldo', 'armaldo', 'Rock', 'Bug', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/348.png', 0, 'EPIC'),
  ('char_cranidos', '408', 'Cranidos', 'cranidos', 'Rock', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/408.png', 600, 'RARE'),
  ('char_rampardos', '409', 'Rampardos', 'rampardos', 'Rock', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/409.png', 0, 'EPIC'),
  ('char_shieldon', '410', 'Shieldon', 'shieldon', 'Rock', 'Steel', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/410.png', 600, 'RARE'),
  ('char_bastiodon', '411', 'Bastiodon', 'bastiodon', 'Rock', 'Steel', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/411.png', 0, 'EPIC'),
  ('char_tirtouga', '564', 'Tirtouga', 'tirtouga', 'Water', 'Rock', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/564.png', 600, 'RARE'),
  ('char_carracosta', '565', 'Carracosta', 'carracosta', 'Water', 'Rock', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/565.png', 0, 'EPIC'),
  ('char_archen', '566', 'Archen', 'archen', 'Rock', 'Flying', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/566.png', 600, 'RARE'),
  ('char_archeops', '567', 'Archeops', 'archeops', 'Rock', 'Flying', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/567.png', 0, 'EPIC');

INSERT OR IGNORE INTO evolution_paths (id, from_character_id, to_character_id, point_cost) VALUES
  ('evo_omanyte_omastar', 'char_omanyte', 'char_omastar', 1000),
  ('evo_kabuto_kabutops', 'char_kabuto', 'char_kabutops', 1000),
  ('evo_lileep_cradily', 'char_lileep', 'char_cradily', 1000),
  ('evo_anorith_armaldo', 'char_anorith', 'char_armaldo', 1000),
  ('evo_cranidos_rampardos', 'char_cranidos', 'char_rampardos', 1000),
  ('evo_shieldon_bastiodon', 'char_shieldon', 'char_bastiodon', 1000),
  ('evo_tirtouga_carracosta', 'char_tirtouga', 'char_carracosta', 1000),
  ('evo_archen_archeops', 'char_archen', 'char_archeops', 1000);
