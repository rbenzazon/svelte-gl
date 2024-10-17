export function hasSameShallow(a, b) {
	if (a == null || b == null || a.length !== b.length) {
		return false;
	}
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) {
			return false;
		}
	}
	return true;
}
export function optionalPropsDeepEqual(a, b) {
	if (a == null || b == null) {
		return false;
	}
	for (let key in a) {
		if (Array.isArray(a[key])) {
			if (!hasSameShallow(a[key], b[key])) {
				return false;
			}
		} else if (a[key] !== b[key]) {
			return false;
		}
	}
	return true;
}
