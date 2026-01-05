import multer from 'multer';
import path from 'path';
import fs from 'fs';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists (middleware/../uploads -> server/uploads)
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (_req, _file, cb) {
        cb(null, uploadDir);
    },
    filename: function (_req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Allow images, audios, videos, PDFs, etc.
    // Common mappings:
    // audio/mpeg, audio/ogg, audio/mp4, audio/aac
    // video/mp4, video/mpeg
    // application/pdf
    // image/...

    // Simplistic regex for extensions
    const allowedExtensions = /jpeg|jpg|png|gif|webp|mp3|ogg|mp4|pdf|doc|docx|xls|xlsx|txt/;
    const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase().replace('.', ''));
    // mime type check is often safer but can be tricky with some audio types on some systems
    // relying on extension + basic mime group

    if (extname) {
        return cb(null, true);
    } else {
        cb(new Error('File type not allowed. Allowed: images, audio, video, pdf, docs.'));
    }
};

export const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: fileFilter
});
