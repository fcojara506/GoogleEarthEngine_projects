Map.add(ui.Label("Loading..."));

// Define region
var Region2 = ee.FeatureCollection('users/franciscojara/MAULE/estaciones_maule_2021');

var Region_buffer100m = createBuffer(Region2, 100);
var Region_buffer1000m = createBuffer(Region2, 1000).geometry().dissolve();

var Start_period = ee.Date('2020-01-01');
var End_period = ee.Date(Date.now());
var initial_value = ee.Date('2020-06-26');

var sentinel2 = getImageCollection(initial_value, 3, Region_buffer1000m);

// Name of the legend for legend in UI Panel
var names_legend = ['(0 , 25]','(25 - 50]','(50 - 75]','(75 - 100]'];
var palette =['001d3d','0077b6','00b4d8','ade8f4']; 

var names       = Region2.aggregate_array("Nombre");

// FUNCTIONS
function createBuffer(featureCollection, distance) {
  return featureCollection.map(function (feature) {
    return feature.buffer(distance);
  });
}


function getImageCollection(initialDate, advanceDays, bufferedRegion) {
  return ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .select('MSK_SNWPRB')
    .filterBounds(bufferedRegion)
    .filterDate(initialDate, initialDate.advance(advanceDays, 'days'))
    .filterMetadata('CLOUDY_PIXEL_PERCENTAGE', 'less_than', 50) // Filter based on cloud cover percentage
    .map(function (img) { return img.updateMask(img.gt(0)); })
    .mean();
}

function removeLayer(name,map) {
  var layers = map.layers();
  // list of layers names
  var names = [];
  layers.forEach(function(lay) {
    var lay_name = lay.getName();
    names.push(lay_name);
  });
  // get index
  var index = names.indexOf(name);
  if (index > -1) {
    // if name in names
    var layer = layers.get(index);
    map.remove(layer);
  } else {
    print('Layer '+name+' not found');
  }
}

function addImageToMaps(image, style, name, maps) {
  if (maps.length === 0) {
    for (var i = 0; i < 7; i++) {
      var name_station = names.get(i);
      var coords = Region2.filter(ee.Filter.eq('Nombre', name_station)).first();
      var roi = coords.geometry().buffer(1000); // Buffer of 1 km around the coords
      
      var map = ui.Map();
      map.setOptions('TERRAIN');
      var label_name = ui.Label('Loading...');
      label_names.push(label_name);
      map.add(label_name); // add label to each map
      map.setControlVisibility(false); // show map layers
      
      // Clip the image to the region of interest (ROI) and add it to the map
      map.addLayer(image.clip(roi), style, name);
      
      var xMarker = coords.geometry().buffer(1); // Create a closer buffer around the point coords
      map.addLayer(xMarker, {color: 'red'}, 'X Marker');
      map.addLayer(Region_buffer100m, {color: 'green', pointShape: 'diamond', pointSize: 100}, 'Puntos', true, 1); // add points
      map.centerObject(coords, 14); // center to the point
      map.setLocked(false, 13, 21);
      maps.push(map); // save each map
    }
  } else {
    for (var j = 0; j < 7; j++) {
      map = maps[j];
      removeLayer('Puntos',map)
      removeLayer(name,map)
  
      name_station = names.get(j);
      coords = Region2.filter(ee.Filter.eq('Nombre', name_station)).first();
      roi = coords.geometry().buffer(1000); // Buffer of 1 km around the coords

      map.addLayer(image.clip(roi), style, name);
      xMarker = coords.geometry().buffer(1); // Create a closer buffer around the point coords
      map.addLayer(xMarker, {color: 'red'}, 'X Marker');
      //map.addLayer(image.clip(roi).resample('bicubic'), style, name); // Add resampled image
      
      
      map.addLayer(Region_buffer100m, {color: 'green', pointShape: 'diamond', pointSize: 100}, 'Puntos', true, 1); // add points
    }
  }
  return maps;
}

 function get_snow_value(dataset) {
    // cast Feature
    var nested_get_value=function(f){
    var station_name = ee.String(f.get('Nombre'))
    var newf = ee.Feature(f)
    var value = dataset.reduceRegion(ee.Reducer.first(), f.geometry(), 100).get('MSK_SNWPRB')
    var roundedValue = ee.Number(value).format('%.1f');
    
    var value2 = ee.Algorithms.If(value, roundedValue, "NA")

    var new_labeled= station_name.cat(' (').cat(value2).cat("%)")
    var val=ee.Feature(newf.set('new_label',new_labeled))
    return val
    }
    return nested_get_value              
  }
  

//https://gis.stackexchange.com/questions/315537/print-and-ui-label-return-different-strings-in-console-and-in-the-ui-in-goog
  function change_label(label_name,j){
    var new_label=new_labels.get(j);
    new_label.evaluate(function(newlabel){label_name.setValue(newlabel)} );
  }

function renderDateRange(dateRange) {
  //print(dateRange)
  var dataset_sentinel2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                  .filterBounds(Region_buffer1000m) // Filter by buffered region
                  .filterDate(dateRange.start(),dateRange.end())
                  .select('MSK_SNWPRB')
                  .map(function(img){return img.updateMask(img.gt(0))})
                  .mean()
  print(dateRange)
                  
 // MAKE PANELS
  new_labels=Region2.map(get_snow_value(dataset_sentinel2)).aggregate_array("new_label");
  addImageToMaps(dataset_sentinel2,{min: 0,max: 100.0,palette: palette,},"Sentinel 2",maps);
  label_names.map(change_label)
}


var label_names=[];
var maps=addImageToMaps(sentinel2,{min: 0,max: 100.0,palette: palette,},"Sentinel 2",[]);
var new_labels = Region2.map(get_snow_value(sentinel2)).aggregate_array("new_label");
label_names.map(change_label)



var slider = ui.DateSlider({
  start: Start_period,
  end: End_period,
  period: 3, // Every n days
  value: initial_value,
  onChange: renderDateRange,
  style: {
  width:'90%',
  whiteSpace:'nowrap',
  stretch: 'horizontal',
  position:'top-right',
  margin : '10px',
  backgroundColor: 'rgba(255, 255, 255, 0)',
  color:'red'
  },
  });
  


// Set position of panel
var legend = ui.Panel({style: {position: 'bottom-left',
padding: '8px 15px',
backgroundColor: 'rgba(255, 255, 255, 0)',}});
// Create legend title
var legendTitle = ui.Label({
  value: 'Snow presence probability \n (%)',
  style: {
    fontWeight: 'bold',
    fontSize: '14px',
    margin: '0 0 4px 0',
    padding: '0',
    backgroundColor: 'rgba(255, 255, 255, 0.7)'
    }
});
legend.add(legendTitle);

var makeRow = function(color, name) {
      // Create the label that is actually the colored box.
      var colorBox = ui.Label({style: {backgroundColor: '#' + color,
      padding: '8px',
      margin: '0 0 4px 0'}});
      
      var description = ui.Label({value: name,style: {margin: '0 0 4px 6px',backgroundColor: 'rgba(255, 255, 255, 0.7)',}});
      return ui.Panel({widgets: [colorBox, description],
      layout: ui.Panel.Layout.Flow('horizontal'),
      style: {backgroundColor: 'rgba(255, 255, 255, 0.5)',}
      }
      );};
      
for (var i = 0; i < names_legend.length; i++) {
  legend.add(makeRow(palette[i], names_legend[i]));
  }
  // Add the title to the panel

var rectangle_outbounds = ee.Feature(Region_buffer1000m.bounds());
var additionalMap = ui.Map();
additionalMap.setOptions('TERRAIN');
additionalMap.addLayer(rectangle_outbounds, {color: 'red'}, 'outbounds');
additionalMap.centerObject(rectangle_outbounds, 3);
additionalMap.setControlVisibility(false);
additionalMap.setLocked(true, 3, 4);

maps[3].add(legend);
//maps[3].setControlVisibility(true);
var mapGrid = ui.Panel(
    [
      ui.Panel([slider, maps[3]], null, {stretch: 'both'}),
      ui.Panel([maps[0], maps[4]], null, {stretch: 'both'}),
      ui.Panel([maps[1], maps[5]], null, {stretch: 'both'}),
      ui.Panel([maps[2], maps[6]], null, {stretch: 'both'}),
      ui.Panel([additionalMap], null, {stretch: 'vertical'}),
    ],
    ui.Panel.Layout.Flow('horizontal'), {stretch: 'both'});
    
ui.Map.Linker(maps, "change-zoom")



var title = ui.Label('Probability of snow presence at meteorological stations in the Maule Region, Chile',
{stretch: 'horizontal', textAlign: 'center', fontWeight: 'normal', fontSize: '24px'});

var shortDescription = 'Product derived from Sentinel 2 satellite imagery (10 m resolution). Cloud cover might affects reliability of the product. The average probability of snow around 100m radius (green circles) is shown next to each station. Red circles around stations are 1m radius (zoom in!). Left menu allows date selection from 01-01-2020 to the near present (typically 3 days).';

var combinedSubtitle = ui.Label({
  value: shortDescription,
  style: {
    margin: '0px 0px 4px 10px',
    whiteSpace: 'normal'
  }
});


var subtitle6 = ui.Label({
  value: 'Created by Francisco Jara. University of Chile (2021). Source code available on: https://github.com/fcojara506/GoogleEarthEngine_projects',
  style: {
    margin: '0px 0 0px 10px',
    color: 'blue', // Optional: Set the color to blue to make it look like a link
  }
});
subtitle6.setUrl('https://github.com/fcojara506/GoogleEarthEngine_projects');

ui.root.widgets().reset([title, combinedSubtitle, mapGrid, subtitle6]);
ui.root.setLayout(ui.Panel.Layout.Flow('vertical'));

