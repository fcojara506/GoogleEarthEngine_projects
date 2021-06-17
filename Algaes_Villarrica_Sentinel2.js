 // Version 0 by Nicolás Rondán
 // Version 1 by Francisco Jara 17/06/2021
 var image_collection = ee.ImageCollection("COPERNICUS/S2_SR");
 
 // ===========================================================================================
 // ======================= 1) Filter collection by geography bounds ========================== 
 // ===========================================================================================
 var geometry = /* color: #d63000 */ee.Geometry.Polygon(
    [[[-72.20643005371093, -39.25083386340201],
      [-72.24179229736328, -39.267581260592515],
      [-72.21775970458984, -39.29920431607211],
      [-71.97194061279296, -39.31275268327373],
      [-71.95923767089843, -39.227965879105184],
      [-72.05021820068359, -39.20854883427944],
      [-72.06944427490234, -39.19923738770367],
      [-72.1113296508789, -39.21147503398173],
      [-72.18617401123046, -39.19870526776023],
      [-72.20334014892578, -39.21200705719137]]]);
      
 Map.centerObject(geometry, 12);
 
 var filtered_collection = image_collection.filterBounds(geometry);
 
 // ===========================================================================================
 // ======================= 2) Filter collection by dates  ==================================== 
 // ===========================================================================================
var date_with    = ee.Date('2019-02-28');
var date_without = ee.Date('2020-01-01');

 
 var image_with_cyanobacteria = filtered_collection.filterDate(date_with, date_with.advance(1,'days')).first();
 var image_without_cyanobacteria = filtered_collection.filterDate(date_without, date_without.advance(1,'days')).first();
 
 
 // ===========================================================================================
 // ================= 3) Show images in natural colors (RED, GREEN, BLUE) =====================
 // ===========================================================================================
 var natural_colors_bands = ['B4', 'B3', 'B2'];
 
 Map.addLayer(image_with_cyanobacteria, {gamma: 1.3, min: 0, max: 2000, bands: natural_colors_bands}, 'with cyanobacteria (natural color)',true);
 Map.addLayer(image_without_cyanobacteria, {gamma: 1.3, min: 0, max: 2000, bands: natural_colors_bands}, 'without cyanobacteria (natural color)',true);
 
 // ===========================================================================================
 // ========================== 4) Draw workin region Polygon ==================================
 // ===========================================================================================
 
 var empty = ee.Image().byte();
 
 var outline = empty.paint({
   featureCollection: geometry,
   color: 1,
   width: 3
 });
 
 Map.addLayer(outline, {palette: '000000'}, 'Working Zone Polygon', true, 0.5);
 
 // ===========================================================================================
 // ===================== 5) Show images in pseudo-colors (RED, NIR, SWIR) ====================
 // ===========================================================================================
 
 var red_nir_swir = ['B4', 'B8', 'B11'];
 Map.addLayer(image_with_cyanobacteria, {gamma: 1.3, min: 0, max: 2000, bands: red_nir_swir}, 'with cyanobacteria (pseudo color)',false);
 Map.addLayer(image_without_cyanobacteria, {gamma: 1.3, min: 0, max: 2000, bands: red_nir_swir}, 'without cyanobacteria (pseudo color)',false);
 
 var false_color_cyanobacteria = image_with_cyanobacteria.visualize({gamma: 1.3, min: 0, max: 2000, bands: red_nir_swir});
 var false_color_no_cyanobacteria = image_without_cyanobacteria.visualize({gamma: 1.3, min: 0, max: 2000, bands: red_nir_swir});
 
 Export.image.toDrive({
   image: false_color_cyanobacteria,
   description: 'false_color_cyanobacteria',
   scale: 30,
   region: geometry
 });
 
 
 Export.image.toDrive({
   image: false_color_no_cyanobacteria,
   description: 'false_color_no_cyanobacteria',
   scale: 30,
   region: geometry
 });
 
 // ===========================================================================================
 // ============================== 6) Build FAI index =========================================
 // ===========================================================================================
 
 var fai_expression = 'NIR - ((RED * (835 - 1613) + SWIR * (664 - 835))/(664 - 1613))';
 var fai_with_cyanobacteria = image_with_cyanobacteria.expression(
     fai_expression, {
       'NIR': image_with_cyanobacteria.select('B8'),
       'RED': image_with_cyanobacteria.select('B4'),
       'SWIR': image_with_cyanobacteria.select('B11')
 });
 var fai_without_cyanobacteria = image_without_cyanobacteria.expression(
     fai_expression, {
       'NIR': image_without_cyanobacteria.select('B8'),
       'RED': image_without_cyanobacteria.select('B4'),
       'SWIR': image_without_cyanobacteria.select('B11')
 });
 
 Map.addLayer(fai_with_cyanobacteria, {min: -100, max: 100, palette: ['DC143C', '66CDAA']}, 'FAI (Cyanobacteria)',false);
 Map.addLayer(fai_without_cyanobacteria, {min: -100, max: 100, palette: ['DC143C', '66CDAA']}, 'FAI (No cyanobacteria)',false);
 
 
 // ===========================================================================================
 // ================== 7)Maskwater region and generate Cyanobacteria Mask =====================
 // ===========================================================================================
 
 var water_dataset = ee.Image("CIESIN/GPWv411/GPW_Water_Mask");
 var water_mask = water_dataset.select('water_mask');
 var mask = water_mask.eq(3);
 
 var masked_fai_with_cyanobacteria = fai_with_cyanobacteria.updateMask(mask);
 var fai_mask = masked_fai_with_cyanobacteria.gt(0);
 var masked_cyanobacteria = fai_with_cyanobacteria.updateMask(fai_mask); 
 
 Map.addLayer(masked_cyanobacteria, {min: -1, max: 1, palette: ['DC143C', '66CDAA']}, 'Masked (Cyanobacteria)',false);
 