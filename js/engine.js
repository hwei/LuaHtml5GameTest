$(function () {
  (function init_animation_frame () {
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
  })();

  var LUA_SRC_LIST = [
    'main.lua',
    'pl/class.lua',
    'pl/utils.lua',
    'pl/compat.lua',
    'pl/List.lua',
    'pl/tablex.lua',
    'pl/types.lua',
  ];

  var width = 320;
  var height = 240;

  (function load_all_resource(callback){
    var graphic = null;
    var remain = LUA_SRC_LIST.length + 1;
    var join = false;
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
        remain -= 1;
        if (join && remain === 0) {
          callback(graphic);
        }
      };
    }
    for(var i in LUA_SRC_LIST) {
      var filename = LUA_SRC_LIST[i];
      $.get('lua/' + filename, gen_loaded_lua(filename));
    }

    var renderer = PIXI.autoDetectRenderer(width, height, $('#Screen')[0]);
    LoadGraphic(
      renderer,
      function (g) {
        graphic = g;
        remain -= 1;
        if (join && remain === 0) {
          callback(g);
        }
      }
    );

    join = true;
    if (remain === 0) {
      callback(graphic);
    }
  })(function loaded_all_resource(graphic) {
    // Lua VM
    var C = Lua5_1.C;
    var L = C.lua_open();
    C.luaL_openlibs(L);

    C.lua_getglobal(L, 'package'); // package
    C.lua_getfield(L, -1, 'loaded'); // package, loaded
    C.lua_remove(L, -2); // loaded

    // seed random module
    C.lua_createtable(L, 0, 2);
    C.lua_pushcfunction(L,
      Lua5_1.Runtime.addFunction(function (L) {
        var seed = C.luaL_checknumber(L, 1);
        Math.seedrandom(seed);
        return 0;
      })
    );
    C.lua_setfield(L, -2, 'setseed');
    C.lua_pushcfunction(L,
      Lua5_1.Runtime.addFunction(function (L) {
        var r = Math.random();
        C.lua_pushnumber(L, r);
        return 1;
      })
    );
    C.lua_setfield(L, -2, 'getrandom');
    // loaded, seedrandom

    C.lua_setfield(L, -2, 'seedrandom'); // loaded
    C.lua_pop(L, 1); //

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
        var fid = C.luaL_checknumber(L, 1);
        var f = graphic_func_dict[fid];
        if (!f) {
          throw 'Invalid graphic call: ' + fid;
        }
        for (var i = 2; i <= n; ++i) {
          var t = C.luaL_checknumber(L, i);
          temp_args[i - 2] = t;
        }
        var r = f.apply(graphic, temp_args);
        C.lua_pushnumber(L, r);
        return 1;
      })
    );
    // graphic_func

    // game logic init
    C.lua_getglobal(L, 'require');
    C.lua_pushstring(L, 'main');
    C.lua_call(L, 1, 1); // graphic_func, module
    C.lua_getfield(L, -1, 'GameLogic'); // graphic_func, module, GameLogic
    C.lua_remove(L, -2); // graphic_func, GameLogic
    C.lua_pushvalue(L, -2); // graphic_func, GameLogic, graphic_func
    C.lua_pushnumber(L, width); // graphic_func, GameLogic, graphic_func, width
    C.lua_pushnumber(L, height); // graphic_func, GameLogic, graphic_func, width, height
    C.lua_call(L, 3, 1); // graphic_func, game_logic

    // stats
    var graphic_stats = new Stats();
    var logic_stats = new Stats();
    $('#Stats')
    .append($(graphic_stats.domElement).addClass('stats'))
    .append($(logic_stats.domElement).addClass('stats'));

    // option
    $('input:radio[name=scale]').change(function () {
        var $this = $(this);
        if ($this.is(':checked')) {
          graphic.Scale(parseInt($this.val(), 10));
        }
    });

    // tick
    var interval_id = setInterval(function () {
      logic_stats.begin();
      C.lua_getfield(L, -1, 'Tick'); // graphic_func, game_logic, Tick
      C.lua_pushvalue(L, -2); // graphic_func, game_logic, Tick, game_logic
      C.lua_pushvalue(L, -4); // graphic_func, game_logic, Tick, game_logic, graphic_func
      try {
        C.lua_call(L, 2, 0); // graphic_func, game_logic
      } catch (err) {
        clearInterval(interval_id);
        throw err;
      }
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
