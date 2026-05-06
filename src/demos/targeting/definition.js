const CATEGORY_SPECS = [
  {
    id: 'inventory',
    label: 'Inventory',
    accent: '#0f766e',
    icon: 'GlobeHemisphereWest',
    mood: 'Open supply, publisher shape, and content adjacency.',
  },
  {
    id: 'location',
    label: 'Location',
    accent: '#0284c7',
    icon: 'MapTrifold',
    mood: 'Countries, metros, lists, and precise place layers.',
  },
  {
    id: 'data',
    label: 'Data',
    accent: '#2563eb',
    icon: 'Database',
    mood: 'Audience packs, identity, user pools, and provider taxonomies.',
  },
  {
    id: 'demographics',
    label: 'Demographics',
    accent: '#7c3aed',
    icon: 'UserCircle',
    mood: 'Language, income, age, and demographic overlays.',
  },
  {
    id: 'device',
    label: 'Device',
    accent: '#475569',
    icon: 'Devices',
    mood: 'Operating system, browser, carrier, and device footprint.',
  },
  {
    id: 'quality',
    label: 'Quality',
    accent: '#b45309',
    icon: 'ShieldCheck',
    mood: 'Safety, fraud, viewability, and supply quality controls.',
  },
  {
    id: 'context',
    label: 'Context',
    accent: '#c2410c',
    icon: 'Sparkle',
    mood: 'Semantic topic families, sentiment, contextual packs, and IRIS.',
  },
  {
    id: 'media',
    label: 'Media',
    accent: '#b91c1c',
    icon: 'FilmStrip',
    mood: 'Creative shape, player environment, and video mechanics.',
  },
  {
    id: 'sustainability',
    label: 'Sustainability',
    accent: '#15803d',
    icon: 'Leaf',
    mood: 'Environmental and responsible media overlays.',
  },
];

const FIELD_CATALOG = [
  { field: 'PUBLISHER', featureKey: 'publisher', label: 'Exchanges & Sites', category: 'inventory', provider: 'platform' },
  { field: 'PMP_DEAL', featureKey: 'ad.pmp.deal.id', label: 'Deals', category: 'inventory', provider: 'platform' },
  { field: 'SITE_LIST', featureKey: 'site.lists.v2', label: 'Site Lists', category: 'inventory', provider: 'platform' },
  { field: 'SITE_CATEGORY', featureKey: 'ad.site.cats', label: 'Content Categories', category: 'inventory', provider: 'platform' },
  { field: 'SITE_TYPE', featureKey: 'ad.site.type', label: 'Site Type', category: 'inventory', provider: 'platform' },

  { field: 'LOCATION', featureKey: 'location', label: 'Countries, Regions, & Cities', category: 'location', provider: 'platform' },
  { field: 'LOCATION_METRO', featureKey: 'location.metrocode', label: 'Metropolitan Areas', category: 'location', provider: 'platform' },
  { field: 'POSTAL_CODE', featureKey: 'location.postalcode', label: 'Postal Codes', category: 'location', provider: 'platform' },
  { field: 'POSTAL_LIST', featureKey: 'location.postalcode.list', label: 'Postal Code Lists', category: 'location', provider: 'platform' },
  { field: 'WHEREABOUT', featureKey: 'location.whereabout', label: 'User Whereabouts', category: 'location', provider: 'platform' },
  { field: 'FACTUAL', featureKey: 'dmp.factual', label: 'Foursquare (fka Factual)', category: 'location', provider: 'foursquare' },
  { field: 'LOCATION_LIST_TARGETING', featureKey: 'location.list', label: 'Location Lists', category: 'location', provider: 'platform' },
  { field: 'LAT_LONG', featureKey: 'location.lat.lon.present', label: 'Latitude and Longitude', category: 'location', provider: 'platform' },

  { field: 'USER_POOL', featureKey: 'user.segment', label: 'User Pools', category: 'data', provider: 'platform' },
  { field: 'NINTH_DECIMAL', featureKey: 'ninthdecimal.taxonomy', label: '9D powered by InMarket', category: 'data', provider: 'inmarket' },
  { field: 'NEUSTAR_SEGMENTS', featureKey: 'dmp.neustar.audience', label: 'Neustar Segments', category: 'data', provider: 'neustar' },
  { field: 'NEUSTAR_ELEMENT', featureKey: 'dmp.neustar', label: 'Neustar Element IDs', category: 'data', provider: 'neustar' },
  { field: 'LIVE_RAMP_SEGMENTS', featureKey: 'dmp.liveramp.custom', label: 'LiveRamp Segments', category: 'data', provider: 'liveramp' },
  { field: 'FIRST_PARTY_CUSTOM', featureKey: 'provider.taxonomy', label: '3rd Party Custom Segments', category: 'data', provider: 'provider-combo', providerFamily: 'dynamic-provider-row' },
  { field: 'ADOBE', featureKey: 'dmp.adobe.id', label: 'Adobe Segments', category: 'data', provider: 'adobe' },
  { field: 'VIANT_SEGMENTS', featureKey: 'viant.taxonomy', label: 'Identity Segments', category: 'data', provider: 'viant' },
  { field: 'FIRST_PARTY_VIANT_SEGMENTS', featureKey: 'viant.taxonomy', label: '1st Party Segments', category: 'data', provider: 'viant' },
  { field: 'TRITON_SEGMENTS', featureKey: 'triton', label: 'Triton Broadcast Radio Segments', category: 'data', provider: 'triton' },

  { field: 'GENDER', featureKey: 'user.demographic.gender', label: 'Gender', category: 'demographics', provider: 'platform' },
  { field: 'AGE', featureKey: 'user.demographic.age', label: 'Age', category: 'demographics', provider: 'platform' },
  { field: 'LANGUAGE', featureKey: 'user.language', label: 'Language', category: 'demographics', provider: 'platform' },
  { field: 'INCOME', featureKey: 'user.demographic.hhi', label: 'Household Income', category: 'demographics', provider: 'platform' },
  { field: 'PEER39_LANGUAGE', featureKey: 'peer39.language', label: 'Peer39 Language Categories', category: 'demographics', provider: 'peer39' },
  { field: 'COMSCORE_LANGUAGE', featureKey: 'comscore.language', label: 'Comscore Language Categories', category: 'demographics', provider: 'comscore' },
  { field: 'COMSCORE_DEMOGRAPHICS', featureKey: 'comscore.demographics', label: 'Comscore Demographic Categories', category: 'demographics', provider: 'comscore' },
  { field: 'COMSCORE_VIDEO_OR_CTV_LANGUAGE', featureKey: 'comscore.video.or.ctv.language', label: 'Comscore Video & CTV Language Categories', category: 'demographics', provider: 'comscore' },

  { field: 'DEVICE_TYPE', featureKey: 'device.type', label: 'Device Type', category: 'device', provider: 'platform' },
  { field: 'CARRIER', featureKey: 'carrier.name', label: 'Carrier', category: 'device', provider: 'platform' },
  { field: 'MAKE_MODEL', featureKey: 'device.maker.model', label: 'Makes & Models', category: 'device', provider: 'platform' },
  { field: 'DEVICE_OS', featureKey: 'device.os.osv', label: 'OS Type / OS Version', category: 'device', provider: 'platform' },
  { field: 'DEVICE_BROWSER', featureKey: 'device.browser', label: 'Browser', category: 'device', provider: 'platform' },
  { field: 'DEVICE_ID', featureKey: 'device.id.present', label: 'Device ID', category: 'device', provider: 'platform' },

  { field: 'DV_FRAUD', featureKey: 'dv.fraud', label: 'DoubleVerify Fraud Segments', category: 'quality', provider: 'doubleverify' },
  { field: 'DV_AUTHENTIC_BRAND_SAFETY', featureKey: 'dv.authentic.brand.safety', label: 'DoubleVerify Authentic Brand Suitability Segments', category: 'quality', provider: 'doubleverify' },
  { field: 'IAS_VIEWABILITY', featureKey: 'ias.viewability', label: 'Integral Ad Science Viewability Segments', category: 'quality', provider: 'ias' },
  { field: 'ML_VIEWABILITY', featureKey: 'ml.viewability', label: 'Machine Learned Viewability', category: 'quality', provider: 'ias' },
  { field: 'IAS_BRAND_SAFETY', featureKey: 'ias.brand.safety', label: 'Integral Ad Science Brand Safety Segments', category: 'quality', provider: 'ias' },
  { field: 'IAS_FRAUD', featureKey: 'ias.fraud', label: 'Integral Ad Science Fraud Segments', category: 'quality', provider: 'ias' },
  { field: 'IAS_TRAQ', featureKey: 'ias.traq', label: 'Integral Ad Science Traffic Ad Quality Score Segments', category: 'quality', provider: 'ias' },
  { field: 'ADS_TXT_SUPPORT', featureKey: 'adstxt.support', label: 'Ads.txt/App-Ads.txt', category: 'quality', provider: 'platform' },
  { field: 'ADS_TXT_DIRECT', featureKey: 'adstxt.direct.pub', label: 'Direct Publishers Only', category: 'quality', provider: 'platform' },
  { field: 'DV_BRAND_SAFETY', featureKey: 'dv.brand.safety', label: 'DoubleVerify Brand Safety & Suitability Segments', category: 'quality', provider: 'doubleverify' },
  { field: 'DV_VIEWABILITY', featureKey: 'dv.viewability', label: 'DoubleVerify Viewability Segments', category: 'quality', provider: 'doubleverify' },
  { field: 'IAS_KEYWORD', featureKey: 'ias.keyword', label: 'IAS Custom Context Control Segments', category: 'quality', provider: 'ias' },
  { field: 'COMSCORE_VIDEO_OR_CTV_BRAND_SAFETY', featureKey: 'comscore.video.or.ctv.brand.safety', label: 'Comscore Video & CTV Brand Safety Categories', category: 'quality', provider: 'comscore' },
  { field: 'COMSCORE_VIDEO_OR_CTV_BRAND_SUITABILITY', featureKey: 'comscore.video.or.ctv.brand.suitability', label: 'Comscore Video & CTV Brand Suitability Categories', category: 'quality', provider: 'comscore' },
  { field: 'COMSCORE_BRAND_SAFETY', featureKey: 'comscore.brand.safety', label: 'Comscore Brand Safety Categories', category: 'quality', provider: 'comscore' },
  { field: 'COMSCORE_BRAND_SUITABILITY', featureKey: 'comscore.brand.suitability', label: 'Comscore Brand Suitability Categories', category: 'quality', provider: 'comscore' },
  { field: 'IAS_CONTEXT_CONTROL', featureKey: 'ias.context.control', label: 'Integral Ad Science Context Control', category: 'quality', provider: 'ias' },
  { field: 'IAS_IP_FRAUD', featureKey: 'ias.ip.fraud', label: 'Integral Ad Science CTV Pre-Bid Fraud Prevention', category: 'quality', provider: 'ias' },
  { field: 'PEER39_SAFETY', featureKey: 'peer39.safety', label: 'Peer39 Brand Safety Categories', category: 'quality', provider: 'peer39' },
  { field: 'PEER39_PAGE_SIGNALS', featureKey: 'peer39.page.signals', label: 'Peer39 Page Signals Categories', category: 'quality', provider: 'peer39' },
  { field: 'PEER39_FRAUD', featureKey: 'peer39.fraud', label: 'Peer39 Fraud Categories', category: 'quality', provider: 'peer39' },
  { field: 'PEER39_NEWS_GUARD', featureKey: 'peer39.news.guard', label: 'Peer39 News Guard Categories', category: 'quality', provider: 'peer39' },
  { field: 'INTEGRAL_AD_SCIENCE_CTV_SEGMENTS', featureKey: 'ias.ctv', label: 'Integral Ad Science CTV Segments', category: 'quality', provider: 'ias' },
  { field: 'SUPPLY_PATHS', featureKey: 'supply.paths', label: 'Supply Paths', category: 'quality', provider: 'platform', combines: ['supply.paths', 'target.supply', 'hop.limit'] },

  { field: 'UNIVERSAL_ATTENTION', featureKey: 'universal.attention', label: 'DoubleVerify Universal Attention Categories', category: 'context', provider: 'doubleverify' },
  { field: 'PEER39_ONLINE_VIDEO', featureKey: 'peer39.online.video', label: 'Peer39 Online Video', category: 'context', provider: 'peer39' },
  { field: 'PEER39_SOCIAL_CONTEXT', featureKey: 'peer39.social.context', label: 'Peer39 Social Context', category: 'context', provider: 'peer39' },
  { field: 'PEER39_GOLDFISH_ADS', featureKey: 'peer39.goldfish.ads', label: 'Peer39 GoldFishAds', category: 'context', provider: 'peer39' },
  { field: 'PEER39_POLK', featureKey: 'peer39.polk', label: 'Peer39 Polk', category: 'context', provider: 'peer39' },
  { field: 'PEER39_CONTEXTUAL_RETAIL_MEDIA', featureKey: 'peer39.contextual.retail.media', label: 'Peer39 Contextual Retail Media', category: 'context', provider: 'peer39' },
  { field: 'COMSCORE_CUSTOM', featureKey: 'comscore.custom', label: 'Comscore Custom Categories', category: 'context', provider: 'comscore' },
  { field: 'COMSCORE_VIDEO_OR_CTV_CONTEXTUAL', featureKey: 'comscore.video.or.ctv.contextual', label: 'Comscore Video & CTV Contextual Categories', category: 'context', provider: 'comscore' },
  { field: 'COMSCORE_VIDEO_OR_CTV_PREDICTIVE_AUDIENCE', featureKey: 'comscore.video.or.ctv.predictive.audience', label: 'Comscore Video & CTV Predictive Audience Categories', category: 'context', provider: 'comscore' },
  { field: 'PEER39_WEATHER', featureKey: 'peer39.weather', label: 'Peer39 Weather Categories', category: 'context', provider: 'peer39' },
  { field: 'COMSCORE_CONTEXTUAL', featureKey: 'comscore.contextual', label: 'Comscore Contextual Categories', category: 'context', provider: 'comscore' },
  { field: 'COMSCORE_SYNDICATED_RANKINGS', featureKey: 'comscore.syndicated.rankings', label: 'Comscore Syndicated Rankings Categories', category: 'context', provider: 'comscore' },
  { field: 'COMSCORE_PREDICTIVE_AUDIENCE', featureKey: 'comscore.predictive.audience', label: 'Comscore Predictive Audience Categories', category: 'context', provider: 'comscore' },
  { field: 'ADELAIDE_GROUPING', featureKey: 'adelaide.grouping', label: 'Adelaide AU Media Quality Categories', category: 'context', provider: 'adelaide' },
  { field: 'PEER39_MOBILE_APPS', featureKey: 'peer39.mobile.apps', label: 'Peer39 Mobile Apps Categories', category: 'context', provider: 'peer39' },
  { field: 'PEER39_CONTEXT', featureKey: 'peer39.context', label: 'Peer39 Contextual Categories', category: 'context', provider: 'peer39' },
  { field: 'PEER39_SENTIMENT', featureKey: 'peer39.sentiment', label: 'Peer39 Sentiment Categories', category: 'context', provider: 'peer39' },
  { field: 'PEER39_SOCIAL_PREDICT', featureKey: 'peer39.social.predict', label: 'Peer39 Social Predict Categories', category: 'context', provider: 'peer39' },
  { field: 'PEER39_CUSTOM_STANDARD', featureKey: 'peer39.custom.standard', label: 'Peer39 Custom Standard Categories', category: 'context', provider: 'peer39' },
  { field: 'PEER39_RETICLE', featureKey: 'peer39.reticle', label: 'Peer39 Reticle Categories', category: 'context', provider: 'peer39' },
  { field: 'PEER39_SPECIALTY', featureKey: 'peer39.specialty', label: 'Peer39 Specialty Categories', category: 'context', provider: 'peer39' },
  { field: 'PEER39_CUSTOM_ADVANCED', featureKey: 'peer39.custom.advanced', label: 'Peer39 Custom Advanced Categories', category: 'context', provider: 'peer39' },
  { field: 'PEER39_CUSTOM_STANDARD_MOBILE_CATEGORIES', featureKey: 'peer39.custom.standard.mobile.categories', label: 'Peer39 Custom Standard Mobile Categories', category: 'context', provider: 'peer39' },
  { field: 'PEER39_CUSTOM_ADVANCED_MOBILE_CATEGORIES', featureKey: 'peer39.custom.advanced.mobile.categories', label: 'Peer39 Custom Advanced Mobile Categories', category: 'context', provider: 'peer39' },
  { field: 'IRIS_SEGMENTS', featureKey: 'iris', label: 'IRIS-enabled Categories', category: 'context', provider: 'iris' },
  { field: 'PEER39_OTT_CTV', featureKey: 'peer39.ott.ctv', label: 'Peer39 OTT-CTV Categories', category: 'context', provider: 'peer39' },
  { field: 'PEER39_CUSTOM_ADVANCED_CTV_CATEGORIES', featureKey: 'peer39.custom.advanced.ctv.categories', label: 'Peer39 Custom Advanced CTV Categories', category: 'context', provider: 'peer39' },
  { field: 'PEER39_CUSTOM_STANDARD_CTV_CATEGORIES', featureKey: 'peer39.custom.standard.ctv.categories', label: 'Peer39 Custom Standard CTV Categories', category: 'context', provider: 'peer39' },

  { field: 'MEDIA_TYPE', featureKey: 'media.format', label: 'Media Types', category: 'media', provider: 'platform' },
  { field: 'CREATIVE_SIZES', featureKey: 'adsize', label: 'Creative Sizes', category: 'media', provider: 'platform' },
  { field: 'VIDEO_LENGTH', featureKey: 'media.duration', label: 'Video Length', category: 'media', provider: 'platform' },
  { field: 'AD_POSITION', featureKey: 'ad.position', label: 'Ad Position', category: 'media', provider: 'platform' },
  { field: 'SKIPPABLE_MEDIA', featureKey: 'media.skippable', label: 'Skippable Media', category: 'media', provider: 'platform' },
  { field: 'SKIPPABLE_VIDEO', featureKey: 'video.skippable', label: 'Skippable Video', category: 'media', provider: 'platform' },
  { field: 'SKIPPABLE_AUDIO', featureKey: 'audio.skippable', label: 'Skippable Audio', category: 'media', provider: 'platform' },
  { field: 'VPAID_ONLY', featureKey: 'video.vpaid.only', label: 'VPAID Video', category: 'media', provider: 'platform' },
  { field: 'NEW_VIDEO_TYPE', featureKey: 'media.plcmt', label: 'Video Type', category: 'media', provider: 'platform' },
  { field: 'VIDEO_PRE_MID_POST', featureKey: 'media.podseq', label: 'Video Pre/Mid/Post', category: 'media', provider: 'platform' },
  { field: 'VIDEO_PLAYER', featureKey: 'media.playersize', label: 'Video Player Size', category: 'media', provider: 'platform' },

  { field: 'PEER39_SUSTAINABILITY', featureKey: 'peer39.sustainability.scope3', label: 'Peer39 Sustainability', category: 'sustainability', provider: 'peer39' },
];

export const MCP_BINDINGS = [
  {
    id: 'categoryCatalog',
    label: 'Top category catalog',
    operation: 'catalog',
    source: 'newui top-level targeting categories',
    requestShape: ['clientContext', 'channelV2?', 'surface?'],
    outputShape: ['topLevelCategory', 'field', 'featureKey', 'label'],
  },
  {
    id: 'fieldLookup',
    label: 'Targeting tree lookup',
    operation: 'lookup',
    source: 'platform MCP targeting tree',
    requestShape: ['field', 'query', 'advertiserId?', 'channelsV2?', 'limit?'],
    outputShape: ['id', 'label', 'path', 'provider?', 'count?'],
  },
  {
    id: 'fieldChildren',
    label: 'Targeting tree children',
    operation: 'children',
    source: 'platform MCP targeting tree',
    requestShape: ['field', 'parentId?', 'query?', 'advertiserId?', 'channelsV2?'],
    outputShape: ['id', 'label', 'parentId', 'isLeaf', 'selectionType'],
  },
  {
    id: 'fieldAncestors',
    label: 'Targeting tree ancestors',
    operation: 'ancestors',
    source: 'platform MCP targeting tree',
    requestShape: ['field', 'ids[]'],
    outputShape: ['id', 'label', 'lineage[]'],
  },
  {
    id: 'fieldNodeMap',
    label: 'Targeting tree node map',
    operation: 'node-map',
    source: 'platform MCP targeting tree',
    requestShape: ['field', 'ids[]'],
    outputShape: ['id', 'label', 'path', 'provider?', 'deprecated?'],
  },
];

export const APPROACH_DEFINITIONS = [
  {
    id: 'atlas',
    title: 'Atlas Explorer',
    subtitle: 'Category-first browsing with a premium field gallery and large tree canvas.',
    shell: 'atlas',
    bestFor: 'Planner and trader workflows where the user starts from a top-level targeting category.',
    strengths: ['High browseability', 'Strong top-category iconography', 'Fast field comparison'],
  },
  {
    id: 'workbench',
    title: 'Targeting Workbench',
    subtitle: 'A composer-oriented split view with field stack, tree actions, and a rule tray.',
    shell: 'workbench',
    bestFor: 'Power users building one line item or audience definition with include/exclude intent.',
    strengths: ['Rule composition clarity', 'Field context stays visible', 'Good include/exclude ergonomics'],
  },
  {
    id: 'studio',
    title: 'Lookup Studio',
    subtitle: 'Search-first analyst view with MCP operation hints, result shelves, and explain panels.',
    shell: 'studio',
    bestFor: 'Support, solutions, or analyst workflows focused on lookup, lineage, and label resolution.',
    strengths: ['Search-first flow', 'Explicit operation model', 'Best for id-to-label and lineage debug'],
  },
];

const leaf = (field, path, label, count, extra = {}) => ({
  id: `${field.field}:${path.join('/')}`,
  label,
  count,
  path,
  ...extra,
});

function providerCopy(provider) {
  const map = {
    platform: 'Platform-native',
    peer39: 'Peer39',
    comscore: 'Comscore',
    ias: 'Integral Ad Science',
    doubleverify: 'DoubleVerify',
    viant: 'Viant',
    adobe: 'Adobe',
    liveramp: 'LiveRamp',
    neustar: 'Neustar',
    triton: 'Triton',
    foursquare: 'Foursquare',
    iris: 'IRIS.TV',
    inmarket: 'InMarket',
    adelaide: 'Adelaide',
    'provider-combo': 'Provider taxonomy',
  };
  return map[provider] || 'Third-party';
}

function buildAudienceTree(field) {
  return [
    {
      label: 'High Intent',
      children: [
        leaf(field, ['High Intent', 'Auto In-Market'], 'Auto In-Market', 1824),
        leaf(field, ['High Intent', 'Travel Planners'], 'Travel Planners', 1375),
      ],
    },
    {
      label: 'Lifecycle',
      children: [
        leaf(field, ['Lifecycle', 'Cart Abandoners'], 'Cart Abandoners', 948),
        leaf(field, ['Lifecycle', 'Past Purchasers'], 'Past Purchasers', 1207),
      ],
    },
    {
      label: 'Modeled Extensions',
      children: [
        leaf(field, ['Modeled Extensions', 'Lookalike Households'], 'Lookalike Households', 732),
      ],
    },
  ];
}

function buildLocationTree(field) {
  return [
    {
      label: 'United States',
      children: [
        {
          label: 'California',
          children: [
            leaf(field, ['United States', 'California', 'Los Angeles'], 'Los Angeles', 1402),
            leaf(field, ['United States', 'California', 'San Diego'], 'San Diego', 882),
          ],
        },
        {
          label: 'Texas',
          children: [
            leaf(field, ['United States', 'Texas', 'Dallas'], 'Dallas', 1018),
            leaf(field, ['United States', 'Texas', 'Austin'], 'Austin', 544),
          ],
        },
      ],
    },
    {
      label: 'Canada',
      children: [
        leaf(field, ['Canada', 'Toronto'], 'Toronto', 691),
        leaf(field, ['Canada', 'Vancouver'], 'Vancouver', 388),
      ],
    },
  ];
}

function buildInventoryTree(field) {
  return [
    {
      label: 'Premium Supply',
      children: [
        leaf(field, ['Premium Supply', 'Streaming Lifestyle'], 'Streaming Lifestyle', 611),
        leaf(field, ['Premium Supply', 'Business News'], 'Business News', 438),
      ],
    },
    {
      label: 'Open Exchange',
      children: [
        leaf(field, ['Open Exchange', 'Sports Enthusiasts'], 'Sports Enthusiasts', 2285),
        leaf(field, ['Open Exchange', 'Finance Readers'], 'Finance Readers', 1277),
      ],
    },
    {
      label: 'Curated Lists',
      children: [
        leaf(field, ['Curated Lists', 'CTV Household Reach'], 'CTV Household Reach', 359),
      ],
    },
  ];
}

function buildQualityTree(field) {
  return [
    {
      label: 'Low Risk',
      children: [
        leaf(field, ['Low Risk', 'General News Safe'], 'General News Safe', 744),
        leaf(field, ['Low Risk', 'Family Friendly'], 'Family Friendly', 852),
      ],
    },
    {
      label: 'Suitability Packs',
      children: [
        leaf(field, ['Suitability Packs', 'Conservative'], 'Conservative', 628),
        leaf(field, ['Suitability Packs', 'Balanced'], 'Balanced', 905),
      ],
    },
    {
      label: 'Fraud and Viewability',
      children: [
        leaf(field, ['Fraud and Viewability', 'Pre-Bid Fraud Filter'], 'Pre-Bid Fraud Filter', 517),
      ],
    },
  ];
}

function buildContextTree(field) {
  return [
    {
      label: 'Culture and Lifestyle',
      children: [
        leaf(field, ['Culture and Lifestyle', 'Home Design'], 'Home Design', 1190),
        leaf(field, ['Culture and Lifestyle', 'Foodie Travel'], 'Foodie Travel', 844),
      ],
    },
    {
      label: 'Business and Tech',
      children: [
        leaf(field, ['Business and Tech', 'AI Strategy'], 'AI Strategy', 512),
        leaf(field, ['Business and Tech', 'Cloud Buyers'], 'Cloud Buyers', 664),
      ],
    },
    {
      label: 'Entertainment and Sports',
      children: [
        leaf(field, ['Entertainment and Sports', 'Women\'s Sports'], 'Women\'s Sports', 792),
        leaf(field, ['Entertainment and Sports', 'Streaming Premieres'], 'Streaming Premieres', 608),
      ],
    },
  ];
}

function buildDeviceTree(field) {
  return [
    {
      label: 'Mobile',
      children: [
        leaf(field, ['Mobile', 'iOS'], 'iOS', 1290),
        leaf(field, ['Mobile', 'Android'], 'Android', 1433),
      ],
    },
    {
      label: 'Connected TV',
      children: [
        leaf(field, ['Connected TV', 'Samsung'], 'Samsung', 806),
        leaf(field, ['Connected TV', 'Roku'], 'Roku', 988),
      ],
    },
  ];
}

function buildDemographicTree(field) {
  return [
    {
      label: 'Core',
      children: [
        leaf(field, ['Core', '25-34'], '25-34', 1354),
        leaf(field, ['Core', '35-44'], '35-44', 1299),
      ],
    },
    {
      label: 'Affluence',
      children: [
        leaf(field, ['Affluence', '$100K-$150K'], '$100K-$150K', 712),
        leaf(field, ['Affluence', '$150K+'], '$150K+', 590),
      ],
    },
  ];
}

function buildMediaTree(field) {
  return [
    {
      label: 'Video',
      children: [
        leaf(field, ['Video', 'Instream'], 'Instream', 902),
        leaf(field, ['Video', 'Outstream'], 'Outstream', 640),
      ],
    },
    {
      label: 'Creative Envelope',
      children: [
        leaf(field, ['Creative Envelope', '300x250'], '300x250', 511),
        leaf(field, ['Creative Envelope', '15 Seconds'], '15 Seconds', 834),
      ],
    },
  ];
}

function buildSustainabilityTree(field) {
  return [
    {
      label: 'Scope 3 Bands',
      children: [
        leaf(field, ['Scope 3 Bands', 'Efficient Reach'], 'Efficient Reach', 412),
        leaf(field, ['Scope 3 Bands', 'Low Emissions'], 'Low Emissions', 388),
      ],
    },
  ];
}

export function buildFieldTree(field) {
  if (!field) return [];
  switch (field.category) {
    case 'inventory':
      return buildInventoryTree(field);
    case 'location':
      return buildLocationTree(field);
    case 'data':
      return buildAudienceTree(field);
    case 'demographics':
      return buildDemographicTree(field);
    case 'device':
      return buildDeviceTree(field);
    case 'quality':
      return buildQualityTree(field);
    case 'context':
      return buildContextTree(field);
    case 'media':
      return buildMediaTree(field);
    case 'sustainability':
      return buildSustainabilityTree(field);
    default:
      return [];
  }
}

export function flattenTree(nodes = [], parentPath = []) {
  const flattened = [];
  for (const node of nodes) {
    const nextPath = [...parentPath, node.label];
    if (Array.isArray(node.children) && node.children.length > 0) {
      flattened.push(...flattenTree(node.children, nextPath));
      continue;
    }
    flattened.push({
      value: node.id,
      label: node.label,
      groupKey: nextPath.join('/'),
      path: node.path || nextPath,
      count: node.count || 0,
      tooltip: `${nextPath.join(' / ')} · ${node.count || 0} ids`,
    });
  }
  return flattened;
}

export function summarizeSelections(selectionByField = {}, fieldById = {}) {
  const rows = [];
  for (const [fieldId, laneMap] of Object.entries(selectionByField || {})) {
    const field = fieldById[fieldId];
    if (!field) continue;
    for (const lane of ['include', 'exclude']) {
      const values = Array.isArray(laneMap?.[lane]) ? laneMap[lane] : [];
      if (values.length === 0) continue;
      rows.push({
        field,
        lane,
        count: values.length,
        values,
      });
    }
  }
  return rows;
}

export function buildLookupResults(fields, query) {
  const term = String(query || '').trim().toLowerCase();
  if (!term) return [];
  const matches = [];
  for (const field of fields) {
    const tree = flattenTree(buildFieldTree(field));
    if (field.label.toLowerCase().includes(term) || field.featureKey.toLowerCase().includes(term)) {
      matches.push({
        kind: 'field',
        field,
        label: field.label,
        detail: `${providerCopy(field.provider)} · ${field.featureKey}`,
      });
    }
    for (const option of tree) {
      if (option.label.toLowerCase().includes(term) || option.groupKey.toLowerCase().includes(term)) {
        matches.push({
          kind: 'node',
          field,
          label: option.label,
          detail: option.groupKey.replaceAll('/', ' / '),
          nodeValue: option.value,
        });
      }
    }
  }
  return matches.slice(0, 18);
}

const CATEGORY_BY_ID = Object.fromEntries(CATEGORY_SPECS.map((item) => [item.id, item]));
const FIELD_BY_ID = Object.fromEntries(FIELD_CATALOG.map((item) => [item.field, item]));

export const TARGETING_DEMO_DEFINITION = {
  title: 'Targeting Selection Studio',
  subtitle: 'A Forge-native proposal for a platform MCP-backed targeting tree explorer.',
  summary:
    'One shared targeting meta model, three different UX shells. Every shell assumes the platform MCP server owns lookup, children, ancestors, and node-map, while the UI owns top-level category grouping and terminology.',
  categories: CATEGORY_SPECS.map((category) => {
    const fields = FIELD_CATALOG.filter((field) => field.category === category.id);
    return {
      ...category,
      fieldCount: fields.length,
      providers: Array.from(new Set(fields.map((field) => providerCopy(field.provider)))).slice(0, 4),
    };
  }),
  fields: FIELD_CATALOG,
  categoryById: CATEGORY_BY_ID,
  fieldById: FIELD_BY_ID,
  approaches: APPROACH_DEFINITIONS,
  bindings: MCP_BINDINGS,
  defaultCategoryId: 'context',
  defaultFieldId: 'IRIS_SEGMENTS',
  filterSchema: {
    type: 'object',
    properties: {
      advertiserName: {
        type: 'string',
        title: 'Advertiser',
        default: 'Acme Streaming',
        'x-ui-order': 10,
      },
      channelV2: {
        type: 'string',
        title: 'Primary Channel',
        enum: ['DISPLAY', 'VIDEO', 'NATIVE', 'AUDIO', 'CTV', 'DOOH'],
        default: 'CTV',
        'x-ui-order': 20,
      },
      lane: {
        type: 'string',
        title: 'Active Lane',
        enum: ['include', 'exclude'],
        default: 'include',
        'x-ui-order': 30,
      },
      operation: {
        type: 'string',
        title: 'Primary MCP Operation',
        enum: ['children', 'lookup', 'ancestors', 'node-map'],
        default: 'children',
        'x-ui-order': 40,
      },
      query: {
        type: 'string',
        title: 'Lookup Query',
        default: 'sports',
        'x-ui-order': 50,
      },
    },
  },
};
