import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const makepath = (appendix) => {
    return path.join(path.dirname(__dirname), "public", appendix);
}
export default makepath;
