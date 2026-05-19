const path = require('path');

module.exports = {
  entry: {
    bundle:  './src/index.jsx',
    manager: './src/manager/index.jsx',
  },
  output: {
    path: path.resolve(__dirname, 'public/dist'),
    filename: '[name].js',
    publicPath: '/dist/',
  },
  target: 'web',
  devServer: {
    static: path.join(__dirname, 'public'),
    port: 3000,
    open: true,
    hot: true,
    devMiddleware: {
      publicPath: '/dist/',
    },
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: 'babel-loader',
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.json$/,
        type: 'json',
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
};
