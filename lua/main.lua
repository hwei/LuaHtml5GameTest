local class = require 'pl.class'

local GameLogic = class()

function GameLogic:_init()
	print('aaaa')
end

function GameLogic:Init(g)
	print('hahaha')
	self.layer_id = g(1, 0)
	self.batch_id = g(2, self.layer_id, 1)
	self.tile_id = g(3, self.batch_id)
	self.x = 0
	self.y = 0
end

function GameLogic:Input(keycode, ...)
end

function GameLogic:Tick(g)
	self.x = math.fmod(self.x + 1, 640)
	self.y = math.fmod(self.y + 1, 480)
	g(6, self.tile_id, self.x, self.y)
end

return {
	GameLogic = GameLogic,
}
