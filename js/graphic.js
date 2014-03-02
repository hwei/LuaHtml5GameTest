var Graphic = function (context, width, height, image_dict) {

function _Layer() {
  this.batch_list = [];
  this.x = 0;
  this.y = 0;
}

_Layer.prototype.CreateBatch = function (texture_id) {
  var batch = new _Batch(texture_id);
  var batch_id = batch_count + 1;
  batch_dict[batch_id] = batch;
  this.batch_list.push(batch);
  batch_count += 1;
  return batch_id;
};

_Layer.prototype.Position = function (x, y) {
  this.x = x;
  this.y = y;
};

_Layer.prototype.Draw = function () {
  var batch_list = this.batch_list;
  for(var i in batch_list) {
    batch_list[i].Draw(this.x, this.y);
  }
};

function _Batch(texture_id) {
  this.texture_id = texture_id;
  this.tile_list = [];
}

_Batch.prototype.CreateTile = function () {
  var tile = new _Tile();
  var tile_id = tile_count + 1;
  tile_dict[tile_id] = tile;
  this.tile_list.push(tile);
  tile_count += 1;
  return tile_id;
};

_Batch.prototype.Draw = function (base_x, base_y) {
  var tile_list = this.tile_list;
  for (var i in tile_list) {
    tile_list[i].Draw(base_x, base_y);
  }
};

function _Tile() {
  this.x = 0;
  this.y = 0;
  this.img = image_dict['bunny.png'];
}

_Tile.prototype.Position = function(x, y) {
  this.x = x;
  this.y = y;
};

_Tile.prototype.Draw = function(base_x, base_y) {
  var x = this.x + base_x;
  var y = this.y + base_y;
  context.drawImage(this.img, x, y);
};


var g = {};

var layer_order_list = [];
var layer_order_2_list = {}; // {1: [_Layer, _Layer], 2: [_Layer, _Layer]}
var layer_count = 0;
var layer_dict = {};
var batch_count = 0;
var batch_dict = {};
var tile_count = 0;
var tile_dict = {};

g.CreateLayer = function(z_order) {
  var layer_list;
  if (layer_order_list.indexOf(z_order) == -1) {
    layer_list = [];
    layer_order_2_list[z_order] = layer_list;
    layer_order_list.push(z_order);
    layer_order_list.sort();
  } else {
    layer_list = layer_order_2_list[z_order];
  }
  var layer = new _Layer();
  layer_list.push(layer);
  var layer_id = layer_count + 1;
  layer_dict[layer_id] = layer;
  layer_count += 1;
  return layer_id;
};

g.CreateBatch = function(layer_id, tile_id) {
  var layer = layer_dict[layer_id];
  if (layer === undefined) {
    return 0;
  }
  return layer.CreateBatch(tile_id);
};

g.CreateTile = function(batch_id) {
  var batch = batch_dict[batch_id];
  if (batch === undefined) {
    return 0;
  }
  return batch.CreateTile();
};

g.TilePosition = function(tile_id, x, y) {
  var tile = tile_dict[tile_id];
  if (tile === undefined) {
    return 0;
  }
  tile.Position(x, y);
  return 1;
};

g.Draw = function () {
  context.fillStyle = "rgba(0, 0, 0, 255)";
  context.fillRect(0, 0, width, height);
  for(var i in layer_order_list) {
    var z = layer_order_list[i];
    var layer_list = layer_order_2_list[z];
    for(var j in layer_list) {
      var layer = layer_list[j];
      layer.Draw();
    }
  }
};

return g;

};
