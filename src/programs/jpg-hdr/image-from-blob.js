export const getHTMLImageFromBlob = (blob) => {
	return new Promise((resolve, reject) => {
		const img = document.createElement("img");
		img.onload = () => {
			resolve(img);
		};
		img.onerror = (e) => {
			reject(e);
		};
		img.src = URL.createObjectURL(blob);
	});
};
