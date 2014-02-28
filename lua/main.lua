local alert = require 'hello-world.alert'
local a = 0
function test()
	a = a + 1
	alert.alert(tostring(a))
end
return {test = test}
