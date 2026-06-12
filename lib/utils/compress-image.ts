/**
 * Kompres gambar di sisi browser menggunakan Canvas API.
 * Target: ≤ 300 KB, max dimensi 1920px, output JPEG.
 * Jika file sudah kecil, dikembalikan apa adanya.
 */
export async function compressImage(
  file: File,
  maxSizeKB = 300,
  maxDimension = 1920
): Promise<File> {
  // Jika sudah cukup kecil, langsung kembalikan
  if (file.size <= maxSizeKB * 1024) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // Hitung dimensi baru (proporsi terjaga)
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, width, height);

      // Coba quality 0.8 dulu; kalau masih besar, turun ke 0.6
      const tryCompress = (quality: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            if (blob.size > maxSizeKB * 1024 && quality > 0.5) {
              tryCompress(quality - 0.2);
            } else {
              const outName = file.name.replace(/\.[^.]+$/, ".jpg");
              resolve(new File([blob], outName, { type: "image/jpeg" }));
            }
          },
          "image/jpeg",
          quality
        );
      };

      tryCompress(0.82);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file); // fallback: upload original
    };

    img.src = objectUrl;
  });
}
