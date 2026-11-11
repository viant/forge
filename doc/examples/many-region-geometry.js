// Independently invented rectangular areas and readings; no external geography or application data.
export const manyRegionGeometry = {
  id: 'many-areas', kind: 'geoMapBlock', title: 'Area readings', datasetRef: 'primary',
  geo: {
    shape: 'geojson', projection: 'planar', key: 'area', metric: {key: 'reading', label: 'Reading'},
    geometry: {type: 'FeatureCollection', features: Array.from({length: 51}, (_, index) => {
      const x = index % 17 * 2, y = Math.floor(index / 17) * 2;
      return {type: 'Feature', id: `area-${index + 1}`, properties: {label: `Area ${String(index + 1).padStart(2, '0')}`},
        geometry: {type: 'Polygon', coordinates: [[[x,y],[x+1,y],[x+1,y+1],[x,y+1],[x,y]]]}};
    })},
  },
};
export const manyRegionRows = [{area: 'area-1', reading: 7}, {area: 'area-2', reading: 0}, {area: 'area-3', reading: null}];
