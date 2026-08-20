// Single source of truth for the ecosystem app list, shared by the landing grid
// and the /demo preview so they never drift (icons / order / live status).
// A change here updates every surface at once.

export interface EcosystemApp {
  name: string;
  emoji: string;
  domain: string;
  category: string;
}

export const APPS: EcosystemApp[] = [
  { name: 'Life',        emoji: '🌱', domain: 'life.pi',        category: 'Personal'      },
  { name: 'Insure',      emoji: '🛡️', domain: 'insure.pi',      category: 'Finance'       },
  { name: 'Commerce',    emoji: '🛒', domain: 'commerce.pi',    category: 'Business'      },
  { name: 'Ecommerce',   emoji: '📦', domain: 'ecommerce.pi',   category: 'Business'      },
  { name: 'Assets',      emoji: '💼', domain: 'assets.pi',      category: 'Finance'       },
  { name: 'Fundx',       emoji: '📊', domain: 'fundx.pi',       category: 'Finance'       },
  { name: 'Dx',          emoji: '🏥', domain: 'dx.pi',          category: 'Health'        },
  { name: 'Analytics',   emoji: '📈', domain: 'analytics.pi',   category: 'Business'      },
  { name: 'Nbf',         emoji: '🏦', domain: 'nbf.pi',         category: 'Finance'       },
  { name: 'Epic',        emoji: '🎮', domain: 'epic.pi',        category: 'Entertainment' },
  { name: 'Legend',      emoji: '⭐', domain: 'legend.pi',      category: 'Premium'       },
  { name: 'Connection',  emoji: '🔗', domain: 'connection.pi',  category: 'Social'        },
  { name: 'System',      emoji: '⚙️', domain: 'system.pi',      category: 'Tech'          },
  { name: 'Alert',       emoji: '🔔', domain: 'alert.pi',       category: 'Tech'          },
  { name: 'Tec',         emoji: '👑', domain: 'tec.pi',         category: 'Premium'       },
  { name: 'Estate',      emoji: '🏠', domain: 'estate.pi',      category: 'Premium'       },
  { name: 'Nx',          emoji: '🚀', domain: 'nx.pi',          category: 'Tech'          },
  { name: 'Explorer',    emoji: '✈️', domain: 'explorer.pi',    category: 'Premium'       },
  { name: 'Nexus',       emoji: '🌐', domain: 'nexus.pi',       category: 'Hub'           },
  { name: 'Brookfield',  emoji: '🏙️', domain: 'brookfield.pi',  category: 'Premium'       },
  { name: 'Vip',         emoji: '💎', domain: 'vip.pi',         category: 'Premium'       },
  { name: 'Titan',       emoji: '🦾', domain: 'titan.pi',       category: 'Business'      },
  { name: 'Zone',        emoji: '🎯', domain: 'zone.pi',        category: 'Personal'      },
  { name: 'Elite',       emoji: '🏆', domain: 'elite.pi',       category: 'Premium'       },
];

// Apps a signed-in Hub user can open right now (proves the ecosystem is real).
// Adding a key here marks that app LIVE everywhere at once.
export const LIVE_APPS: Record<string, string> = {
  'Assets':   'https://assets.tecosystem.app',
  'Commerce': 'https://tec-commerce-app.vercel.app',
};

export const CATEGORY_COLORS: Record<string, string> = {
  Finance:       '#f0c040',
  Premium:       '#FBBF24',
  Business:      '#7eb8f7',
  Tech:          '#7ee7c0',
  Personal:      '#f09898',
  Health:        '#98e0a8',
  Entertainment: '#c898f0',
  Social:        '#f0b878',
  Hub:           '#ffffff',
};
