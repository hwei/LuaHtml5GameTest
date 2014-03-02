function LoadGraphic (renderer, callback) {

function _Layer() {
  this.container = new PIXI.DisplayObjectContainer();
}

_Layer.prototype.CreateBatch = function (texture_id) {
  var batch = new _Batch(texture_id);
  this.container.addChild(batch.batch);
  var batch_id = batch_count + 1;
  batch_dict[batch_id] = batch;
  batch_count += 1;
  return batch_id;
};

_Layer.prototype.Position = function (x, y) {
  this.container.x = x;
  this.container.y = y;
};

function MissingTileFactory() {
  return new _MissingTile();
}

function _Batch(texture_id) {
  console.log(PIXI.SpriteBatch);
  this.batch = new PIXI.SpriteBatch();
  var tile_new = TileFactory(texture_id);
  if (!tile_new) {
    tile_new = MissingTileFactory;
  }
  this.tile_new = tile_new;
}

_Batch.prototype.CreateTile = function () {
  var tile = this.tile_new();
  this.batch.addChild(tile.sprite);
  var tile_id = tile_count + 1;
  tile_dict[tile_id] = tile;
  tile_count += 1;
  return tile_id;
};

function _MissingTile() {
}

_MissingTile.prototype.Position = function(x, y) {
};

_MissingTile.prototype.Frame = function() {};


var g = {};

var ori_width = renderer.width;
var ori_height = renderer.height;
var stage = new PIXI.Stage(0x000000);
var root_layer = new PIXI.DisplayObjectContainer();
stage.addChild(root_layer);
var layer_count = 0;
var layer_dict = {};
var batch_count = 0;
var batch_dict = {};
var tile_count = 0;
var tile_dict = {};

g.CreateLayer = function(z_order) {
  var layer = new _Layer();
  root_layer.addChild(layer.container);
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

g.TileFrame = function() {
  var tile_id = arguments[0];
  var tile = tile_dict[tile_id];
  if (tile === undefined) {
    return 0;
  }
  tile.Frame.apply(tile, Array.prototype.slice.call(arguments, 1));
  return 1;
};

(function start_load (callback){
  var loader = new PIXI.AssetLoader(['img/orin_tex_1.json']);
  loader.onComplete = function () { callback(g); };
  loader.load();
})(callback);

g.Draw = function() {
  renderer.render(stage);
};

g.Scale = function(s) {
  root_layer.scale.x = s;
  root_layer.scale.y = s;
  renderer.resize(ori_width * s, ori_height * s);
};

}


var TileFactory = (function () {

function Orin () {
  this.sprite = PIXI.Sprite.fromFrame('run_W_R.png');
  this.sprite.scale.x = -1;
  this.sprite.scale.y = 1;
}

Orin.prototype.Position = function(x, y) {
  this.sprite.x = x + 32;
  this.sprite.y = y;
};

Orin.prototype.Frame = function() {};

var classes = {
  1: Orin,
};

return function (texture_id) {
  return function () {
    return new classes[texture_id]();
  };
};

})();

