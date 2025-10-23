import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
    
const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
  entry: './app.js', // file gốc của bạn
  output: {
    path: path.resolve(__dirname, 'public'),
    filename: 'bundle.js',
  },
  target: 'node',
  mode: 'development', // hoặc 'production'
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: { loader: 'babel-loader' },
      },
    ],
  },

};
