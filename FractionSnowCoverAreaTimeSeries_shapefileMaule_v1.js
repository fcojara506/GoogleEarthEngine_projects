/* ###################################################################
CODIGO PARA CÁLCULO DE FRACCIÓN DE COBERTURA NIVAL (fSCA) 
A PARTIR DE IMAGENES SATELITALES MODIS AQUA Y TERRA
CON RELLENO TEMPORAL Y ESPACIAL DE NUBES.

DISEÑADO POR: MIGUEL LAGOS (2016)
VERSION EN GOOGLE ENGINE: 
-V1.0 ALEJANDRA ISAMIT (30 enero de 2019) 
-V1.1 FRANCISCO JARA (20 de febrero 2020)
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

var BASIN_NAME="MAULE_EXTENDIDO"; //NOMBRE DEL ARCHIVO DE SALIDA
var Region = ee.FeatureCollection("users/franciscojara/cuencas_pronostico2019_4326"); //ARCHIVO SHAPE
var ppd = ee.FeatureCollection("users/franciscojara/precipitacion/pp_2001_2020_MAULE"); //ARCHIVO CSV DE PRECIPITACION
var start = ee.Date('2002-05-01'); //FECHA DE INICIO
var finish = ee.Date('2002-07-30'); //FECHA FINAL 
var BOOLEAN_TIMESERIES_CHART=true; //PLOTEAR SERIE DE TIEMPO DEL FSCA, NO RECOMENDABLE PARA PERIODOS >1AÑO
var threshold=10// UMBRAL PARA CONTAR DIAS SOBRE ESE VALOR EN %fsca


//_______________________________________CODE________________________________________//

var Terra = ee.ImageCollection("MODIS/006/MOD10A1");
var Aqua = ee.ImageCollection("MODIS/006/MYD10A1");

ppd=ppd.sort('system:time_start'); //SERIE DE PRECIPITACION
ppd=ppd.map(function(feature){
  var num = ee.Number.parse(feature.get('precipitacion'));
  var date = ee.Date(feature.get('system:time_start'));
  return feature.set('system:time_start', date), feature.set('precipitacion', num);
  });
  
//// Pre-procesamiento
//filtrar para la fecha requerida
var Terra_filt = Terra.filterDate(start,finish);
var Aqua_filt = Aqua.filterDate(start,finish);
ppd=ppd.filterDate(start,finish);

//plotear serie de tiempo de la precipitacion
var graph = ui.Chart.feature.byFeature(ppd, 'system:time_start', 'precipitacion');
print(graph.setChartType("LineChart")
         .setOptions({vAxis: {title: 'pp [mm]'},
                      hAxis: {title: 'Fecha'}}));     

Map.centerObject(Region);

//seleccionar solo NDSI y cortar al area de estudio
var maskSNOW = function(image){
var snowCov = image.select('NDSI_Snow_Cover');//.clip(Region)
var QA = image.select('NDSI_Snow_Cover_Basic_QA');//.clip(Region)
var mask = QA.eq(0); //(Calidad de la muestra)
//0: Best,  1: Good, 2: Ok, 3: Poor - not currently in use, 211: Night 239: Ocean
return snowCov.updateMask(mask); //enmascara snowcov
};

var Terra_clip = Terra_filt.map(maskSNOW);
var Aqua_clip = Aqua_filt.map(maskSNOW);
//Parametros de visualizacion para el mapa
var snowCoverVis = {min: 0.0, max: 100.0, palette: ['black','0dffff','0524ff','ffffff']};

/////PASO 0: UNIR AQUA Y TERRA
//unir imagenes con la misma fecha
var filterTime = ee.Filter.equals({
leftField: 'system:time_start',
rightField: 'system:time_start'
});

var merged_feats = ee.Join.inner().apply(Terra_clip,Aqua_clip, filterTime);
var invertedJoined = ee.Join.inverted().apply(Terra_clip,Aqua_clip, filterTime);
var merged_feats = ee.ImageCollection(merged_feats);

var modis = merged_feats.map(function(feature) {
return ee.ImageCollection([feature.get('primary'), feature.get('secondary')]).mean()
 .copyProperties(feature.get('primary'), ['system:time_start', 'system:index'])});

var modis0 = modis.merge(invertedJoined);

modis0 = modis0.sort('system:time_start');

/////PASO 1: RELLENO TEMPORAL
//Crear ImageCollection a partir de FeatureCollection
var Pp_diaria =ppd.map(function(feature) {
return ee.Image(ee.Number(feature.get('precipitacion'))).copyProperties(feature, ['system:time_start']);
});
//Funcion de relleno temporal
var temporalSnow = function(image){
  var dia = ee.Date(image.get('system:time_start'));
  var pp = ee.Image(Pp_diaria.filterDate(dia).first()).gt(0); //Boolean pp>0 entonces 1
  var imageSnow= ee.Image();
  //Si pp(dia)>0
  if (pp==1){//si hay precipitacion
  var dmas_4 = dia.advance(3,'day');// solo se promedia dias hacia adelante
  var diascercanos_pp= modis0.filterDate(dia,dmas_4);
  imageSnow = diascercanos_pp.mean();
  }
  else {//si NO hay precipitacion
  //Si pp(dia)=0
  var dmenos = dia.advance(-2,'day'); //dias hacia atrás para el promedio temporal
  var dmas = dia.advance(2,'day'); //dias hacia adelante para el promedio temporal
  var diascercanos_notpp= modis0.filterDate(dmenos,dmas);
  imageSnow = diascercanos_notpp.mean();
  }
  //reemplazar valores faltantes
  return ee.ImageCollection([image.float(), imageSnow.float()]).reduce(ee.Reducer.firstNonNull())
  .copyProperties(image, ['system:time_start']);
};
//Aplicar funcion para obtener relleno
var modis1 = modis0.map(temporalSnow);

//PASO 2: RELLENO ESPACIAL, se itera varias veces
//Rellenar con el promedio de los 8 pixeles cercanos
var spatialFill = function (image) {
var temp = ee.Image().clip(Region);
var unmasked = image.unmask(temp);
var filled = unmasked.focal_mean(500, 'square', 'meters', 3); // aca se repite 3 veces el proceso
var join = filled.blend(unmasked).copyProperties(image, ['system:time_start']);
return join;
};
var modis2 = modis1.map(spatialFill);
modis2 = modis2.map(function(image){return image.clip(Region)});

// PASO3: SERIE DE TIEMPO DEL PROMEDIO ESPACIAL
var createTS = function(img){
var date = img.get('system:time_start');
var value = img.reduceRegion(ee.Reducer.mean(), Region,500);
var ft = ee.Feature(null, {'system:time_start': date, 
                           'date': ee.Date(date).format('Y/M/d'), 
                           'value': value.get("NDSI_Snow_Cover_first")});
return ft;
};

var temp_mean_modis2 = modis2.map(createTS);



// PASO4: EXPORTAR
var today = new Date().toISOString().slice(0, 10).replace("-","_").replace("-","_");
var hora= new Date().toTimeString().slice(0,5).replace(":","","/g");
today=today+'_'+hora;

//MAPA PROMEDIO
var spatial_mean_modis2=modis2.mean();
Export.image.toDrive({image:spatial_mean_modis2,
            description: 'MapafSCAPromedio_'+BASIN_NAME+'_'+today,
            folder: "GEE",
            maxPixels:67000000000,
            scale: 500,
            region: Region
});

//CONTAR LOS DIAS CON NIEVE EN CADA PIXEL
var n_days = finish.difference(start,'day');
var modis_count=modis2.map(function(image){return image.gte(threshold).clip(Region).divide(n_days)});
var snowCoverVis = {min: 0.0, max: 6370, palette: ['black','0dffff','0524ff','ffffff']};
modis_count=modis_count.sum().toDouble()
//print(modis2)

Export.image.toDrive({image:modis_count ,
            description: 'MapafSCA_Dias_'+BASIN_NAME+'_'+today+'_threshold'+threshold,
            folder: "GEE",
            maxPixels:67000000000,
            scale: 500,
            region: Region
});

//Map.addLayer(modis_count, snowCoverVis, 'Snow Cover');

//SERIE DE TIEMPO FSCA
if(BOOLEAN_TIMESERIES_CHART){
var graph = ui.Chart.feature.byFeature(temp_mean_modis2, 'system:time_start', 'value');
print(graph.setChartType("LineChart")
         .setOptions({vAxis: {title: 'fSCA [%]'},
                      hAxis: {title: 'Fecha'}})); 
}

//EXPORTAR SERIE DE TIEMPO FSCA
Export.table.toDrive({collection: temp_mean_modis2,
                    folder: "GEE",
                    selectors: 'date, value',
                    fileFormat: 'CSV',
                    description: 'TimeSeries_fsca_'+today,
                    fileNamePrefix: 'TimeSeries_fsca_'+BASIN_NAME+'_'+today,
});

// plotear un dia de ejemplo
snowCoverVis = {min: 0.0, max: 100, palette: ['black','0dffff','0524ff','ffffff']};

Map.addLayer(modis2.filterDate(ee.Date('2002-06-19')).first(), snowCoverVis, 'MODIS ejemplo junio');
Map.addLayer(modis2.filterDate(ee.Date('2002-05-08')).first(), snowCoverVis, 'MODIS ejemplo mayo');