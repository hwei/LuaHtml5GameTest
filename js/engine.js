var IMG_SRC_DICT = {
  'bunny.png': 'http://www.html5canvastutorials.com/content/labs/html5-canvas-bouncing-bunnies/bunny.png',
};

var LUA_SRC_LIST = [
  'main.lua',
  'pl/class.lua', 'pl/utils.lua', 'pl/compat.lua',
];


$(function () {
  var lastTime = 0;
  var vendors = ['ms', 'moz', 'webkit', 'o'];
  for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
      window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
      window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame'] ||
        window[vendors[x]+'CancelRequestAnimationFrame'];
  }
  if (!window.requestAnimationFrame)
      window.requestAnimationFrame = function(callback, element) {
          var currTime = new Date().getTime();
          var timeToCall = Math.max(0, 16 - (currTime - lastTime));
          var id = window.setTimeout(function() {
            callback(currTime + timeToCall);
          }, timeToCall);
          lastTime = currTime + timeToCall;
          return id;
      };
  window.requestAnimFrame = window.requestAnimationFrame;

  (function loadAllResource(callback){
    var remain = 0;
    var dec_end = false;
    var images = {};
    function loaded_one() {
      remain -= 1;
      if (remain === 0 && dec_end) {
        callback(images);
      }
    }
    function dec_image(name, src) {
      remain += 1;
      var img = new Image();
      img.onload = function () {
        images[name] = img;
        loaded_one();
      };
      img.src = src;
    }
    function gen_loaded_lua(filename) {
      return function loaded_lua(data) {
        var p = filename.lastIndexOf('/');
        var path;
        var name;
        if (p == -1) {
          path = '/';
          name = filename;
        } else {
          path = '/' + filename.substring(0, p + 1);
          name = filename.substring(p + 1);
        }
        Lua5_1.provide_file(path, name, data, true, false);
        loaded_one();
      };
    }
    function dec_lua_list(lua_list) {
      remain += lua_list.length;
      for(var i in lua_list) {
        var filename = lua_list[i];
        $.get('lua/' + filename, gen_loaded_lua(filename));
      }
    }
    for (var name in IMG_SRC_DICT) {
      dec_image(name, IMG_SRC_DICT[name]);
    }
    dec_lua_list(LUA_SRC_LIST);
    dec_end = true;
    if (remain === 0) {
      callback(images);
    }
  })(function (images) {
    var graphic_stats = new Stats();
    $('body').append($(graphic_stats.domElement).addClass('graphic_stats'));
    var logic_stats = new Stats();
    $('body').append($(logic_stats.domElement).addClass('logic_stats'));

    var $Screen = $('#Screen');
    var graphic = Graphic(
      $Screen[0].getContext('2d'),
      $Screen[0].width, $Screen[0].height,
      images
    );

    // Lua VM
    var C = Lua5_1.C;
    var L = C.lua_open();
    C.luaL_openlibs(L);

    // graphic callback
    var graphic_func_dict = {
      1: graphic.CreateLayer,
      2: graphic.CreateBatch,
      3: graphic.CreateTile,
      4: graphic.LayerPosition,
      5: graphic.LayerStyle,
      6: graphic.TilePosition,
      7: graphic.TileFrame,
    };
    var temp_args = [];
    C.lua_pushcfunction(
      L,
      Lua5_1.Runtime.addFunction(function (L) {
        var n = C.lua_gettop(L);
        var f = graphic_func_dict[C.luaL_checknumber(L, 1)];
        for (var i = 2; i <= n; ++i) {
          var t = C.luaL_checknumber(L, i);
          temp_args[i - 2] = t;
        }
        var r = f.apply(graphic, temp_args);
        C.lua_pushnumber(L, r);
        return 1;
      })
    );
    var graphic_func = C.luaL_ref(L, C.LUA_REGISTRYINDEX);

    // game logic object
    C.lua_getglobal(L, 'require');
    C.lua_pushstring(L, 'main');
    C.lua_call(L, 1, 1); // module
    C.lua_getfield(L, -1, 'GameLogic'); // module, test1
    C.lua_remove(L, -2); // test1
    C.lua_call(L, 0, 1); // game_logic
    var game_logic = C.luaL_ref(L, C.LUA_REGISTRYINDEX); //

    // init
    C.lua_rawgeti(L, C.LUA_REGISTRYINDEX, game_logic); // game_logic
    C.lua_getfield(L, -1, 'Init'); // game_logic, Init
    C.lua_rawgeti(L, C.LUA_REGISTRYINDEX, game_logic); // game_logic, Init, game_logic
    C.lua_rawgeti(L, C.LUA_REGISTRYINDEX, graphic_func); // game_logic, Init, game_logic, graphic_func
    C.lua_call(L, 2, 0); // game_logic

    // tick
    setInterval(function () {
      logic_stats.begin();
      C.lua_getfield(L, -1, 'Tick'); // game_logic, Tick
      C.lua_rawgeti(L, C.LUA_REGISTRYINDEX, game_logic); // game_logic, Tick, game_logic
      C.lua_rawgeti(L, C.LUA_REGISTRYINDEX, graphic_func); // game_logic, Tick, game_logic, graphic_func
      C.lua_call(L, 2, 0); // game_logic
      logic_stats.end();
    }, 1000 / 60);

    // draw
    function draw() {
      graphic_stats.begin();
      graphic.Draw();
      graphic_stats.end();
      window.requestAnimationFrame(draw);
    }
    window.requestAnimationFrame(draw);
  });
});
