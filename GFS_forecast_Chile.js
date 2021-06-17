///////////////////////////////////////////////////////////////////////////////////////////////////
// Download rainfall forecast for 1 - 5 days ahead from NOAA GFS
//
// Benny Istanto | Earth Observation and Climate Analyst | benny.istanto@wfp.org
// Francisc Jara | University of Chile
///////////////////////////////////////////////////////////////////////////////////////////////////

//https://webcache.googleusercontent.com/search?q=cache:1mQBzuN_6VUJ:https://benny.istan.to/blog/20210416-how-to-get-daily-rainfall-forecast-data-from-gfs-part-2+&cd=2&hl=en&ct=clnk&gl=cl&client=ubuntu
 
// Center of the map
Map.setCenter(-71, -35.8,5);
Map.setOptions('TERRAIN')

var Region1 = ee.FeatureCollection("users/franciscojara/MAULE/Cuencas_Maule").geometry();
var Region2 = ee.FeatureCollection('users/franciscojara/MAULE/estaciones_norte_2021').geometry();
var Region3 = ee.FeatureCollection('users/franciscojara/MAULE/estaciones_sur_2021').geometry();

var map_Region1 = ui.Map.Layer(Region1, {color: 'black' , fillColor: 'blue'}, 'Cuencas', true, 0.65);
var map_Region2 = ui.Map.Layer(Region2,{color: 'red'},'Sur',true,1);
var map_Region3 = ui.Map.Layer(Region3,{color: 'red'},'Norte',true,1);
// Strip time off current date/time
var d = new Date();
var today = ee.Date(d);
print(d); // Print date for latest GFS data

// GFS Dataset Availability:
// https://developers.google.com/earth-engine/datasets/catalog/NOAA_GFS0P25#citations
var start_period = ee.Date('2019-07-01'); // First GFS data 1 Jul 2015

// MAIN INPUT
//---
// Import GFS data - https://developers.google.com/earth-engine/datasets/catalog/NOAA_GFS0P25
// 24-hours/1-day forecast from selected date
var GFS0P25_1day = ee.ImageCollection('NOAA/GFS0P25')
  .select('total_precipitation_surface')
  .filterMetadata('forecast_hours', 'equals', 24);

// 48-hours/2-day forecast from selected date
var GFS0P25_2day = ee.ImageCollection('NOAA/GFS0P25')
  .select('total_precipitation_surface')
  .filterMetadata('forecast_hours', 'equals', 48);

// 72-hours/3-day forecast from selected date 
var GFS0P25_3day = ee.ImageCollection('NOAA/GFS0P25')
  .select('total_precipitation_surface')
  .filterMetadata('forecast_hours', 'equals', 72);

// 96-hours/4-day forecast from selected date
var GFS0P25_4day = ee.ImageCollection('NOAA/GFS0P25')
  .select('total_precipitation_surface')
  .filterMetadata('forecast_hours', 'equals', 96);

// 120-hours/5-day forecast from selected date
var GFS0P25_5day = ee.ImageCollection('NOAA/GFS0P25')
  .select('total_precipitation_surface')
  .filterMetadata('forecast_hours', 'equals', 120);



// Define an SLD style of discrete intervals to apply to the image.
// Notes: SLD visualisation will make the data rendered as RGB during point inspector into a pixel.
var visRainForecastSLD =
  '<RasterSymbolizer>' +
    '<ColorMap  type="ramp" extended="false" >' +
      '<ColorMapEntry color="#ffffff" opacity="0.0" quantity="1" label="No Rain" />' +
      '<ColorMapEntry color="#9bf6ff" opacity="0.7" quantity="10" label="1-10" />' +
      '<ColorMapEntry color="#14213d" opacity="0.7" quantity="30" label="10-30" />' +
      '<ColorMapEntry color="#d00000" opacity="0.7" quantity="100" label="&gt; 30" />' +
    '</ColorMap>' +
  '</RasterSymbolizer>'; 
  
// Name of the legend for legend in UI Panel
var names = [
  '<=1',
'(1 - 10]',
'(10 - 30]',
'> 30'];

var palette =[
"ffffff", 
"9bf6ff",
"14213d",
"d00000"]; 


// INITIAL PROCESS WHEN MAP LOADED
//---
// Add today's GFS data to the map
var gfs1day = GFS0P25_1day    
      .filterDate(today.advance(-1, 'day'), today)
      .median(); // make a composite of the collection
var layer1day = ui.Map.Layer(gfs1day.sldStyle(visRainForecastSLD),{},'GFS 1-day', true);
// var layer1day = ui.Map.Layer(gfs1day,visRainForecast,'GFS 1-day', true);

var gfs2day = GFS0P25_2day    
      .filterDate(today.advance(-1, 'day'), today)
      .median(); // make a composite of the collection
var layer2day = ui.Map.Layer(gfs2day.sldStyle(visRainForecastSLD),{},'GFS 2-day', false);
// var layer2day = ui.Map.Layer(gfs2day,visRainForecast,'GFS 2-day', false);

var gfs3day = GFS0P25_3day    
      .filterDate(today.advance(-1, 'day'), today)
      .median(); // make a composite of the collection
var layer3day = ui.Map.Layer(gfs3day.sldStyle(visRainForecastSLD),{},'GFS 3-day', false);
// var layer3day = ui.Map.Layer(gfs3day,visRainForecast,'GFS 3-day', false);

var gfs4day = GFS0P25_4day    
      .filterDate(today.advance(-1, 'day'), today)
      .median(); // make a composite of the collection
var layer4day = ui.Map.Layer(gfs4day.sldStyle(visRainForecastSLD),{},'GFS 4-day', false);
// var layer4day = ui.Map.Layer(gfs4day,visRainForecast,'GFS 4-day', false);

var gfs5day = GFS0P25_5day    
      .filterDate(today.advance(-1, 'day'), today)
      .median(); // make a composite of the collection
var layer5day = ui.Map.Layer(gfs5day.sldStyle(visRainForecastSLD),{},'GFS 5-day', false);
// var layer5day = ui.Map.Layer(gfs5day,visRainForecast,'GFS 5-day', false);
  
// Reset all layers
Map.layers().reset([layer1day,layer2day,layer3day,layer4day,layer5day,map_Region1,map_Region2,map_Region3]);



// Render date range function
function renderDateRange(dateRange) {
  var gfs1day = GFS0P25_1day
      .filterDate(dateRange.start(), dateRange.end())
      .median(); // make a composite of the collection
  
  var gfs2day = GFS0P25_2day
      .filterDate(dateRange.start(), dateRange.end())
      .median(); // make a composite of the collection      

  var gfs3day = GFS0P25_3day
      .filterDate(dateRange.start(), dateRange.end())
      .median(); // make a composite of the collection
      
  var gfs4day = GFS0P25_4day
      .filterDate(dateRange.start(), dateRange.end())
      .median(); // make a composite of the collection
      
  var gfs5day = GFS0P25_5day
      .filterDate(dateRange.start(), dateRange.end())
      .median(); // make a composite of the collection      
  
  // Load the image into map
  var layer1day = ui.Map.Layer(gfs1day.sldStyle(visRainForecastSLD),{},'GFS 1-dia', true);
  var layer2day = ui.Map.Layer(gfs2day.sldStyle(visRainForecastSLD),{},'GFS 2-dia', false);
  var layer3day = ui.Map.Layer(gfs3day.sldStyle(visRainForecastSLD),{},'GFS 3-dia', false);
  var layer4day = ui.Map.Layer(gfs4day.sldStyle(visRainForecastSLD),{},'GFS 4-dia', false);
  var layer5day = ui.Map.Layer(gfs5day.sldStyle(visRainForecastSLD),{},'GFS 5-dia', false);
  

  // Reset all layers
  Map.layers().reset([layer1day,layer2day,layer3day,layer4day,layer5day,map_Region1,map_Region2,map_Region3]);
}



// DATE SLIDER CONFIG
//---
// UI widgets needs client-side data .evaluate() to get client-side values of start and end period
ee.Dictionary({start: start_period, end: today.advance(1, 'day')})
  .evaluate(renderSlider);

// Slider function
function renderSlider(dates) {
  var slider = ui.DateSlider({
    start: dates.start.value, 
    end: dates.end.value, 
    period: 1, // Every 5 days
    style: {width: '300px', padding: '10px'},
    onChange: renderDateRange
  });
  Map.add(slider);
  slider.setValue(today);
}



// Legend
// Set position of panel
var legend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px 15px'
  }
});
 
// Create legend title
var legendTitle = ui.Label({
  value: 'Pronóstico de precipitación GFS (mm/dia)',
  style: {
    fontWeight: 'bold',
    fontSize: '14px',
    margin: '0 0 4px 0',
    padding: '0'
    }
});
// Add the title to the panel
legend.add(legendTitle);
 
// Creates and styles 1 row of the legend.
var makeRow = function(color, name) {
 
      // Create the label that is actually the colored box.
      var colorBox = ui.Label({
        style: {
          backgroundColor: '#' + color,
          // Use padding to give the box height and width.
          padding: '8px',
          margin: '0 0 4px 0'
        }
      });
 
      // Create the label filled with the description text.
      var description = ui.Label({
        value: name,
        style: {margin: '0 0 4px 6px'}
      });
 
      // return the panel
      return ui.Panel({
        widgets: [colorBox, description],
        layout: ui.Panel.Layout.Flow('horizontal')
      });
};


// Add color and and names
for (var i = 0; i < names.length; i++) {
  legend.add(makeRow(palette[i], names[i]));
  }  
 

 
// Add legend to map 
Map.add(legend);



// Subset for downloading data
var rectangle_RBB = ee.Geometry.Rectangle(60, -80, 180, 80);
var bbox_RBB = ee.Feature(rectangle_RBB).geometry();


/*
// Export the result to Google Drive
Export.image.toDrive({
  image:gfs1day,
  description:'GFS-1day',
  folder:'GEE_GFS',
  scale:5600,
  region:bbox_RBB,
  maxPixels:1e12
});

Export.image.toDrive({
  image:gfs2day,
  description:'GFS-2day',
  folder:'GEE_GFS',
  scale:5600,
  region:bbox_RBB,
  maxPixels:1e12
});

Export.image.toDrive({
  image:gfs3day,
  description:'GFS-3day',
  folder:'GEE_GFS',
  scale:5600,
  region:bbox_RBB,
  maxPixels:1e12
});

Export.image.toDrive({
  image:gfs4day,
  description:'GFS-4day',
  folder:'GEE_GFS',
  scale:5600,
  region:bbox_RBB,
  maxPixels:1e12
});

Export.image.toDrive({
  image:gfs5day,
  description:'GFS-5day',
  folder:'GEE_GFS',
  scale:5600,
  region:bbox_RBB,
  maxPixels:1e12
});
*/

// End of script