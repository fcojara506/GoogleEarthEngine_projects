var today = ee.Date(new Date());
var inicio = today.advance(-4, 'day')
var final = today

var maskSNOW = function(image){
  var snowCov = image.select('NDSI_Snow_Cover');//.clip(Region)
  var QA = image.select('NDSI_Snow_Cover_Basic_QA');//.clip(Region)
  var mask = QA.lte(2); //Calidad de la muestra
  //0: Best,  1: Good, 2: Ok, 3: Poor - not currently in use, 211: Night 239: Ocean
  var mask2=snowCov.gt(0); // limitar a valor mayores que 0
  return snowCov.updateMask(mask).updateMask(mask2); //enmascara snowcov
};

var spatialFill = function (image) {
  var filled = image.focal_median(0.7, 'octagon', 'pixels', 2); // aca se repite 3 veces el proceso
  return filled;
};

var avgImages = function (feature) {
  var avg = ee.ImageCollection([feature.get('primary'), feature.get('secondary')])
  .mean()
  .copyProperties(feature.get('primary'), ['system:time_start', 'system:index'])
  return avg;
}

var filterTime = ee.Filter.equals(
  {leftField: 'system:time_start',
  rightField: 'system:time_start'});


var dataset_aqua = ee.ImageCollection('MODIS/006/MYD10A1')
                  .filterDate(inicio, final)
                  .map(maskSNOW)
                  
                  
var dataset_terra = ee.ImageCollection('MODIS/006/MOD10A1')
                  .filterDate(inicio, final)
                  .map(maskSNOW)
                  
var dataset_modis = ee.ImageCollection(
  ee.Join.inner()
  .apply(dataset_terra,dataset_aqua, filterTime))
  .map(avgImages)
  .map(spatialFill)
  .mean()
  .visualize({min: 0,max: 100.0,palette: ['0dffff', '0524ff', 'ffffff'],})
  ;

var dataset_sentinel3 = ee.ImageCollection('COPERNICUS/S3/OLCI')
                  .filterDate(inicio, final)
                  .select(['Oa08_radiance', 'Oa06_radiance', 'Oa04_radiance'])
                  .mean()
                  .multiply(ee.Image([0.00876539, 0.0123538, 0.0115198]))
                  .visualize({min: 0,max: 3,gamma: 2,});

var images = {
 'MODIS Cobertura Nival': dataset_modis,
 'Sentinel3': dataset_sentinel3,
};

// Create the left map, and have it display layer 0.
var leftMap = ui.Map();
//leftMap.setControlVisibility(false);
var leftSelector = addLayerSelector(leftMap, 0, 'top-left');
// Create the right map, and have it display layer 1.
var rightMap = ui.Map();
//rightMap.setControlVisibility(false);
var rightSelector = addLayerSelector(rightMap, 1, 'top-right');
// Adds a layer selection widget to the given map, to allow users to change
// which image is displayed in the associated map.
function addLayerSelector(mapToChange, defaultValue, position) {
  //var label = ui.Label('Cambiar base de datos:');
  //var label = ui.Label(Object.keys(images));
  // This function changes the given map to show the selected image.
  function updateMap(selection) {
    mapToChange.layers().set(0, ui.Map.Layer(images[selection]));
    //mapToChange.addLayer(images[selection], {min: 0,max: 6,gamma: 1.5,});
    mapToChange.setOptions('HYBRID');
  }
  // Configure a selection dropdown to allow the user to choose between images,
  // and set the map to update when a user makes a selection.
  var select = ui.Select(
    {items: Object.keys(images),
    onChange: updateMap,
    });
  select.setValue(Object.keys(images)[defaultValue], true);

  var controlPanel =ui.Panel({widgets: [select], 
  style: {
    position: position, 
    backgroundColor: 'blue',
    padding: '0px',
    fontSize: '40px',
    fontWeight:100
  }
  });

  mapToChange.add(controlPanel);
}

// Create a SplitPanel to hold the adjacent, linked maps.
var splitPanel = ui.SplitPanel({
  firstPanel: leftMap,
  secondPanel: rightMap,
  wipe: true,
  style: {stretch: 'both'}
});

// Set the SplitPanel as the only thing in the UI root.
ui.root.widgets().reset([splitPanel]);
var linker = ui.Map.Linker([leftMap, rightMap]);
leftMap.setCenter(-70, -35.5, 6);



var clipmap = function(image){return image.clip(rectangle)};
var rectangle = ee.Geometry.Rectangle([-76, -18, -67, -55]);
var doy_today =today.getRelative('day', 'year');
var woy_today =today.getRelative('day', 'week');

var doy_today_onwards= today.advance(7, 'day').getRelative('day', 'week')
var doy_today_backwards= today.advance(-7, 'day').getRelative('day', 'week')



var ndvi_aqua = ee.ImageCollection('MODIS/006/MYD10A1')
                  .map(maskSNOW)
                  .filter(ee.Filter.calendarRange(woy_today,woy_today,'day_of_week'));

var ndvi_terra = ee.ImageCollection('MODIS/006/MOD10A1')
                  .map(maskSNOW)
                  .filter(ee.Filter.calendarRange(woy_today,woy_today,'day_of_week'));

var ndvi = ee.ImageCollection(
  ee.Join.inner()
  .apply(ndvi_terra,ndvi_aqua, filterTime))
  .map(avgImages);
  //.map(spatialFill)

print(ndvi)

var ndvi1 = ee.ImageCollection('MODIS/006/MOD10A1')
                  .map(maskSNOW)
                  .filter(ee.Filter.calendarRange(woy_today,woy_today,'day_of_week'));

leftMap.style().set('cursor', 'crosshair');
// Create an empty panel in which to arrange widgets.
// The layout is vertical flow by default.
var panel = ui.Panel({style: {width: '20%'}})
.add(ui.Label('Haz click en el mapa para ver series de tiempos por coordenadas'));
// Set a callback function for when the user clicks the map.
leftMap.onClick(function(coords) {
  // Create or update the location label (the second widget in the panel)
  var location = 'lon: ' + coords.lon.toFixed(2) + ' ' +
                 'lat: ' + coords.lat.toFixed(2);
  panel.widgets().set(1, ui.Label(location));

  // Add a red dot to the map where the user clicked.
  var point = ee.Geometry.Point(coords.lon, coords.lat);
  Map.layers().set(1, ui.Map.Layer(point, {color: 'red'}));
  // Create a chart of NDVI over time.
  //print(ndvi)
  var clip_point= function(image){return image.clip(point)}
  var ndvi_clip=ndvi.map(clip_point)
  
  var chart = ui.Chart.image.series(ndvi_clip, point, ee.Reducer.mean(), 500)
      .setOptions({
        title: 'Cobertura en años anteriores en la misma fecha (+-20 días)',
        vAxis: {title: 'Cobertura nieve NDVI MODIS'},
        lineWidth: 1,
        pointSize: 3,
      });
      
  var chart2=ui.Chart.image.doySeriesByYear(
    {imageCollection: ndvi_clip,
    bandName: 'NDSI_Snow_Cover',
    region: point,
    regionReducer: ee.Reducer.mean(),
    scale: 500,
    sameDayReducer: ee.Reducer.mean(),
    startDay: 1,
    endDay:365}
    )
    //.setChartType('ScatterChart')
    .setChartType('LineChart')
    .setOptions({
                  title: 'Cobertura nival en años anteriores',
                  hAxis: {
                    title: 'Día del año',
                    titleTextStyle: {italic: false, bold: true}
                  },
                  vAxis: {
                    title: 'Cobertura nival (%)',
                    titleTextStyle: {italic: false, bold: true}
                  },
                  lineWidth: 1,
                  colors: [
                    'gray',
                    'gray',
                    'gray',
                    'gray',
                    'gray',
                    'gray',
                    'gray',
                    'gray',
                    'gray',
                    'gray',
                    'gray',
                    'gray',
                    'gray',
                    'gray',
                    'gray',
                    'gray',
                    'gray',
                    'yellow',
                    '76b349'],
                });


  // Add (or replace) the third widget in the panel by
  // manipulating the widgets list.
  panel.widgets().set(3, chart2);
});

// Add the panel to the ui.root.
ui.root.add(panel);

