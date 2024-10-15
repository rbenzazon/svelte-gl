export function hasSameShallow(a, b) {
	if (a == null || b == null || a.size !== b.size) {
		return false;
	}
	for (let item of a) {
		if (!b.has(item)) {
			return false;
		}
	}
	return true;
}
