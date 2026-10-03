-- Adds 20 more characters: Elekid, Magby, Trapinch and Honedge three-stage lines,
-- and Swablu, Tyrunt, Amaura and Sneasel two-stage lines. Base forms are sold in the
-- shop; evolved forms are evolution-only (price 0). INSERT OR IGNORE leaves existing
-- rows untouched, and each character has at most one outgoing evolution path.

INSERT OR IGNORE INTO characters (id, external_id, name, slug, type_primary, type_secondary, image_url, price, rarity) VALUES
  ('char_elekid', '239', 'Elekid', 'elekid', 'Electric', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/239.png', 400, 'COMMON'),
  ('char_electabuzz', '125', 'Electabuzz', 'electabuzz', 'Electric', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/125.png', 0, 'RARE'),
  ('char_electivire', '466', 'Electivire', 'electivire', 'Electric', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/466.png', 0, 'EPIC'),
  ('char_magby', '240', 'Magby', 'magby', 'Fire', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/240.png', 400, 'COMMON'),
  ('char_magmar', '126', 'Magmar', 'magmar', 'Fire', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/126.png', 0, 'RARE'),
  ('char_magmortar', '467', 'Magmortar', 'magmortar', 'Fire', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/467.png', 0, 'EPIC'),
  ('char_trapinch', '328', 'Trapinch', 'trapinch', 'Ground', NULL, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/328.png', 400, 'COMMON'),
  ('char_vibrava', '329', 'Vibrava', 'vibrava', 'Ground', 'Dragon', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/329.png', 0, 'RARE'),
  ('char_flygon', '330', 'Flygon', 'flygon', 'Ground', 'Dragon', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/330.png', 0, 'EPIC'),
  ('char_honedge', '679', 'Honedge', 'honedge', 'Steel', 'Ghost', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/679.png', 450, 'COMMON'),
  ('char_doublade', '680', 'Doublade', 'doublade', 'Steel', 'Ghost', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/680.png', 0, 'RARE'),
  ('char_aegislash', '681', 'Aegislash', 'aegislash', 'Steel', 'Ghost', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/681.png', 0, 'EPIC'),
  ('char_swablu', '333', 'Swablu', 'swablu', 'Normal', 'Flying', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/333.png', 350, 'COMMON'),
  ('char_altaria', '334', 'Altaria', 'altaria', 'Dragon', 'Flying', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/334.png', 0, 'RARE'),
  ('char_tyrunt', '696', 'Tyrunt', 'tyrunt', 'Rock', 'Dragon', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/696.png', 600, 'RARE'),
  ('char_tyrantrum', '697', 'Tyrantrum', 'tyrantrum', 'Rock', 'Dragon', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/697.png', 0, 'EPIC'),
  ('char_amaura', '698', 'Amaura', 'amaura', 'Rock', 'Ice', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/698.png', 600, 'RARE'),
  ('char_aurorus', '699', 'Aurorus', 'aurorus', 'Rock', 'Ice', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/699.png', 0, 'EPIC'),
  ('char_sneasel', '215', 'Sneasel', 'sneasel', 'Dark', 'Ice', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/215.png', 500, 'RARE'),
  ('char_weavile', '461', 'Weavile', 'weavile', 'Dark', 'Ice', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/461.png', 0, 'EPIC');

INSERT OR IGNORE INTO evolution_paths (id, from_character_id, to_character_id, point_cost) VALUES
  ('evo_elekid_electabuzz', 'char_elekid', 'char_electabuzz', 600),
  ('evo_electabuzz_electivire', 'char_electabuzz', 'char_electivire', 1000),
  ('evo_magby_magmar', 'char_magby', 'char_magmar', 600),
  ('evo_magmar_magmortar', 'char_magmar', 'char_magmortar', 1000),
  ('evo_trapinch_vibrava', 'char_trapinch', 'char_vibrava', 600),
  ('evo_vibrava_flygon', 'char_vibrava', 'char_flygon', 1000),
  ('evo_honedge_doublade', 'char_honedge', 'char_doublade', 600),
  ('evo_doublade_aegislash', 'char_doublade', 'char_aegislash', 1000),
  ('evo_swablu_altaria', 'char_swablu', 'char_altaria', 800),
  ('evo_tyrunt_tyrantrum', 'char_tyrunt', 'char_tyrantrum', 1000),
  ('evo_amaura_aurorus', 'char_amaura', 'char_aurorus', 1000),
  ('evo_sneasel_weavile', 'char_sneasel', 'char_weavile', 1000);
