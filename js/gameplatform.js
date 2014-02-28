var stats;

function loadAllResource(callback){
  var remain = 0;
  var dec_end = false;
  var images = {};
  function loaded_one() {
    console.log('loaded one');
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
  dec_image('bunny.png', 'http://www.html5canvastutorials.com/content/labs/html5-canvas-bouncing-bunnies/bunny.png');
  dec_lua_list(['main.lua', 'hello-world/alert.lua']);
  dec_end = true;
  if (remain === 0) {
    callback(images);
  }
}


$(document).ready(function() {
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

  stats = new Stats();
  $('body').append($(stats.domElement).addClass('stats'));

  loadAllResource(function (images) {
    
    var C = Lua5_1.C;

    var L = C.lua_open();
    C.luaL_openlibs(L);

    C.lua_pushcfunction(
        L,
        Lua5_1.Runtime.addFunction(
            function(L)
            {
              var str = C.luaL_checkstring(L, 1);
              alert("{Lua} " + str);
              return 0;
            }
          )
      );
    C.lua_setglobal(L, "ALERT");

    C.lua_getglobal(L, 'require');
    C.lua_pushstring(L, 'main'); // 'main'
    C.lua_call(L, 1, 1); // module
    C.lua_getfield(L, -1, 'test'); // module, test
    C.lua_call(L, 0, 0); // module
    C.lua_getfield(L, -1, 'test'); // module, test
    C.lua_call(L, 0, 0); // module
    C.lua_pop(L, 1); //

    // if (C.luaL_dostring(L, "ALERT('Hello, world')") !== 0)
    // {
    //   var err = C.lua_tostring(L, -1);
    //   C.lua_close(L);
    //   L = 0;
    //   throw new Error("Lua error: " + err);
    // }

    GamePlatform.Start(images);
  });
});

function Tick() {
  stats.begin();
  GamePlatform.Tick();
  stats.end();
}

var GamePlatform = {
  width: 640,
  height: 480,
  Start: function (images) {
    this.stage = new Kinetic.Stage({
        container: "container",
        width: this.width,
        height: this.height,
    });
    this.layer = new Kinetic.Layer();
    this.stage.add(this.layer);

    this.bunny = new Kinetic.Image({
        image: images['bunny.png'],
        transformsEnabled: 'position',
    });
    this.layer.add(this.bunny);
    window.requestAnimationFrame(Tick);
  },
  Tick: function() {
    var x = this.bunny.getX();
    x = (x + 1) % this.width;
    this.bunny.setX(x);
    var y = this.bunny.getY();
    y = (y + 1) % this.height;
    this.bunny.setY(y);
    this.layer.drawScene();
    window.requestAnimationFrame(Tick);
  },
};

