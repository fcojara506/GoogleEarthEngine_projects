
var Start_period = ee.Date('2000-01-01');
var End_period   = ee.Date(new Date().getTime());

Map.setOptions('TERRAIN');
Map.setCenter(-71, -35.8,9.5);
Map.setLocked(false,9,24);
var subset       = Map.getBounds(false);

var Region1      = ee.FeatureCollection("users/franciscojara/MAULE/Cuencas_Maule").geometry();
var Region2      = ee.FeatureCollection('users/franciscojara/MAULE/estaciones_norte_2021').geometry();
var Region3      = ee.FeatureCollection('users/franciscojara/MAULE/estaciones_sur_2021').geometry();

var map_Region1  = ui.Map.Layer(Region1,{color: 'black' , fillColor: 'blue'}, 'Cuencas', true, 0.65);
var map_Region2  = ui.Map.Layer(Region2,{color: 'red'},'Sur',true,1);
var map_Region3  = ui.Map.Layer(Region3,{color: 'red'},'Norte',true,1);
  
 
function renderSlider(dates) {
  //print(dates)
  var slider = ui.DateSlider({
    start: dates.start.value, 
    end: dates.end.value, 
    period: 1, // Every 5 days
    onChange: renderDateRange,
  })
  Map.add(slider)
  slider.setValue(End_period.advance(-2,'days'));

}
function renderDateRange(dateRange) {

  var dataset_sentinel2 = ee.ImageCollection('COPERNICUS/S2_SR')
                  .filterDate(dateRange.start(),dateRange.end())
                  .select('MSK_SNWPRB')
                  .map(function(img){return img.updateMask(img.gt(0))})
                  .mean()
                  
  var dataset_sentinel3 = ee.ImageCollection('COPERNICUS/S3/OLCI')
                  //.filterBounds(subset)
                  .filterDate(dateRange.start(),dateRange.end())
                  .select(['Oa08_radiance', 'Oa06_radiance', 'Oa04_radiance'])
                  .mean()
                  .multiply(ee.Image([0.00876539, 0.0123538, 0.0115198]))
 // MAKE PANELS

  var layer_sentinel2 = ui.Map.Layer(dataset_sentinel2,{min: 0,max: 100.0,palette: ['fcbf49','98c1d9', '118ab2','d00000'],},"Sentinel 2 (prob. nieve)");
  var layer_sentinel3 = ui.Map.Layer(dataset_sentinel3,{min: 0,max: 3,gamma: 2,},"Sentinel 3");
  
  Map.layers().reset([layer_sentinel3,layer_sentinel2,map_Region1,map_Region2,map_Region3])

  
}
ee.Dictionary({start: Start_period, end: End_period}).evaluate(renderSlider);