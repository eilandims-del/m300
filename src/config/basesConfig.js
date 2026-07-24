export const BASES_CONFIG = {
  extraTeamTags: ['-PD-', '-ML-', '-EP-', '-LC-', '-LL-', '-CO-', '-MP-', '-IN-', '-EN-', '-MO-', '-LV-'],
  polos: [
    {
      name: 'Norte',
      ignoreTeamTags: ['-AP-'],
      matchType: 'direct_prefix',
      bases: [
        { name: 'Inhuçu', propria: ['INH-'], parceira: ['STB-'] },
        { name: 'Tianguá', propria: ['TNG-'], parceira: ['STM-', 'STV-', 'STT-'] },
        { name: 'Camocim', propria: ['CMC-'], parceira: ['CMK-'] },
        { name: 'Sobral', propria: ['SBL-'], parceira: ['SBC-', 'SBF-', 'SBM-', 'SBR-', 'SBU-'] }
      ]
    },
    {
      name: 'Centro-Norte',
      ignoreTeamTags: ['-AP-'],
      matchType: 'infix_type_with_base_prefix',
      typeIdentifiers: {
        propria: ['-EN-'],
        parceira: ['-RD-']
      },
      bases: [
        { name: 'Canindé', prefixes: ['CNB-', 'CND-', 'CNM-', 'CNI-'] },
        { name: 'Quixadá', prefixes: ['CNQ-', 'CNX-', 'QXD-', 'QXB-', 'QXU-'] },
        { name: 'Crateús', prefixes: ['NVC-', 'CAT-'] },
        { name: 'Nova Russas', prefixes: ['NVQ-', 'NVR-', 'NVV-', 'NVI-', 'NVM-'] }
      ]
    },
    {
      name: 'Atlântico',
      ignoreTeamTags: ['-AP-'],
      matchType: 'direct_prefix',
      bases: [
        { name: 'Itapajé', propria: ['ITJ-'], parceira: ['ITE-'] },
        { name: 'Itapipoca', propria: ['ITK-'], parceira: ['IPK-'] },
        { name: 'Trairi', propria: ['TRR-'], parceira: ['IPT-'] },
        { name: 'Acaraú', propria: ['ACU-'], parceira: ['ACA-'] }
      ]
    }
  ]
};

export function resolveTeam(teamName = '') {
  const team = String(teamName || '').toUpperCase();
  const fallback = { polo: 'Não identificado', base: 'Não identificada', tipo: 'Não identificado', ignored: false };

  for (const polo of BASES_CONFIG.polos) {
    if ((polo.ignoreTeamTags || []).some((tag) => team.includes(tag))) {
      return { ...fallback, polo: polo.name, ignored: true };
    }

    if (polo.matchType === 'direct_prefix') {
      for (const base of polo.bases) {
        if ((base.propria || []).some((prefix) => team.startsWith(prefix))) {
          return { polo: polo.name, base: base.name, tipo: 'Própria', ignored: false };
        }
        if ((base.parceira || []).some((prefix) => team.startsWith(prefix))) {
          return { polo: polo.name, base: base.name, tipo: 'Parceira', ignored: false };
        }
      }
    }

    if (polo.matchType === 'infix_type_with_base_prefix') {
      const type = (polo.typeIdentifiers?.propria || []).some((tag) => team.includes(tag))
        ? 'Própria'
        : (polo.typeIdentifiers?.parceira || []).some((tag) => team.includes(tag))
          ? 'Parceira'
          : null;
      for (const base of polo.bases) {
        if ((base.prefixes || []).some((prefix) => team.startsWith(prefix))) {
          return { polo: polo.name, base: base.name, tipo: type || 'Não identificado', ignored: false };
        }
      }
    }
  }

  return fallback;
}
