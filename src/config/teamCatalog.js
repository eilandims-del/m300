import { normalizeToken } from '../utils/normalization.js';

const rawVtrCatalog = [
  ['CNB-EN-90B', 'Canindé', 'Manhã', 'Própria'],
  ['CND-RD-21B', 'Canindé', 'Manhã', 'Parceira'],
  ['CNB-EN-91B', 'Canindé', 'Manhã', 'Própria'],
  ['CND-RD-22B', 'Canindé', 'Manhã', 'Parceira'],
  ['CNB-EN-92B', 'Canindé', 'Manhã', 'Própria'],
  ['CND-RD-23B', 'Canindé', 'Manhã', 'Parceira'],
  ['CND-EN-90B', 'Canindé', 'Manhã', 'Própria'],
  ['CNM-RD-21B', 'Canindé', 'Manhã', 'Parceira'],
  ['CND-EN-91B', 'Canindé', 'Manhã', 'Própria'],
  ['CNB-RD-21B', 'Canindé', 'Manhã', 'Parceira'],
  ['CND-EN-92B', 'Canindé', 'Manhã', 'Própria'],
  ['CNI-RD-21B', 'Canindé', 'Manhã', 'Parceira'],
  ['CND-EN-93B', 'Canindé', 'Tarde', 'Própria'],
  ['CND-RD-21C', 'Canindé', 'Tarde', 'Parceira'],
  ['CND-EN-94B', 'Canindé', 'Tarde', 'Própria'],
  ['CNB-RD-21C', 'Canindé', 'Tarde', 'Parceira'],
  ['CND-EN-95B', 'Canindé', 'Tarde', 'Própria'],
  ['CNI-RD-21C', 'Canindé', 'Tarde', 'Parceira'],
  ['CNM-RD-21D', 'Canindé', 'Noite', 'Parceira'],
  ['CND-RD-21D', 'Canindé', 'Noite', 'Parceira'],
  ['CNQ-EN-90B', 'Quixadá', 'Manhã', 'Própria'],
  ['QXD-RD-21B', 'Quixadá', 'Manhã', 'Parceira'],
  ['CNQ-EN-91B', 'Quixadá', 'Manhã', 'Própria'],
  ['QXD-RD-22B', 'Quixadá', 'Manhã', 'Parceira'],
  ['CNQ-EN-92B', 'Quixadá', 'Manhã', 'Própria'],
  ['QXB-RD-21B', 'Quixadá', 'Manhã', 'Parceira'],
  ['CNQ-EN-93B', 'Quixadá', 'Manhã', 'Própria'],
  ['QXB-RD-22B', 'Quixadá', 'Manhã', 'Parceira'],
  ['CNQ-EN-94B', 'Quixadá', 'Manhã', 'Própria'],
  ['QXU-RD-21B', 'Quixadá', 'Manhã', 'Parceira'],
  ['CNX-EN-90B', 'Quixadá', 'Tarde', 'Própria'],
  ['QXD-RD-21C', 'Quixadá', 'Tarde', 'Parceira'],
  ['CNX-EN-91B', 'Quixadá', 'Tarde', 'Própria'],
  ['QXB-RD-21C', 'Quixadá', 'Tarde', 'Parceira'],
  ['CNX-EN-92B', 'Quixadá', 'Noite', 'Própria'],
  ['QXB-RD-21D', 'Quixadá', 'Noite', 'Parceira'],
  ['CNX-EN-94B', 'Quixadá', 'Noite', 'Própria'],
  ['QXU-RD-21D', 'Quixadá', 'Noite', 'Parceira'],
  ['QXD-RD-23B', 'Quixadá', 'Manhã', 'Parceira'],
  ['QXD-RD-21D', 'Quixadá', 'Noite', 'Parceira'],
  ['NVC-EN-90B', 'Crateús', 'Manhã', 'Própria'],
  ['CAT-RD-21B', 'Crateús', 'Manhã', 'Parceira'],
  ['NVC-EN-91B', 'Crateús', 'Manhã', 'Própria'],
  ['CAT-RD-22B', 'Crateús', 'Manhã', 'Parceira'],
  ['NVC-EN-92B', 'Crateús', 'Tarde', 'Própria'],
  ['CAT-RD-21C', 'Crateús', 'Tarde', 'Parceira'],
  ['NVC-EN-93B', 'Crateús', 'Tarde', 'Própria'],
  ['CAT-RD-22C', 'Crateús', 'Tarde', 'Parceira'],
  ['NVC-EN-94B', 'Crateús', 'Tarde', 'Própria'],
  ['CAT-RD-23C', 'Crateús', 'Tarde', 'Parceira'],
  ['NVC-EN-95B', 'Crateús', 'Noite', 'Própria'],
  ['CAT-RD-21D', 'Crateús', 'Noite', 'Parceira'],
  ['NVQ-EN-90B', 'Nova Russas', 'Manhã', 'Própria'],
  ['NVR-RD-21B', 'Nova Russas', 'Manhã', 'Parceira'],
  ['NVQ-EN-91B', 'Nova Russas', 'Manhã', 'Própria'],
  ['NVR-RD-22B', 'Nova Russas', 'Manhã', 'Parceira'],
  ['NVQ-EN-92B', 'Nova Russas', 'Manhã', 'Própria'],
  ['NVR-RD-23B', 'Nova Russas', 'Manhã', 'Parceira'],
  ['NVQ-EN-93B', 'Nova Russas', 'Manhã', 'Própria'],
  ['NVI-RD-21B', 'Nova Russas', 'Manhã', 'Parceira'],
  ['NVR-EN-90B', 'Nova Russas', 'Manhã', 'Própria'],
  ['NVI-RD-22B', 'Nova Russas', 'Manhã', 'Parceira'],
  ['NVR-EN-91B', 'Nova Russas', 'Manhã', 'Própria'],
  ['NVQ-RD-21B', 'Nova Russas', 'Manhã', 'Parceira'],
  ['NVR-EN-92B', 'Nova Russas', 'Manhã', 'Própria'],
  ['NVM-RD-21B', 'Nova Russas', 'Manhã', 'Parceira'],
  ['NVR-EN-93B', 'Nova Russas', 'Manhã', 'Própria'],
  ['NVV-RD-21B', 'Nova Russas', 'Manhã', 'Parceira'],
  ['NVR-EN-94B', 'Nova Russas', 'Tarde', 'Própria'],
  ['NVR-RD-21C', 'Nova Russas', 'Tarde', 'Parceira'],
  ['NVR-EN-95B', 'Nova Russas', 'Tarde', 'Própria'],
  ['NVV-RD-21C', 'Nova Russas', 'Tarde', 'Parceira'],
  ['NVV-EN-90B', 'Nova Russas', 'Tarde', 'Própria'],
  ['NVI-RD-21C', 'Nova Russas', 'Tarde', 'Parceira'],
  ['NVR-RD-22C', 'Nova Russas', 'Tarde', 'Parceira'],
  ['NVR-RD-21D', 'Nova Russas', 'Noite', 'Parceira'],
  ['NVQ-RD-21D', 'Nova Russas', 'Noite', 'Parceira']
];

const BASE_POLO = new Map([
  ['CANINDE', 'Centro-Norte'],
  ['QUIXADA', 'Centro-Norte'],
  ['CRATEUS', 'Centro-Norte'],
  ['NOVARUSSAS', 'Centro-Norte']
]);

export const VTR_TEAM_CATALOG = rawVtrCatalog.map(([equipe, base, periodo, tipoEquipe]) => ({
  equipe,
  base: canonicalBase(base),
  periodo,
  tipoEquipe,
  polo: BASE_POLO.get(normalizeToken(base)) || 'Centro-Norte'
}));

export const VTR_TEAM_INDEX = new Map(VTR_TEAM_CATALOG.map((entry) => [normalizeToken(entry.equipe), entry]));

export function canonicalBase(base) {
  const token = normalizeToken(base);
  if (token === 'CANINDE') return 'Canindé';
  if (token === 'QUIXADA') return 'Quixadá';
  if (token === 'CRATEUS') return 'Crateús';
  if (token === 'NOVARUSSAS') return 'Nova Russas';
  return String(base || '').trim();
}
