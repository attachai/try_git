-- Adds 25 legendary characters. 21 are sold in the shop as single forms: the
-- legendary beasts, Latias/Latios, Celebi, Jirachi, Deoxys, Dialga, Palkia,
-- Giratina, Darkrai, Reshiram, Zekrom, Xerneas, Yveltal, Zamazenta, Eternatus,
-- Koraidon, Miraidon, and Arceus as the top prize (5000). Two legendary lines evolve:
-- Kubfu -> Urshifu and Type: Null -> Silvally (EPIC in the shop, LEGENDARY evolved).
-- INSERT OR IGNORE leaves existing rows untouched.

INSERT OR IGNORE INTO characters (id, external_id, name, slug, type_primary, type_secondary, image_url, price, rarity) VALUES
  ('char_raikou', '243', 'Raikou', 'raikou', 'Electric', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/243.png', 2000, 'LEGENDARY'),
  ('char_entei', '244', 'Entei', 'entei', 'Fire', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/244.png', 2000, 'LEGENDARY'),
  ('char_suicune', '245', 'Suicune', 'suicune', 'Water', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/245.png', 2000, 'LEGENDARY'),
  ('char_latias', '380', 'Latias', 'latias', 'Dragon', 'Psychic', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/380.png', 2500, 'LEGENDARY'),
  ('char_latios', '381', 'Latios', 'latios', 'Dragon', 'Psychic', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/381.png', 2500, 'LEGENDARY'),
  ('char_celebi', '251', 'Celebi', 'celebi', 'Psychic', 'Grass', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/251.png', 3000, 'LEGENDARY'),
  ('char_jirachi', '385', 'Jirachi', 'jirachi', 'Steel', 'Psychic', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/385.png', 3000, 'LEGENDARY'),
  ('char_deoxys', '386', 'Deoxys', 'deoxys', 'Psychic', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/386.png', 3000, 'LEGENDARY'),
  ('char_dialga', '483', 'Dialga', 'dialga', 'Steel', 'Dragon', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/483.png', 3000, 'LEGENDARY'),
  ('char_palkia', '484', 'Palkia', 'palkia', 'Water', 'Dragon', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/484.png', 3000, 'LEGENDARY'),
  ('char_giratina', '487', 'Giratina', 'giratina', 'Ghost', 'Dragon', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/487.png', 3000, 'LEGENDARY'),
  ('char_darkrai', '491', 'Darkrai', 'darkrai', 'Dark', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/491.png', 3000, 'LEGENDARY'),
  ('char_reshiram', '643', 'Reshiram', 'reshiram', 'Dragon', 'Fire', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/643.png', 3000, 'LEGENDARY'),
  ('char_zekrom', '644', 'Zekrom', 'zekrom', 'Dragon', 'Electric', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/644.png', 3000, 'LEGENDARY'),
  ('char_xerneas', '716', 'Xerneas', 'xerneas', 'Fairy', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/716.png', 3000, 'LEGENDARY'),
  ('char_yveltal', '717', 'Yveltal', 'yveltal', 'Dark', 'Flying', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/717.png', 3000, 'LEGENDARY'),
  ('char_zamazenta', '889', 'Zamazenta', 'zamazenta', 'Fighting', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/889.png', 3000, 'LEGENDARY'),
  ('char_eternatus', '890', 'Eternatus', 'eternatus', 'Poison', 'Dragon', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/890.png', 3000, 'LEGENDARY'),
  ('char_koraidon', '1007', 'Koraidon', 'koraidon', 'Fighting', 'Dragon', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1007.png', 3000, 'LEGENDARY'),
  ('char_miraidon', '1008', 'Miraidon', 'miraidon', 'Electric', 'Dragon', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1008.png', 3000, 'LEGENDARY'),
  ('char_arceus', '493', 'Arceus', 'arceus', 'Normal', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/493.png', 5000, 'LEGENDARY'),
  ('char_kubfu', '891', 'Kubfu', 'kubfu', 'Fighting', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/891.png', 1500, 'EPIC'),
  ('char_urshifu', '892', 'Urshifu', 'urshifu', 'Fighting', 'Dark', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/892.png', 0, 'LEGENDARY'),
  ('char_typenull', '772', 'Type: Null', 'type-null', 'Normal', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/772.png', 1500, 'EPIC'),
  ('char_silvally', '773', 'Silvally', 'silvally', 'Normal', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/773.png', 0, 'LEGENDARY');

INSERT OR IGNORE INTO evolution_paths (id, from_character_id, to_character_id, point_cost) VALUES
  ('evo_kubfu_urshifu', 'char_kubfu', 'char_urshifu', 2000),
  ('evo_typenull_silvally', 'char_typenull', 'char_silvally', 2000);
