local class = require 'pl.class'
local List = require 'pl.List'

local TILE_SIZE = 16

local TileMeter = class()

function TileMeter:_init(x)
	self:Set(x)
end

function TileMeter:Set(x)
	local t = math.floor(x / TILE_SIZE)
	self.r = x - t * TILE_SIZE
	self.t = t
end

function TileMeter:Add(x)
	local t = math.floor(x / TILE_SIZE)
	local r = x - t * TILE_SIZE
	t = self.t + t
	r = self.r + r
	if r > TILE_SIZE then
		self.t = t + 1
		self.r = r - TILE_SIZE
	else
		self.t = t
		self.r = r
	end
end

function TileMeter:Get()
	return self.t * TILE_SIZE + self.r
end

function TileMeter.Diff(a, b)
	local t = a.t - b.t
	local r = a.r - b.r
	return r * TILE_SIZE + t
end

local Land = class()

function Land:_init(g, width, height, land_func)
	self.width = width
	self.height = height
	self.land_func = land_func
	self.tile_count_x = math.ceil(width / TILE_SIZE) + 1
	self.tile_count_y = math.ceil(height / TILE_SIZE) + 1
	self.layer_id = g(1, 0)
	self.batch_id = g(2, self.layer_id, 2)
	self.tile_list = List()
	local y = 0
	for ty = 1, self.tile_count_y do
		local x = 0
		for tx = 1, self.tile_count_x do
			local tile_id = g(3, self.batch_id)
			self.tile_list:append(tile_id)
			g(6, tile_id, x, y)
			x = x + TILE_SIZE
		end
		y = y + TILE_SIZE
	end
end

function Land:UpdateGraphic(g, offset_x, offset_y)
	local tx_min, ty_min = offset_x.t, offset_y.t
	if self.tx_min ~= tx_min or self.ty_min ~= ty_min then
		self.tx_min, self.ty_min = tx_min, ty_min
		local i = 0
		local tile_list = self.tile_list
		local land_func = self.land_func
		for j = 1, self.tile_count_y do
			local ty = ty_min + j - 1
			for k = 1, self.tile_count_x do
				local tx = tx_min + k - 1
				i = i + 1
				g(7, tile_list[i], land_func(tx, ty))
			end
		end
	end
	local offset_x, offset_y = -offset_x.r, -offset_y.r
	if self.offset_x ~= offset_x or self.offset_y ~= offset_y then
		self.offset_x, self.offset_y = offset_x, offset_y
		g(4, self.layer_id, offset_x, offset_y)
	end
end

local Camera = class()

function Camera:_init(x, y, width, height)
	self.half_width = width / 2
	self.half_height = height / 2
	self.ox = TileMeter(x - self.half_width)
	self.oy = TileMeter(y - self.half_height)
end

function Camera:Move(dx, dy)
	self.ox:Add(dx)
	self.oy:Add(dy)
end

function Camera:GetOffset()
	return self.ox, self.oy
end

local function land_func(tx, ty)
	if ty <= 0 then
		return -1
	elseif ty == 1 then
		return 1
	else
		return 5
	end
end

local IntFuncCache = class()

function IntFuncCache:_init(cache_size)
	self.inputs = {}
	self.outputs = {}
	self.cache_size = cache_size
end

function IntFuncCache:Get(x)
	local i = x % self.cache_size
	if self.inputs[i] == x then
		return self.outputs[i]
	else
		return nil
	end
end

function IntFuncCache:Set(x, y)
	local i = x % self.cache_size
	self.inputs[i] = x
	self.outputs[i] = y
end

local land_random_cache = IntFuncCache(64)

local function random_func(tx)
	local r = land_random_cache:Get(tx)
	if r ~= nil then
		return r
	end
    local l = math.floor(tx / 8)
    SRandSet(l)
    r = math.floor(SRandGet() * 3)
    land_random_cache:Set(tx, r)
    return r
end

local function land_func(tx, ty)
    if ty > 0 then
        return 5
    end
    local h = random_func(tx)
    if ty > -h then
        return 5
    elseif ty == -h then
        return 1
    else
        return -1
    end
end

local GameLogic = class()

function GameLogic:_init(g, w, h)
	self.width = w
	self.height = h
	self.camera = Camera(0, 0, w, h)

	self.land = Land(g, w, h, land_func)

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
	local camera = self.camera
	camera:Move(1, 0)
	local ox, oy = camera:GetOffset()
	self.land:UpdateGraphic(g, ox, oy)

	self.x = math.fmod(self.x + 1, 320)
	self.y = math.fmod(self.y + 1, 240)
	g(6, self.tile_id, self.x, self.y)
end

return {
	GameLogic = GameLogic,
}
