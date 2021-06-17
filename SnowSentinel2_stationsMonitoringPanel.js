Map.add(ui.Label("Cargando..."))

var clipmap = function(image){return image.clip(rectangle)};
var rectangle = ee.Geometry.Rectangle([-76, -18, -67, -55]);

var Start_period = ee.Date('2020-01-01');
var End_period   = ee.Date(Date.now());
var initial_value= End_period.advance(-4,'days')

var sentinel2 = ee.ImageCollection('COPERNICUS/S2_SR')
                  .filterDate(initial_value, End_period)
                  .select('MSK_SNWPRB')
                  .map(function(img){return img.updateMask(img.gt(0))})
                  .mean()

// Name of the legend for legend in UI Panel
var names_legend = ['(0 , 25]','(25 - 50]','(50 - 75]','(75 - 100]'];
//var palette =['ade8f4','00b4d8','0077b6','001d3d']; 
var palette =['001d3d','0077b6','00b4d8','ade8f4']; 

var Region1 = ee.FeatureCollection('users/franciscojara/MAULE/estaciones_maule_2021_buffer100m');
var Region2     = ee.FeatureCollection('users/franciscojara/MAULE/estaciones_maule_2021');
//var map_Region2 = ui.Map.Layer(Region2,{color: 'red'},'Sur',true,1);
var names       = Region2.aggregate_array("Nombre");

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


function addImageToMaps(image,style,name,maps){

if (maps.length===0){
for (var i = 0; i < 7; i++) {
  var name_station = names.get(i);
  var coords       = Region2.filter(ee.Filter.eq('Nombre', name_station)).first();
  var map = ui.Map();
  map.setOptions('HYBRID');
  var label_name=ui.Label('Cargando...');
  label_names.push(label_name)
  map.add(label_name); // add label to each map
  //map.addLayer(sentinel2,{min: 0,max: 100.0,palette: ['fcbf49','98c1d9', '118ab2','d00000'],},'a'); // add a map
  map.setControlVisibility(false); // show map layer ticks
  map.addLayer(image,style,name);
  map.addLayer(Region1,{color: 'green',pointShape: 'diamond', pointSize: 100},'Puntos',true,1); // add points
  map.centerObject(coords,15); // center to the point
  map.setLocked(false,13,24);
  maps.push(map); // save each map
}
}else{
for (var j = 0; j < 7; j++) {
  map=maps[j];
  removeLayer('Puntos',map)
  removeLayer(name,map)
  map.addLayer(image,style,name);
  map.addLayer(Region1,{color: 'green',pointShape: 'diamond', pointSize: 100},'Puntos',true,1); // add points
}
}
return maps;
}


var label_names=[];
var maps=addImageToMaps(sentinel2,{min: 0,max: 100.0,palette: palette,},"Sentinel 2",[]);
var new_labels=Region2.map(get_snow_value(sentinel2)).aggregate_array("new_label");
label_names.map(change_label)

 function get_snow_value(dataset) {
    // cast Feature
    var nested_get_value=function(f){
    var station_name = ee.String(f.get('Nombre'))
    var newf = ee.Feature(f)
    var value = dataset.reduceRegion(ee.Reducer.first(), f.geometry(), 100).get('MSK_SNWPRB')
    var value2=ee.Algorithms.If(value,value,"NA")
    
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
  var dataset_sentinel2 = ee.ImageCollection('COPERNICUS/S2_SR')
                  .filterDate(dateRange.start(),dateRange.end())
                  .select('MSK_SNWPRB')
                  .map(function(img){return img.updateMask(img.gt(0))})
                  .mean()
                  
  /*
  var dataset_sentinel3 = ee.ImageCollection('COPERNICUS/S3/OLCI')
                  //.filterBounds(subset)
                  .filterDate(dateRange.start(),dateRange.end())
                  .select(['Oa08_radiance', 'Oa06_radiance', 'Oa04_radiance'])
                  .mean()
                  .multiply(ee.Image([0.00876539, 0.0123538, 0.0115198]))
 */
 // MAKE PANELS
 
  new_labels=Region2.map(get_snow_value(dataset_sentinel2)).aggregate_array("new_label");
  addImageToMaps(dataset_sentinel2,{min: 0,max: 100.0,palette: palette,},"Sentinel 2",maps);
  label_names.map(change_label)
  //ee.List.sequence(0, 7).map(change_label)
}

var slider = ui.DateSlider({
  start: Start_period,
  end: End_period,
  period: 3, // Every 5 days
  value: initial_value,
  onChange: renderDateRange,
  style: {
  width:'90%',
  whiteSpace:'nowrap',
  stretch: 'horizontal',
  position:'top-right',
  margin : '10px'
  },
  });
  


// Set position of panel
var legend = ui.Panel({style: {position: 'top-left',
padding: '8px 15px',
backgroundColor: 'rgba(255, 255, 255, 0)',}});
// Create legend title
var legendTitle = ui.Label({
  value: 'Probabilidad de nieve \n (%)',
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

maps[3].add(legend);
//maps[3].setControlVisibility(true);

var mapGrid = ui.Panel(
    [
      ui.Panel([slider,maps[3]], null, {stretch: 'both'}),
      ui.Panel([maps[0], maps[4]], null, {stretch: 'both'}),
      ui.Panel([maps[1], maps[5]], null, {stretch: 'both'}),
      ui.Panel([maps[2], maps[6]], null, {stretch: 'both'})
      ],
    ui.Panel.Layout.Flow('horizontal'), {stretch: 'both'});

ui.Map.Linker(maps, "change-zoom")

var title = ui.Label('Probabilidad de presencia de nieve en estaciones meteorológicas Región del Maule',
{stretch: 'horizontal', textAlign: 'center', fontWeight: 'normal', fontSize: '24px'});

var subtitle1 = ui.Label({value:'Producto derivado de imágenes satelitales Sentinel 2 (resolución 10 m). La nubosidad puede afectar significativamente la confiabilidad.', style: {margin: '0px 0px 4px 10px'}});
var subtitle2 = ui.Label({value:'La probabilidad asociada a cada estación aparece al costado del nombre. NA% indica ausencia o indetección.', style: {margin: '0 0 4px 10px'}});
var subtitle3 = ui.Label({value:'Los rectángulos enmarcan una región de 0.001°(aprox. 100m) entorno a cada estación.', style: {margin: '0 0 4px 10px'}});
var subtitle4 = ui.Label({value:'El menú de la izquierda permite especificar las fechas entre 01-01-2000 y el presente cercano.', style: {margin: '0 0 4px 10px'}});
var subtitle5 = ui.Label({value:'La imagen de fondo corresponde al mapa base de Google Maps Satellite (Anacrónico).', style: {margin: '0px 0 0px 10px'}});

ui.root.widgets().reset([title,subtitle1,subtitle2,subtitle3,subtitle4,subtitle5, mapGrid]);
ui.root.setLayout(ui.Panel.Layout.Flow('vertical'));
  

