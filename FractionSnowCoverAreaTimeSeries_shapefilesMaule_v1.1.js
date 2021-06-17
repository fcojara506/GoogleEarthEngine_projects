/* ###################################################################
CODIGO PARA EL CÁLCULO DE LA FRACCIÓN DE COBERTURA NIVAL (fSCA) 
A PARTIR DE IMAGENES SATELITALES MODIS AQUA Y TERRA
CON RELLENO TEMPORAL Y ESPACIAL DE NUBES DISEÑADO POR MIGUEL LAGOS (2016).

VERSIONES EN GOOGLE EARTH ENGINE: 
-V1.0 ALEJANDRA ISAMIT (30 enero de 2019) 
-V1.1 FRANCISCO JARA (20 de febrero 2020)

ADVANCED MINING TECHNOLOGY CENTER- UNIVERSIDAD DE CHILE
_____________________________________________________________________
DESCRIPCION DE LAS VERSIONES

V1.0: RELLENO TEMPORAL Y ESPACIAL DE MODIS MOD10A1 Y MYD10A1 PARA YERBA LOCA 
CON PRECIPITACION CARGADA DE GOOGLE FUSION TABLE.
SE CONSIDERA UNA PRECIPITACION UNIFORME PARA TODA LA ZONA

V1.1 IMPLEMENTACION DE PROMEDIO TEMPORAL Y ESPACIAL DE LAS 
SERIES DE TIEMPO.
CARGA DE ARCHIVOS EN ASSETS CON FORMATO CSV Y SHAPEFILE.
EXPORTACION DE IMAGENES DE FSCA PROMEDIO TOTAL DEL PERIODO.
EXPORTACION DE SERIE DE TIEMPO DEL PROMEDIO ESPACIAL EN '*.CSV'.
_____________________________________________________________________
DESCRIPCION LOS ARCHIVOS

EL ARCHIVO DE PRECIPITACIONES SE CARGA EN "ASSETS" EN UN ARCHIVO .CSV
LA COLUMNA DE FECHAS DEBE TENER EL NOMBRE: system:time_start 
Y LOS VALORES DEBEN ESTAR EN FORMATO EPOCH (MILISEGUNDOS DESDE 1970-01-01) = (x-FECHA(1970,1,1))*86400*1000
LA COLUMNA DE PRECIPITACION DEBE TENER EL NOMBRE: precipitacion
SIN TILDES, EN MINUSCULAS, SIN COMILLAS O ESPACIOS EN LOS NOMBRES

LA PRECIPITACION SE UTILIZA PARA EL RELLENO TEMPORAL DE LOS PIXELES CON NUBES:
SI PRECIPITACION>0, SE RELLENA CON EL PROMEDIO DE FSCA DE LOS 4 DIAS HACIA ADELANTE.
SI NO HAY PRECIPITACION, SE RELLENA CON EL PROMEDIO DE LOS 3 DIAS HACIA ADELANTE Y 3 HACIA ATRAS.

EL ARCHIVO SHAPEFILE (.SHP,.SHX,.DBF,.PRJ) SE CARGA EN ASSETS Y DEBE ESTAR EN EPSG 4326 (WGS84).

LOS ARCHIVOS DE RESULTADOS APARECEN EN LA PESTAÑA "Tasks", SE DEBE PRESIONAR "RUN" PARA GUARDARLOS
_____________________________________________________________________
CONTACTO: FRANCISCO.JARA@UCHILE.CL
ESTE PRODUCTO ESTA EN EVALUACION POR LO DEBE USUARSE BAJO SU PROPIA RESPONSABILIDAD
GEE TIENE UN RETRASO DE ACTUALIZACION ENTRE 3-5 DIAS EN LAS IMAGENES MODIS
#####################################################################
*/

//################INPUTS################

var BASIN_NAMES=['ACHIBUENO','ANCOA','LONGAVI','LONTUE','MAULE','MELADO'];
for (var i = 0; i < BASIN_NAMES.length; i++) { 
  var BASIN_NAME=BASIN_NAMES[i];
  print(BASIN_NAME)
  var shapefile_name="users/franciscojara/shapefiles/"+BASIN_NAME+"_4326_GEE";
  var ppd_filename = "users/franciscojara/precipitacion/pp_2001_2020_"+BASIN_NAME;
  var Region = ee.FeatureCollection(shapefile_name);
  var ppd = ee.FeatureCollection(ppd_filename);

  var start = ee.Date('2021-01-01');
  var finish = ee.Date('2022-01-01');  
  var BOOLEAN_TIMESERIES_CHART=false;
  
//_________________ MAIN __________________

//obtener series de tiempo de Terra y Aqua
var Terra = ee.ImageCollection("MODIS/006/MOD10A1");// inicio 2000-feb-24
var Aqua = ee.ImageCollection("MODIS/006/MYD10A1"); //inicio 2002-jul-04


ppd=ppd.sort('system:time_start').filterDate(start,finish); //SERIE DE PRECIPITACION



ppd=ppd.map(function(feature){
    var num = ee.Number.parse(feature.get('precipitacion'));
    var date = ee.Date(feature.get('system:time_start'));
    return feature.set('system:time_start', date), feature.set('precipitacion', num);
    });
    
//################ Pre-procesamiento ################
//filtrar para la fecha requerida
var Terra_filt = Terra.filterDate(start,finish);
var Aqua_filt = Aqua.filterDate(start,finish);


//plotear serie de tiempo de la precipitacion
var graph = ui.Chart.feature.byFeature(ppd, 'system:time_start', 'precipitacion');
//print(graph.setChartType("LineChart")
//           .setOptions({vAxis: {title: 'pp [mm]'},
//                        hAxis: {title: 'Fecha'}}));     

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

//################ PASO 0: UNIR AQUA Y TERRA ################
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

//################ PASO 1: RELLENO TEMPORAL ################
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
    var dmas_p = dia.advance(4,'day');// solo se promedia dias hacia adelante
    var diascercanos_pp= modis0.filterDate(dia,dmas_p);
    imageSnow = diascercanos_pp.mean();
    }
    else {//si NO hay precipitacion
    //Si pp(dia)=0
    var dmenos = dia.advance(-5,'day'); //dias hacia atrás para el promedio temporal
    var dmas = dia.advance(5,'day'); //dias hacia adelante para el promedio temporal
    var diascercanos_notpp= modis0.filterDate(dmenos,dmas);
    imageSnow = diascercanos_notpp.mean();
    }
    //reemplazar valores faltantes
    return ee.ImageCollection([image.float(), imageSnow.float()]).reduce(ee.Reducer.firstNonNull())
    .copyProperties(image, ['system:time_start']);
};
//Aplicar funcion para obtener relleno
var modis1 = modis0.map(temporalSnow);

//################ PASO 2: RELLENO ESPACIAL################
//Rellenar con el promedio de los 8 pixeles cercanos. Itera varias veces
var spatialFill = function (image) {
  var temp = ee.Image().clip(Region);
  var unmasked = image.unmask(temp);
  var filled = unmasked.focal_mean(500, 'square', 'meters', 4); // aca se repite 4 veces el proceso
  var join = filled.blend(unmasked).copyProperties(image, ['system:time_start']);
  return join;
};
var modis2 = modis1.map(spatialFill);
modis2 = modis2.map(function(image){return image.clip(Region)});

//################ PASO3: SERIE DE TIEMPO DEL PROMEDIO ESPACIAL################
var createTS = function(img){
  var date = img.get('system:time_start');
  var value = img.reduceRegion(ee.Reducer.mean(), Region,500);
  var ft = ee.Feature(null, {'system:time_start': date, 
                             'date': ee.Date(date).format('Y/M/d'), 
                             'value': value.get("NDSI_Snow_Cover_first")});
  return ft;
};

var serie_tiempo_modis2 = modis2.map(createTS);

//################ PASO 4: EXPORTAR################
var today = new Date().toISOString().slice(0, 10).replace("-","_").replace("-","_");
var hora= new Date().toTimeString().slice(0,5).replace(":","","/g");
today=today+'_'+hora;


// PLOTEAR SERIE DE TIEMPO
if(BOOLEAN_TIMESERIES_CHART){
var graph = ui.Chart.feature.byFeature(serie_tiempo_modis2, 'system:time_start', 'value');
print(graph.setChartType("LineChart")
           .setOptions({vAxis: {title: 'fSCA [%]'},
                        hAxis: {title: 'Fecha'}})); 
}

//EXPORTAR SERIE DE TIEMPO FSCA
Export.table.toDrive({collection: serie_tiempo_modis2,
                      folder: "GEE",
                      selectors: 'date, value',
                      fileFormat: 'CSV',
                      description: 'TimeSeries_fsca_'+today,
                      fileNamePrefix: 'TimeSeries_fsca_'+BASIN_NAME+'_'+today,
});

}
print(modis2)

//################ PLOTEAR UN DIA DE EJEMPLO ################
var snowCoverVis = {min: 0.0, max: 100.0, palette: ['black','0524ff', '0dffff','ffffff']}; // Visualizacion para el mapa
Map.addLayer(modis2.filterDate(ee.Date('2021-01-04')).first(), snowCoverVis, '11-04');
Map.addLayer(modis2.filterDate(ee.Date('2021-04-05')).first(), snowCoverVis, '11-05');
Map.addLayer(modis2.filterDate(ee.Date('2021-05-08')).first(), snowCoverVis, '');