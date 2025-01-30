// Built-in templates for the subscription system
export const builtInTemplates = [
  {
    id: 'boe-general',
    name: 'BOE General',
    description: 'Seguimiento general del Boletín Oficial del Estado',
    type: 'boe',
    prompts: ['disposición', 'ley', 'real decreto'],
    frequency: 'daily',
    isBuiltIn: true,
    icon: 'GanttChart',
    logo: 'https://www.boe.es/favicon.ico',
    metadata: {
      category: 'government',
      source: 'boe'
    }
  },
  {
    id: 'boe-subvenciones',
    name: 'Subvenciones BOE',
    description: 'Alertas de subvenciones y ayudas públicas',
    type: 'boe',
    prompts: ['subvención', 'ayuda', 'convocatoria'],
    frequency: 'immediate',
    isBuiltIn: true,
    icon: 'Coins',
    logo: 'https://www.boe.es/favicon.ico',
    metadata: {
      category: 'government',
      source: 'boe'
    }
  },
  {
    id: 'real-estate-rental',
    name: 'Alquiler de Viviendas',
    description: 'Búsqueda de alquileres en zonas específicas',
    type: 'real-estate',
    prompts: ['alquiler', 'piso', 'apartamento'],
    frequency: 'immediate',
    isBuiltIn: true,
    icon: 'Key',
    logo: 'https://cdn-icons-png.flaticon.com/512/1040/1040993.png',
    metadata: {
      category: 'real-estate',
      source: 'property-listings'
    }
  }
];