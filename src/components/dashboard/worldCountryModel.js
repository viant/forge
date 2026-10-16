import {WORLD_COUNTRY_PATHS} from './worldCountryPaths.js';

const aliases = new Map(WORLD_COUNTRY_PATHS.flatMap(country =>
  country.aliases.map(alias => [String(alias).toUpperCase(), country.key])));
aliases.set('UNITED STATES', 'US');
aliases.set('UK', 'GB');

export function normalizeCountryKey(value) {
  const key = String(value ?? '').trim().toUpperCase();
  return aliases.get(key) || aliases.get(/^\d+$/.test(key) ? key.padStart(3, '0') : key) || key;
}

export function countryRegionsByKey(regions = []) {
  return new Map(regions.map(region => [normalizeCountryKey(region.key), region]));
}

export {WORLD_COUNTRY_PATHS};
