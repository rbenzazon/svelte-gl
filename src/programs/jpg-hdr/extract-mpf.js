export function extractMPF(imageArrayBuffer, extractFII = true, extractNonFII = true) {
	const dataView = new DataView(imageArrayBuffer);
	// If you're executing this line on a big endian machine, it'll be reversed.
	// bigEnd further down though, refers to the endianness of the image itself.
	if (dataView.getUint16(0) !== 0xffd8) {
		return;
	}

	const length = dataView.byteLength;
	let offset = 2;
	let loops = 0;
	let marker; // APP# marker

	while (offset < length) {
		if (++loops > 250) {
			return;
		}
		if (dataView.getUint8(offset) !== 0xff) {
			return;
		}
		marker = dataView.getUint8(offset + 1);

		if (marker === 0xe2) {
			const formatPt = offset + 4;
			if (dataView.getUint32(formatPt) === 0x4d504600) {
				const tiffOffset = formatPt + 4;
				let bigEnd;

				// Test for TIFF validity and endianness
				// 0x4949 and 0x4D4D ('II' and 'MM') marks Little Endian and Big Endian
				if (dataView.getUint16(tiffOffset) === 0x4949) {
					bigEnd = false;
				} else if (dataView.getUint16(tiffOffset) === 0x4d4d) {
					bigEnd = true;
				} else {
					return;
				}
				if (dataView.getUint16(tiffOffset + 2, !bigEnd) !== 0x002a) {
					return;
				}

				// 32 bit number stating the offset from the start of the 8 Byte MP Header
				// to MP Index IFD Least possible value is thus 8 (means 0 offset)
				const firstIFDOffset = dataView.getUint32(tiffOffset + 4, !bigEnd);

				if (firstIFDOffset < 0x00000008) {
					return;
				}

				const dirStart = tiffOffset + firstIFDOffset;
				const count = dataView.getUint16(dirStart, !bigEnd);
				const entriesStart = dirStart + 2;
				let numberOfImages = 0;
				for (let i = entriesStart; i < entriesStart + 12 * count; i += 12) {
					if (dataView.getUint16(i, !bigEnd) === 0xb001) {
						numberOfImages = dataView.getUint32(i + 8, !bigEnd);
					}
				}

				const nextIFDOffsetLen = 4;
				const MPImageListValPt = dirStart + 2 + count * 12 + nextIFDOffsetLen;
				const images = [];

				for (let i = MPImageListValPt; i < MPImageListValPt + numberOfImages * 16; i += 16) {
					const image = {
						MPType: dataView.getUint32(i, !bigEnd),
						size: dataView.getUint32(i + 4, !bigEnd),
						dataOffset: dataView.getUint32(i + 8, !bigEnd),
						dependantImages: dataView.getUint32(i + 12, !bigEnd),
						start: -1,
						end: -1,
						isFII: false,
					};

					if (!image.dataOffset) {
						image.start = 0;
						image.isFII = true;
					} else {
						image.start = tiffOffset + image.dataOffset;
						image.isFII = false;
					}
					image.end = image.start + image.size;
					images.push(image);
				}

				if (extractNonFII && images.length) {
					const bufferBlob = new Blob([dataView]);
					const imgs = [];
					for (const image of images) {
						if (image.isFII && !extractFII) {
							continue;
						}
						const imageBlob = bufferBlob.slice(image.start, image.end + 1, "image/jpeg");
						// we don't need this
						// const imageUrl = URL.createObjectURL(imageBlob)
						// image.img = document.createElement('img')
						// image.img.src = imageUrl
						console.log("imageBlob", imageBlob);

						imgs.push(imageBlob);
					}
					return imgs;
				}
			}
		}
		offset += 2 + dataView.getUint16(offset + 2);
	}
}
