export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            const result = typeof reader.result === 'string' ? reader.result : '';
            const [, base64 = ''] = result.split(',');

            if (!base64) {
                reject(new Error('FILE_TO_BASE64_FAILED'));
                return;
            }

            resolve(base64);
        };

        reader.onerror = () => {
            reject(new Error('FILE_TO_BASE64_FAILED'));
        };

        reader.readAsDataURL(file);
    });
}
