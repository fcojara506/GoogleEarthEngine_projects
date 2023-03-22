/* ###################################################################
CODIGO PARA CÁLCULO DE FRACCIÓN DE COBERTURA NIVAL (fSCA) 
A PARTIR DE IMAGENES SATELITALES MODIS AQUA Y TERRA
CON RELLENO TEMPORAL Y ESPACIAL DE NUBES.

DISEÑADO POR: MIGUEL LAGOS (2016)
VERSION EN GOOGLE ENGINE: 
-V1.0 ALEJANDRA ISAMIT (30 enero de 2019) 
-V1.1 FRANCISCO JARA (20 de febrero 2020)
-V1.2 RANCISCO JARA (22 de marzo 2023)
_____________________________________________________________________
DESCRIPCION DE LAS VERSIONES

V1.0: RELLENO TEMPORAL Y ESPACIAL DE MODIS MOD10A1 Y MYD10A1 PARA YERBA LOCA 
CON PRECIPITACION CARGADA DE GOOGLE FUSION TABLE.

V1.1 IMPLEMENTACION DE PROMEDIO TEMPORAL Y ESPACIAL DE LAS 
SERIES DE TIEMPO. 
EXPORTACION DE IMAGENES DE FSCA PROMEDIO TOTAL DEL PERIODO.
EXPORTACION DE SERIE DE TIEMPO DEL PROMEDIO ESPACIAL EN '*.CSV'.
_____________________________________________________________________
FORMATOS

EL ARCHIVO DE PRECIPITACIONES SE CARGA EN ASSETS EN UN ARCHIVO '*.CSV'.
LA COLUMNA DE FECHAS DEBE TENER EL NOMBRE "system:time_start" 
Y DEBEN ESTAR EN FORMATO EPOCH
(MILISEGUNDOS DESDE 1970-01-01) = (x-DATE(1970,1,1))*86400*1000

EL ARCHIVO SHAPEFILE SE CARGA EN ASSETS Y DEBE ESTAR EN EPGS 4326 (WGS84)
#####################################################################
*/

// Set variables
var BASIN_NAME = "MAULE_EXTENDIDO";
var Region = ee.FeatureCollection("users/franciscojara/cuencas_pronostico2019_4326");
var precipitation = ee.FeatureCollection("users/franciscojara/precipitacion/pp_2001_2020_MAULE")
  .sort('system:time_start')
  .map(function(feature) {
    var num = ee.Number.parse(feature.get('precipitacion'));
    var date = ee.Date(feature.get('system:time_start'));
    return feature.set('system:time_start', date).set('precipitacion', num);
  });
var start = ee.Date('2002-05-01');
var finish = ee.Date('2002-07-30');
var BOOLEAN_TIMESERIES_CHART = true;
var threshold = 10;

// Load MODIS images
var Terra = ee.ImageCollection("MODIS/006/MOD10A1").filterDate(start, finish);
var Aqua = ee.ImageCollection("MODIS/006/MYD10A1").filterDate(start, finish);

// Define functions for masking snow cover
var maskSNOW = function(image){
  var snowCov = image.select('NDSI_Snow_Cover');
  var QA = image.select('NDSI_Snow_Cover_Basic_QA');
  var mask = QA.eq(0);
  return snowCov.updateMask(mask);
};
var spatialFill = function (image) {
  var temp = ee.Image().clip(Region);
  var unmasked = image.unmask(temp);
  var filled = unmasked.focal_mean(500, 'square', 'meters', 3);
  var join = filled.blend(unmasked).copyProperties(image, ['system:time_start']);
  return join;
};
var temporalSnow = function(image){
  var dia = ee.Date(image.get('system:time_start'));
  var pp = ee.Image(precipitation.filterDate(dia).first()).gt(0);
  var imageSnow= ee.Image();
  if (pp==1){
    var dmas_4 = dia.advance(3,'day');
    var diascercanos_pp = modis0.filterDate(dia, dmas_4);
    imageSnow = diascercanos_pp.mean();
  } else {
    var dmenos = dia.advance(-2,'day');
    var dmas = dia.advance(2,'day');
    var diascercanos_notpp = modis0.filterDate(dmenos, dmas);
    imageSnow = diascercanos_notpp.mean();
  }
  return ee.ImageCollection([image.float(), imageSnow.float()]).reduce(ee.Reducer.firstNonNull())
    .copyProperties(image, ['system:time_start']);
};
var createTS = function(img){
  var date = img.get('system:time_start');
  var value = img.reduceRegion(ee.Reducer.mean(), Region,500);
  var ft = ee.Feature(null, {
    'system:time_start': date, 
    'date': ee.Date(date).format('Y/M/d'), 
    'value': value.get("NDSI_Snow_Cover_first")
  });
  return ft;
};

// Join Aqua and Terra images
var filterTime = ee.Filter.equals({
  leftField: 'system:time_start',
  rightField: 'system:time_start'
});
var merged_feats = ee.Join.inner().apply(Terra.map(maskSNOW), Aqua.map(maskSNOW), filterTime);
var invertedJoined = ee.Join.inverted().apply(Terra.map(maskSNOW
  ), Aqua.map(maskSNOW), filterTime);
  var merged_feats = ee.ImageCollection(merged_feats);
  var modis = merged_feats.map(function(feature) {
  return ee.ImageCollection([feature.get('primary'), feature.get('secondary')]).mean()
  .copyProperties(feature.get('primary'), ['system:time_start', 'system:index'])
  }).merge(invertedJoined).sort('system:time_start');
  
  // Apply temporal and spatial fill
  var modis0 = modis;
  var modis1 = modis0.map(temporalSnow);
  var modis2 = modis1.map(spatialFill).map(spatialFill).map(spatialFill).map(function(image){
  return image.clip(Region);
  });
  
  // Export maps and tables
  var today = new Date().toISOString().slice(0, 10).replace("-","").replace("-","");
  var hora = new Date().toTimeString().slice(0,5).replace(":","","/g");
  today = today + '_' + hora;
  
  var spatial_mean_modis2 = modis2.mean();
  Export.image.toDrive({
  image: spatial_mean_modis2,
  description: 'MapafSCAPromedio_'+BASIN_NAME+'_'+today,
  folder: "GEE",
  maxPixels: 67000000000,
  scale: 500,
  region: Region
  });
  
  var n_days = finish.difference(start,'day');
  var modis_count = modis2.map(function(image) {
  return image.gte(threshold).clip(Region).divide(n_days);
  }).sum().toDouble();
  Export.image.toDrive({
  image: modis_count,
  description: 'MapafSCA_Dias_'+BASIN_NAME+'_'+today+'_threshold'+threshold,
  folder: "GEE",
  maxPixels: 67000000000,
  scale: 500,
  region: Region
  });
  
  var temp_mean_modis2 = modis2.map(createTS);
  if (BOOLEAN_TIMESERIES_CHART) {
  var graph = ui.Chart.feature.byFeature(temp_mean_modis2, 'system:time_start', 'value');
  print(graph.setChartType("LineChart")
  .setOptions({
  vAxis: {title: 'fSCA [%]'},
  hAxis: {title: 'Fecha'}
  }));
  }
  Export.table.toDrive({
  collection: temp_mean_modis2,
  folder: "GEE",
  selectors: 'date, value',
  fileFormat: 'CSV',
  description: 'TimeSeries_fsca_'+today,
  fileNamePrefix: 'TimeSeries_fsca_'+BASIN_NAME+'_'+today
  });
  
  // Plot a sample day
  var snowCoverVis = {min: 0.0, max: 100, palette: ['black','0dffff','0524ff','ffffff']};
  Map.addLayer(modis2.filterDate(ee.Date('2002-06-19')).first(), snowCoverVis, 'MODIS ejemplo junio');
  Map.addLayer(modis2.filterDate(ee.Date('2002-05-08')).first(), snowCoverVis, 'MODIS ejemplo mayo');