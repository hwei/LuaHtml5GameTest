function LoadGraphic (renderer, callback) {


function _Layer(lid) {
  this.lid = lid;
  this.pixi_obj = new PIXI.DisplayObjectContainer();
}

_Layer.prototype.CreateBatch = function (texture_id) {
  var batch_id = batch_count + 1;
  var batch;
  if (texture_id == -1) {
    batch = new _BatchGizmos(batch_id);
  } else {
    batch = new _Batch(batch_id, texture_id);
  }
  this.pixi_obj.addChild(batch.pixi_obj);
  batch_dict[batch_id] = batch;
  batch_count += 1;
  return batch_id;
};

_Layer.prototype.Position = function (x, y) {
  this.pixi_obj.x = x;
  this.pixi_obj.y = y;
};

function MissingTileFactory() {
  return new _MissingTile();
}

function _Batch (bid, texture_id) {
  this.bid = bid;
  this.pixi_obj = new PIXI.SpriteBatch();
  var tile_new = TileFactory(texture_id);
  if (!tile_new) {
    tile_new = MissingTileFactory;
  }
  this.tile_new = tile_new;
}

_Batch.prototype.CreateTile = function () {
  var tile_id = tile_count + 1;
  var tile = this.tile_new(new _TileBase(tile_id));
  this.pixi_obj.addChild(tile.pixi_obj);
  tile_dict[tile_id] = tile;
  tile_count += 1;
  return tile_id;
};

function _BatchGizmos (bid) {
  this.bid = bid;
  var graphics = new PIXI.Graphics();
  this.pixi_obj = graphics;
  var gizmos_list = [];
  this.gizmos_list = gizmos_list;
  function redraw () {
    graphics.clear();
    graphics.beginFill(0x000000, 0);
    graphics.lineStyle(1, 0xff00ff, 1);
    for (var i in gizmos_list) {
      var gizmos = gizmos_list[i];
      var left = gizmos.left;
      var right = gizmos.right;
      var top = gizmos.top;
      var bottom = gizmos.bottom;
      graphics.drawRect(
        gizmos.x - left, gizmos.y - top,
        left + right, top + bottom
      );
    }
    delete batch_tick_dict[bid];
  }
  this.gizmos_changed_callback = function () {
    batch_tick_dict[bid] = redraw;
  };
}

_BatchGizmos.prototype.CreateTile = function () {
  var tile_id = tile_count + 1;
  var tile = new _GizmosTile(this.gizmos_changed_callback);
  this.gizmos_list.push(tile);
  tile_dict[tile_id] = tile;
  tile_count += 1;
  return tile_id;
};


function _TileBase (tid) {
  this.tid = tid;
}

_TileBase.prototype.SubscribeTick = function (tick_callback) {
  if (tick_callback === undefined) {
    delete tile_tick_dict[this.tid];
  } else {
    tile_tick_dict[this.tid] = tick_callback;
  }
};


function _MissingTile() {
}

_MissingTile.prototype.Position = function(x, y) {
};

_MissingTile.prototype.Style = function() {};


function _GizmosTile(changed_callback) {
  this.x = 0;
  this.y = 0;
  this.left = 1;
  this.right = 1;
  this.top = 1;
  this.bottom = 1;
  this.changed_callback = changed_callback;
}

_GizmosTile.prototype.Position = function(x, y) {
  this.x = x;
  this.y = y;
  this.changed_callback();
};

_GizmosTile.prototype.Style = function(left, right, top, bottom) {
  this.left = left;
  this.right = right;
  this.top = top;
  this.bottom = bottom;
  this.changed_callback();
};


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
var batch_tick_dict = {};
var tile_count = 0;
var tile_dict = {};
var tile_tick_dict = {};

g.CreateLayer = function () {
  var layer_id = layer_count + 1;
  var layer = new _Layer(layer_id);
  root_layer.addChild(layer.pixi_obj);
  layer_dict[layer_id] = layer;
  layer_count += 1;
  return layer_id;
};

g.CreateBatch = function (layer_id, tile_id) {
  var layer = layer_dict[layer_id];
  if (layer === undefined) {
    return 0;
  }
  return layer.CreateBatch(tile_id);
};

g.CreateTile = function (batch_id) {
  var batch = batch_dict[batch_id];
  if (batch === undefined) {
    return 0;
  }
  return batch.CreateTile();
};

g.LayerPosition = function (layer_id, x, y) {
  var layer = layer_dict[layer_id];
  if (layer === undefined) {
    return 0;
  }
  var c = layer.pixi_obj;
  c.x = x;
  c.y = y;
  return 1;
};

g.TilePosition = function (tile_id, x, y) {
  var tile = tile_dict[tile_id];
  if (tile === undefined) {
    return 0;
  }
  tile.Position(x, y);
  return 1;
};

g.TileStyle = function () {
  var tile_id = arguments[0];
  var tile = tile_dict[tile_id];
  if (tile === undefined) {
    return 0;
  }
  tile.Style.apply(tile, Array.prototype.slice.call(arguments, 1));
  return 1;
};

g.Tick = function () {
  for (var tid in tile_tick_dict) {
    tile_tick_dict[tid]();
  }
  for (var bid in batch_tick_dict) {
    batch_tick_dict[bid]();
  }
};

g.Draw = function () {
  renderer.render(stage);
};

g.Scale = function (s) {
  root_layer.scale.x = s;
  root_layer.scale.y = s;
  renderer.resize(ori_width * s, ori_height * s);
};

(function start_load (callback){
  var loader = new PIXI.AssetLoader([
    'img/orin_tex_1.json',
    'img/land.json',
  ]);
  loader.onComplete = function () { callback(g); };
  loader.load();
})(callback);

}


var TileFactory = (function () {

var get_animator = (function () {
  // 0 静止
  // 20 走
  // 40 跳
  // 100 跑
  var anim_raw_data = {
    orin: [{
      name: 'stand',
      id: 0,
      frames: [{
        frame_id: 'walk_W.png',
        length: 0,
        scale: {x: -1, y: 1},
        anchor: {x: 0.5, y: 0.96875},
      }],
    }, {
      name: 'walk',
      id: 20,
      frames: [{
        frame_id: 'walk_W.png',
        length: 10,
        scale: {x: -1, y: 1},
        anchor: {x: 0.5, y: 0.96875},
      }, {
        frame_id: 'walk_W_L.png',
        length: 10,
        scale: {x: -1, y: 1},
        anchor: {x: 0.5, y: 0.96875},
      }, {
        frame_id: 'walk_W.png',
        length: 10,
        scale: {x: -1, y: 1},
        anchor: {x: 0.5, y: 0.96875},
      }, {
        frame_id: 'walk_W_R.png',
        length: 10,
        scale: {x: -1, y: 1},
        anchor: {x: 0.5, y: 0.96875},
      }],
    }, {
      name: 'jump',
      id: 40,
      frames: [{
        frame_id: 'walk_W.png',
        length: 0,
        scale: {x: -1, y: 1},
        anchor: {x: 0.5, y: 0.96875},
      }],
    }, {
      name: 'run',
      id: 100,
      frames: [{
        frame_id: 'run_W.png',
        length: 10,
        scale: {x: -1, y: 1},
        anchor: {x: 0.5, y: 0.96875},
      }, {
        frame_id: 'run_W_L.png',
        length: 10,
        scale: {x: -1, y: 1},
        anchor: {x: 0.5, y: 0.96875},
      }, {
        frame_id: 'run_W.png',
        length: 10,
        scale: {x: -1, y: 1},
        anchor: {x: 0.5, y: 0.96875},
      }, {
        frame_id: 'run_W_R.png',
        length: 10,
        scale: {x: -1, y: 1},
        anchor: {x: 0.5, y: 0.96875},
      }],
    }],
  };

  var anim_cooked_data = {};

  function cook_anim_data (anim_name) {
    var raw_data = anim_raw_data[anim_name];
    var cooked_data = {};
    for (var i in raw_data) {
      var anim_data = raw_data[i];
      var frames = [];
      for (var j in anim_data.frames) {
        var frame_info = anim_data.frames[j];
        var frame = PIXI.Texture.fromFrame(frame_info.frame_id);
        frames.push({
          frame: frame,
          length: frame_info.length,
          scale: frame_info.scale,
          anchor: frame_info.anchor,
        });
      }
      cooked_data[anim_data.id] = frames;
    }
    return cooked_data;
  }

  function _Animator (data) {
    this.data = data;
    this.pixi_obj = new PIXI.Sprite(this.data[0][0].frame);
    this.Animate(0);
    this.offset_x = 0;
    this.offset_y = 0;
  }

  _Animator.prototype.Animate = function (animate_id) {
    this.animate_id = animate_id;
    this.frame_idx = 0;
    this.tick_idx = 0;
    var frame_list = this.data[this.animate_id];
    this.pixi_obj.setTexture(frame_list[0].frame);
  };

  _Animator.prototype.Tick = function () {
    this.tick_idx += 1;
    var frame_list = this.data[this.animate_id];
    var frame_info = frame_list[this.frame_idx];
    if (frame_info.length === 0) {
      return;
    }
    if (this.tick_idx > frame_info.length) {
      this.tick_idx = 0;
      this.frame_idx += 1;
      frame_info = frame_list[this.frame_idx];
      if (frame_info === undefined) {
        this.frame_idx = 0;
        frame_info = frame_list[0];
      }
      var scale_x = frame_info.scale.x;
      var scale_y = frame_info.scale.y;
      var frame = frame_info.frame;
      this.pixi_obj.setTexture(frame);
      this.pixi_obj.scale.x = scale_x;
      this.pixi_obj.scale.y = scale_y;
      this.pixi_obj.anchor.x = frame_info.anchor.x;
      this.pixi_obj.anchor.y = frame_info.anchor.y;
    }
  };

  _Animator.prototype.Position = function (x, y) {
    this.pixi_obj.x = x;
    this.pixi_obj.y = y;
  };

  return function(anim_name) {
    var d = anim_cooked_data[anim_name];
    if (d === undefined) {
      d = cook_anim_data(anim_name);
      anim_cooked_data[anim_name] = d;
    }
    return new _Animator(d);
  };
})();


function SpriteTile (name, base) {
  this.animator = get_animator(name);
  this.pixi_obj = this.animator.pixi_obj;
  this.base = base;
}

SpriteTile.prototype.Position = function (x, y) {
  this.animator.Position(x, y);
};

SpriteTile.prototype.Style = function (style_id) {
  this.animator.Animate(style_id);
  if (this.tick_callback === undefined) {
    var animator = this.animator;
    this.tick_callback = function () {
      animator.Tick();
    };
  }
  this.base.SubscribeTick(this.tick_callback);
};

var land_frames = null;

function Land () {
  if (land_frames === null) {
    land_frames = {};
    for (var i = 0; i < 0x10; ++i) {
      var name = 'land_' + i.toString(16) + '.png';
      land_frames[i] = PIXI.Texture.fromFrame(name);
    }
  }
  this.pixi_obj = new PIXI.Sprite(land_frames[0]);
}

Land.prototype.Position = function(x, y) {
  this.pixi_obj.x = x;
  this.pixi_obj.y = y;
};

Land.prototype.Style = function(i) {
  if (i in land_frames) {
    this.pixi_obj.setTexture(land_frames[i]);
    this.pixi_obj.alpha = 1;
  } else {
    this.pixi_obj.alpha = 0;
  }
};


var factory_dict = {
  0x1000: function () { return new Land(); },
  0x2000: function (base) { return new SpriteTile('orin', base); },
};

return function (texture_id) {
  return function (base) {
    return factory_dict[texture_id](base);
  };
};

})();

