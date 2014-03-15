local class = require 'pl.class'
local List = require 'pl.List'

local TILE_SIZE = 16

local TileMeter = class()

function TileMeter:_init(x)
	self:Set(x)
end

function TileMeter:Copy(x)
	self.t = x.t
	self.r = x.r
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
	return t * TILE_SIZE + r
end

local Land = class()

function Land:_init(g, width, height, land_func)
	self.width = width
	self.height = height
	self.land_func = land_func
	self.tile_count_x = math.ceil(width / TILE_SIZE) + 1
	self.tile_count_y = math.ceil(height / TILE_SIZE) + 1
	self.layer_id = g(1, 0)
	self.batch_id = g(2, self.layer_id, 0x1000)
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

function Camera:Trace(x, y, k)
	local dx = (TileMeter.Diff(x, self.ox) - self.half_width) * k
	local dy = (TileMeter.Diff(y, self.oy) - self.half_height) * k
	if dx > 0 then
		dx = math.floor(dx)
	elseif dx < 0 then
		dx = math.ceil(dx)
	end
	if dy > 0 then
		dy = math.floor(dy)
	elseif dy < 0 then
		dy = math.ceil(dy)
	end
	if dx == 0 and dy == 0 then
		local ox = self.ox
		ox:Copy(x)
		ox:Add(-self.half_width)
		local oy = self.oy
		oy:Copy(y)
		oy:Add(-self.half_height)
	else
		self:Move(dx, dy)
	end
end

function Camera:GetOrigin()
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

local seedrandom = require 'seedrandom'

local land_random_cache = IntFuncCache(64)

local function random_func(tx)
	local r = land_random_cache:Get(tx)
	if r ~= nil then
		return r
	end
    local l = math.floor(tx / 8)
    seedrandom.setseed(l)
    r = math.floor(seedrandom.getrandom() * 3)
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

local TilemapCollider = class()

function TilemapCollider:_init(collision_func, left, right, top, bottom)
	self.collision_func = collision_func
	self.collision_func_alt = function (yt, xt)
		return collision_func(xt, yt)
	end

	self.left = left
	self.right = right
	self.top = top
	self.bottom = bottom

	local top_t = math.floor(top / TILE_SIZE)
	-- nearest tile y to hit top: top_hit_t - (y.r < top_hit_r ? 1 : 0)
	self.top_hit_t =  -1 - top_t
	self.top_hit_r = top - top_t * TILE_SIZE

	local bottom_t = math.ceil(bottom / TILE_SIZE)
	-- nearest tile y to hit bottom: bottom_hit_t + (y.r > bottom_hit_r ? 1 : 0)
	self.bottom_hit_t = bottom_t
	self.bottom_hit_r = bottom_t * TILE_SIZE - bottom

	local left_t = math.floor(left / TILE_SIZE)
	local left_r = left - left_t * TILE_SIZE
	-- nearest tile x to hit left: left_hit_t - (x.r < left_hit_r ? 1 : 0)
	self.left_hit_t =  -1 - left_t
	self.left_hit_r = left_r

	local right_t = math.ceil(right / TILE_SIZE)
	-- nearest tilex to hit right: right_hit_t + (x.r > right_hit_r ? 1 : 0)
	self.right_hit_t = right_t
	self.right_hit_r = right_t * TILE_SIZE - right

	self.x = TileMeter(0)
	self.y = TileMeter(0)
	self.speed_x = 0
	self.speed_y = 0

	self.hit_left = false
	self.hit_right = false
	self.hit_top = false
	self.hit_bottom = false
end

local function hit_detect(collision_func, t, i_begin, i_end, m, hit_speed, speed)
	local hit = false
	for i = i_begin, i_end do
		if collision_func(t, i) then
			hit = true
			break
		end
	end
	if hit then
		m:Add(hit_speed)
		return 0, true
	else
		m:Add(speed)
		return speed, false
	end
end

-- params: speed_x, speed_y, tx, ty, rx, ry
-- Note: speed should be less than TILESIZE, otherwize the collision will fail.
function TilemapCollider:Tick(...)
	local x = self.x
	local y = self.y
	local speed_x = self.speed_x;
	local speed_y = self.speed_y;
	repeat
		local sx, sy, tx, ty, rx, ry = ...
		if sx ~= nil then speed_x = sx end
		if sy ~= nil then speed_y = sy end
		if tx == nil then break end
		x.t = tx
		x.r = 0
		if ty == nil then break end
		y.t = ty
		y.r = 0
		if rx == nil then break end
		x.r = rx
		if ry == nil then break end
		y.r = ry
	until true

	if speed_x == 0 and speed_y == 0 then
		self.speed_x = 0
		self.speed_y = 0
		return
	end

	-- xxx_hit_t means nearst tile coord to hit

	-- if abs(speed) is small than abs(xxx_hit_speed),
	-- then object will not cross tile boarder in current tick,
	-- and collision detection can be skipped

	local top_hit_t = y.t + self.top_hit_t
	local top_hit_speed = self.top_hit_r - y.r
	if top_hit_speed > 0 then
		top_hit_t = top_hit_t - 1
		top_hit_speed = top_hit_speed - TILE_SIZE
	end
	local bottom_hit_t = y.t + self.bottom_hit_t
	local bottom_hit_speed = self.bottom_hit_r - y.r
	if bottom_hit_speed < 0 then
		bottom_hit_t = bottom_hit_t + 1
		bottom_hit_speed = bottom_hit_speed + TILE_SIZE
	end
	local left_hit_t = x.t + self.left_hit_t
	local left_hit_speed = self.left_hit_r - x.r
	if left_hit_speed > 0 then
		left_hit_t = left_hit_t - 1
		left_hit_speed = left_hit_speed - TILE_SIZE
	end
	local right_hit_t = x.t + self.right_hit_t
	local right_hit_speed = self.right_hit_r - x.r
	if right_hit_speed < 0 then
		right_hit_t = right_hit_t + 1
		right_hit_speed = right_hit_speed + TILE_SIZE
	end

	local collision_func = self.collision_func

	self.hit_left = false
	self.hit_right = false
	if speed_x > right_hit_speed then
		speed_x, self.hit_right = hit_detect(
			self.collision_func, right_hit_t,
			top_hit_t + 1, bottom_hit_t - 1,
			x, right_hit_speed, speed_x
		)
	elseif speed_x < left_hit_speed then
		speed_x, self.hit_left = hit_detect(
			self.collision_func, left_hit_t,
			top_hit_t + 1, bottom_hit_t - 1,
			x, left_hit_speed, speed_x
		)
	else
		x:Add(speed_x)
	end

	self.hit_top = false
	self.hit_bottom = false
	if speed_y > bottom_hit_speed then
		speed_y, self.hit_bottom = hit_detect(
			self.collision_func_alt, bottom_hit_t,
			left_hit_t + 1, right_hit_t - 1,
			y, bottom_hit_speed, speed_y
		)
	elseif speed_y < top_hit_speed then
		speed_y, self.hit_top = hit_detect(
			self.collision_func_alt, top_hit_t,
			left_hit_t + 1, right_hit_t - 1,
			y, top_hit_speed, speed_y
		)
	else
		y:Add(speed_y)
	end

	self.speed_x = speed_x
	self.speed_y = speed_y
end

function TilemapCollider:PositionSpeed()
	return self.x, self.y, self.speed_x, self.speed_y
end

local GameLogic = class()

function GameLogic:_init(g, w, h)
	self.width = w
	self.height = h
	self.camera = Camera(0, 0, w, h)

	self.land = Land(g, w, h, land_func)

	self.layer_id = g(1, 0)
	self.batch_id = g(2, self.layer_id, 0x2000)
	self.tile_id = g(3, self.batch_id)
	g(7, self.tile_id, 100)
	self.gizmos_batch_id = g(2, self.layer_id, -1)
	self.gizmos_id = g(3, self.gizmos_batch_id)
	g(7, self.gizmos_id, 6, 6, 24, 0)

	self.collider = TilemapCollider(function (tx, ty)
		return land_func(tx, ty) ~= -1
	end, 6, 6, 24, 0)
	self.speed_y = 0
	self.speed_x = 0
	self.collider:Tick(0, 0, 0, -16)
end

function GameLogic:Input(keycode, ...)
	local is_down = select(1, ...)
	if is_down == 1 then
		if keycode == 37 then
			self.speed_x = -2
		elseif keycode == 39 then
			self.speed_x = 2
		elseif keycode == 38 and self.collider.hit_bottom then
			self.speed_y = -6
		end
	else
		if keycode == 37 or keycode == 39 then
			self.speed_x = 0
		end
	end
end

function GameLogic:Tick(g)
	local speed_y = self.speed_y
	self.collider:Tick(self.speed_x, speed_y)
	self.speed_y = math.min(speed_y + 0.375, 5)

	local mx, my = self.collider:PositionSpeed()

	local camera = self.camera
	camera:Trace(mx, my, 0.5)
	local ox, oy = camera:GetOrigin()

	self.land:UpdateGraphic(g, ox, oy)

	local x = (mx.t - ox.t) * TILE_SIZE + mx.r - ox.r
	local y = (my.t - oy.t) * TILE_SIZE + my.r - oy.r
	g(6, self.tile_id, x, y)
	g(6, self.gizmos_id, x, y)
end

return {
	GameLogic = GameLogic,
}
